// Importar utilidades del backend
import { normalizeRows, extractTimeHHMM, parseFechaDMY, toISODate } from "../../backend/utils/turnsUtils.js";

const TURNOS_TABLE = "Turnos";
const DISPONIBILIDAD_TABLE = "Disponibilidad";
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
    const fechaStr = req.query.fecha; // esperar ISO yyyy-mm-dd
    const numParam = req.query.num ? Number(req.query.num) : null;

    // Leer Disponibilidad
    let dispResp = await findRows(DISPONIBILIDAD_TABLE, `([Número] <> "")`);
    let dispRows = normalizeRows(dispResp) || [];
    if (!dispRows.length) dispRows = normalizeRows(await readRows(DISPONIBILIDAD_TABLE)) || [];

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
    const allTurnosResp = await readRows(TURNOS_TABLE);
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
      const found = await findRows(TURNOS_TABLE, filter);
      allTurnos = normalizeRows(found) || [];
      console.log("[getDisponibilidad] filas encontradas por findRows:", (allTurnos || []).length);
    }

    // filtrar filas de Turnos conservando solo las que coinciden en ISO (prueba varias interpretaciones)
    const turnosRows = (allTurnos || []).filter(r => {
      const s = String(r.Fecha ?? r['Fecha'] ?? "");
      const candidates = isoCandidatesFromString(s);
      if (!candidates || candidates.length === 0) return false;
      return candidates.includes(requestedISO);
    });
    console.log("[getDisponibilidad] turnos encontrados (filtrados):", turnosRows.length);

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