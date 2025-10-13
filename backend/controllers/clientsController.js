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

    // Si no encontramos ningún cliente: devolver info para que el front muestre formulario de registro
    if (!rows || rows.length === 0) {
      const contactType = emailMode ? "correo" : "teléfono";
      const prefill = emailMode ? { Correo: input } : { Telefono: input };
      const message = `No se encontró el ${contactType} ingresado, por favor complete sus datos para sacar un turno.`;
      return res.status(200).json({ found: false, contactType, prefill, message });
    }

    const client = rows[0];
    const clientRowId = extractClientRowId(client);

    // Normalizar correo: buscar entre varias columnas y asignar sólo si es email válido.
    // Si no hay email válido, dejar vacío y limpiar otras posibles columnas de email
    const emailCols = ['Correo','Email','Mail','mail','correo','email'];
    let foundEmail = "";
    for (const col of emailCols) {
      const v = valueToString(client[col] ?? "");
      if (isEmail(v.trim())) { foundEmail = v.trim(); break; }
    }
    client.Correo = foundEmail || "";
    // limpiar duplicados/otras columnas para evitar que el front muestre el teléfono en ellas
    for (const col of emailCols) {
      if (col === 'Correo') continue;
      client[col] = client.Correo ? client.Correo : "";
    }

    // obtener turnos del cliente (filtrado localmente por seguridad)
    let upcoming = [];
    // declarar memberships en scope de la función para que esté disponible al final
    let memberships = [];
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

      try {
        // Buscar membresías por Cliente = Row ID. Hacer fallback a readRows y filtrado local
        memberships = [];
        console.log("[findClient] clientRowId:", clientRowId);
        if (clientRowId) {
          const esc = v => String(v || "").replace(/"/g, '\\"');
          const filter = `([Cliente] = "${esc(clientRowId)}")`;
          console.log("[findClient] fetching memberships with filter:", filter);
          let membRows = [];
          try {
            const membResp = await appsheet.findRows("Membresías Activas", filter);
            console.log("[findClient] Membresías Activas findRows raw:", membResp);
            membRows = normalizeRows(membResp) || [];
          } catch (err) {
            console.warn("[findClient] findRows Membresías Activas falló (no crítico):", err?.message ?? err);
          }

          // filtrar localmente por coincidencia exacta/contains en el campo Cliente
          const matchId = String(clientRowId).trim();
          let filtered = (membRows || []).filter(m => {
            const cli = valueToString(m["Cliente"] ?? m.Cliente ?? "").trim();
            return cli === matchId || cli.includes(matchId);
          });

          // si no encontramos nada con findRows, hacer readRows y filtrar localmente (más robusto)
          if (!filtered || filtered.length === 0) {
            try {
              const all = await appsheet.readRows("Membresías Activas");
              const allRows = normalizeRows(all) || [];
              filtered = (allRows || []).filter(m => {
                const cli = valueToString(m["Cliente"] ?? m.Cliente ?? "").trim();
                return cli === matchId || cli.includes(matchId);
              });
              console.log("[findClient] Membresías Activas readRows filtered count:", filtered.length);
            } catch (e) {
              console.warn("[findClient] readRows Membresías Activas falló:", e?.message ?? e);
              filtered = [];
            }
          }

          memberships = (filtered || []).map(m => ({
            "Row ID": valueToString(m["Row ID"] ?? m.RowID ?? m["RowID"] ?? ""),
            Membresía: valueToString(m["Membresía"] ?? m.Membresia ?? m["Membresía "] ?? ""),
            "Fecha de Inicio": valueToString(m["Fecha de Inicio"] ?? m.FechaInicio ?? ""),
            Vencimiento: valueToString(m["Vencimiento"] ?? m.Vencimiento ?? ""),
            "Turnos Restantes": valueToString(m["Turnos Restantes"] ?? m["Turnos Restantes "] ?? m.TurnosRestantes ?? ""),
            Estado: valueToString(m["Estado"] ?? m.Estado ?? "")
          }));
        }
      } catch (err2) {
        console.warn("[findClient] error procesando membresías:", err2?.message ?? err2);
        memberships = [];
      }
      console.log("[findClient] memberships count:", memberships.length);

    } catch (e) {
      console.error("[findClient] error obteniendo turnos:", e);
      upcoming = [];
    }

    return res.status(200).json({ found: true, client, upcoming, memberships });
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

    // campo único "Nombre y Apellido"
    const fullName = (payload["Nombre y Apellido"] ?? payload.Nombre ?? payload.name ?? "").toString().trim();
    const telefono = (payload["Teléfono"] ?? payload.Telefono ?? payload.telefono ?? payload.phone ?? "").toString().trim();
    const correo = (payload["Correo"] ?? payload.Correo ?? payload.correo ?? payload.email ?? "").toString().trim();

    if (!fullName) return res.status(400).json({ ok: false, message: "Faltan datos: Nombre y Apellido." });
    if (!telefono && !correo) return res.status(400).json({ ok: false, message: "Faltan datos: Teléfono o Correo." });

    // construir fila con los nombres EXACTOS de las columnas
    const row = {
      "Nombre y Apellido": fullName,
      "Teléfono": telefono,
      "Correo": correo,
      "¿Puede sacar múltiples turnos?": "No"
    };

    if (typeof appsheet.addRow === "function") {
      try {
        const addedRaw = await appsheet.addRow(CLIENTES_TABLE, row);
        const created = normalizeRows(addedRaw) || [];
        const client = (created && created[0]) ? created[0] : row;
        return res.status(201).json({ ok: true, client, raw: addedRaw });
      } catch (e) {
        console.error("[createClient] appsheet.addRow error:", e);
        return res.status(201).json({ ok: true, client: row, raw: null, message: "Cliente no persistido: addRow falló." });
      }
    }

    // fallback si addRow no está disponible
    console.warn("[createClient] appsheet.addRow no disponible");
    return res.status(201).json({ ok: true, client: row, raw: null, message: "Cliente no persistido (addRow no disponible)." });
  } catch (err) {
    console.error("[createClient] error:", err);
    return res.status(500).json({ ok: false, message: "Error al crear cliente." });
  }
}

