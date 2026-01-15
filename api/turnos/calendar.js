// Importar utilidades del backend que funcionan
import { normalizeRows, extractTimeHHMM, parseFechaDMY, toISODate } from "../../backend/utils/turnsUtils.js";

// Función auxiliar para convertir valores a string
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

// AppSheet service functions (EXACTOS del backend que funciona)
async function doAction(tableName, body) {
  const BASE = process.env.APPSHEET_BASE_URL;
  const APP_KEY = process.env.APPSHEET_ACCESS_KEY;
  
  const url = `${BASE}/tables/${encodeURIComponent(tableName)}/Action`;
  const headers = {
    "Content-Type": "application/json",
  };
  if (APP_KEY) headers.ApplicationAccessKey = APP_KEY;

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const raw = await resp.text();
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn("[AppSheet] response not JSON");
    return raw;
  }
}

async function findRows(tableName, filter = "") {
  return await doAction(tableName, {
    Action: "Find",
    Properties: {},
    Rows: [],
    Filter: filter || ""
  });
}

async function readRows(tableName) {
  return await doAction(tableName, {
    Action: "Read",
    Properties: {},
    Rows: []
  });
}

// FUNCIÓN PRINCIPAL: Copia EXACTA del availabilityController.js que funciona
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
    console.log("[calendar] Procesando filas de disponibilidad:", dispRows.length);
    (dispRows || []).forEach((r, index) => {
      const keyRaw = String(r["Número"] ?? r.Numero ?? r.numero ?? r["Día"] ?? r.Dia ?? r.Dia ?? "").trim();
      const raw = r["Horarios"] ?? r.Horarios ?? r.horarios ?? "";
      console.log(`[calendar] Fila ${index}: keyRaw='${keyRaw}', horarios='${raw}'`);
      let arr = [];
      if (Array.isArray(raw)) arr = raw.map(x => extractTimeHHMM(x));
      else arr = String(raw || "").split(",").map(x => extractTimeHHMM(x)).filter(Boolean);
      const uniq = Array.from(new Set(arr.filter(Boolean)));

      // generar claves correctas para esta fila
      const keys = new Set();
      if (keyRaw) {
        keys.add(keyRaw);
        const n = Number(keyRaw);
        if (!isNaN(n)) {
          // AppSheet usa 1=Lunes, 2=Martes, ..., 6=Sábado (NO hay domingo=7)
          // JavaScript usa 0=Domingo, 1=Lunes, 2=Martes, ..., 6=Sábado
          // Solo mapear si el número está en rango válido (1-6 para AppSheet)
          if (n >= 1 && n <= 6) {
            keys.add(String(n)); // AppSheet number (1-6)
            // Mapeo correcto: AppSheet n → JavaScript n (1→1, 2→2, etc.)
            const jsWeekday = n; // Lunes AppSheet(1) → Lunes JS(1)
            keys.add(String(jsWeekday));
            keys.add(WEEKDAY_NAMES[jsWeekday]);
            keys.add(WEEKDAY_NAMES[jsWeekday].toLowerCase());
          }
        } else {
          // si es nombre de weekday
          const idx = WEEKDAY_NAMES.findIndex(w => w.toLowerCase() === keyRaw.toLowerCase());
          if (idx >= 0) {
            keys.add(WEEKDAY_NAMES[idx]);
            keys.add(WEEKDAY_NAMES[idx].toLowerCase());
            // Solo generar número si no es domingo (idx=0)
            if (idx !== 0) {
              keys.add(String(idx)); // JS weekday number (1-6)
            }
          }
        }
      }

      // asignar same horarios a todas las claves detectadas
      console.log(`[calendar] Claves generadas para '${keyRaw}':`, Array.from(keys));
      for (const k of keys) disponibilidadMap[String(k)] = uniq;
    });
    
    console.log("[calendar] DisponibilidadMap final:", disponibilidadMap);

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
        // fallback: interpretar como MM/DD/YYYY (formato AppSheet)
        const s = String(r.Fecha ?? "");
        const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        if (m) {
          let mm = Number(m[1]), dd = Number(m[2]), yy = Number(m[3]); // MM/DD/YYYY
          if (yy < 100) yy += 2000;
          iso = new Date(Date.UTC(yy, mm - 1, dd)).toISOString().slice(0,10);
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

    // Procesar Cancelar Agenda - calcular días bloqueados
    const blockedVariosSet = new Set();
    const blockedUnDiaSet = new Set();
    
    console.log('[calendar] Processing Cancelar Agenda, found rows:', cancelRows.length);
    
    // Procesar registros de Cancelar Agenda
    (cancelRows || []).forEach(r => {
      const tipoRaw = r.Cancelar ?? r["Cancelar"] ?? r.cancelar ?? "";
      const tipo = valueToString(tipoRaw).trim();
      
      console.log('[calendar] Cancelar row:', { tipo, data: r });
      
      if (tipo === "Varios días") {
        // Rango de fechas desde "Desde" hasta "Hasta"
        const desdeRaw = r.Desde ?? r["Desde"] ?? r.desde ?? "";
        const hastaRaw = r.Hasta ?? r["Hasta"] ?? r.hasta ?? "";
        
        console.log('[calendar] Varios días:', { desde: desdeRaw, hasta: hastaRaw });
        
        if (desdeRaw && hastaRaw) {
          try {
            const fechaDesde = parseFechaDMY(desdeRaw);
            const fechaHasta = parseFechaDMY(hastaRaw);
            
            if (fechaDesde && fechaHasta) {
              // Generar todas las fechas en el rango
              const current = new Date(fechaDesde);
              while (current <= fechaHasta) {
                const iso = toISODate(current);
                blockedVariosSet.add(iso);
                console.log('[calendar] Added to blockedVariosSet:', iso);
                current.setUTCDate(current.getUTCDate() + 1);
              }
            }
          } catch (e) {
            console.warn('[calendar] Error parsing Varios días range:', e);
          }
        }
      } else if (tipo === "Un día") {
        // Fecha específica en campo "Día"
        const unDiaRaw = r["Día"] ?? r["Un día"] ?? r["Un dia"] ?? r.UnDia ?? r.undia ?? r.Dia ?? "";
        
        console.log('[calendar] Un día:', unDiaRaw);
        
        if (unDiaRaw) {
          try {
            const fecha = parseFechaDMY(unDiaRaw);
            if (fecha) {
              const iso = toISODate(fecha);
              blockedUnDiaSet.add(iso);
              console.log('[calendar] Added to blockedUnDiaSet:', iso);
            }
          } catch (e) {
            console.warn('[calendar] Error parsing Un día:', e);
          }
        }
      }
    });

    // evaluate each date
     const result = dates.map(d => {
       const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
       
       // Mapeo CORRECTO de días de la semana
       // JavaScript getUTCDay(): domingo=0, lunes=1, martes=2, miércoles=3, jueves=4, viernes=5, sábado=6
       // AppSheet Disponibilidad: Domingo=1 (NO EXISTE), Lunes=2, Martes=3, Miércoles=4, Jueves=5, Viernes=6, Sábado=7
       const jsWeekday = d.getUTCDay(); // 0-6
       
       // Conversión JS → AppSheet
       const appsheetNumber = jsWeekday === 0 ? 1 : jsWeekday + 1;
       // JS Domingo(0) → AppSheet Domingo(1) - NO EXISTE en tabla
       // JS Lunes(1) → AppSheet Lunes(2) 
       // JS Martes(2) → AppSheet Martes(3), etc.
       
       // 1) check disponibilidad by weekday
       let horariosDia = [];
       
       if (jsWeekday === 0) {
         // Domingo: AppSheet número 1, pero NO existe en la tabla → siempre bloqueado
         horariosDia = [];
       } else {
         // Lunes a Sábado: buscar en disponibilidadMap usando número AppSheet
         horariosDia = disponibilidadMap[String(appsheetNumber)] || 
                      disponibilidadMap[WEEKDAY_NAMES[jsWeekday]] || 
                      disponibilidadMap[WEEKDAY_NAMES[jsWeekday].toLowerCase()] || [];
       }
       
       const weekdayBlocked = horariosDia.length === 0;
       
       if (WEEKDAY_NAMES[jsWeekday] === 'Domingo') {
         console.log(`[calendar] DOMINGO ${iso}: jsWeekday=${jsWeekday}, appsheetNumber=${appsheetNumber}`);
         console.log(`[calendar] Domingo AppSheet(1) NO existe en tabla → siempre bloqueado`);
         console.log(`  - horariosDia:`, horariosDia);
         console.log(`  - weekdayBlocked:`, weekdayBlocked);
       } else if (WEEKDAY_NAMES[jsWeekday] === 'Lunes') {
         console.log(`[calendar] LUNES ${iso}: jsWeekday=${jsWeekday}, appsheetNumber=${appsheetNumber}`);
         console.log(`[calendar] Buscando Lunes AppSheet(2) en disponibilidadMap`);
         console.log(`  - disponibilidadMap["${appsheetNumber}"]:`, disponibilidadMap[String(appsheetNumber)] ? 'ENCONTRADO' : 'NO ENCONTRADO');
         console.log(`  - horariosDia:`, horariosDia);
         console.log(`  - weekdayBlocked:`, weekdayBlocked);
       }
       
       // 2) Cancelar Agenda: usar sets calculados previamente
       const blockedByCancel = blockedUnDiaSet.has(iso) || blockedVariosSet.has(iso);
        // 3) occupied hours
        const occupiedSet = occupiedByISO[iso] || new Set();
        
        const horariosNormalized = (horariosDia || []).map(normalizeToHM);
        const availableHorarios = horariosNormalized.filter(h => !occupiedSet.has(h));
        
        const available = !weekdayBlocked && !blockedByCancel && availableHorarios.length > 0;
        
        const resultado = { iso, numero: appsheetNumber, blocked: weekdayBlocked || blockedByCancel ? true : false, weekdayBlocked, blockedByCancel, available, horarios: availableHorarios };
        
        return resultado;
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
    console.log('📅 Calendar request usando lógica EXACTA del controller original...');
    await getCalendarAvailability(req, res);
  } catch (err) {
    console.error("[calendar handler] error:", err);
    return res.status(500).json({ message: "Error calculando disponibilidad del calendario", errorDetails: err.message });
  }
}