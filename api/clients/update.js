// api/clients/update.js - Actualizar cliente existente
function valueToString(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const cand = v.value ?? v.displayValue ?? v.text ?? v.label ?? null;
    if (cand === null || cand === undefined) {
      try { return String(v); } catch (e) { return ""; }
    }
    if (typeof cand === "object") return JSON.stringify(cand);
    return String(cand);
  }
  return String(v);
}

function normalizeRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.rows && Array.isArray(data.rows)) return data.rows;
  if (data.Rows && Array.isArray(data.Rows)) return data.Rows;
  return [data];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body || {};
    const rowId = payload["Row ID"] ?? payload.rowId ?? payload.RowID ?? payload.id ?? payload.idRow;
    
    if (!rowId) {
      return res.status(400).json({ ok: false, message: "Falta Row ID del cliente." });
    }

    const BASE = process.env.APPSHEET_BASE_URL;
    const APP_KEY = process.env.APPSHEET_ACCESS_KEY;
    const esc = v => String(v || "").replace(/"/g, '\\"');

    async function doAction(tableName, body) {
      const url = `${BASE}/tables/${encodeURIComponent(tableName)}/Action`;
      const headers = { "Content-Type": "application/json" };
      if (APP_KEY) headers.ApplicationAccessKey = APP_KEY;

      const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      const raw = await resp.text().catch(() => "");
      
      let json = null;
      try { json = raw ? JSON.parse(raw) : null; } 
      catch (err) { json = raw; }
      return json;
    }

    async function findRows(table, filter) {
      return await doAction(table, { Action: "Find", Properties: {}, Rows: [], Filter: filter || "" });
    }

    async function readRows(tableName) {
      return await doAction(tableName, { Action: "Read", Properties: {}, Rows: [] });
    }

    async function updateRow(table, rowObject) {
      return await doAction(table, { Action: "Edit", Properties: {}, Rows: [rowObject] });
    }

    // Obtener cliente actual
    let existing = null;
    try {
      const resp = await findRows("Clientes", `([Row ID] = "${esc(rowId)}")`);
      const rows = normalizeRows(resp) || [];
      existing = rows[0] || null;
    } catch (e) {
      const all = await readRows("Clientes");
      const rows = normalizeRows(all) || [];
      existing = rows.find(r => {
        const rid = valueToString(r["Row ID"] ?? r.RowID ?? "");
        return rid && rid === String(rowId);
      }) || null;
    }

    if (!existing) {
      return res.status(404).json({ ok: false, message: "Cliente no encontrado." });
    }

    // Normalizar teléfono para AppSheet: solo característica + número, sin espacios ni guiones
    function normalizePhone(phone) {
      if (!phone) return "";
      
      // Remover todos los caracteres no numéricos (espacios, guiones, paréntesis, etc.)
      let digits = phone.replace(/\D/g, "");
      
      // Devolver solo los dígitos limpios sin agregar prefijos
      return digits;
    }

    const existingTelefono = valueToString(existing?.["Teléfono"] ?? "").trim();
    const existingCorreo = valueToString(existing?.["Correo"] ?? "").trim();
    
    // Normalizar teléfono existente para comparaciones
    const existingTelefonoNormalized = normalizePhone(existingTelefono);

    // Valores del payload
    const telefonoProvided = "Teléfono" in payload || "Telefono" in payload || "telefono" in payload || "phone" in payload;
    const correoProvided = "Correo" in payload || "correo" in payload || "email" in payload;

    let telefono = telefonoProvided ? String(payload["Teléfono"] ?? payload.Telefono ?? payload.telefono ?? payload.phone ?? "").trim() : existingTelefono;
    const correo = correoProvided ? String(payload["Correo"] ?? payload.correo ?? payload.email ?? "").trim() : existingCorreo;

    // Normalizar teléfono si se proporciona
    if (telefonoProvided && telefono) {
      telefono = normalizePhone(telefono);
    }

    if (!telefono && !correo) {
      return res.status(400).json({ ok: false, message: "Debe tener al menos Teléfono o Correo." });
    }

    // TODO: Implementar validación de duplicados más adelante

    // Construir update
    const row = { "Row ID": rowId, "Teléfono": telefono, "Correo": correo };
    
    if (payload["Nombre y Apellido"] || payload.Nombre) {
      const fullName = (payload["Nombre y Apellido"] ?? payload.Nombre ?? "").toString().trim();
      if (fullName) row["Nombre y Apellido"] = fullName;
    }

    try {
      const updatedRaw = await updateRow("Clientes", row);
      
      // Verificar si AppSheet devolvió un error
      if (updatedRaw && typeof updatedRaw === 'object' && updatedRaw.status >= 400) {
        console.error('[updateClient] AppSheet error:', updatedRaw);
        
        // Extraer mensaje de error más específico
        let errorMessage = "Error al actualizar cliente en AppSheet";
        if (updatedRaw.detail) {
          // Extraer la parte relevante del error
          const match = updatedRaw.detail.match(/Invalid value for column (.+?): (.+?)(?:\n|$)/);
          if (match) {
            const [, column, value] = match;
            errorMessage = `Valor inválido para ${column}: "${value}". Verifique el formato.`;
          } else {
            errorMessage = updatedRaw.detail;
          }
        }
        
        return res.status(400).json({ 
          ok: false, 
          message: errorMessage,
          appsheetError: updatedRaw
        });
      }
      
      const updated = normalizeRows(updatedRaw) || [];
      const client = (updated && updated[0]) ? updated[0] : { ...existing, ...row };
      
      console.log('[updateClient] ✅ Client updated successfully');
      return res.status(200).json({ ok: true, client, raw: updatedRaw });
      
    } catch (updateError) {
      console.error('[updateClient] Update error:', updateError);
      return res.status(500).json({ 
        ok: false, 
        message: "Error de conexión al actualizar cliente: " + updateError.message
      });
    }

  } catch (err) {
    console.error("[updateClient] error:", err);
    return res.status(500).json({ ok: false, message: "Error interno al actualizar cliente." });
  }
}