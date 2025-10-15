import { normalizeRows } from "../../backend/utils/turnsUtils.js";

// AppSheet service functions
async function doAction(tableName, body) {
  const BASE = process.env.APPSHEET_BASE_URL;
  const APP_KEY = process.env.APPSHEET_ACCESS_KEY;
  
  const url = `${BASE}/tables/${tableName}/Action`;
  const headers = {
    'Content-Type': 'application/json'
  };
  if (APP_KEY) headers.ApplicationAccessKey = APP_KEY;

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  const raw = await resp.text();
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn("[AppSheet] response not JSON");
    return { error: raw };
  }
}

async function readRows(tableName) {
  return await doAction(tableName, {
    Action: "Read",
    Properties: {},
    Rows: []
  });
}

async function findRows(tableName, filter = "") {
  return await doAction(tableName, {
    Action: "Find",
    Properties: {},
    Rows: [],
    Filter: filter || `([Servicio] <> "")`
  });
}

export default async function handler(req, res) {
  console.log('🔧 Servicios request usando AppSheet...');

  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Intentar con findRows primero
    let serviciosResp = await findRows("Servicios", `([Servicio] <> "")`);
    let serviciosRows = normalizeRows(serviciosResp);
    
    // Si no funcionó, intentar con readRows
    if (!serviciosRows || serviciosRows.length === 0) {
      console.log('[DEBUG] findRows devolvió vacío, intentando readRows...');
      const readResp = await readRows("Servicios");
      serviciosRows = normalizeRows(readResp);
    }

    console.log('[DEBUG] Servicios encontrados:', serviciosRows?.length || 0);

    const servicios = (serviciosRows || []).map(row => ({
      "Row ID": row["Row ID"] || row["RowID"] || row._RowNumber || row.id,
      "Servicio": row["Servicio"] || row.servicio || row.Nombre || row.nombre,
      "Duración": row["Duración"] || row.duracion || row.Duracion,
      "Precio": row["Precio"] || row.precio
    })).filter(s => s.Servicio); // Filtrar solo los que tengan servicio definido

    console.log('[DEBUG] Servicios normalizados:', servicios);
    return res.json({ ok: true, servicios });
  } catch (error) {
    console.error('[ERROR] Error obteniendo servicios:', error);
    return res.status(500).json({ 
      error: 'Error obteniendo servicios',
      details: error.message,
      success: false 
    });
  }
}