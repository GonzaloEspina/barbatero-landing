import * as appsheet from "../services/appsheetService.js";
import { normalizeRows, extractTimeHHMM, parseFechaDMY, toISODate } from "../utils/turnsUtils.js";

const TURNOS_TABLE = "Turnos";
const DISPONIBILIDAD_TABLE = "Disponibilidad";

function normalizeToHM(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const cand = value.value ?? value.displayValue ?? value.text ?? JSON.stringify(value);
    return normalizeToHM(cand);
  }
  const s = String(value).replace(/\u00A0/g, " ").trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) {
    const hh = String(Number(m[1])).padStart(2, "0");
    const mm = m[2];
    return `${hh}:${mm}`;
  }
  return s;
}

export async function getDisponibilidad(req, res) {
  try {
    const numero = req.query.num ? Number(req.query.num) : null; // weekday num expected
    const fechaStr = req.query.fecha; // ISO yyyy-mm-dd
    let requestedDate = null;
    if (fechaStr) requestedDate = new Date(fechaStr + "T00:00:00");

    // leer Disponibilidad
    let dispResp = await appsheet.findRows(DISPONIBILIDAD_TABLE, `([Número] <> "")`);
    let dispRows = normalizeRows(dispResp);
    if (!dispRows || dispRows.length === 0) {
      const tmp = await appsheet.readRows(DISPONIBILIDAD_TABLE);
      dispRows = normalizeRows(tmp) || [];
    }

    // obtener horarios por número de día
    const disponibilidadMap = {};
    (dispRows||[]).forEach(r => {
      const num = String(r["Número"] ?? r.Numero ?? r.numero ?? "").trim();
      const raw = r["Horarios"] ?? r.Horarios ?? r.horarios ?? "";
      let arr = [];
      if (Array.isArray(raw)) arr = raw.map(x=>extractTimeHHMM(x));
      else arr = String(raw||"").split(",").map(x=>extractTimeHHMM(x)).filter(Boolean);
      disponibilidadMap[num] = Array.from(new Set(arr.filter(Boolean)));
    });

    // leer Cancelar Agenda
    let cancelResp = await appsheet.findRows("Cancelar Agenda", `([Cancelar] <> "")`);
    let cancelRows = normalizeRows(cancelResp);
    if (!cancelRows || cancelRows.length === 0) {
      const tmp = await appsheet.readRows("Cancelar Agenda");
      cancelRows = normalizeRows(tmp) || [];
    }

    // si no piden fecha específica, devolver la lista de horarios del numero
    if (!requestedDate) {
      const horarios = disponibilidadMap[String(numero)] || [];
      return res.status(200).json({ horarios });
    }

    // buscar turnos en la fecha (múltiples formatos dd/mm/yy etc handled by calendar endpoint ideally)
    const formatDMYY = d => {
      const dd = String(d.getUTCDate()).padStart(2,'0');
      const mm = String(d.getUTCMonth()+1).padStart(2,'0');
      const yy = String(d.getUTCFullYear()).slice(-2);
      return `${dd}/${mm}/${yy}`;
    };

    const fechaDMYY = formatDMYY(requestedDate);
    const filterTurnos = `([Fecha] = "${fechaDMYY}")`;
    let turnosResp = await appsheet.findRows(TURNOS_TABLE, filterTurnos);
    let turnosRows = normalizeRows(turnosResp) || [];

    // fallback read all and filter
    if (!turnosRows || turnosRows.length === 0) {
      const tmp = await appsheet.readRows(TURNOS_TABLE);
      turnosRows = normalizeRows(tmp) || [];
      turnosRows = turnosRows.filter(r => {
        const parsed = parseFechaDMY(r.Fecha);
        if (!parsed) return false;
        const iso = toISODate(parsed);
        return iso === toISODate(requestedDate);
      });
    }

    // occupied hours
    const occupied = (turnosRows||[]).flatMap(r => {
      const h = r.Hora ?? r['Hora'] ?? "";
      if (Array.isArray(h)) return h.map(normalizeToHM);
      return String(h||"").split(",").map(x=>normalizeToHM(x)).filter(Boolean);
    });

    const horariosDia = disponibilidadMap[String(numero)] || [];
    const available = horariosDia.filter(h => !occupied.includes(h));

    // comprobar Cancelar Agenda
    const reqISO = toISODate(requestedDate);
    const blockedByCancel = (cancelRows||[]).some(r => {
      const tipo = String(r.Cancelar ?? r["Cancelar"] ?? "").trim().toLowerCase();
      const diaRaw = r["Día"] ?? r["Dia"] ?? r.Dia;
      const diaDate = parseFechaDMY(diaRaw);
      if (diaDate && tipo.includes("un") && toISODate(diaDate) === reqISO) return true;
      const desdeDate = parseFechaDMY(r.Desde ?? r["Desde"]);
      const hastaDate = parseFechaDMY(r.Hasta ?? r["Hasta"]);
      if (desdeDate && hastaDate && requestedDate.getTime() >= desdeDate.getTime() && requestedDate.getTime() <= hastaDate.getTime()) return true;
      return false;
    });

    if (blockedByCancel) {
      return res.status(200).json({ horarios: [], message: "El día ingresado no está disponible, por favor pruebe ingresando otra fecha." });
    }

    return res.status(200).json({ horarios: available });
  } catch (err) {
    console.error("[getDisponibilidad] error:", err);
    return res.status(500).json({ message: "Error leyendo disponibilidad" });
  }
}

