import * as appsheet from "../services/appsheetService.js";
import { normalizeRows, extractTimeHHMM, parseFechaDMY, toISODate } from "../utils/turnsUtils.js";

const TURNOS_TABLE = "Turnos";
const DISPONIBILIDAD_TABLE = "Disponibilidad";

// Añadido: definir una sola vez los nombres de los weekdays
const WEEKDAY_NAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

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
    const fechaStr = req.query.fecha; // esperar ISO yyyy-mm-dd
    const numParam = req.query.num ? Number(req.query.num) : null;

    // Leer Disponibilidad
    let dispResp = await appsheet.findRows(DISPONIBILIDAD_TABLE, `([Número] <> "")`);
    let dispRows = normalizeRows(dispResp) || [];
    if (!dispRows.length) dispRows = normalizeRows(await appsheet.readRows(DISPONIBILIDAD_TABLE)) || [];

    // construir map simple: clave = número 1..7 -> horarios normalizados HH:MM
    const disponibilidadMap = {};
    for (const r of (dispRows || [])) {
      const keyRaw = String(r["Número"] ?? r.Numero ?? r.numero ?? r["Día"] ?? r.Dia ?? "").trim();
      const raw = r["Horarios"] ?? r.Horarios ?? r.horarios ?? "";
      let arr = [];
      if (Array.isArray(raw)) arr = raw.map(x => normalizeToHM(x));
      else arr = String(raw || "").split(",").map(x => normalizeToHM(x)).filter(Boolean);
      const uniq = Array.from(new Set(arr.filter(Boolean)));

      // determinar números asociados (1..7)
      const nums = new Set();
      const n = Number(keyRaw);
      if (!isNaN(n)) {
        if (n >= 1 && n <= 7) nums.add(n);
        else if (n >= 0 && n <= 6) nums.add(n + 1);
      } else if (keyRaw) {
        const idx = WEEKDAY_NAMES.findIndex(w => w.toLowerCase() === keyRaw.toLowerCase());
        if (idx >= 0) nums.add(idx + 1);
      }

      for (const num of nums) {
        disponibilidadMap[String(num)] = uniq;
      }
    }

    // si no se pidió fecha, devolver la lista para num param (si existe)
    if (!fechaStr) {
      const horarios = disponibilidadMap[String(numParam)] || [];
      return res.status(200).json({ horarios });
    }

    // usar ISO (YYYY-MM-DD) string para evitar shifts por timezone
    const requestedISO = String(fechaStr || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedISO)) {
      return res.status(400).json({ message: "Fecha inválida. Usar yyyy-mm-dd" });
    }

    // Leer todos los turnos y filtrar localmente por la fecha solicitada (más robusto)
    console.log("[getDisponibilidad] filtrando turnos localmente por fecha solicitada (ISO):", requestedISO);
    // intentar readRows (puede devolver vacío si AppSheet no devuelve todo)
    const allTurnosResp = await appsheet.readRows(TURNOS_TABLE);
    let allTurnos = normalizeRows(allTurnosResp) || [];
    // si readRows no devolvió filas, hacer fallback con Find buscando variantes de la fecha
    if ((!allTurnos || allTurnos.length === 0)) {
      console.log("[getDisponibilidad] readRows devolvió vacío, intentando findRows por variantes de la fecha");
      const [ry, rm, rd] = requestedISO.split("-").map(n => Number(n));
      const d = new Date(Date.UTC(ry, rm - 1, rd));
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = d.getUTCFullYear();
      const yy = String(yyyy).slice(-2);
      const variants = [
        `${dd}/${mm}/${yy}`,
        `${mm}/${dd}/${yy}`,
        `${dd}/${mm}/${yyyy}`,
        `${mm}/${dd}/${yyyy}`,
        requestedISO
      ];
      const quoted = Array.from(new Set(variants)).map(v => `"${v}"`).join(",");
      const filter = `([Fecha] IN (${quoted}))`;
      console.log("[getDisponibilidad] findRows filter:", filter);
      const found = await appsheet.findRows(TURNOS_TABLE, filter);
      allTurnos = normalizeRows(found) || [];
      console.log("[getDisponibilidad] filas encontradas por findRows:", (allTurnos || []).length);
    }

    // helper: dado un string posible de fecha, devuelve uno o varios ISO YYYY-MM-DD candidatas
    const isoCandidatesFromString = (s) => {
      if (!s) return [];
      const out = new Set();
      const str = String(s).trim();

      // 1) preferir parseFechaDMY (si existe en utils)
      try {
        const p = parseFechaDMY(str);
        if (p && !isNaN(p.getTime())) out.add(toISODate(p));
      } catch (e) { /* ignore */ }

      // 2) ISO explícito
      const mIso = str.match(/(\d{4}-\d{2}-\d{2})/);
      if (mIso) out.add(mIso[1]);

      // 3) buscar todas las ocurrencias tipo D/M/Y (o M/D/Y) y disambiguar
      for (const m of str.matchAll(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g)) {
        let a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
        if (y < 100) y += 2000;
        // si uno de los dos > 12, podemos determinar cuál es día/mes
        if (a > 12 && b <= 12) {
          // a es día -> D/M/Y
          const d = new Date(Date.UTC(y, b - 1, a));
          out.add(toISODate(d));
        } else if (b > 12 && a <= 12) {
          // b es día -> M/D/Y (interpretar como MDY)
          const d = new Date(Date.UTC(y, a - 1, b));
          out.add(toISODate(d));
        } else {
          // ambiguo (ambos <=12) -> preferir DMY pero también agregar MDY si es distinto
          const d1 = new Date(Date.UTC(y, b - 1, a)); // D/M/Y
          out.add(toISODate(d1));
          const d2 = new Date(Date.UTC(y, a - 1, b)); // M/D/Y
          if (d2.getTime() !== d1.getTime()) out.add(toISODate(d2));
        }
      }

      return Array.from(out);
    };

    // filtrar filas de Turnos conservando solo las que coinciden en ISO (prueba varias interpretaciones)
    const turnosRows = (allTurnos || []).filter(r => {
      const s = String(r.Fecha ?? r['Fecha'] ?? "");
      const candidates = isoCandidatesFromString(s);
      if (!candidates || candidates.length === 0) return false;
      return candidates.includes(requestedISO);
    });
    console.log("[getDisponibilidad] turnos encontrados (filtrados):", turnosRows.length, " — sample fechas ISO encontradas (por fila):", turnosRows.slice(0,6).map(rr => isoCandidatesFromString(rr.Fecha)));

    // construir set de horas ocupadas (HH:MM) — buscar todas las apariciones HH:MM en la columna Hora
    const occupiedSet = new Set();
    (turnosRows || []).forEach((t) => {
      const hf = t.Hora ?? t['Hora'] ?? t.hora ?? "";
      if (hf === null || hf === undefined) return;
      if (Array.isArray(hf)) {
        hf.forEach(item => {
          const s = String(item || "");
          const matches = s.match(/\d{1,2}:\d{2}/g);
          if (matches) matches.forEach(m => occupiedSet.add(m.padStart(5, "0")));
        });
      } else {
        const s = String(hf);
        const matches = s.match(/\d{1,2}:\d{2}/g);
        if (matches) matches.forEach(m => occupiedSet.add(m.padStart(5, "0")));
      }
    });
    console.log("[getDisponibilidad] occupiedSet:", Array.from(occupiedSet).sort());

    // parsear requestedISO a Date UTC y obtener weekday (1..7) sin shifts de zona horaria
    const [ry, rm, rd] = requestedISO.split('-').map(n => Number(n));
    const requestedDateUTC = new Date(Date.UTC(ry, rm - 1, rd));
    const dayNum = requestedDateUTC.getUTCDay() + 1; // 1..7
    const horariosDia = disponibilidadMap[String(dayNum)] || [];

    // disponibles = horariosDia menos ocupados
    const available = horariosDia.filter(h => !occupiedSet.has(h));

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
      const keyRaw = String(r["Número"] ?? r.Numero ?? r.numero ?? r["Día"] ?? r.Dia ?? r.Dia ?? "").trim();
      const raw = r["Horarios"] ?? r.Horarios ?? r.horarios ?? "";
      let arr = [];
      if (Array.isArray(raw)) arr = raw.map(x => extractTimeHHMM(x));
      else arr = String(raw || "").split(",").map(x => extractTimeHHMM(x)).filter(Boolean);
      const uniq = Array.from(new Set(arr.filter(Boolean)));

      // generar múltiples claves posibles para esta fila
      const keys = new Set();
      if (keyRaw) {
        keys.add(keyRaw);
        const n = Number(keyRaw);
        if (!isNaN(n)) {
          // soportar convención 1..7 y 0..6
          keys.add(String(n));
          keys.add(String(n - 1));
          const idx = ((n - 1) + 7) % 7;
          keys.add(WEEKDAY_NAMES[idx]);
          keys.add(WEEKDAY_NAMES[idx].toLowerCase());
        } else {
          // si es nombre de weekday
          const idx = WEEKDAY_NAMES.findIndex(w => w.toLowerCase() === keyRaw.toLowerCase());
          if (idx >= 0) {
            keys.add(String(idx + 1));
            keys.add(String(idx));
            keys.add(WEEKDAY_NAMES[idx]);
            keys.add(WEEKDAY_NAMES[idx].toLowerCase());
          }
        }
      }

      // asignar same horarios a todas las claves detectadas
      if (keys.size === 0) {
        // fallback: guardar bajo clave vacía
        disponibilidadMap[""] = uniq;
      } else {
        for (const k of keys) disponibilidadMap[String(k)] = uniq;
      }
    });
    console.log("[getCalendarAvailability] disponibilidadMap sample keys:", Object.keys(disponibilidadMap).slice(0,10));

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
    (turnosRows || []).forEach((r) => {
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
    const result = dates.map(d => {
      const iso = formatISO(d);
      const numero = d.getUTCDay() + 1; // 1..7
      const numStr = String(numero);
      // 1) check disponibilidad by weekday
      const horariosDia = disponibilidadMap[numStr] || disponibilidadMap[String(numero-1)] || disponibilidadMap[WEEKDAY_NAMES[numero-1]] || disponibilidadMap[WEEKDAY_NAMES[numero-1].toLowerCase()] || [];
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