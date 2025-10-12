import * as appsheet from "../services/appsheetService.js";
import { normalizeRows, extractClientRowId, extractTimeHHMM } from "../utils/turnsUtils.js";

const TURNOS_TABLE = "Turnos";
const SERVICIOS_TABLE = "Servicios";
const CLIENTES_TABLE = "Clientes";
const CANCELAR_TABLE = "Cancelar Agenda";

const pad2 = n => String(n).padStart(2, "0");
const safe = v => (v === null || v === undefined) ? "" : String(v).trim();
const safeLower = v => String(v || "").toLowerCase();

// helper: parsea formatos comunes y devuelve ISO YYYY-MM-DD o null
function parseFlexibleToISO(raw) {
  const v = safe(raw);
  if (!v) return null;
  // ya es ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // slash formato D/M/YY(YY) o M/D/YY(YY) - asumimos D/M/YY (argentina)
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let d = Number(m[1]), mo = Number(m[2]), yy = m[3];
    if (yy.length === 2) yy = String(Number(yy) < 70 ? 2000 + Number(yy) : 1900 + Number(yy));
    const yyyy = Number(yy);
    const dt = new Date(yyyy, mo - 1, d);
    if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    // si no válido, intentar swap (por si la entrada fuera MM/DD)
    const dt2 = new Date(yyyy, d - 1, mo);
    if (!isNaN(dt2.getTime())) return dt2.toISOString().slice(0, 10);
    return null;
  }
  // intentar parse nativo como fallback
  const dt = new Date(v);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
}

// helper: formatea a DD/MM/YY (usado en confirmarTurno)
function formatFechaDDMMAA(raw) {
  const iso = parseFlexibleToISO(raw);
  if (!iso) return String(raw || "");
  const [y,m,d] = iso.split("-");
  return `${pad2(Number(d))}/${pad2(Number(m))}/${String(y).slice(-2)}`;
}

