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
    Filter: filter || `([Nombre] <> "")`
  });
}

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Manejar preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo aceptar GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  console.log('💳 Membresías request usando AppSheet...');

  try {
    // Intentar con findRows primero
    let membresiasResp = await findRows("Membresías", `([Nombre] <> "")`);
    let membresiasRows = normalizeRows(membresiasResp);
    
    // Si no funcionó, intentar con readRows
    if (!membresiasRows || membresiasRows.length === 0) {
      console.log('[DEBUG] findRows devolvió vacío, intentando readRows...');
      const readResp = await readRows("Membresías");
      membresiasRows = normalizeRows(readResp);
    }

    console.log('[DEBUG] Membresías encontradas:', membresiasRows?.length || 0);
    
    // Log completo de una membresía para ver qué campos están disponibles
    if (membresiasRows && membresiasRows.length > 0) {
      console.log('[DEBUG] Primera membresía completa:', membresiasRows[0]);
    }

    const memberships = (membresiasRows || []).map(row => ({
      "Row ID": row["Row ID"] || row["RowID"] || row._RowNumber || row.id,
      "key": row["Row ID"] || row["RowID"] || row._RowNumber || row.id, // Para compatibilidad con frontend
      "nombre": row["Nombre"] || row.nombre || row.Membresía || row.membresía,
      "membresia": row["Nombre"] || row.nombre || row.Membresía || row.membresía, // Alias para compatibilidad
      "descripcion": `Cantidad de turnos: ${row["Cantidad de Turnos"] || row["cantidad"] || "N/A"} - Válido por: ${row["Meses Activa"] || row["meses"] || "N/A"} meses - Valor: ${row["Valor"] || row["Precio"] || row.precio || "N/A"}`,
      "precio": row["Valor"] || row["Precio"] || row.precio || "",
      "beneficios": row["Beneficios"] || row.beneficios || [],
      "duracion": `${row["Meses Activa"] || row["meses"] || "N/A"} meses`,
      "cantidadTurnos": row["Cantidad de Turnos"] || row["cantidad"] || "",
      "mesesActiva": row["Meses Activa"] || row["meses"] || "",
      "valor": row["Valor"] || row["Precio"] || row.precio || "", // Campo que espera el frontend
      "activa": true // Por defecto true para membresías disponibles
    })).filter(m => m.nombre); // Filtrar solo las que tengan nombre definido

    console.log('[DEBUG] Membresías normalizadas:', memberships);
    
    return res.status(200).json({
      memberships,
      message: `${memberships.length} membresías disponibles`
    });
  } catch (error) {
    console.error('[ERROR] Error obteniendo membresías:', error);
    return res.status(500).json({ 
      error: 'Error obteniendo membresías',
      details: error.message,
      success: false 
    });
  }
}