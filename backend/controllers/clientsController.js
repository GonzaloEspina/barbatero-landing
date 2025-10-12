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

      // --- Nuevo: filtrar solo turnos desde hoy en adelante ---
      const pad2 = (n) => String(n).padStart(2, "0");
      const now = new Date();
      const todayIso = `${now.getUTCFullYear()}-${pad2(now.getUTCMonth()+1)}-${pad2(now.getUTCDate())}`;

      const isoCandidatesFromString = (s) => {
        if (!s) return [];
        const out = new Set();
        const str = String(s).trim();
        // 1) ISO explícito yyyy-mm-dd
        const mIso = str.match(/(\d{4}-\d{2}-\d{2})/);
        if (mIso) out.add(mIso[1]);
        // 2) buscar D/M/Y o M/D/Y variantes
        for (const m of str.matchAll(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g)) {
          let a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
          if (y < 100) y += 2000;
          // si a > 12 entonces a es día (D/M/Y)
          if (a > 12 && b <= 12) {
            out.add(new Date(Date.UTC(y, b - 1, a)).toISOString().slice(0,10));
          } else if (b > 12 && a <= 12) {
            // b es día -> M/D/Y interpretado como MDY
            out.add(new Date(Date.UTC(y, a - 1, b)).toISOString().slice(0,10));
          } else {
            // ambiguo -> preferir D/M/Y y también agregar MDY si distinto
            const d1 = new Date(Date.UTC(y, b - 1, a)).toISOString().slice(0,10); // D/M/Y
            out.add(d1);
            const d2 = new Date(Date.UTC(y, a - 1, b)).toISOString().slice(0,10); // M/D/Y
            if (d2 !== d1) out.add(d2);
          }
        }
        return Array.from(out);
      };

      // solo conservar turnos cuya fecha (cualquiera de las interpretaciones) sea >= todayIso
      upcoming = (turnosRows || []).filter(t => {
        const s = String(t.Fecha ?? t['Fecha'] ?? "");
        const candidates = isoCandidatesFromString(s);
        if (!candidates || candidates.length === 0) return false;
        return candidates.some(c => c >= todayIso);
      });
      console.log("[findClient] upcoming count after date filter (>=today):", upcoming.length);

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

// Agregar createClient minimal para que la ruta pueda importarla.
// Si querés, reemplazo este stub por la implementación completa de creación en AppSheet.
export async function createClient(req, res) {
  try {
    const payload = req.body || {};
    // Validación mínima
    if (!payload.Nombre && !payload.Telefono && !payload.Correo) {
      return res.status(400).json({ ok: false, message: "Faltan datos: Nombre, Teléfono o Correo." });
    }

    // Si tenés una función para crear filas en appsheet, usarla aquí.
    // Por ahora devolvemos el payload recibido como confirmación.
    console.log("[createClient] payload:", payload);
    return res.status(201).json({ ok: true, client: payload, message: "createClient: stub (implementar persistencia si hace falta)" });
  } catch (err) {
    console.error("[createClient] error:", err);
    return res.status(500).json({ ok: false, message: "Error al crear cliente." });
  }
}