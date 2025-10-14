// Helper functions
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
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body || {};
    console.log('[createClient] Payload received:', payload);

    // Compatibilidad con ambos formatos: "Nombre y Apellido" unificado o separado
    let fullName = "";
    if (payload["Nombre y Apellido"]) {
      fullName = payload["Nombre y Apellido"].toString().trim();
    } else if (payload.Nombre || payload.nombre) {
      fullName = (payload.Nombre ?? payload.nombre ?? "").toString().trim();
      // Si hay apellido, combinarlo
      if (payload.Apellido || payload.apellido) {
        const apellido = (payload.Apellido ?? payload.apellido ?? "").toString().trim();
        if (apellido) fullName += " " + apellido;
      }
    } else if (payload.name) {
      fullName = payload.name.toString().trim();
    }

    // Normalizar teléfono para AppSheet: solo característica + número, sin espacios ni guiones
    function normalizePhone(phone) {
      if (!phone) return "";
      
      // Remover todos los caracteres no numéricos (espacios, guiones, paréntesis, etc.)
      let digits = phone.replace(/\D/g, "");
      
      // Devolver solo los dígitos limpios sin agregar prefijos
      return digits;
    }

    let telefono = (payload["Teléfono"] ?? payload.Telefono ?? payload.telefono ?? payload.phone ?? "").toString().trim();
    const correo = (payload["Correo"] ?? payload.Correo ?? payload.correo ?? payload.email ?? "").toString().trim();

    // Normalizar teléfono si se proporciona
    if (telefono) {
      const originalTelefono = telefono;
      telefono = normalizePhone(telefono);
      console.log('[createClient] Phone normalization:', { original: originalTelefono, normalized: telefono });
    }

    if (!fullName) {
      return res.status(400).json({ ok: false, message: "Faltan datos: Nombre y Apellido." });
    }
    if (!telefono && !correo) {
      return res.status(400).json({ ok: false, message: "Faltan datos: Teléfono o Correo." });
    }

    // Configuración AppSheet
    const BASE = process.env.APPSHEET_BASE_URL;
    const APP_KEY = process.env.APPSHEET_ACCESS_KEY;

    // Funciones auxiliares para validar duplicados
    async function doAction(tableName, body) {
      const url = `${BASE.replace(/\/$/, "")}/tables/${encodeURIComponent(tableName)}/Action`;
      const headers = { "Content-Type": "application/json" };
      if (APP_KEY) headers.ApplicationAccessKey = APP_KEY;
      
      const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      const raw = await resp.text().catch(() => "");
      
      let json = null;
      try { json = raw ? JSON.parse(raw) : null; } 
      catch (err) { json = raw; }
      return json;
    }

    async function readRows(tableName) {
      return await doAction(tableName, { Action: "Read", Properties: {}, Rows: [] });
    }

    // VALIDAR DUPLICADOS usando la misma lógica de find-client.js
    try {
      console.log('[createClient] Validating duplicates...');
      
      // Helper function from find-client.js
      function digitsOnly(v) {
        return String(v || "").replace(/\D/g, "");
      }
      
      const esc = v => String(v || "").replace(/"/g, '\\"');

      async function findRows(table, filter) {
        return await doAction(table, { Action: "Find", Properties: {}, Rows: [], Filter: filter || "" });
      }

      // Verificar duplicado de teléfono usando findRows como find-client.js
      if (telefono) {
        const digitsTarget = digitsOnly(telefono);
        const phoneCols = ['Teléfono','Telefono','Tel','phone','Phone'];
        const phoneFilters = phoneCols.map(c => `([${c}] = "${esc(digitsTarget)}")`);
        
        console.log('[createClient] Checking phone duplicates with filter:', phoneFilters.join(" OR "));
        
        try {
          const phoneResp = await findRows("Clientes", phoneFilters.join(" OR "));
          const phoneRows = normalizeRows(phoneResp) || [];
          
          if (phoneRows.length > 0) {
            return res.status(409).json({ 
              ok: false, 
              message: `Este teléfono ya está en uso, por favor ingrese otro teléfono.`,
              field: 'telefono'
            });
          }
        } catch (e) {
          console.warn('[createClient] findRows phone check failed, fallback to readRows');
          // Fallback como en find-client.js
          const allResp = await readRows("Clientes");
          const allRows = normalizeRows(allResp) || [];
          
          const duplicatePhone = allRows.find(c => {
            const clientPhone = valueToString(c["Teléfono"] ?? c.Telefono ?? "").trim();
            const clientDigits = digitsOnly(clientPhone);
            return clientDigits && clientDigits === digitsTarget;
          });
          
          if (duplicatePhone) {
            return res.status(409).json({ 
              ok: false, 
              message: `Este teléfono ya está en uso, por favor ingrese otro teléfono.`,
              field: 'telefono'
            });
          }
        }
      }

      // Verificar duplicado de correo usando findRows como find-client.js
      if (correo) {
        const emailFilter = `([Correo] = "${esc(correo)}")`;
        console.log('[createClient] Checking email duplicates with filter:', emailFilter);
        
        try {
          const emailResp = await findRows("Clientes", emailFilter);
          const emailRows = normalizeRows(emailResp) || [];
          
          if (emailRows.length > 0) {
            return res.status(409).json({ 
              ok: false, 
              message: `Este correo ya está en uso, por favor ingrese otro correo.`,
              field: 'correo'
            });
          }
        } catch (e) {
          console.warn('[createClient] findRows email check failed, fallback to readRows');
          // Fallback como en find-client.js
          const allResp = await readRows("Clientes");
          const allRows = normalizeRows(allResp) || [];
          
          const duplicateEmail = allRows.find(c => {
            const clientEmail = valueToString(c["Correo"] ?? c.Correo ?? "").trim().toLowerCase();
            return clientEmail && clientEmail === correo.toLowerCase();
          });
          
          if (duplicateEmail) {
            return res.status(409).json({ 
              ok: false, 
              message: `Este correo ya está en uso, por favor ingrese otro correo.`,
              field: 'correo'
            });
          }
        }
      }
      
      console.log('[createClient] ✅ No duplicates found, proceeding with creation');
      
    } catch (duplicateError) {
      console.warn('[createClient] Error checking duplicates:', duplicateError.message);
      // Continuar con la creación aunque falle la validación de duplicados
    }

    // Función addRow usando doAction
    async function addRow(table, rowObject) {
      return await doAction(table, {
        Action: "Add",
        Properties: {},
        Rows: [rowObject]
      });
    }

    // construir fila con los nombres EXACTOS de las columnas
    const row = {
      "Nombre y Apellido": fullName,
      "Teléfono": telefono,
      "Correo": correo,
      "¿Puede sacar múltiples turnos?": "No" // Por defecto No
    };

    console.log('[createClient] Creating client row:', row);

    try {
      const addedRaw = await addRow("Clientes", row);
      
      // Verificar si AppSheet devolvió un error
      if (addedRaw && typeof addedRaw === 'object' && addedRaw.status >= 400) {
        console.error('[createClient] AppSheet error:', addedRaw);
        
        // Extraer mensaje de error más específico
        let errorMessage = "Error al crear cliente en AppSheet";
        if (addedRaw.detail) {
          // Extraer la parte relevante del error
          const match = addedRaw.detail.match(/Invalid value for column (.+?): (.+?)(?:\n|$)/);
          if (match) {
            const [, column, value] = match;
            errorMessage = `Valor inválido para ${column}: "${value}". Verifique el formato.`;
          } else if (addedRaw.detail.includes('already exists') || addedRaw.detail.includes('duplicate')) {
            errorMessage = "Ya existe un cliente con estos datos. Verifique teléfono y correo.";
          } else {
            errorMessage = addedRaw.detail;
          }
        }
        
        return res.status(400).json({ 
          ok: false, 
          message: errorMessage,
          appsheetError: addedRaw
        });
      }
      
      const created = normalizeRows(addedRaw) || [];
      const client = (created && created[0]) ? created[0] : row;
      
      console.log('[createClient] ✅ Client created successfully:', client["Nombre y Apellido"]);
      
      return res.status(201).json({ 
        ok: true, 
        client, 
        raw: addedRaw,
        upcoming: [], // Nuevo cliente no tiene turnos
        memberships: [] // Nuevo cliente no tiene membresías
      });
    } catch (e) {
      console.error("[createClient] addRow error:", e);
      return res.status(500).json({ 
        ok: false, 
        message: "Error de conexión al crear cliente: " + e.message
      });
    }

  } catch (err) {
    console.error("[createClient] error:", err);
    return res.status(500).json({ 
      ok: false, 
      message: "Error interno al crear cliente."
    });
  }
}