// generar array de Dates inclusivo
function buildDateRangeDates(fromDate, toDate) {
  const out = [];
  const cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const end = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  while (cur <= end) {
    out.push(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate()));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/**
 * GET /api/turnos/calendar?start=...&end=...
 * Devuelve { days: [{ iso: "YYYY-MM-DD", horarios: ["10:00","11:00"], blocked: false, available: true }, ...] }
 */
export async function getCalendar(req, res) {
  try {
    const { start, end } = req.query;

    // parsear start/end usando parseFlexibleToISO -> Date de inicio/fin
    let startIso = parseFlexibleToISO(start) || null;
    let endIso = parseFlexibleToISO(end) || null;
    const today = new Date();
    let startDate = startIso ? new Date(startIso + "T00:00:00") : new Date();
    let endDate = endIso ? new Date(endIso + "T00:00:00") : new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());

    // construir rango de fechas
    const range = buildDateRangeDates(startDate, endDate);

    // leer turnos (intentando pedir solo columnas necesarias)
    let resp = null;
    try {
      const cols = ["Cliente", "Cliente ID", "Fecha", "Hora"];
      if (typeof appsheet.findRows === "function") {
        try {
          resp = await appsheet.findRows(TURNOS_TABLE, "TRUE", cols);
        } catch {
          resp = await appsheet.findRows(TURNOS_TABLE, "TRUE");
        }
      } else if (typeof appsheet.readRows === "function") {
        try {
          resp = await appsheet.readRows(TURNOS_TABLE, { columns: cols });
        } catch {
          resp = await appsheet.readRows(TURNOS_TABLE);
        }
      }
    } catch {
      resp = null;
    }

    const allRows = normalizeRows(resp) || [];

    // mapa fechaKey -> { horarios: Set, blocked: boolean }
    // fechaKey será preferentemente YYYY-MM-DD si la fecha es parseable por Date, sino el string raw trimmed
    const map = new Map();

    for (const r of allRows) {
      const fechaRaw = (r.Fecha ?? r.fecha ?? r.Date ?? "").toString().trim();
      if (!fechaRaw) continue;
      // usar parser flexible para obtener ISO (YYYY-MM-DD)
      const parsedIso = parseFlexibleToISO(fechaRaw);
      const key = parsedIso || fechaRaw;

      // extraer horas (puede ser "HH:MM:SS" o lista separada por coma)
      const horaRaw = safe(r.Hora || r.hora || "");
      const parts = String(horaRaw).split(",").map(p => p.trim()).filter(Boolean);
      for (const p of parts) {
        const hhmm = extractTimeHHMM(p) || (p.match(/^(\d{1,2}:\d{2})/) ? p.match(/^(\d{1,2}:\d{2})/)[1] : null);
        if (!hhmm) continue;
        if (!map.has(key)) map.set(key, { horarios: new Set(), blocked: false });
        map.get(key).horarios.add(hhmm);
      }

      // detectar bloqueo por columnas específicas (si existen)
      const bloqueadoVal = (safe(r.Bloqueado) || safe(r.Bloque) || safe(r.Estado) || "").toString().toLowerCase();
      if (bloqueadoVal.includes("si") || bloqueadoVal.includes("bloq") || bloqueadoVal.includes("bloque")) {
        if (!map.has(key)) map.set(key, { horarios: new Set(), blocked: true });
        else map.get(key).blocked = true;
      }
    }

    // construir respuesta por cada fecha en el rango (iso será YYYY-MM-DD)
    const days = range.map(d => {
      const iso = d.toISOString().slice(0, 10);
      const entry = map.get(iso) || { horarios: new Set(), blocked: false };
      const horarios = Array.from(entry.horarios).sort((a,b) => a.localeCompare(b));
      const blocked = !!entry.blocked;
      const available = !blocked && horarios.length > 0;
      return { iso, horarios, blocked, available };
    });

    return res.status(200).json({ days });
  } catch (e) {
    console.error("Error en getCalendar:", e);
    return res.status(500).json({ message: "Error generando calendario" });
  }
}

