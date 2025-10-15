import { normalizeRows } from "../../../backend/utils/turnsUtils.js";

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

async function addRow(tableName, rowData) {
  return await doAction(tableName, {
    Action: "Add",
    Properties: {},
    Rows: [rowData]
  });
}

async function findRows(tableName, filter) {
  return await doAction(tableName, {
    Action: "Find",
    Properties: {},
    Rows: [],
    Filter: filter
  });
}

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Manejar preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo aceptar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  console.log('💳 Reservar membresía request usando AppSheet:', {
    body: req.body
  });

  const { clientRowId, membershipKey, membershipNombre, membershipPrecio } = req.body;

  // Validar datos requeridos
  if (!clientRowId || !membershipKey) {
    return res.status(400).json({ 
      error: 'Faltan datos requeridos: clientRowId, membershipKey',
      ok: false
    });
  }

  try {
    // 1. Obtener información de la membresía desde AppSheet
    let membresiaNombre = membershipNombre;
    let membresiaPrecio = membershipPrecio;
    
    if (!membresiaNombre && membershipKey) {
      try {
        const membershipFilter = `([Row ID] = "${membershipKey}")`;
        const membershipResp = await findRows("Membresías", membershipFilter);
        const membershipRows = normalizeRows(membershipResp);
        if (membershipRows && membershipRows.length > 0) {
          const membership = membershipRows[0];
          membresiaNombre = membership["Nombre"] || membership.nombre || membership["Membresía"] || "";
          membresiaPrecio = membership["Valor"] || membership["Precio"] || membership.precio || "";
        }
      } catch (error) {
        console.warn('[DEBUG] No se pudo obtener información de la membresía:', error.message);
      }
    }

    // 2. Crear membresía activa en AppSheet según especificaciones exactas
    const membershipData = {
      "Membresía": membresiaNombre || "Membresía",
      "Cliente": clientRowId, // Row ID del cliente actual
      "Valor": membresiaPrecio || "",
      "Pago Confirmado": "No" // Inicialmente No
    };

    console.log('[DEBUG] Enviando a AppSheet tabla Membresías Activas:', membershipData);

    const response = await addRow("Membresías Activas", membershipData);
    
    console.log('[DEBUG] Respuesta de AppSheet:', response);

    if (response && !response.error) {
      const normalizedResponse = normalizeRows(response);
      const createdMembership = normalizedResponse?.[0] || membershipData;
      
      return res.status(201).json({
        ok: true,
        reserva: createdMembership,
        message: `Membresía ${membresiaNombre} reservada para cliente. Complete el pago para activarla.`
      });
    } else {
      console.error('[ERROR] Error de AppSheet:', response);
      return res.status(500).json({
        ok: false,
        error: 'Error al crear membresía en AppSheet',
        details: response?.error || 'Respuesta inesperada'
      });
    }

  } catch (error) {
    console.error('[ERROR] Error reservando membresía:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
}