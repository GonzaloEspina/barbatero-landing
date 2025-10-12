import * as appsheet from "../services/appsheetService.js";
import { isEmail } from "../utils/validation.js";
import { normalizeRows, extractClientRowId } from "../utils/turnsUtils.js";

const CLIENTES_TABLE = "Clientes";

// helper: extrae texto utilizable de un campo que puede ser string, number o objeto { value, displayValue, text, ... }
function valueToString(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const cand = v.value ?? v.displayValue ?? v.text ?? v.label ?? null;
    if (cand === null || cand === undefined) {
      try { return String(v); } catch (e) { return ""; }
    }
    if (typeof cand === "object") return JSON.stringify(cand);
    return String(cand);
  }
  return String(v);
}

// normaliza a solo dígitos
function digitsOnly(v) {
  if (v === null || v === undefined) return "";
  return valueToString(v).replace(/\D/g, "");
}

// prueba variantes comunes: igualdad, sufijo, y removiendo prefijos país/cero (54, 549, 0)
function phoneMatches(pd, target) {
  if (!pd || !target) return false;
  if (pd === target) return true;
  if (pd.endsWith(target) || target.endsWith(pd)) return true;
  const tryVariants = (t) => {
    if (!t) return false;
    const v1 = t.replace(/^54/, "");   // quitar +54
    const v2 = t.replace(/^549/, "");  // quitar +54 +9 mobile
    const v3 = t.replace(/^0+/, "");   // quitar ceros a la izquierda
    return [v1, v2, v3].some(x => x && (pd === x || pd.endsWith(x) || x.endsWith(pd)));
  };
  return tryVariants(target) || tryVariants(pd);
}