// Nuevo endpoint: actualizar cliente
export async function updateClient(req, res) {
  try {
    const payload = req.body || {};
    const rowId = payload["Row ID"] ?? payload.rowId ?? payload.RowID ?? payload.id ?? payload.idRow;
    if (!rowId) return res.status(400).json({ ok: false, message: "Falta Row ID del cliente." });

    const esc = v => String(v || "").replace(/"/g, '\\"');

    // intentar obtener la fila actual para conocer valores previos
    let existing = null;
    try {
      const resp = await appsheet.findRows(CLIENTES_TABLE, `([Row ID] = "${esc(rowId)}")`);
      const rows = normalizeRows(resp) || [];
      existing = rows[0] || null;
    } catch (e) {
      console.warn("[updateClient] findRows falló, intentando readRows fallback", e?.message ?? e);
      const all = await appsheet.readRows(CLIENTES_TABLE);
      const rows = normalizeRows(all) || [];
      existing = rows.find(r => {
        const rid = valueToString(r["Row ID"] ?? r.RowID ?? r["RowID"] ?? r["Row Id"] ?? "");
        return rid && rid === String(rowId);
      }) || null;
    }

    const existingTelefono = valueToString(existing?.["Teléfono"] ?? existing?.Telefono ?? "").trim();
    const existingCorreo = valueToString(existing?.["Correo"] ?? existing?.Correo ?? "").trim();

    // valores enviados (pueden ser empty string -> significa borrar)
    const telefonoProvided = Object.prototype.hasOwnProperty.call(payload, "Teléfono") || Object.prototype.hasOwnProperty.call(payload, "Telefono") || Object.prototype.hasOwnProperty.call(payload, "telefono") || Object.prototype.hasOwnProperty.call(payload, "phone");
    const correoProvided = Object.prototype.hasOwnProperty.call(payload, "Correo") || Object.prototype.hasOwnProperty.call(payload, "correo") || Object.prototype.hasOwnProperty.call(payload, "email");

    const telefonoRaw = (payload["Teléfono"] ?? payload.Telefono ?? payload.telefono ?? payload.phone);
    const correoRaw = (payload["Correo"] ?? payload.correo ?? payload.email);

    const telefono = telefonoProvided ? String(telefonoRaw ?? "").trim() : existingTelefono;
    const correo = correoProvided ? String(correoRaw ?? "").trim() : existingCorreo;

    // requerir al menos uno no vacío después de la actualización
    if (!telefono && !correo) {
      return res.status(400).json({ ok: false, message: "Debe tener al menos Teléfono o Correo. No se permiten ambos vacíos." });
    }

    // construir objeto con Row ID y sólo las columnas que queremos actualizar (incluir claves aunque sean "")
    const row = { "Row ID": rowId };
    // incluir teléfono y correo explícitamente (si el front quiere mantener el existente, ya están en telefono/correo)
    row["Teléfono"] = telefono;
    row["Correo"] = correo;
    // si el payload trae nombre explícitamente lo podemos respetar (opcional)
    if (payload["Nombre y Apellido"] || payload.Nombre) {
      const fullName = (payload["Nombre y Apellido"] ?? payload.Nombre ?? "").toString().trim();
      if (fullName) row["Nombre y Apellido"] = fullName;
    }

    if (typeof appsheet.updateRow === "function") {
      try {
        const updatedRaw = await appsheet.updateRow(CLIENTES_TABLE, row);
        const created = normalizeRows(updatedRaw) || [];
        const client = (created && created[0]) ? created[0] : row;
        return res.status(200).json({ ok: true, client, raw: updatedRaw });
      } catch (e) {
        console.error("[updateClient] appsheet.updateRow error:", e);
        return res.status(500).json({ ok: false, message: "Error al actualizar cliente en AppSheet." });
      }
    }

    return res.status(500).json({ ok: false, message: "updateRow no está implementado en el servicio AppSheet." });
  } catch (err) {
    console.error("[updateClient] error:", err);
    return res.status(500).json({ ok: false, message: "Error interno al actualizar cliente." });
  }
}

// --- START: nuevas funciones para listar y reservar membresías ---
// formatea fecha dd/mm/yyyy
function fmtDDMMYYYY(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
function addMonths(d, months) {
  const dt = new Date(d);
  dt.setMonth(dt.getMonth() + Number(months || 0));
  return dt;
}

// Listar membresías (para que el front muestre Membresía | Cantidad de Turnos | Meses Activa | Valor)
export async function listMemberships(req, res) {
  try {
    const tryNames = ["Membresías", "Membresias", "Membresia", "Membresia ", "Membresias Activas", "Membresias"]; // variantes a probar
    let rows = [];
    let usedName = null;
    for (const name of tryNames) {
      try {
        console.log(`[listMemberships] intentando readRows tabla: "${name}"`);
        const resp = await appsheet.readRows(name);
        // mostrar tipo/preview para diagnosticar
        console.log(`[listMemberships] raw readRows response type: ${typeof resp}`);
        try { console.log(`[listMemberships] raw preview:`, Array.isArray(resp) ? resp.slice(0,3) : resp && resp.rows ? resp.rows.slice(0,3) : resp); } catch(e){/*ignore*/}

        const got = normalizeRows(resp) || [];
        console.log(`[listMemberships] readRows "${name}" returned count:`, got.length);
        if (got && got.length > 0) {
          rows = got;
          usedName = name;
          break;
        }
      } catch (err) {
        console.warn(`[listMemberships] readRows "${name}" falló:`, err?.message ?? err);
      }

      // intentar findRows(TRUE) como fallback
      try {
        console.log(`[listMemberships] intentando findRows tabla: "${name}" con filtro TRUE`);
        const resp2 = await appsheet.findRows(name, "TRUE");
        console.log(`[listMemberships] raw findRows response type: ${typeof resp2}`);
        const got2 = normalizeRows(resp2) || [];
        console.log(`[listMemberships] findRows "${name}" returned count:`, got2.length);
        if (got2 && got2.length > 0) {
          rows = got2;
          usedName = name;
          break;
        }
      } catch (err2) {
        console.warn(`[listMemberships] findRows "${name}" falló:`, err2?.message ?? err2);
      }
    }

    if ((!rows || rows.length === 0)) {
      console.warn("[listMemberships] No se obtuvieron filas de AppSheet con ninguna variante de nombre. Verificar: table name exacto, permisos API key y security filters.");
      return res.json({ ok: true, memberships: [] });
    }

    console.log("[listMemberships] usando tabla:", usedName, "filas:", rows.length);
    console.log("[listMemberships] sample rows keys:", Object.keys((rows[0]||{})).slice(0,20));

    const out = (rows || []).map(r => ({
      key: valueToString(r["Membresía"] ?? r.Membresia ?? r["Membresía "] ?? r["Row ID"] ?? r["RowID"] ?? ""),
      membresia: valueToString(r["Membresía"] ?? r.Membresia ?? r.Membresia ?? r["Membresía "] ?? ""),
      cantidadTurnos: valueToString(r["Cantidad de Turnos"] ?? r["Cantidad de Turnos "] ?? r.Cantidad ?? r.cantidad ?? ""),
      mesesActiva: valueToString(r["Meses Activa"] ?? r["Meses Activa "] ?? r.Meses ?? r.meses ?? ""),
      valor: valueToString(r["Valor"] ?? r.Valor ?? r.valor ?? "")
    }));

    return res.json({ ok: true, memberships: out });
  } catch (e) {
    console.error("[listMemberships] error inesperado:", e?.message ?? e);
    return res.status(500).json({ ok: false, memberships: [], message: "error interno" });
  }
}

// Reservar/crear una membresía activa.
// body: { clientRowId, membershipKey }
// importante: "Cliente" en la fila nueva quedará EXACTAMENTE igual a clientRowId
export async function reserveMembership(req, res) {
  try {
    const body = req.body || {};
    const clientRowId = String(body.clientRowId || body.clientId || "").trim();
    const membershipKey = String(body.membershipKey || "").trim();
    if (!clientRowId || !membershipKey) return res.status(400).json({ ok: false, message: "clientRowId y membershipKey requeridos." });

    // obtener datos de la membresía seleccionada
    let memb = null;
    try {
      const f = await appsheet.findRows("Membresías", `([Membresía] = "${String(membershipKey).replace(/"/g,'\\"')}")`);
      const fr = normalizeRows(f) || [];
      if (fr.length) memb = fr[0];
    } catch (e) { /* ignore */ }

    if (!memb) {
      const all = normalizeRows(await appsheet.readRows("Membresías")) || [];
      memb = all.find(r => valueToString(r["Membresía"] ?? r.Membresia ?? "") === membershipKey);
    }
    if (!memb) return res.status(404).json({ ok: false, message: "Membresía no encontrada." });

    // helper: ISO date YYYY-MM-DD
    function toISODate(d) {
      const dt = new Date(d);
      return dt.toISOString().slice(0, 10);
    }

    const today = new Date();
    const meses = Number(valueToString(memb["Meses Activa"] ?? memb["Meses Activa "] ?? memb.Meses ?? 2)) || 2;
    const inicioStr = toISODate(today);
    const vencimientoStr = toISODate(addMonths(today, meses));

    const cantidadTurnos = valueToString(memb["Cantidad de Turnos"] ?? memb.Cantidad ?? memb["Cantidad de Turnos "] ?? "");
    const valor = valueToString(memb["Valor"] ?? memb.Valor ?? memb.valor ?? "");

    const newRow = {
      "Membresía": membershipKey,
      "Cliente": clientRowId,
      "Valor": valor,
      "Pago Confirmado": "No",
      "Fecha de Inicio": inicioStr,
      "Vencimiento": vencimientoStr,
      "Turnos Restantes": cantidadTurnos
    };

    // crear fila
    if (typeof appsheet.addRow === "function") {
      await appsheet.addRow("Membresías Activas", newRow);
    } else if (typeof appsheet.createRow === "function") {
      await appsheet.createRow("Membresías Activas", newRow);
    } else if (typeof appsheet.postRow === "function") {
      await appsheet.postRow("Membresías Activas", newRow);
    } else {
      return res.status(500).json({ ok: false, message: "No hay helper para crear filas en AppSheet." });
    }

    return res.status(201).json({
      ok: true,
      message: "Membresía reservada. Pendiente de activación.",
      activeMembership: newRow
    });
  } catch (err) {
    console.error("[reserveMembership] error:", err?.message ?? err);
    return res.status(500).json({ ok: false, message: "Error reservando membresía." });
  }
}
// --- END: nuevas funciones ---