async function findClienteById(id) {
  if (!id) return null;
  const safeId = safe(id).replace(/"/g, '\\"');
  try {
    let resp = await appsheet.findRows(CLIENTES_TABLE, `([Row ID] = "${safeId}")`);
    let rows = normalizeRows(resp) || [];
    if (rows.length) return rows[0];
    if (typeof appsheet.readRows === "function") {
      const all = await appsheet.readRows(CLIENTES_TABLE);
      if (!all) return null; // <-- proteger contra body vacío
      const allRows = normalizeRows(all) || [];
      return allRows.find(r => {
        const rid = safe(r["Row ID"] ?? r["RowID"] ?? r._RowNumber ?? r._RowKey);
        return rid === safeId;
      }) || null;
    }
    return null;
  } catch {
    return null;
  }
}

async function findClienteByName(name) {
  if (!name) return null;
  const safeName = safe(name).replace(/"/g, '\\"');
  try {
    let resp = await appsheet.findRows(CLIENTES_TABLE, `([Nombre y Apellido] = "${safeName}")`);
    let rows = normalizeRows(resp) || [];
    if (rows.length) return rows[0];
    if (typeof appsheet.readRows === "function") {
      const all = await appsheet.readRows(CLIENTES_TABLE);
      if (!all) return null; // <-- proteger contra body vacío
      const allRows = normalizeRows(all) || [];
      return allRows.find(r => safe(r["Nombre y Apellido"] ?? r.Nombre) === safe(name)) || null;
    }
    return null;
  } catch {
    return null;
  }
}

// --- nuevo: buscar cliente por correo (primero) o teléfono (fallback) ---
async function findClienteByContact(contact) {
  if (!contact) return null;
  const sc = safe(contact);
  const scEsc = sc.replace(/"/g, '\\"');
  const scLower = sc.toLowerCase();
  try {
    // buscar primero por Correo exacto con findRows (si devuelve algo, validar que el correo coincida)
    let resp = await appsheet.findRows(CLIENTES_TABLE, `([Correo] = "${scEsc}")`);
    let rows = normalizeRows(resp) || [];
    if (rows.length) {
      const candidate = rows[0];
      if (safeLower(candidate["Correo"]) === scLower) return candidate;
      // si findRows devolvió algo pero el correo no coincide (posible incoherencia), ignorar y seguir
    }

    // si findRows no devolvió match exacto, leer todas y comparar case-insensitive
    if (typeof appsheet.readRows === "function") {
      const all = await appsheet.readRows(CLIENTES_TABLE);
      if (!all) return null; // <-- proteger contra body vacío
      const allRows = normalizeRows(all) || [];
      const match = allRows.find(r => safeLower(r["Correo"]) === scLower);
      if (match) return match;
      // fallback por teléfono si no hay match por correo
      return allRows.find(r => safe(r["Teléfono"]) === sc) || null;
    }

    // si no hay readRows y findRows no encontró por correo, intentar teléfono con findRows (validando también)
    resp = await appsheet.findRows(CLIENTES_TABLE, `([Teléfono] = "${scEsc}")`);
    rows = normalizeRows(resp) || [];
    if (rows.length) {
      const candidate = rows[0];
      if (safe(candidate["Teléfono"]) === sc) return candidate;
    }

    return null;
  } catch {
    return null;
  }
}

export async function createTurno(req, res) {
  try {
    const { contacto, clienteRowId, Fecha, Hora, Servicio, clienteName } = req.body;
    if (!Fecha || !Hora || (!clienteRowId && !clienteName && !contacto)) {
      return res.status(400).json({ message: "Faltan datos requeridos (Fecha, Hora y clienteRowId o clienteName o contacto)." });
    }

    // Ya no se formatea la Fecha; se envía tal cual viene desde el frontend
    const fechaForSheet = String(Fecha).trim();

    // normalizar hora a HH:MM:SS; soportar múltiples separadas por coma
    const hmRaw = String(Hora || "").trim();
    const horaGuardar = (() => {
      const parts = hmRaw.split(",").map(p => p.trim()).filter(Boolean);
      const norm = parts.map(h => {
        const m = String(h).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        return m ? `${String(Number(m[1])).padStart(2,'0')}:${m[2]}:00` : h;
      });
      return norm.join(", ");
    })();

    // resolver clienteId y nombre antes de armar newRow (igual que antes)
    const clienteIdRaw = clienteRowId ? String(clienteRowId).trim() : "";
    let clienteIdNormalized = clienteIdRaw;
    let clienteNombre = clienteName ? safe(clienteName) : "";

    if (!clienteNombre && clienteIdRaw) {
      const byId = await findClienteById(clienteIdRaw).catch(() => null);
      if (byId) {
        clienteNombre = safe(byId["Nombre y Apellido"] ?? byId.Nombre ?? byId["Nombre"]);
      }
    }

    if ((!clienteIdNormalized || !clienteNombre) && contacto) {
      const byContact = await findClienteByContact(contacto).catch(() => null);
      if (byContact) {
        clienteIdNormalized = clienteIdNormalized || safe(byContact["Row ID"] ?? byContact["RowID"] ?? extractClientRowId(byContact));
        clienteNombre = clienteNombre || safe(byContact["Nombre y Apellido"] ?? byContact.Nombre ?? byContact["Nombre"]);
      }
    }

    const servicioId = safe(Servicio);

    const newRow = {
      "Cliente": clienteNombre,
      "Cliente ID": clienteIdNormalized,
      "Fecha": fechaForSheet,
      "Hora": horaGuardar,
      "Servicio": servicioId
    };

    delete newRow["Row ID"];
    delete newRow["RowID"];
    delete newRow["_RowNumber"];
    delete newRow["_RowKey"];

    if (!appsheet || typeof appsheet.addRow !== "function") {
      return res.status(500).json({ message: "Servicio de datos no disponible" });
    }

    const created = await appsheet.addRow(TURNOS_TABLE, newRow);
    if (created) return res.status(201).json({ created: true, turno: created });

    return res.status(502).json({ message: "No se pudo crear turno en AppSheet (addRow devolvió vacío).", newRow });

  } catch (e) {
    console.error("Error en createTurno:", e);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
}

// --- confirmarTurno (nuevo) ---
export async function confirmarTurno(req, res) {
  try {
    const { turnoId, fecha, hora, servicio } = req.body;
    if (!turnoId || !fecha || !hora) {
      return res.status(400).json({ message: "Faltan datos requeridos (turnoId, fecha y hora)." });
    }

    const esc = v => String(v || "").replace(/"/g, '\\"');
    const safeTurnoId = esc(turnoId);
    const safeFecha = esc(formatFechaDDMMAA(fecha));
    const safeHora = esc(safe(hora));
    const safeServicio = esc(servicio);

    const filter = `([Row ID] = "${safeTurnoId}")`;

    // Buscar el turno por ID
    let resp = await appsheet.findRows(TURNOS_TABLE, filter);
    let rows = normalizeRows(resp) || [];
    if (rows.length === 0) {
      return res.status(404).json({ message: "Turno no encontrado." });
    }

    const turno = rows[0];

    // Confirmar que la fecha, hora y servicio coinciden
    const fechaHoraServicioCoinciden = (
      safe(turno.Fecha) === safeFecha &&
      safe(turno.Hora) === safeHora &&
      safe(turno.Servicio) === safeServicio
    );

    if (!fechaHoraServicioCoinciden) {
      return res.status(400).json({ message: "Los datos del turno no coinciden con los proporcionados." });
    }

    // --- aquí se podría agregar lógica adicional para la confirmación ---
    // Por ejemplo marcar una columna "Confirmado" en AppSheet (opcional, comentar si no aplica).
    try {
      const rowId = turno["Row ID"] ?? turno["RowID"] ?? turno._RowNumber ?? turno._rowNumber ?? null;
      if (rowId && typeof appsheet.updateRow === "function") {
        // intentar marcar como confirmado (no bloquear si falla)
        await appsheet.updateRow(TURNOS_TABLE, rowId, { Confirmado: true });
      }
    } catch {
      // ignorar fallos no críticos al intentar actualizar
    }

    // devolver confirmación y el registro del turno
    return res.status(200).json({ confirmed: true, turno });

  } catch (e) {
    console.error("Error en confirmarTurno:", e);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
}

export async function getServicios(req, res) {
  try {
    let resp = await appsheet.findRows(SERVICIOS_TABLE, `([Servicio] <> "")`);
    let rows = normalizeRows(resp) || [];
    if ((!rows || rows.length === 0) && typeof appsheet.readRows === "function") {
      const fallback = await appsheet.readRows(SERVICIOS_TABLE);
      rows = normalizeRows(fallback) || [];
    }
    return res.status(200).json(rows);
  } catch {
    return res.status(500).json({ message: "Error leyendo servicios" });
  }
}

// --- disponibilidad (nuevo) ---
export async function getDisponibilidad(req, res) {
  try {
    const { fecha } = req.query;
    if (!fecha) {
      return res.status(400).json({ message: "Falta el parámetro fecha." });
    }

    // parsear fecha usando parseFlexibleToISO -> ISO string (YYYY-MM-DD)
    const requestedIso = parseFlexibleToISO(fecha);
    if (!requestedIso) {
      return res.status(400).json({ message: "Fecha inválida." });
    }
    // Date objeto para formatos
    const requestedDate = new Date(requestedIso + "T00:00:00");

    // Preparar múltiples representaciones de la misma fecha para buscar robustamente en AppSheet
    const formatDDMMYY = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
    const formatMMDDYY = d => `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
    const formatDDMMYYYY = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const formatMMDDYYYY = d => `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
    const formatISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    const candidates = Array.from(new Set([
      formatDDMMYY(requestedDate),
      formatDDMMYYYY(requestedDate),
      formatMMDDYY(requestedDate),
      formatMMDDYYYY(requestedDate),
      formatISO(requestedDate)
    ]));
    const quoted = candidates.map(v => `"${String(v).replace(/"/g,"")}"`);
    const filterTurnos = `([Fecha] IN (${quoted.join(",")}))`;
    console.log("[getDisponibilidad] buscando turnos con fechas:", candidates);
    let turnosResp = await appsheet.findRows(TURNOS_TABLE, filterTurnos);
    let turnosRows = normalizeRows(turnosResp) || [];

    // buscar servicios (todas las filas donde Servicio no esté vacío)
    let serviciosResp = await appsheet.findRows(SERVICIOS_TABLE, `([Servicio] <> "")`);
    let serviciosRows = normalizeRows(serviciosResp) || [];

    // construir respuesta: por cada servicio, agregar disponibilidad
    const disponibilidad = serviciosRows.map(servicio => {
      const idServicio = safe(servicio.Servicio);

      // filtrar turnos que coincidan con el servicio (turnosRows ya fueron filtrados por fecha vía filterTurnos)
      const turnosDelServicio = turnosRows.filter(turno => {
        const servicioTurno = safe(turno.Servicio);
        return servicioTurno === idServicio;
      });

      // agrupar por hora normalizada (HH:MM)
      const agrupado = turnosDelServicio.reduce((acc, turno) => {
        const horaTurnoRaw = safe(turno.Hora);
        const hhmm = extractTimeHHMM(horaTurnoRaw) || (horaTurnoRaw.match(/^(\d{1,2}:\d{2})/) ? horaTurnoRaw.match(/^(\d{1,2}:\d{2})/)[1] : null);
        if (!hhmm) return acc;
        const key = hhmm;
        if (!acc[key]) acc[key] = { hora: hhmm, count: 0 };
        acc[key].count++;
        return acc;
      }, {});

      // convertir a array y ordenar por hora
      const horarios = Object.values(agrupado).sort((a, b) => a.hora.localeCompare(b.hora));

      return { servicio: idServicio, horarios };
    });

    return res.status(200).json(disponibilidad);
  } catch (e) {
    console.error("Error en getDisponibilidad:", e);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
}

// --- cancelarTurno (nuevo) ---
export async function cancelarTurno(req, res) {
  try {
    const { turnoId } = req.body;
    if (!turnoId) {
      return res.status(400).json({ message: "Falta el parámetro turnoId." });
    }

    const esc = v => String(v || "").replace(/"/g, '\\"');
    const safeTurnoId = esc(turnoId);

    const filter = `([Row ID] = "${safeTurnoId}")`;

    // Buscar el turno por ID
    let resp = await appsheet.findRows(TURNOS_TABLE, filter);
    let rows = normalizeRows(resp) || [];
    if (rows.length === 0) {
      return res.status(404).json({ message: "Turno no encontrado." });
    }

    const turno = rows[0];

    // Marcar como cancelado (opcional: se puede eliminar en lugar de marcar)
    try {
      const rowId = turno["Row ID"] ?? turno["RowID"] ?? turno._RowNumber ?? turno._rowNumber ?? null;
      if (rowId && typeof appsheet.updateRow === "function") {
        // intentar marcar como cancelado (no bloquear si falla)
        await appsheet.updateRow(TURNOS_TABLE, rowId, { Estado: "Cancelado" });
      }
    } catch {
      // ignorar fallos no críticos al intentar actualizar
    }

    // devolver confirmación y el registro del turno
    return res.status(200).json({ canceled: true, turno });

  } catch (e) {
    console.error("Error en cancelarTurno:", e);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
}