function rowContainsEmail(row, emailLower) {
  try {
    for (const key of Object.keys(row || {})) {
      const v = row[key];
      if (v === null || v === undefined) continue;
      const s = valueToString(v).trim().toLowerCase();
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
    if (!contacto) return res.status(400).json({ found: false, message: "Ingrese correo o teléfono." });

    const input = String(contacto).trim();
    const emailMode = isEmail(input);
    const esc = v => String(v || "").replace(/"/g, '\\"');

    // intentar búsqueda dirigida: si es email -> usar findRows por correo (más eficiente)
    // si es teléfono -> leer todo y filtrar localmente por dígitos (maneja +54, espacios, paréntesis, sufijos)
    let rows = [];
    if (emailMode) {
      const filter = `([Correo] = "${esc(input)}")`;
      try {
        const clientResp = await appsheet.findRows(CLIENTES_TABLE, filter);
        rows = normalizeRows(clientResp) || [];
      } catch (e) {
        console.warn("[findClient] findRows por email falló, intentar readRows", e?.message ?? e);
        const all = await appsheet.readRows(CLIENTES_TABLE);
        rows = normalizeRows(all) || [];
      }
    } else {
      // teléfono: intentar findRows por igualdad exacta en varias columnas (más confiable que readRows),
      // y sólo si eso falla hacer readRows
      const digitsTarget = digitsOnly(input);
      const escVal = v => String(v || "").replace(/"/g, '\\"');
      const phoneCols = ['Teléfono','Telefono','Tel','phone','Phone','TelefonoContacto'];
      const phoneFilters = phoneCols.map(c => `([${c}] = "${escVal(digitsTarget)}")`);
      try {
        const resp = await appsheet.findRows(CLIENTES_TABLE, phoneFilters.join(" OR "));
        rows = normalizeRows(resp) || [];
        console.log("[findClient] findRows por teléfono count:", (rows || []).length);
      } catch (e) {
        console.warn("[findClient] findRows por teléfono falló, intentando readRows", e?.message ?? e);
        const all = await appsheet.readRows(CLIENTES_TABLE);
        rows = normalizeRows(all) || [];
      }
    }

    // filtrado robusto según modo (email: comparar case-insensitive en columnas; teléfono: normalizar dígitos)
    if (emailMode) {
      const emailLower = input.toLowerCase();
      rows = (rows || []).filter(r => {
        const c = valueToString(r.Correo ?? r["Correo"] ?? r.email ?? r.Email ?? "").trim().toLowerCase();
        if (c === emailLower) return true;
        return rowContainsEmail(r, emailLower);
      });
    } else {
      // comparación: primero intentar igualdad exacta sobre el campo tal como está en la DB,
      // luego comparar por dígitos (por si hay caracteres invisibles). Añadir logs para depuración.
      const digitsTarget = digitsOnly(input);
      console.log("[findClient] phone search target (input):", input, "digitsTarget:", digitsTarget);
      // muestra sample de teléfonos leídos antes de filtrar
      try {
        console.log("[findClient] sample phones (raw):", (rows || []).slice(0,10).map(r => valueToString(r["Teléfono"] ?? r.Telefono ?? r.phone ?? r.Phone ?? "")));
        console.log("[findClient] sample phones (digits):", (rows || []).slice(0,10).map(r => digitsOnly(r["Teléfono"] ?? r.Telefono ?? r.phone ?? r.Phone ?? "")));
      } catch(e) { /* ignore logging errors */ }

      rows = (rows || []).filter(r => {
        const phoneRaw = r["Teléfono"] ?? r.Telefono ?? r.phone ?? r.Phone ?? "";
        const phoneStr = valueToString(phoneRaw).trim();
        const pd = digitsOnly(phoneRaw);
        // igualdad estricta con lo que envía el front (sin modificaciones)
        if (phoneStr && phoneStr === input) return true;
        // fallback: igualdad por dígitos
        if (pd && pd === digitsTarget) return true;
        return false;
      });
    }

    // fallback: leer todo y filtrar localmente si no encontramos nada
    if (!rows || rows.length === 0) {
      const all = await appsheet.readRows(CLIENTES_TABLE);
      const allRows = normalizeRows(all) || [];
      if (emailMode) {
        const emailLower = input.toLowerCase();
        rows = allRows.filter(r => {
          const c = valueToString(r.Correo ?? r["Correo"] ?? r.email ?? r.Email ?? "").trim().toLowerCase();
          if (c === emailLower) return true;
          return rowContainsEmail(r, emailLower);
        });
      } else {
        // fallback: intentar igualdad directa sobre el campo y luego por dígitos; loguear sample
        const digitsTarget = digitsOnly(input);
        console.log("[findClient] fallback readRows phone target:", input, digitsTarget);
        console.log("[findClient] fallback sample phones (raw):", allRows.slice(0,10).map(r => valueToString(r["Teléfono"] ?? r.Telefono ?? r.phone ?? r.Phone ?? "")));
        rows = allRows.filter(r => {
          const phoneRaw = r["Teléfono"] ?? r.Telefono ?? r.phone ?? r.Phone ?? "";
          const phoneStr = valueToString(phoneRaw).trim();
          const pd = digitsOnly(phoneRaw);
          if (phoneStr && phoneStr === input) return true;
          if (pd && pd === digitsTarget) return true;
          return false;
        });
      }
      console.log("[findClient] fallback readRows clientes count:", allRows.length);
    }

    if (!rows || rows.length === 0) return res.status(200).json({ found: false, message: "No se encontró cliente con ese contacto." });

    const client = rows[0];
    const clientRowId = extractClientRowId(client);

    // obtener turnos del cliente (filtrado localmente por seguridad)
    let upcoming = [];
    try {
      const filterTurnos = clientRowId ? `([Cliente ID] = "${String(clientRowId).replace(/"/g,'\\"')}")` : null;
      let turnosResp = filterTurnos ? await appsheet.findRows("Turnos", filterTurnos) : await appsheet.readRows("Turnos");
      let turnosRows = normalizeRows(turnosResp) || [];

      // Mostrar algunos Cliente ID encontrados en turnos para debug
      const distinctClienteIds = Array.from(new Set((turnosRows || []).map(t => String(t["Cliente ID"] ?? t["ClienteID"] ?? t.Cliente ?? "").trim()).filter(Boolean)));
      console.log("[findClient] distinct cliente IDs in turnos (sample):", distinctClienteIds.slice(0,20));

      if (clientRowId) {
        const cid = String(clientRowId).trim();
        const matched = (turnosRows || []).filter(t => {
          const tid = String(t["Cliente ID"] ?? t["ClienteID"] ?? t["Cliente Id"] ?? t["Cliente"] ?? t.Cliente ?? "").trim();
          if (tid === cid) return true;
          if (String(t["Cliente Key"] ?? t["Cliente_Key"] ?? t["ClienteId"] ?? "").trim() === cid) return true;
          for (const k of Object.keys(t || {})) {
            const v = t[k];
            if (v === null || v === undefined) continue;
            if (String(v).trim() === cid) return true;
          }
          return false;
        });
        turnosRows = matched;
      } else {
        turnosRows = (turnosRows || []).filter(t => {
          const contactoTurno = String(t.Contacto ?? t["Contacto"] ?? "").trim().toLowerCase();
          if (contactoTurno && contactoTurno === input.toLowerCase()) return true;
          return rowContainsEmail(t, input.toLowerCase());
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