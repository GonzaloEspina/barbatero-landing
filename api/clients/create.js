function normalizeRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.rows && Array.isArray(data.rows)) return data.rows;
  if (data.Rows && Array.isArray(data.Rows)) return data.Rows;
  return [data];
}

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

function digitsOnly(v) {
  if (v === null || v === undefined) return "";
  return valueToString(v).replace(/\D/g, "");
}

function isEmail(str) {
  if (!str) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(str).trim());
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

    // campo único "Nombre y Apellido"
    const fullName = (payload["Nombre y Apellido"] ?? payload.Nombre ?? payload.name ?? "").toString().trim();
    const telefono = (payload["Teléfono"] ?? payload.Telefono ?? payload.telefono ?? payload.phone ?? "").toString().trim();
    const correo = (payload["Correo"] ?? payload.Correo ?? payload.correo ?? payload.email ?? "").toString().trim();

    if (!fullName) return res.status(400).json({ ok: false, message: "Faltan datos: Nombre y Apellido." });
    if (!telefono && !correo) return res.status(400).json({ ok: false, message: "Faltan datos: Teléfono o Correo." });

    // Configuración AppSheet
    const BASE = process.env.APPSHEET_BASE_URL;
    const APP_KEY = process.env.APPSHEET_ACCESS_KEY;

    async function doAction(tableName, body) {
      const url = `${BASE}/tables/${tableName}/Action`;
      const headers = { "Content-Type": "application/json" };
      if (APP_KEY) headers.ApplicationAccessKey = APP_KEY;
      
      const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      const raw = await resp.text().catch(() => "");
      
      try { 
        return raw ? JSON.parse(raw) : null; 
      } catch (err) { 
        return raw; 
      }
    }

    async function findRows(table, filter) {
      return await doAction(table, { 
        Action: "Find", 
        Properties: {}, 
        Rows: [], 
        Filter: filter || "" 
      });
    }

    async function readRows(tableName) {
      return await doAction(tableName, { 
        Action: "Read", 
        Properties: {}, 
        Rows: [] 
      });
    }

    // VALIDACIÓN DE DUPLICADOS usando exactamente la misma lógica de find-client.js
    console.log('[createClient] Starting duplicate validation...');
    
    let phoneExists = false;
    let emailExists = false;
    
    // Función auxiliar para escape de strings como en find-client.js
    const esc = v => String(v || "").replace(/"/g, '\\"');
    
    // Verificar teléfono si se proporcionó - usar la misma lógica exacta de find-client.js
    if (telefono) {
      console.log('[createClient] Checking phone:', telefono);
      
      try {
        let phoneRows = [];
        const digitsTarget = digitsOnly(telefono);
        const phoneCols = ['Teléfono','Telefono','Tel','phone','Phone','TelefonoContacto'];
        const phoneFilters = phoneCols.map(c => `([${c}] = "${esc(digitsTarget)}")`);
        
        // Intentar findRows primero
        try {
          const phoneResults = await findRows("Clientes", phoneFilters.join(" OR "));
          phoneRows = normalizeRows(phoneResults) || [];
          console.log('[createClient] findRows phone results:', phoneRows.length);
        } catch (e) {
          console.warn('[createClient] findRows phone failed, trying readRows fallback');
          phoneRows = [];
        }
        
        // Filtrado exacto como en find-client.js
        phoneRows = (phoneRows || []).filter(r => {
          const phoneRaw = r["Teléfono"] ?? r.Telefono ?? r.phone ?? r.Phone ?? "";
          const phoneStr = valueToString(phoneRaw).trim();
          const pd = digitsOnly(phoneRaw);
          
          // igualdad estricta con lo que envía el front
          if (phoneStr && phoneStr === telefono) {
            console.log('[createClient] ✅ Phone exact match:', phoneStr);
            return true;
          }
          // fallback: igualdad por dígitos
          if (pd && pd === digitsTarget) {
            console.log('[createClient] ✅ Phone digits match:', pd);
            return true;
          }
          return false;
        });
        
        // Fallback final: leer todo y filtrar localmente (como find-client.js)
        if (!phoneRows || phoneRows.length === 0) {
          console.log('[createClient] No phone results, trying fallback readRows');
          const all = await readRows("Clientes");
          const allRows = normalizeRows(all) || [];
          console.log('[createClient] fallback readRows count:', allRows.length);
          
          phoneRows = allRows.filter(r => {
            const phoneRaw = r["Teléfono"] ?? r.Telefono ?? r.phone ?? r.Phone ?? "";
            const phoneStr = valueToString(phoneRaw).trim();
            const pd = digitsOnly(phoneRaw);
            if (phoneStr && phoneStr === telefono) return true;
            if (pd && pd === digitsTarget) return true;
            return false;
          });
        }
        
        if (phoneRows.length > 0) {
          phoneExists = true;
          console.log('[createClient] Phone duplicate found:', phoneRows[0]["Nombre y Apellido"]);
        } else {
          console.log('[createClient] No phone duplicates found');
        }
      } catch (e) {
        console.error('[createClient] Error checking phone:', e);
      }
    }
    
    // Verificar correo si se proporcionó - usar la misma lógica exacta de find-client.js
    if (correo) {
      console.log('[createClient] Checking email:', correo);
      
      try {
        let emailRows = [];
        const filter = `([Correo] = "${esc(correo)}")`;
        
        // Intentar findRows primero
        try {
          const emailResults = await findRows("Clientes", filter);
          emailRows = normalizeRows(emailResults) || [];
          console.log('[createClient] findRows email results:', emailRows.length);
        } catch (e) {
          console.warn('[createClient] findRows email failed, trying readRows fallback');
          emailRows = [];
        }
        
        // Filtrado exacto como en find-client.js
        const emailLower = correo.toLowerCase();
        emailRows = (emailRows || []).filter(r => {
          const c = valueToString(r.Correo ?? r["Correo"] ?? r.email ?? r.Email ?? "").trim().toLowerCase();
          if (c === emailLower) {
            console.log('[createClient] ✅ Email exact match found:', c);
            return true;
          }
          return false;
        });
        
        // Fallback final: leer todo y filtrar localmente (como find-client.js)
        if (!emailRows || emailRows.length === 0) {
          console.log('[createClient] No email results, trying fallback readRows');
          const all = await readRows("Clientes");
          const allRows = normalizeRows(all) || [];
          console.log('[createClient] fallback readRows count:', allRows.length);
          
          emailRows = allRows.filter(r => {
            const c = valueToString(r.Correo ?? r["Correo"] ?? r.email ?? r.Email ?? "").trim().toLowerCase();
            if (c === emailLower) return true;
            return false;
          });
        }
        
        if (emailRows.length > 0) {
          emailExists = true;
          console.log('[createClient] Email duplicate found:', emailRows[0]["Nombre y Apellido"]);
        } else {
          console.log('[createClient] No email duplicates found');
        }
      } catch (e) {
        console.error('[createClient] Error checking email:', e);
      }
    }
    
    // Determinar mensaje de error basado en qué duplicados se encontraron
    if (phoneExists && emailExists) {
      return res.status(409).json({ 
        ok: false, 
        message: `El teléfono y correo ingresado ya están en uso, por favor ingrese otros datos.`,
        field: 'both'
      });
    } else if (phoneExists) {
      return res.status(409).json({ 
        ok: false, 
        message: `Este teléfono ya está en uso, por favor ingrese otro número.`,
        field: 'telefono'
      });
    } else if (emailExists) {
      return res.status(409).json({ 
        ok: false, 
        message: `Este correo ya está en uso, por favor ingrese otro correo.`,
        field: 'correo'
      });
    }
    
    console.log('[createClient] No duplicates found, proceeding with creation');

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
      "¿Puede sacar múltiples turnos?": "No"
    };

    const addedRaw = await addRow("Clientes", row);
    const created = normalizeRows(addedRaw) || [];
    const client = (created && created[0]) ? created[0] : row;
    
    return res.status(201).json({ 
      ok: true, 
      client, 
      raw: addedRaw,
      upcoming: [], 
      memberships: [] 
    });

  } catch (err) {
    console.error("[createClient] error:", err);
    return res.status(500).json({ 
      ok: false, 
      message: "Error interno al crear cliente."
    });
  }
}