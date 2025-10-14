// Importar utilidades del backend que funcionan
import { normalizeRows, extractTimeHHMM, parseFechaDMY, toISODate } from "../../backend/utils/turnsUtils.js";

const TURNOS_TABLE = "Turnos";
const DISPONIBILIDAD_TABLE = "Disponibilidad";

// Definir nombres de los weekdays
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

// helper: extrae y parsea la primera fecha dentro de una cadena (DD/MM/YY, DD/MM/YYYY, MM/DD/YY, ISO)
function parseDateFromAnyString(input) {
  if (input === null || input === undefined) return null;

  // si viene como objeto (AppSheet puede devolver objetos con displayValue/value)
  if (typeof input === "object") {
    // extraer candidato textual
    const cand = input.value ?? input.displayValue ?? input.text ?? input.label ?? null;
    if (cand) return parseDateFromAnyString(cand);
    if (input instanceof Date && !isNaN(input.getTime())) return input;
    // fallback a toString si contenido útil
    const str = (input.toString && input.toString() !== "[object Object]") ? input.toString() : null;
    if (str) return parseDateFromAnyString(str);
    return null;
  }

  // si viene como número (posible epoch)
  if (typeof input === "number") {
    const dNum = new Date(input);
    if (!isNaN(dNum.getTime())) return dNum;
    return null;
  }

  // normalizar espacios/tab/nbsp y otros caracteres no imprimibles
  let s = String(input).replace(/\u00A0/g, " ").replace(/\t/g, " ").replace(/\r/g, " ").replace(/\n/g, " ").trim();
  s = s.replace(/\s+/g, " ");
  if (!s) return null;

  // intento rápido: si JS puede parsear un ISO/fecha claramente, convertir a UTC date
  const jsDate = new Date(s);
  if (!isNaN(jsDate.getTime())) {
    // aceptar si el string parece ISO o empieza con año (evita MM/DD ambiguity)
    if (/^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{4}/.test(s)) {
      return new Date(Date.UTC(jsDate.getFullYear(), jsDate.getMonth(), jsDate.getDate()));
    }
  }

  // 1) intentar parseFechaDMY directo (tu util)
  try {
    const p = parseFechaDMY(s);
    if (p && !isNaN(p.getTime())) return p;
  } catch (e) {}

  // 2) buscar primera ocurrencia ISO o D/M/Y
  const m = s.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/);
  if (!m) return null;
  const found = m[0].trim();

  // si es ISO (YYYY-MM-DD)
  const isoMatch = found.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const yy = Number(isoMatch[1]), mm = Number(isoMatch[2]), dd = Number(isoMatch[3]);
    return new Date(Date.UTC(yy, mm - 1, dd));
  }

  // si es D/M/Y o M/D/Y: intentar parseFechaDMY sobre el substring y, si falla, construir manualmente
  try {
    const p2 = parseFechaDMY(found);
    if (p2 && !isNaN(p2.getTime())) return p2;
  } catch (e) {}

  const parts = found.split(/[\/\-]/).map(x => Number(x));
  if (parts.length === 3) {
    let [a, b, y] = parts;
    if (y < 100) y += 2000;
    // asumir D/M/Y (convención del sistema)
    return new Date(Date.UTC(y, (b - 1), a));
  }
  return null;
}

// AppSheet service functions (replicar del backend)
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
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn("[AppSheet] response not JSON");
    return { error: raw };
  }
}

async function findRows(tableName, filter = "") {
  return await doAction(tableName, {
    Action: "Find",
    Properties: {},
    Rows: [{ Selector: filter || `([Numero] <> "")` }]
  });
}

async function readRows(tableName) {
  return await doAction(tableName, {
    Action: "Read",
    Properties: {},
    Rows: []
  });
}

// devuelve array de ISO strings (YYYY-MM-DD) candidatas a partir de un valor de celda
function isoCandidatesFromString(s) {
  if (!s && s !== 0) return [];
  // si es objeto/numero reutilizar el parser que ya tenemos
  if (typeof s === "object" || typeof s === "number") {
    const p = parseDateFromAnyString(s);
    if (p && !isNaN(p.getTime())) return [toISODate(p)];
    // si no pudo, intentar con toString
    s = String(s);
  }
  s = String(s).trim();
  if (!s) return [];

  const out = new Set();
  // 1) ISO explícito
  const mIso = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (mIso) out.add(mIso[1]);

  // 2) intentar parseFechaDMY (tu util) - preferido
  try {
    const p = parseFechaDMY(s);
    if (p && !isNaN(p.getTime())) out.add(toISODate(p));
  } catch (e) {}

  // 3) buscar patrones D/M/Y o M/D/Y y generar variantes (disambiguar cuando sea posible)
  for (const m of s.matchAll(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g)) {
    let a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
    if (y < 100) y += 2000;
    // si alguno >12, sabemos qué es día
    if (a > 12 && b <= 12) {
      out.add(new Date(Date.UTC(y, b - 1, a)).toISOString().slice(0,10));
    } else if (b > 12 && a <= 12) {
      out.add(new Date(Date.UTC(y, a - 1, b)).toISOString().slice(0,10));
    } else {
      // ambiguo: agregar D/M/Y y M/D/Y si distinto
      const d1 = new Date(Date.UTC(y, b - 1, a)).toISOString().slice(0,10); // D/M/Y
      out.add(d1);
      const d2 = new Date(Date.UTC(y, a - 1, b)).toISOString().slice(0,10); // M/D/Y
      out.add(d2);
    }
  }

  return Array.from(out);
}

