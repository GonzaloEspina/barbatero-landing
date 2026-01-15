// TURNOS API - Consolidated endpoint for appointment operations
// Handles calendar, availability, find-client, and services operations

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
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn(`[doAction] Response not JSON:`, raw);
    parsed = null;
  }

  return { ok: resp.ok, status: resp.status, data: parsed, raw };
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { action } = req.query;

    // CALENDAR - Get appointments by date
    if (action === "calendar") {
      const { start, end, fecha } = req.query;
      
      // Support both date range and single date queries
      let filter;
      if (fecha) {
        filter = `([Fecha] = "${fecha}")`;
      } else if (start && end) {
        filter = `([Fecha] >= "${start}") AND ([Fecha] <= "${end}")`;
      } else {
        return res.status(400).json({ message: "Fecha o rango de fechas es requerido" });
      }

      const payload = {
        Action: "Find",
        Properties: {},
        Rows: [],
        Filter: filter
      };

      const result = await doAction("Turnos", payload);
      
      if (!result.ok) {
        console.error("Error getting calendar:", result.raw);
        return res.status(500).json({ message: "Error obteniendo calendario" });
      }

      return res.status(200).json({ 
        ok: true, 
        turnos: result.data || [] 
      });
    }

    // AVAILABILITY - Get available time slots
    else if (action === "availability") {
      const { fecha } = req.query;
      
      if (!fecha) {
        return res.status(400).json({ message: "Fecha es requerida" });
      }

      // Get existing appointments for the date
      const payload = {
        Action: "Find",
        Properties: {},
        Rows: [],
        Filter: `([Fecha] = "${fecha}")`
      };

      const result = await doAction("Turnos", payload);
      
      if (!result.ok) {
        console.error("Error getting availability:", result.raw);
        return res.status(500).json({ message: "Error obteniendo disponibilidad" });
      }

      // Generate available slots (simplified logic)
      const existingTurnos = result.data || [];
      const occupiedSlots = existingTurnos.map(t => t.Hora || t["Hora Virtual"] || t["Formato Hora"]);
      
      // Standard available slots (can be customized)
      const allSlots = [
        "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
        "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00",
        "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30"
      ];

      const availableSlots = allSlots.filter(slot => !occupiedSlots.includes(slot));

      return res.status(200).json({ 
        ok: true, 
        available: availableSlots,
        occupied: occupiedSlots
      });
    }

    // FIND CLIENT - Search for client by email
    else if (action === "find-client") {
      const { email, contacto } = req.query;
      const searchEmail = email || contacto;
      
      if (!searchEmail) {
        return res.status(400).json({ message: "Email es requerido" });
      }

      const payload = {
        Action: "Find",
        Properties: {},
        Rows: [],
        Filter: `([Correo] = "${searchEmail}")`
      };

      const result = await doAction("Clientes", payload);
      
      if (!result.ok) {
        console.error("Error finding client:", result.raw);
        return res.status(500).json({ message: "Error buscando cliente" });
      }

      const clients = result.data || [];
      if (clients.length === 0) {
        return res.status(200).json({ 
          found: false, 
          message: "Cliente no encontrado",
          contactType: /@/.test(searchEmail) ? "correo" : "teléfono"
        });
      }

      const client = clients[0];
      const clientId = client["Row ID"];

      // Get client's appointments
      const turnosPayload = {
        Action: "Find",
        Properties: {},
        Rows: [],
        Filter: `([Cliente ID] = "${clientId}")`
      };

      const turnosResult = await doAction("Turnos", turnosPayload);
      const turnos = turnosResult.ok ? turnosResult.data || [] : [];

      // Filter upcoming appointments
      const today = new Date();
      const upcoming = turnos.filter(turno => {
        try {
          const turnoDate = new Date(turno.Fecha);
          return turnoDate >= today;
        } catch {
          return false;
        }
      });

      // Get client's memberships
      const membershipsPayload = {
        Action: "Find",
        Properties: {},
        Rows: [],
        Filter: `([Cliente] = "${clientId}")`
      };

      const membershipsResult = await doAction("Membresías Activas", membershipsPayload);
      const memberships = membershipsResult.ok ? membershipsResult.data || [] : [];

      return res.status(200).json({
        found: true,
        client: normalizeRows([client])[0],
        upcoming: normalizeRows(upcoming),
        turnos: normalizeRows(turnos),
        memberships: normalizeRows(memberships)
      });
    }

    // SERVICES - Get available services
    else if (action === "services") {
      const payload = {
        Action: "Read",
        Properties: {},
        Rows: []
      };

      const result = await doAction("Servicios", payload);
      
      if (!result.ok) {
        console.error("Error getting services:", result.raw);
        return res.status(500).json({ message: "Error obteniendo servicios" });
      }

      return res.status(200).json({ 
        ok: true, 
        services: normalizeRows(result.data || [])
      });
    }

    // CREATE APPOINTMENT (POST)
    else if (req.method === "POST") {
      const appointmentData = req.body;
      
      if (!appointmentData.Cliente || !appointmentData.Fecha || !appointmentData.Hora) {
        return res.status(400).json({ 
          message: "Cliente, Fecha y Hora son requeridos" 
        });
      }

      const payload = {
        Action: "Add",
        Properties: {},
        Rows: [appointmentData]
      };

      const result = await doAction("Turnos", payload);
      
      if (!result.ok) {
        console.error("Error creating appointment:", result.raw);
        return res.status(500).json({ message: "Error creando turno" });
      }

      return res.status(201).json({ 
        ok: true, 
        message: "Turno creado correctamente",
        turno: result.data?.[0] || appointmentData
      });
    }

    // UNKNOWN ACTION
    else {
      return res.status(400).json({ message: "Acción no válida" });
    }

  } catch (error) {
    console.error("Turnos API error:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}