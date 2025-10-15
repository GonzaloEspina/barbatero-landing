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
    // 1. Obtener información completa del cliente
    let clienteNombre = clienteName || "";
    if (!clienteNombre && clienteRowId) {
      try {
        const clienteFilter = `([Row ID] = "${clienteRowId}")`;
        const clienteResp = await findRows("Clientes", clienteFilter);
        const clienteRows = normalizeRows(clienteResp);
        if (clienteRows && clienteRows.length > 0) {
          const cliente = clienteRows[0];
          clienteNombre = cliente["Nombre y Apellido"] || cliente["Nombre"] || cliente["Nombre Completo"] || "";
        }
      } catch (error) {
        console.warn('[DEBUG] No se pudo obtener nombre del cliente:', error.message);
      }
    }

    // 2. Obtener valor del servicio
    let valorServicio = "";
    try {
      const servicioFilter = `([Servicio] = "${Servicio}")`;
      const servicioResp = await findRows("Servicios", servicioFilter);
      const servicioRows = normalizeRows(servicioResp);
      if (servicioRows && servicioRows.length > 0) {
        const servicio = servicioRows[0];
        valorServicio = servicio["Precio"] || servicio["Valor"] || "";
      }
    } catch (error) {
      console.warn('[DEBUG] No se pudo obtener precio del servicio:', error.message);
    }

    // 3. Verificar membresía activa (siempre validar, ignorar lo que venga del frontend)
    let membershipIdFinal = null;
    if (clienteRowId) {
      try {
        // Buscar todas las membresías del cliente para verificar manualmente el estado
        const membershipFilter = `([Cliente] = "${clienteRowId}")`;
        const membershipResp = await findRows("Membresías Activas", membershipFilter);
        const membershipRows = normalizeRows(membershipResp);
        
        console.log('[DEBUG] Todas las membresías del cliente:', membershipRows?.map(m => ({
          rowId: m["Row ID"],
          estado: m["Estado"],
          pagoConfirmado: m["Pago Confirmado"],
          vencimiento: m["Vencimiento"]
        })));
        
        if (membershipRows && membershipRows.length > 0) {
          // Filtrar solo las que tienen estado "Activa" Y pertenecen al cliente actual
          const activeMemberships = membershipRows.filter(membership => {
            const estado = membership["Estado"] || "";
            const clienteMembership = membership["Cliente"] || "";
            const esActiva = estado === "Activa";
            const esDelClienteActual = clienteMembership === clienteRowId;
            
            console.log('[DEBUG] Evaluando membresía:', {
              rowId: membership["Row ID"],
              estado: estado,
              clienteMembership: clienteMembership,
              clienteRowId: clienteRowId,
              esActiva: esActiva,
              esDelClienteActual: esDelClienteActual,
              esValida: esActiva && esDelClienteActual
            });
            
            return esActiva && esDelClienteActual;
          });
          
          if (activeMemberships.length > 0) {
            const membership = activeMemberships[0]; // Tomar la primera activa
            membershipIdFinal = membership["Row ID"] || "";
            console.log('[DEBUG] Membresía ACTIVA del cliente actual encontrada y asignada:', membershipIdFinal);
          } else {
            console.log('[DEBUG] No se encontraron membresías ACTIVAS del cliente actual - NO se asignará membresía ID');
          }
        } else {
          console.log('[DEBUG] No se encontraron membresías para este cliente');
        }
      } catch (error) {
        console.warn('[DEBUG] Error verificando membresía activa:', error.message);
      }
    }

    // 4. Preparar datos completos para AppSheet según especificaciones
    const turnoData = {
      // Row ID => se deja en blanco, lo crea appsheet (no incluir en el payload)
      "Cliente": clienteNombre, // Nombre y Apellido 
      "Cliente ID": clienteRowId, // Row ID del cliente
      "Fecha": Fecha, // Fecha seleccionada
      "Hora": Hora, // Hora u horas seleccionadas
      "Servicio": Servicio, // Servicios seleccionados
      "Valor": valorServicio, // El valor del servicio seleccionado
      // Membresía ID => Si tiene una membresía activa, usar el Row ID de esa membresía, sino dejarlo en blanco
    };

    // Solo agregar Membresía ID si existe
    if (membershipIdFinal) {
      turnoData["Membresía ID"] = membershipIdFinal;
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