// Devuelve una única ISO preferida para usar en rangos (prioriza DMY y evita pares mixtos)
function preferredIsoFromString(s) {
  if (!s && s !== 0) return null;
  // si es objeto/numero usar parseDateFromAnyString
  if (typeof s === "object" || typeof s === "number") {
    const p = parseDateFromAnyString(s);
    if (p && !isNaN(p.getTime())) return toISODate(p);
    s = String(s);
  }
  s = String(s).trim();
  if (!s) return null;

  // 1) preferir parseFechaDMY (tu util)
  try {
    const p = parseFechaDMY(s);
    if (p && !isNaN(p.getTime())) return toISODate(p);
  } catch (e) {}

  // 2) buscar patrón D/M/Y o M/D/Y y escoger DMY salvo que podamos disambiguar
  const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return null;
  let a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
  if (y < 100) y += 2000;
  // si uno de los dos >12 podemos inferir cuál es día
  if (a > 12 && b <= 12) {
    // a es día -> D/M/Y
    return new Date(Date.UTC(y, b - 1, a)).toISOString().slice(0,10);
  } else if (b > 12 && a <= 12) {
    // b es día -> M/D/Y (interpretar como MDY)
    return new Date(Date.UTC(y, a - 1, b)).toISOString().slice(0,10);
  } else {
    // ambiguo -> elegir D/M/Y por convención (evita rangos excesivamente amplios)
    return new Date(Date.UTC(y, b - 1, a)).toISOString().slice(0,10);
  }
}

