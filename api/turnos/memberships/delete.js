// DELETE /api/turnos/memberships/delete
// Elimina una membresía pendiente de confirmación

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
  if (req.method !== "DELETE") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { membershipRowId } = req.body;
    
    if (!membershipRowId) {
      return res.status(400).json({ message: "membershipRowId es requerido" });
    }

    console.log(`[DELETE membership] Eliminando membresía ID: ${membershipRowId}`);

    // Primero verificar que la membresía existe y está pendiente
    const readPayload = {
      Action: "Find",
      Properties: {},
      Rows: [],
      Filter: `([Row ID] = "${membershipRowId}")`
    };

    const readResult = await doAction(MEMBERSHIPS_TABLE, readPayload);
    
    if (!readResult.ok) {
      console.error(`Error verificando membresía: ${readResult.status}`);
      console.error("Response:", readResult.raw);
      return res.status(500).json({ message: "Error verificando membresía" });
    }

    console.log("[DELETE membership] Respuesta de verificación:", readResult.data);

    if (!readResult.data || !Array.isArray(readResult.data) || readResult.data.length === 0) {
      return res.status(404).json({ message: "Membresía no encontrada" });
    }

    // Buscar la membresía específica en los resultados
    const membership = readResult.data.find(m => m["Row ID"] === membershipRowId);
    
    if (!membership) {
      return res.status(404).json({ message: "Membresía no encontrada" });
    }

    console.log("[DELETE membership] Membresía encontrada:", membership);
    
    const estado = String(membership?.Estado ?? membership?.estado ?? "").trim();
    console.log("[DELETE membership] Estado de la membresía:", estado);
    
    if (estado !== "Pendiente de Confirmación") {
      return res.status(400).json({ message: "Solo se pueden eliminar membresías pendientes de confirmación" });
    }

    // Eliminar la membresía usando datos completos de la fila
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
        "Estado": membership["Estado"],
        "Related Turnos": membership["Related Turnos"] || ""
      }]
    };

    const deleteResult = await doAction(MEMBERSHIPS_TABLE, deletePayload);

    if (!deleteResult.ok) {
      console.error(`Error eliminando membresía: ${deleteResult.status}`);
      console.error("Error details:", deleteResult.raw);
      return res.status(500).json({ message: "Error eliminando membresía" });
    }

    console.log("[DELETE membership] Membresía eliminada exitosamente");
    
    return res.status(200).json({ 
      ok: true, 
      message: "Membresía eliminada correctamente" 
    });

  } catch (error) {
    console.error("[DELETE membership] Error:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}