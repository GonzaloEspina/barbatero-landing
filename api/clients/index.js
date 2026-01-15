// CLIENTS API - Consolidated endpoint for create and update operations
// Handles both POST (create) and PUT (update) requests

import { normalizeRows } from "../../backend/utils/turnsUtils.js";

// AppSheet service functions
async function doAction(tableName, body) {
  const BASE = process.env.APPSHEET_BASE_URL;
  const APP_KEY = process.env.APPSHEET_ACCESS_KEY;
  
  if (!BASE || !APP_KEY) {
    console.log("❌ Faltan variables de entorno para AppSheet");
    throw new Error("Missing AppSheet environment variables");
  }

  const url = `${BASE}/tables/${tableName}/Action`;
  const headers = {
    'Content-Type': 'application/json',
    ApplicationAccessKey: APP_KEY
  };

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

const CLIENTES_TABLE = "Clientes";

export default async function handler(req, res) {
  try {
    // CREATE CLIENT (POST)
    if (req.method === "POST") {
      const { nombre, telefono, correo } = req.body;
      
      if (!nombre || !telefono) {
        return res.status(400).json({ message: "Nombre y teléfono son requeridos" });
      }

      const payload = {
        Action: "Add",
        Properties: {},
        Rows: [{
          "Nombre y Apellido": nombre,
          "Teléfono": telefono,
          "Correo": correo || ""
        }]
      };

      const result = await doAction(CLIENTES_TABLE, payload);
      
      if (!result.ok) {
        console.error("Error creating client:", result.raw);
        return res.status(500).json({ message: "Error creando cliente" });
      }

      return res.status(201).json({ 
        ok: true, 
        message: "Cliente creado correctamente",
        client: result.data?.[0] || null
      });
    }

    // UPDATE CLIENT (PUT)
    else if (req.method === "PUT") {
      const clientData = req.body;
      const rowId = clientData["Row ID"];
      
      if (!rowId) {
        return res.status(400).json({ message: "Row ID es requerido para actualizar" });
      }

      const payload = {
        Action: "Edit",
        Properties: {},
        Rows: [clientData]
      };

      const result = await doAction(CLIENTES_TABLE, payload);
      
      if (!result.ok) {
        console.error("Error updating client:", result.raw);
        return res.status(500).json({ message: "Error actualizando cliente" });
      }

      return res.status(200).json({ 
        ok: true, 
        message: "Cliente actualizado correctamente",
        client: result.data?.[0] || clientData
      });
    }

    // METHOD NOT ALLOWED
    else {
      return res.status(405).json({ message: "Method not allowed" });
    }

  } catch (error) {
    console.error("Clients API error:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}