// ===== FUNCIÓN PRINCIPAL: getCalendarAvailability (copiada exacta del controller) =====
async function getCalendarAvailability(req, res) {
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
    let dispResp = await findRows(DISPONIBILIDAD_TABLE, `([Número] <> "")`);
    let dispRows = normalizeRows(dispResp);
    if (!dispRows || dispRows.length === 0) {
      const allDisp = await readRows(DISPONIBILIDAD_TABLE);
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
    let cancelResp = await findRows("Cancelar Agenda", `([Cancelar] <> "")`);
    let cancelRows = normalizeRows(cancelResp);
    if (!cancelRows || cancelRows.length === 0) {
      const cr = await readRows("Cancelar Agenda");
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

    let turnosResp = await findRows(TURNOS_TABLE, filterTurnos);
    let turnosRows = normalizeRows(turnosResp) || [];
    if (!turnosRows || turnosRows.length === 0) {
      const tmp = await readRows(TURNOS_TABLE);
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
    // calcular ISO de hoy (UTC) para filtrar turnos anteriores
    const pad2 = (n) => String(n).padStart(2,"0");
    const now = new Date();
    const todayIso = `${now.getUTCFullYear()}-${pad2(now.getUTCMonth()+1)}-${pad2(now.getUTCDate())}`;
    (turnosRows || []).forEach((r) => {
      const fechaParsed = parseFechaDMY ? parseFechaDMY(r.Fecha) : null;
      let iso = null;
      if (fechaParsed) iso = toISODate(fechaParsed);
      else {
        // fallback: intentar interpretar dd/mm/yyyy / mm/dd/yyyy
        const s = String(r.Fecha ?? "");
        const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        if (m) {
          let a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
          if (y < 100) y += 2000;
          if (a > 12 && b <= 12) iso = new Date(Date.UTC(y, b - 1, a)).toISOString().slice(0,10);
          else if (b > 12 && a <= 12) iso = new Date(Date.UTC(y, a - 1, b)).toISOString().slice(0,10);
          else iso = new Date(Date.UTC(y, b - 1, a)).toISOString().slice(0,10);
        }
      }
      if (!iso) return;
      // ignorar turnos anteriores a hoy
      if (iso < todayIso) return;
      let hrs = [];
      const hField = r.Hora ?? r['Hora'] ?? r.hora ?? "";
      if (Array.isArray(hField)) hrs = hField.map(x => normalizeToHM(x));
      else hrs = String(hField||"").split(",").map(x => normalizeToHM(x)).filter(Boolean);
      if (!occupiedByISO[iso]) occupiedByISO[iso] = new Set();
      hrs.forEach(h => { if (h) occupiedByISO[iso].add(h); });
    });

    // --- Nuevo: calcular días bloqueados según Cancelar Agenda ---
    const blockedVariosSet = new Set(); // días bloqueados por los "Varios días"
    const blockedUnDiaSet = new Set(); // días bloqueados por cada "Un día"
    // encontrar todas las filas cuyo Cancelar sea "Varios días"
    const variosRows = (cancelRows || []).filter(r => {
      const tipoRaw = r.Cancelar ?? r["Cancelar"] ?? r.cancelar ?? "";
      const tipo = String(tipoRaw).trim().toLowerCase();
      return tipo.includes("var") || tipo.includes("varios");
    });
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    for (const row of variosRows) {
      const desdeRaw = row.Desde ?? row["Desde"] ?? row.desde ?? null;
      const hastaRaw = row.Hasta ?? row["Hasta"] ?? row.hasta ?? null;
      const desdeCandidates = isoCandidatesFromString(desdeRaw);
      const hastaCandidates = isoCandidatesFromString(hastaRaw);
      console.log("[getCalendarAvailability] Varios row desde candidates:", desdeCandidates, "hasta candidates:", hastaCandidates);

      // elegir la pareja válida (di <= hi) con span mínimo en días
      let bestPair = null;
      let bestSpan = Infinity;
      for (const di of desdeCandidates) {
        for (const hi of hastaCandidates) {
          try {
            const dDate = new Date(di + "T00:00:00Z");
            const hDate = new Date(hi + "T00:00:00Z");
            if (isNaN(dDate.getTime()) || isNaN(hDate.getTime())) continue;
            if (dDate.getTime() <= hDate.getTime()) {
              const span = Math.round((hDate.getTime() - dDate.getTime()) / MS_PER_DAY);
              if (span < bestSpan) { bestSpan = span; bestPair = [di, hi]; }
            }
          } catch (e) { /* ignore invalid combos */ }
        }
      }

      // fallback a preferredIso si no hay combinaciones válidas
      if (!bestPair) {
        const df = preferredIsoFromString(desdeRaw);
        const hf = preferredIsoFromString(hastaRaw);
        if (df && hf && df <= hf) bestPair = [df, hf];
      }

      if (bestPair) {
        const [desdeIso, hastaIso] = bestPair;
        const [sy, sm, sd] = desdeIso.split("-").map(Number);
        const [ey, em, ed] = hastaIso.split("-").map(Number);
        let cur = new Date(Date.UTC(sy, sm - 1, sd));
        const end = new Date(Date.UTC(ey, em - 1, ed));
        while (cur <= end) {
          blockedVariosSet.add(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth()+1).padStart(2,"0")}-${String(cur.getUTCDate()).padStart(2,"0")}`);
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
      } else {
        console.log("[getCalendarAvailability] no se encontró pareja válida para Varios días (desde/hasta):", desdeRaw, hastaRaw);
      }
    }
    // agregar todas las filas "Un día"
    for (const r of (cancelRows || [])) {
      const tipoRaw = r.Cancelar ?? r["Cancelar"] ?? r.cancelar ?? "";
      const tipo = String(tipoRaw).trim().toLowerCase();
      if (tipo.includes("un")) {
        const diaRaw = r["Día"] ?? r["Dia"] ?? r.Dia ?? null;
        const diaCandidates = isoCandidatesFromString(diaRaw);
        if (diaRaw) console.log("[getCalendarAvailability] marcar Un día candidates:", diaCandidates);
        diaCandidates.forEach(c => blockedUnDiaSet.add(c));
      }
    }
    console.log("[getCalendarAvailability] blockedVariosSet:", Array.from(blockedVariosSet).slice(0,20));
    console.log("[getCalendarAvailability] blockedUnDiaSet:", Array.from(blockedUnDiaSet).slice(0,20));

    // evaluate each date
     const result = dates.map(d => {
       const iso = formatISO(d);
       const numero = d.getUTCDay() + 1; // 1..7
       const numStr = String(numero);
       // 1) check disponibilidad by weekday
       const horariosDia = disponibilidadMap[numStr] || disponibilidadMap[String(numero-1)] || disponibilidadMap[WEEKDAY_NAMES[numero-1]] || disponibilidadMap[WEEKDAY_NAMES[numero-1].toLowerCase()] || [];
       const weekdayBlocked = horariosDia.length === 0;
       // 2) Cancelar Agenda: usar sets calculados previamente
       const blockedByCancel = blockedUnDiaSet.has(iso) || blockedVariosSet.has(iso);
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

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Usar la función exacta del controller que funciona
    console.log('📅 Calendar request usando lógica exacta del controller...');
    await getCalendarAvailability(req, res);
  } catch (err) {
    console.error("[calendar handler] error:", err);
    return res.status(500).json({ message: "Error calculando disponibilidad del calendario", errorDetails: err.message });
  }
}