export async function getCalendarAvailability(req, res) {
  try {
    const start = req.query.start; // yyyy-mm-dd
    const end = req.query.end; // yyyy-mm-dd
    if (!start || !end) return res.status(400).json({ message: "start y end requeridos (yyyy-mm-dd)" });

    // build date list
    const from = new Date(start + "T00:00:00");
    const to = new Date(end + "T00:00:00");
    const dates = [];
    for (let d = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())); d <= to; d.setUTCDate(d.getUTCDate()+1)) {
      dates.push(new Date(d));
    }

    // --- Leer Disponibilidad (mapa numero -> horarios HH:MM) ---
    let dispResp = await appsheet.findRows(DISPONIBILIDAD_TABLE, `([Número] <> "")`);
    let dispRows = normalizeRows(dispResp);
    if (!dispRows || dispRows.length === 0) {
      const allDisp = await appsheet.readRows(DISPONIBILIDAD_TABLE);
      dispRows = normalizeRows(allDisp) || [];
    }
    const disponibilidadMap = {};
    (dispRows || []).forEach(r => {
      const key = String(r["Número"] ?? r.Numero ?? r.numero ?? "").trim();
      const raw = r["Horarios"] ?? r.Horarios ?? r.horarios ?? "";
      let arr = [];
      if (Array.isArray(raw)) arr = raw.map(x => extractTimeHHMM(x));
      else arr = String(raw || "").split(",").map(x => extractTimeHHMM(x)).filter(Boolean);
      disponibilidadMap[key] = Array.from(new Set(arr.filter(Boolean)));
    });

    // --- Leer Cancelar Agenda (fallback find -> read) ---
    let cancelResp = await appsheet.findRows("Cancelar Agenda", `([Cancelar] <> "")`);
    let cancelRows = normalizeRows(cancelResp);
    if (!cancelRows || cancelRows.length === 0) {
      const cr = await appsheet.readRows("Cancelar Agenda");
      cancelRows = normalizeRows(cr) || [];
    }

    // build multiple representations per date to match AppSheet formats (DD/MM/YY, MM/DD/YY, DD/MM/YYYY, MM/DD/YYYY, ISO)
    const formatDDMMYY = d => `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCFullYear()).slice(-2)}`;
    const formatMMDDYY = d => `${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCFullYear()).slice(-2)}`;
    const formatDDMMYYYY = d => `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
    const formatMMDDYYYY = d => `${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCDate()).padStart(2,'0')}/${d.getUTCFullYear()}`;
    const formatISO = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;

    const allDateStrings = [];
    dates.forEach(d => {
      allDateStrings.push(formatDDMMYY(d));
      allDateStrings.push(formatMMDDYY(d));
      allDateStrings.push(formatDDMMYYYY(d));
      allDateStrings.push(formatMMDDYYYY(d));
      allDateStrings.push(formatISO(d));
    });
    const uniqueDateStrings = Array.from(new Set(allDateStrings));
    const quoted = uniqueDateStrings.map(v => `"${v.replace(/"/g,'')}"`);
    const filterTurnos = `([Fecha] IN (${quoted.join(",")}))`;

    let turnosResp = await appsheet.findRows(TURNOS_TABLE, filterTurnos);
    let turnosRows = normalizeRows(turnosResp) || [];
    if (!turnosRows || turnosRows.length === 0) {
      const tmp = await appsheet.readRows(TURNOS_TABLE);
      turnosRows = normalizeRows(tmp) || [];
      // keep only relevant dates if readRows returned many
      turnosRows = turnosRows.filter(r => {
        const fechaParsed = parseFechaDMY(r.Fecha);
        if (!fechaParsed) return false;
        const iso = toISODate(fechaParsed);
        return dates.some(d=>toISODate(d)===iso);
      });
    }

    // group occupied hours per date ISO
    const occupiedByISO = {};
    (turnosRows || []).forEach(r => {
      const fechaParsed = parseFechaDMY(r.Fecha);
      if (!fechaParsed) return;
      const iso = toISODate(fechaParsed);
      let hrs = [];
      const hField = r.Hora ?? r['Hora'] ?? r.hora ?? "";
      if (Array.isArray(hField)) hrs = hField.map(x => normalizeToHM(x));
      else hrs = String(hField||"").split(",").map(x => normalizeToHM(x)).filter(Boolean);
      if (!occupiedByISO[iso]) occupiedByISO[iso] = new Set();
      hrs.forEach(h => { if (h) occupiedByISO[iso].add(h); });
    });

    // evaluate each date
    const weekdayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const result = dates.map(d => {
      const iso = formatISO(d);
      const numero = d.getUTCDay() + 1; // 1..7
      const numStr = String(numero);
      // 1) check disponibilidad by weekday
      const horariosDia = disponibilidadMap[numStr] || disponibilidadMap[String(numero-1)] || disponibilidadMap[weekdayNames[numero-1]] || disponibilidadMap[weekdayNames[numero-1].toLowerCase()] || [];
      const weekdayBlocked = horariosDia.length === 0;
      // 2) check Cancelar Agenda
      let blockedByCancel = false;
      for (const r of (cancelRows||[])) {
        const tipo = String(r.Cancelar ?? r["Cancelar"] ?? "").trim().toLowerCase();
        const diaRaw = r["Día"] ?? r["Dia"] ?? r.Dia;
        const diaDate = parseFechaDMY(diaRaw);
        if (diaDate && tipo.includes("un") && toISODate(diaDate) === iso) { blockedByCancel = true; break; }
        const desdeDate = parseFechaDMY(r.Desde ?? r["Desde"]);
        const hastaDate = parseFechaDMY(r.Hasta ?? r["Hasta"]);
        if (desdeDate && hastaDate && d.getTime() >= desdeDate.getTime() && d.getTime() <= hastaDate.getTime()) { blockedByCancel = true; break; }
      }
      // 3) occupied hours
      const occupiedSet = occupiedByISO[iso] || new Set();
      const horariosNormalized = (horariosDia || []).map(normalizeToHM);
      const availableHorarios = horariosNormalized.filter(h => !occupiedSet.has(h));
      const available = !weekdayBlocked && !blockedByCancel && availableHorarios.length > 0;
      return { iso, numero, blocked: weekdayBlocked || blockedByCancel ? true : false, weekdayBlocked, blockedByCancel, available, horarios: availableHorarios };
    });

    return res.status(200).json({ days: result });
  } catch (err) {
    console.error("[getCalendarAvailability] error:", err);
    return res.status(500).json({ message: "Error calculando disponibilidad del calendario" });
  }
}