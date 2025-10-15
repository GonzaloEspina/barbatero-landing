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

    // campo único "Nombre y Apellido"
    const fullName = (payload["Nombre y Apellido"] ?? payload.Nombre ?? payload.name ?? "").toString().trim();
    const telefono = (payload["Teléfono"] ?? payload.Telefono ?? payload.telefono ?? payload.phone ?? "").toString().trim();
    const correo = (payload["Correo"] ?? payload.Correo ?? payload.correo ?? payload.email ?? "").toString().trim();

    if (!fullName) return res.status(400).json({ ok: false, message: "Faltan datos: Nombre y Apellido." });
    if (!telefono && !correo) return res.status(400).json({ ok: false, message: "Faltan datos: Teléfono o Correo." });

    // Configuración AppSheet
    const BASE = process.env.APPSHEET_BASE_URL;
    const APP_KEY = process.env.APPSHEET_ACCESS_KEY;

    async function addRow(table, rowObject) {
      const url = `${BASE}/tables/${table}/Action`;
      const headers = { "Content-Type": "application/json" };
      if (APP_KEY) headers.ApplicationAccessKey = APP_KEY;
      
      const body = {
        Action: "Add",
        Properties: {},
        Rows: [rowObject]
      };
      
      const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      const raw = await resp.text().catch(() => "");
      
      try { 
        return raw ? JSON.parse(raw) : null; 
      } catch (err) { 
        return raw; 
      }
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