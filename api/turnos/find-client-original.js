// Implementación basada en la versión original que funcionaba (commit bfcb105)

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

function isEmail(str) {
  if (!str) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(str).trim());
}

function digitsOnly(v) {
  if (v === null || v === undefined) return "";
  return valueToString(v).replace(/\D/g, "");
}

function rowContainsEmail(row, emailLower) {
  try {
    for (const key of Object.keys(row || {})) {
      const v = row[key];
      if (v === null || v === undefined) continue;
      const s = valueToString(v).trim().toLowerCase();
      if (s === emailLower) return true;
      if (s.includes(emailLower)) return true;
    }
  } catch (e) { /* ignore */ }
  return false;
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
    const { contacto } = req.body || {};
    console.log('🔍 ORIGINAL LOGIC - Searching for:', contacto);
    
    if (!contacto) {
      return res.status(400).json({ found: false, message: "Ingrese correo o teléfono." });
    }

    const input = String(contacto).trim();
    const emailMode = isEmail(input);
    
    console.log('📋 Search parameters:', { input, emailMode });

    // Configuración AppSheet
    const BASE = process.env.APPSHEET_BASE_URL;
    const APP_KEY = process.env.APPSHEET_ACCESS_KEY;
    
    console.log('🔧 AppSheet config:', { BASE, hasKey: !!APP_KEY });

    // Función doAction EXACTA del appsheetService.js original
    async function doAction(tableName, body) {
      const url = `${BASE}/tables/${encodeURIComponent(tableName)}/Action`;
      const headers = {
        "Content-Type": "application/json",
      };
      
      // Usar ApplicationAccessKey como en el original (no "ApplicationAccessKey")
      if (APP_KEY) headers.ApplicationAccessKey = APP_KEY;
      
      console.log("[AppSheet] POST", url, "body:", JSON.stringify(body));
      console.log("[AppSheet] request headers:", headers);

      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      // log response headers como el original
      try {
        const hdrs = {};
        resp.headers.forEach((v,k) => hdrs[k] = v);
        console.log("[AppSheet] response headers:", hdrs);
      } catch(e) { /* ignore */ }

      const raw = await resp.text().catch(() => "");
      console.log(`[AppSheet] response status ${resp.status} raw:`, raw);

      let json = null;
      try { 
        json = raw ? JSON.parse(raw) : null; 
      } catch (err) { 
        console.warn("[AppSheet] response not JSON");
        json = raw; 
      }

      return json;
    }

    // Funciones auxiliares del appsheetService.js original
    async function readRows(tableName) {
      const body = { Action: "Read", Properties: {}, Rows: [] };
      return await doAction(tableName, body);
    }

    async function findRows(table, filter) {
      const body = { Action: "Find", Properties: {}, Rows: [], Filter: filter || "" };
      return await doAction(table, body);
    }

    // LÓGICA EXACTA del clientsController.js original
    let rows = [];
    const CLIENTES_TABLE = "Clientes";
    const esc = v => String(v || "").replace(/"/g, '\\"');

    if (emailMode) {
      // Búsqueda por email usando findRows con Filter (como el original)
      const filter = `([Correo] = "${esc(input)}")`;
      console.log('[findClient] Searching by email with filter:', filter);
      
      try {
        const clientResp = await findRows(CLIENTES_TABLE, filter);
        rows = normalizeRows(clientResp) || [];
        console.log('[findClient] findRows por email results:', rows.length);
      } catch (e) {
        console.warn("[findClient] findRows por email falló, intentar readRows", e?.message ?? e);
        const all = await readRows(CLIENTES_TABLE);
        rows = normalizeRows(all) || [];
        console.log('[findClient] readRows fallback results:', rows.length);
      }
    } else {
      // Búsqueda por teléfono: intentar findRows con OR de columnas, fallback a readRows
      const digitsTarget = digitsOnly(input);
      const escVal = v => String(v || "").replace(/"/g, '\\"');
      const phoneCols = ['Teléfono','Telefono','Tel','phone','Phone','TelefonoContacto'];
      const phoneFilters = phoneCols.map(c => `([${c}] = "${escVal(digitsTarget)}")`);
      
      console.log('[findClient] Searching by phone with filters:', phoneFilters.join(" OR "));
      
      try {
        const resp = await findRows(CLIENTES_TABLE, phoneFilters.join(" OR "));
        rows = normalizeRows(resp) || [];
        console.log("[findClient] findRows por teléfono count:", (rows || []).length);
      } catch (e) {
        console.warn("[findClient] findRows por teléfono falló, intentando readRows", e?.message ?? e);
        const all = await readRows(CLIENTES_TABLE);
        rows = normalizeRows(all) || [];
        console.log("[findClient] readRows phone fallback results:", rows.length);
      }
    }

    // Filtrado robusto según modo (EXACTO del clientsController original)
    if (emailMode) {
      const emailLower = input.toLowerCase();
      rows = (rows || []).filter(r => {
        const c = valueToString(r.Correo ?? r["Correo"] ?? r.email ?? r.Email ?? "").trim().toLowerCase();
        if (c === emailLower) {
          console.log('[findClient] ✅ Email exact match found:', c);
          return true;
        }
        return rowContainsEmail(r, emailLower);
      });
    } else {
      // Filtrado por teléfono exacto del clientsController original
      const digitsTarget = digitsOnly(input);
      console.log("[findClient] phone search target (input):", input, "digitsTarget:", digitsTarget);
      
      // Log de muestra
      try {
        console.log("[findClient] sample phones (raw):", (rows || []).slice(0,10).map(r => valueToString(r["Teléfono"] ?? r.Telefono ?? r.phone ?? r.Phone ?? "")));
        console.log("[findClient] sample phones (digits):", (rows || []).slice(0,10).map(r => digitsOnly(r["Teléfono"] ?? r.Telefono ?? r.phone ?? r.Phone ?? "")));
      } catch(e) { /* ignore logging errors */ }

      rows = (rows || []).filter(r => {
        const phoneRaw = r["Teléfono"] ?? r.Telefono ?? r.phone ?? r.Phone ?? "";
        const phoneStr = valueToString(phoneRaw).trim();
        const pd = digitsOnly(phoneRaw);
        
        // igualdad estricta con lo que envía el front (sin modificaciones)
        if (phoneStr && phoneStr === input) {
          console.log('[findClient] ✅ Phone exact match:', phoneStr);
          return true;
        }
        // fallback: igualdad por dígitos
        if (pd && pd === digitsTarget) {
          console.log('[findClient] ✅ Phone digits match:', pd);
          return true;
        }
        return false;
      });
    }

    // Fallback final: leer todo y filtrar localmente (como el original)
    if (!rows || rows.length === 0) {
      console.log('[findClient] No results, trying fallback readRows');
      const all = await readRows(CLIENTES_TABLE);
      const allRows = normalizeRows(all) || [];
      console.log('[findClient] fallback readRows count:', allRows.length);
      
      if (emailMode) {
        const emailLower = input.toLowerCase();
        rows = allRows.filter(r => {
          const c = valueToString(r.Correo ?? r["Correo"] ?? r.email ?? r.Email ?? "").trim().toLowerCase();
          if (c === emailLower) return true;
          return rowContainsEmail(r, emailLower);
        });
      } else {
        const digitsTarget = digitsOnly(input);
        console.log("[findClient] fallback readRows phone target:", input, digitsTarget);
        rows = allRows.filter(r => {
          const phoneRaw = r["Teléfono"] ?? r.Telefono ?? r.phone ?? r.Phone ?? "";
          const phoneStr = valueToString(phoneRaw).trim();
          const pd = digitsOnly(phoneRaw);
          if (phoneStr && phoneStr === input) return true;
          if (pd && pd === digitsTarget) return true;
          return false;
        });
      }
    }

    console.log('🎯 Final filtered results:', rows.length);

    // Si no encontramos cliente
    if (!rows || rows.length === 0) {
      const contactType = emailMode ? "correo" : "teléfono";
      const prefill = emailMode ? { Correo: input } : { Telefono: input };
      const message = `No se encontró el ${contactType} ingresado, por favor complete sus datos para sacar un turno.`;
      return res.status(200).json({ found: false, contactType, prefill, message });
    }

    // Cliente encontrado
    const client = rows[0];
    console.log('🎉 SUCCESS! Client found:', client["Nombre y Apellido"] || client.Nombre);

    // Por ahora devolver sin turnos ni membresías (implementar después)
    return res.json({
      found: true,
      client,
      upcoming: [], // TODO: implementar búsqueda de turnos
      memberships: [] // TODO: implementar búsqueda de membresías
    });

  } catch (error) {
    console.error('💥 Error:', error);
    return res.status(500).json({
      found: false,
      message: "Error interno al buscar cliente.",
      error: error.message
    });
  }
}