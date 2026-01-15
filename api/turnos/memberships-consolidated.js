// MEMBERSHIPS API - Consolidated endpoint for all membership operations
// Handles GET (list), POST (reserve), DELETE (delete), and query operations

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

const MEMBERSHIPS_TABLE = "Membresías Activas";

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // LIST MEMBERSHIPS (GET)
    if (req.method === "GET") {
      const { action, clientId } = req.query;

      if (action === "findByClient" && clientId) {
        // Find memberships by client ID
        const payload = {
          Action: "Find",
          Properties: {},
          Rows: [],
          Filter: `([Cliente] = "${clientId}")`
        };

        const result = await doAction(MEMBERSHIPS_TABLE, payload);
        
        if (!result.ok) {
          console.error("Error finding memberships:", result.raw);
          return res.status(500).json({ message: "Error buscando membresías" });
        }

        return res.status(200).json({ 
          ok: true, 
          memberships: result.data || [] 
        });
      } else {
        // List all memberships
        const payload = {
          Action: "Read",
          Properties: {},
          Rows: []
        };

        const result = await doAction(MEMBERSHIPS_TABLE, payload);
        
        if (!result.ok) {
          console.error("Error reading memberships:", result.raw);
          return res.status(500).json({ message: "Error leyendo membresías" });
        }

        const normalized = normalizeRows(result.data || []);
        return res.status(200).json({ ok: true, memberships: normalized });
      }
    }

    // RESERVE MEMBERSHIP (POST)
    else if (req.method === "POST") {
      const { clientRowId, membershipValue = 48000 } = req.body;
      
      if (!clientRowId) {
        return res.status(400).json({ message: "clientRowId es requerido" });
      }

      // Check if client already has pending membership
      const checkPayload = {
        Action: "Find",
        Properties: {},
        Rows: [],
        Filter: `([Cliente] = "${clientRowId}")`
      };

      const checkResult = await doAction(MEMBERSHIPS_TABLE, checkPayload);
      
      if (checkResult.ok && checkResult.data?.length > 0) {
        const pendingMembership = checkResult.data.find(m => 
          m.Estado === "Pendiente de Confirmación"
        );
        
        if (pendingMembership) {
          return res.status(400).json({ 
            message: "Cliente ya tiene una membresía pendiente de confirmación" 
          });
        }
      }

      // Create new membership
      const currentDate = new Date();
      const startDate = currentDate.toLocaleDateString('en-US');
      const expiryDate = new Date(currentDate.getTime() + (60 * 24 * 60 * 60 * 1000))
        .toLocaleDateString('en-US');

      const membershipData = {
        "Membresía": "Membresía",
        "Cliente": clientRowId,
        "Valor": membershipValue.toString(),
        "Pago Confirmado": "No",
        "Fecha de Inicio": startDate,
        "Vencimiento": expiryDate,
        "Turnos Restantes": "4",
        "Estado": "Pendiente de Confirmación"
      };

      const addPayload = {
        Action: "Add",
        Properties: {},
        Rows: [membershipData]
      };

      const addResult = await doAction(MEMBERSHIPS_TABLE, addPayload);
      
      if (!addResult.ok) {
        console.error("Error creating membership:", addResult.raw);
        return res.status(500).json({ message: "Error creando membresía" });
      }

      return res.status(201).json({ 
        ok: true, 
        message: "Membresía reservada correctamente",
        membership: addResult.data?.[0] || membershipData
      });
    }

    // DELETE MEMBERSHIP (DELETE)
    else if (req.method === "DELETE") {
      const { membershipRowId } = req.body;
      
      if (!membershipRowId) {
        return res.status(400).json({ message: "membershipRowId es requerido" });
      }

      // First verify membership exists and is pending
      const readPayload = {
        Action: "Find",
        Properties: {},
        Rows: [],
        Filter: `([Row ID] = "${membershipRowId}")`
      };

      const readResult = await doAction(MEMBERSHIPS_TABLE, readPayload);
      
      if (!readResult.ok) {
        console.error(`Error verificando membresía: ${readResult.status}`);
        return res.status(500).json({ message: "Error verificando membresía" });
      }

      if (!readResult.data || !Array.isArray(readResult.data) || readResult.data.length === 0) {
        return res.status(404).json({ message: "Membresía no encontrada" });
      }

      // Find specific membership in results
      const membership = readResult.data.find(m => m["Row ID"] === membershipRowId);
      
      if (!membership) {
        return res.status(404).json({ message: "Membresía no encontrada" });
      }

      const estado = String(membership?.Estado ?? "").trim();
      
      if (estado !== "Pendiente de Confirmación") {
        return res.status(400).json({ 
          message: "Solo se pueden eliminar membresías pendientes de confirmación" 
        });
      }

      // Delete membership
      const deletePayload = {
        Action: "Delete",
        Properties: {},
        Rows: [{
          "Row ID": membership["Row ID"],
          "Membresía": membership["Membresía"],
          "Cliente": membership["Cliente"],
          "Valor": membership["Valor"],
          "Pago Confirmado": membership["Pago Confirmado"],
          "Fecha de Inicio": membership["Fecha de Inicio"],
          "Vencimiento": membership["Vencimiento"],
          "Turnos Restantes": membership["Turnos Restantes"],
          "Estado": membership["Estado"]
        }]
      };

      const deleteResult = await doAction(MEMBERSHIPS_TABLE, deletePayload);

      if (!deleteResult.ok) {
        console.error(`Error eliminando membresía: ${deleteResult.status}`);
        return res.status(500).json({ message: "Error eliminando membresía" });
      }

      return res.status(200).json({ 
        ok: true, 
        message: "Membresía eliminada correctamente" 
      });
    }

    // METHOD NOT ALLOWED
    else {
      return res.status(405).json({ message: "Method not allowed" });
    }

  } catch (error) {
    console.error("Memberships API error:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}