import * as appsheet from "../services/appsheetService.js";
import { isEmail } from "../utils/validation.js";
import { normalizeRows, extractClientRowId } from "../utils/turnsUtils.js";

const CLIENTES_TABLE = "Clientes";

function rowContainsEmail(row, emailLower) {
  try {
    for (const key of Object.keys(row || {})) {
      const v = row[key];
      if (!v && v !== 0) continue;
      const s = String(v).trim().toLowerCase();
      if (s === emailLower) return true;
      // allow cases where field contains the email (safer)
      if (s.includes(emailLower)) return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

export async function findClient(req, res) {
  try {
    const { contacto } = req.body;
    if (!contacto || !isEmail(contacto)) return res.status(400).json({ found: false, message: "Correo inválido." });

    const emailLower = String(contacto).trim().toLowerCase();

    // intento Find por correo (puede devolver array o objeto con Rows)
    const filter = `([Correo] = "${String(contacto).replace(/"/g,'\\"')}")`;
    let clientResp = await appsheet.findRows(CLIENTES_TABLE, filter);
    console.log("[findClient] appsheet.findRows response sample:", Array.isArray(clientResp) ? clientResp.slice(0,3) : clientResp?.Rows?.slice(0,3));
    let rows = normalizeRows(clientResp) || [];
    console.log("[findClient] rows after normalizeRows:", (rows || []).length);

    // filtrado robusto por email: si la columna exacta no existe, buscar en todas las columnas
    rows = (rows || []).filter(r => {
      const c = String(r.Correo ?? r["Correo"] ?? r.email ?? r.Email ?? "").trim().toLowerCase();
      if (c === emailLower) return true;
      return rowContainsEmail(r, emailLower);
    });

    // fallback: leer todo y filtrar localmente si no encontramos nada
    if (!rows || rows.length === 0) {
      const all = await appsheet.readRows(CLIENTES_TABLE);
      const allRows = normalizeRows(all) || [];
      console.log("[findClient] fallback readRows clientes count:", allRows.length);
      rows = allRows.filter(r => {
        const c = String(r.Correo ?? r["Correo"] ?? r.email ?? r.Email ?? "").trim().toLowerCase();
        if (c === emailLower) return true;
        return rowContainsEmail(r, emailLower);
      });
    }

    if (!rows || rows.length === 0) return res.status(200).json({ found: false, message: "No se encontró cliente con ese correo." });

    const client = rows[0];
    console.log("[findClient] selected client sample keys:", Object.keys(client).slice(0,8));
    const clientRowId = extractClientRowId(client);
    console.log("[findClient] clientRowId:", clientRowId);

    // obtener turnos del cliente (filtrado localmente por seguridad)
    let upcoming = [];
    try {
      const filterTurnos = clientRowId ? `([Cliente ID] = "${String(clientRowId).replace(/"/g,'\\"')}")` : null;
      let turnosResp = filterTurnos ? await appsheet.findRows("Turnos", filterTurnos) : await appsheet.readRows("Turnos");
      console.log("[findClient] turnosResp sample:", Array.isArray(turnosResp) ? turnosResp.slice(0,3) : turnosResp?.Rows?.slice(0,3));
      let turnosRows = normalizeRows(turnosResp) || [];
      console.log("[findClient] turnosRows count before filter:", turnosRows.length);

      // Mostrar algunos Cliente ID encontrados en turnos para debug
      const distinctClienteIds = Array.from(new Set((turnosRows || []).map(t => String(t["Cliente ID"] ?? t["ClienteID"] ?? t.Cliente ?? "").trim()).filter(Boolean)));
      console.log("[findClient] distinct cliente IDs in turnos (sample):", distinctClienteIds.slice(0,20));

      // Filtrado robusto: buscar clientRowId en cualquier campo de la fila del turno (puede almacenarse en distintas columnas)
      if (clientRowId) {
        const cid = String(clientRowId).trim();
        const matched = (turnosRows || []).filter(t => {
          // 1) coincidencia directa en campos comunes
          const tid = String(t["Cliente ID"] ?? t["ClienteID"] ?? t["Cliente Id"] ?? t["Cliente"] ?? t.Cliente ?? "").trim();
          if (tid === cid) return true;
          // 2) otras columnas que pueden contener la key
          if (String(t["Cliente Key"] ?? t["Cliente_Key"] ?? t["ClienteId"] ?? "").trim() === cid) return true;
          // 3) buscar exacto en cualquier campo (string equality)
          for (const k of Object.keys(t || {})) {
            const v = t[k];
            if (v === null || v === undefined) continue;
            if (String(v).trim() === cid) return true;
          }
          return false;
        });
        turnosRows = matched;
      } else {
        // si no hay clientRowId, intentar emparejar por contacto/email en turno
        turnosRows = (turnosRows || []).filter(t => {
          const contactoTurno = String(t.Contacto ?? t["Contacto"] ?? "").trim().toLowerCase();
          if (contactoTurno && contactoTurno === emailLower) return true;
          return rowContainsEmail(t, emailLower);
        });
      }

      upcoming = turnosRows;
      console.log("[findClient] upcoming count after filter:", upcoming.length);
    } catch (e) {
      console.error("[findClient] error obteniendo turnos:", e);
      upcoming = [];
    }

    return res.status(200).json({ found: true, client, upcoming });
  } catch (e) {
    console.error("[findClient] error:", e);
    return res.status(500).json({ found: false, message: "Error interno al buscar cliente." });
  }
}

export async function createClient(req, res) {
  try {
    const { correo, nombre, telefono } = req.body;
    if (!correo || !nombre) return res.status(400).json({ message: "correo y nombre son requeridos" });

    const newRow = {
      "Correo": String(correo).trim(),
      "Nombre y Apellido": String(nombre).trim(),
      "Teléfono": telefono ? String(telefono).trim() : ""
    };

    if (!appsheet || typeof appsheet.addRow !== "function") {
      console.error("[createClient] appsheet.addRow no disponible");
      return res.status(500).json({ message: "Servicio de datos no disponible" });
    }

    const created = await appsheet.addRow(CLIENTES_TABLE, newRow);
    return res.status(201).json({ created: true, client: created || newRow });
  } catch (err) {
    console.error("[createClient] error:", err);
    return res.status(500).json({ message: "Error creando cliente" });
  }
}