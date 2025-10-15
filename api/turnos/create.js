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

async function addRow(tableName, rowData) {
  return await doAction(tableName, {
    Action: "Add",
    Properties: {},
    Rows: [rowData]
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

  console.log('📝 Crear turno request usando AppSheet...', {
    body: req.body
  });

  const { 
    contacto,
    clienteRowId, 
    clienteName,
    Fecha, 
    Hora, 
    Servicio,
    "Membresía ID": membershipId
  } = req.body;

  // Validar datos requeridos (usando los nombres que envía el frontend)
  if (!clienteRowId || !Servicio || !Fecha || !Hora) {
    return res.status(400).json({ 
      error: 'Faltan datos requeridos: clienteRowId, Servicio, Fecha, Hora',
      received: { clienteRowId, Servicio, Fecha, Hora },
      success: false
    });
  }

  try {
    // Preparar datos para AppSheet (usar nombres de columnas exactos)
    const turnoData = {
      "Cliente ID": clienteRowId,
      "Fecha": Fecha,
      "Hora": Hora,
      "Servicio": Servicio
    };

    // Agregar Membresía ID si existe
    if (membershipId) {
      turnoData["Membresía ID"] = membershipId;
    }

    console.log('[DEBUG] Enviando a AppSheet tabla Turnos:', turnoData);

    // Crear turno en AppSheet
    const response = await addRow("Turnos", turnoData);
    
    console.log('[DEBUG] Respuesta de AppSheet:', response);

    if (response && !response.error) {
      const normalizedResponse = normalizeRows(response);
      return res.status(201).json({
        success: true,
        turno: normalizedResponse?.[0] || turnoData,
        message: `Turno creado para ${Fecha} a las ${Hora}`
      });
    } else {
      console.error('[ERROR] Error de AppSheet:', response);
      return res.status(500).json({
        success: false,
        error: 'Error al crear turno en AppSheet',
        details: response?.error || 'Respuesta inesperada'
      });
    }

  } catch (error) {
    console.error('[ERROR] Error creando turno:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
}