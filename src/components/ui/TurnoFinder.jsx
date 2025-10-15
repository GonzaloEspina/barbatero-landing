import { useEffect, useState, useMemo } from "react";
import CalendarGrid from "./CalendarGrid";
import TimePicker from "./TimePicker";
import ServiceSelect from "./ServiceSelect";
import NewClientForm from "./NewClientForm";
import ClientCard from "./ClientCard";
import EditClientInline from "./EditClientInline";
import { normalizeToHM, parseDateFromString } from "./utils";
import MembershipCTA from "../MembershipCTA.jsx";


// helper: intercambiar los dos primeros componentes de una fecha (front only)
// mejora: si recibe ISO YYYY-MM-DD devuelve DD/MM/YYYY
const pad = (n) => String(n).padStart(2, "0");
// formatea para display en frontend como DD/MM/YYYY
const formatDateForDisplay = (s) => {
  const v = String(s || "").trim();
  if (!v) return v;
  // ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-");
    return `${pad(Number(d))}/${pad(Number(m))}/${y}`;
  }
  // A/B/C with slashes (ambiguous): si primer componente >12 -> asumir DD/MM, sino asumir MM/DD y swap
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v)) {
    const [p1, p2, p3] = v.split("/").map(x => x.trim());
    const y = p3.length === 2 ? (Number(p3) > 70 ? '19' + p3 : '20' + p3) : p3;
    if (Number(p1) > 12) {
      return `${pad(Number(p1))}/${pad(Number(p2))}/${y}`;
    } else {
      // asumir entrada MM/DD/YYYY -> swap a DD/MM/YYYY
      return `${pad(Number(p2))}/${pad(Number(p1))}/${y}`;
    }
  }
  // fallback: intentar Date y formatear con locale AR
  const dt = new Date(v);
  if (!isNaN(dt.getTime())) {
    return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(dt);
  }
  return v;
};

// helper robusto para parsear fechas recibidas (intenta ISO, DD/MM/YYYY y MM/DD/YYYY)
// devuelve Date o null
const tryParseDate = (input) => {
  if (!input) return null;
  const s = String(input).trim();
  // ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + "T00:00:00");
  // barras: A/B/C
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const p1 = Number(slash[1]), p2 = Number(slash[2]), p3raw = slash[3];
    const year = p3raw.length === 2 ? (Number(p3raw) > 70 ? 1900 + Number(p3raw) : 2000 + Number(p3raw)) : Number(p3raw);
    // heurística: si el primer componente > 12 -> es día (DD/MM/YYYY)
    if (p1 > 12) {
      const d = new Date(year, p2 - 1, p1);
      return isNaN(d.getTime()) ? null : d;
    }
    // si segundo componente > 12 -> es día (MM/DD/YYYY improbable, pero por si acaso)
    if (p2 > 12) {
      const d = new Date(year, p1 - 1, p2);
      return isNaN(d.getTime()) ? null : d;
    }
    // ambos <=12 (ambiguous): asumir MM/DD/YYYY (coincide con datos que ves del backend)
    const d2 = new Date(year, p1 - 1, p2);
    return isNaN(d2.getTime()) ? null : d2;
  }
  // intentos adicionales: soporte con guiones YYYY/MM/DD o DD-MM-YYYY
  const dashIso = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (dashIso) {
    const y = Number(dashIso[1]), m = Number(dashIso[2]), d = Number(dashIso[3]);
    const dd = new Date(y, m - 1, d);
    return isNaN(dd.getTime()) ? null : dd;
  }
  const dashAmb = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
  if (dashAmb) {
    // aplicar misma heurística que con slash
    const p1 = Number(dashAmb[1]), p2 = Number(dashAmb[2]), p3raw = dashAmb[3];
    const year = p3raw.length === 2 ? (Number(p3raw) > 70 ? 1900 + Number(p3raw) : 2000 + Number(p3raw)) : Number(p3raw);
    if (p1 > 12) {
      const d = new Date(year, p2 - 1, p1);
      return isNaN(d.getTime()) ? null : d;
    }
    const d2 = new Date(year, p1 - 1, p2);
    return isNaN(d2.getTime()) ? null : d2;
  }
  // fallback: Date builtin
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
};

// --- REMOVED custom frontend date formatting helpers ---
// Ya no se usa formatDateDDMMYY ni parseFechaToDate ni formatDateISOLocal.
// El frontend usa el iso tal cual que devuelve el backend (YYYY-MM-DD) en calendarDays[].iso
// y envía al backend Fecha exactamente como cadena (Fecha = iso).

export default function TurnoFinder() {
  const [contacto, setContacto] = useState("");
  const [cliente, setCliente] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [membresias, setMembresias] = useState([]);
  const [clientNotFound, setClientNotFound] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTelefono, setNuevoTelefono] = useState("");
  const [error, setError] = useState("");
  
  // Estados de loading específicos para diferentes acciones
  const [loading, setLoading] = useState(false); // buscar cliente
  const [creating, setCreating] = useState(false); // crear turno
  const [updatingTurnos, setUpdatingTurnos] = useState(false); // actualizar datos después de crear turno
  const [updatingMembership, setUpdatingMembership] = useState(false); // actualizar datos después de membresía
  
  const [showModal, setShowModal] = useState(false);
  // registro inline cuando no se encuentra el cliente
  const [registerMode, setRegisterMode] = useState(false);
  const [registerPrefill, setRegisterPrefill] = useState({});
  // ahora un solo campo "Nombre y Apellido"
  const [registerForm, setRegisterForm] = useState({ Nombre: "", Telefono: "", Correo: "" });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");
  // mensaje amigable / invitación a registrarse (no se usa setError para esto)
  const [registerPrompt, setRegisterPrompt] = useState("");
  const [editingClient, setEditingClient] = useState(false);

  // fechas: ahora usamos el string ISO recibido del backend (YYYY-MM-DD) sin formateo adicional
  const [fecha, setFecha] = useState(""); // ISO string (YYYY-MM-DD) para enviar
  const [fechaDisplay, setFechaDisplay] = useState(""); // mismo valor (sin formateo)

  // form state
  const [hora, setHora] = useState("");
  const [selectedHoras, setSelectedHoras] = useState([]); // multi-select
  const [servicio, setServicio] = useState("");
  const [horarios, setHorarios] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [disponibilidadMsg, setDisponibilidadMsg] = useState("");

  // feedback para copiar alias
  const [copiedAlias, setCopiedAlias] = useState(false);
  const handleCopyAlias = async (alias = "barbatero.mp") => {
    try {
      await navigator.clipboard.writeText(alias);
      setCopiedAlias(true);
      setTimeout(() => setCopiedAlias(false), 2000);
    } catch (e) {
      // silencioso
    }
  };
  
  // calendar state
  const [calendarDays, setCalendarDays] = useState([]); // [{ iso: "YYYY-MM-DD", dateObj, available, blocked, horarios }]
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

  // rango: pedimos al backend start/end como ISO (YYYY-MM-DD)
  const today = new Date();
  const maxDateObj = new Date(today);
  maxDateObj.setMonth(maxDateObj.getMonth() + 1);
  const minDateISO = today.toISOString().slice(0,10);
  const maxDateISO = maxDateObj.toISOString().slice(0,10);

  // cargar servicios (igual)
  useEffect(() => {
    const loadServicios = async () => {
      try {
        console.log('Cargando servicios...');
        const res = await fetch("/api/turnos/servicios");
        console.log('Response status:', res.status);
        if (!res.ok) { 
          console.error('Error loading servicios:', res.status, res.statusText);
          setServicios([]); 
          return; 
        }
        const data = await res.json();
        console.log('Servicios data:', data);
        setServicios(data.servicios || []);
      } catch (e) {
        console.error('Exception loading servicios:', e);
        setServicios([]);
      }
    };
    loadServicios();
  }, []);

  const buscarCliente = async () => {
    if (!contacto) { setError("Ingrese un correo."); return; }
    setLoading(true);
    setCliente(null); setUpcoming([]); setError(""); setClientNotFound(false);
    setRegisterMode(false); setRegisterPrefill({}); setRegisterForm({ Nombre: "", Telefono: "", Correo: "" }); setRegisterError(""); setRegisterPrompt("");
    try {
      console.log('Buscando cliente:', contacto);
      const res = await fetch("/api/turnos/find-client", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contacto })
      });
      console.log('Find client response status:', res.status);
      const data = await res.json();
      if (res.ok && data.found) {
        setCliente(data.client);

        // safe sort + map: si sortUpcoming falla caemos al arreglo original
        try {
          const raw = Array.isArray(data.upcoming) ? data.upcoming : [];
          const sorted = (typeof sortUpcoming === "function") ? sortUpcoming(raw) : raw;
          setUpcoming(Array.isArray(sorted) ? sorted.map(t => ({ ...t, Hora: onlyHHMM(t.Hora) })) : raw.map(t => ({ ...t, Hora: onlyHHMM(t.Hora) })));
        } catch (e) {
          console.error("[buscarCliente] sortUpcoming error:", e);
          const raw = Array.isArray(data.upcoming) ? data.upcoming : [];
          setUpcoming(raw.map(t => ({ ...t, Hora: onlyHHMM(t.Hora) })));
        }

        setMembresias(Array.isArray(data.memberships) ? data.memberships : []);
        setClientNotFound(false);
      } else {
        // no mostrar el mensaje en "error" rojo; en su lugar mostrar prompt amigable + formulario
        setError("");
        setClientNotFound(true);
        setRegisterMode(true);
        setRegisterPrefill(data.prefill || {});
        // prefill: si vino Correo o Telefono en prefill, asignar a nuestro campo único
        const pf = data.prefill || {};
        const namePrefill = pf.Nombre || pf["Nombre y Apellido"] || "";
        setRegisterForm(prev => ({ ...prev, Nombre: namePrefill, Telefono: pf.Telefono || pf.Telefono || "", Correo: pf.Correo || "" }));
        setRegisterPrompt(data.message || "No se encontró el contacto. Completá tus datos para sacar un turno.");
      }
    } catch {
      setError("Error de conexión al backend.");
    } finally { setLoading(false); }
  };

  // Función para recargar datos del cliente después de crear membresía
  const onReloadClientAfterMembership = async () => {
    setUpdatingMembership(true);
    await buscarCliente();
    setUpdatingMembership(false);
  };

  // abrir modal: pedir calendario (backend devuelve iso YYYY-MM-DD)
  const openModal = () => {
    setShowModal(true);
    setFecha(""); setFechaDisplay(""); setHora(""); setSelectedHoras([]); setServicio(""); setHorarios([]); setDisponibilidadMsg("");
    setCalendarDays([]); setLoadingCalendar(true);

    (async () => {
      try {
        const cacheKey = `calendarCache_${minDateISO}_${maxDateISO}`;
        const rawCache = sessionStorage.getItem(cacheKey);
        if (rawCache) {
          try {
            const parsed = JSON.parse(rawCache);
            if (parsed && parsed.ts && (Date.now() - parsed.ts) < 5 * 60 * 1000 && Array.isArray(parsed.days)) {
              setCalendarDays(parsed.days.map(d => ({
                ...d,
                dateObj: d.iso ? new Date(d.iso + "T00:00:00") : new Date(),
                horarios: Array.isArray(d.horarios) ? d.horarios.map(normalizeToHM) : []
              })));
            }
          } catch {}
        }

        const url = `/api/turnos/calendar?start=${encodeURIComponent(minDateISO)}&end=${encodeURIComponent(maxDateISO)}`;
        const res = await fetch(url);
        if (!res.ok) {
          setCalendarDays([]);
          setLoadingCalendar(false);
          return;
        }
        const json = await res.json().catch(() => null);
        const days = Array.isArray(json?.days) ? json.days.map(d => {
          const iso = String(d.iso || d.date || "").trim(); // asumimos YYYY-MM-DD
          return {
            iso,
            dateObj: iso ? new Date(iso + "T00:00:00") : new Date(),
            available: !!d.available,
            blocked: !!d.blocked,
            horarios: Array.isArray(d.horarios) ? d.horarios.map(h => onlyHHMM(h)).filter(Boolean) : []
          };
        }) : [];
        setCalendarDays(days);

        try {
          const store = { ts: Date.now(), days: days.map(({ iso, available, blocked, horarios }) => ({ iso, available, blocked, horarios })) };
          sessionStorage.setItem(cacheKey, JSON.stringify(store));
        } catch {}
      } catch {
        setCalendarDays([]);
      } finally {
        setLoadingCalendar(false);
      }
    })();
  };

  // helper para extraer HH:MM para display (sin modificar backend)
// y para parsear horas (incluye segundos) a minutos para ordenar
const onlyHHMM = (h) => {
  if (h === null || h === undefined) return "";
  const s = String(h).replace(/\u00A0/g, " ").trim();
  try {
    const fromUtil = normalizeToHM(h);
    if (fromUtil && /^\d{1,2}:\d{2}$/.test(fromUtil)) return fromUtil.padStart(5, "0");
  } catch {}
  const m = s.match(/(\d{1,2}:\d{2})(?::\d{2})?/);
  if (m) return m[1].padStart(5, "0");
  return s;
};

// parsea un string de hora "HH:MM" o "HH:MM:SS" a minutos desde medianoche (numérico) para ordenar
const parseHoraToMinutes = (h) => {
  if (!h && h !== 0) return 0;
  const s = String(h).trim();
  const m = s.match(/^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/);
  if (!m) return 0;
  const hh = Number(m[1]) || 0;
  const mm = Number(m[2]) || 0;
  return hh * 60 + mm;
};

// helper para ordenar próximos turnos por Fecha y por Hora (usa tryParseDate y parseHoraToMinutes)
const sortUpcoming = (items) => {
  if (!Array.isArray(items)) return [];
  const parseSafeDate = (s) => tryParseDate(s);

  return items
    .map(t => ({ ...t, Fecha: String(t.Fecha ?? t.fecha ?? ""), Hora: String(t.Hora ?? t.hora ?? "") }))
    .sort((a, b) => {
      const da = parseSafeDate(a.Fecha) || new Date(a.Fecha || "");
      const db = parseSafeDate(b.Fecha) || new Date(b.Fecha || "");
      const ta = da && !isNaN(da.getTime()) ? da.getTime() : 0;
      const tb = db && !isNaN(db.getTime()) ? db.getTime() : 0;
      if (ta !== tb) return ta - tb;
      const ma = parseHoraToMinutes(a.Hora);
      const mb = parseHoraToMinutes(b.Hora);
      return ma - mb;
    });
};

  // seleccionar fecha desde calendario: usamos iso tal cual
  const selectFecha = async (iso, payload) => {
    if (!payload || !payload.available) {
      setDisponibilidadMsg("El día ingresado no está disponible, por favor pruebe ingresando otra fecha.");
      setFecha(""); setFechaDisplay(""); setHorarios([]); setHora(""); setSelectedHoras([]); setServicio("");
      return;
    }

    // establecer fecha seleccionada
    setFecha(iso);
    // mantener fechaDisplay con el ISO (NO formatear aquí para evitar efectos colaterales)
    setFechaDisplay(iso);

    // normalizar horarios del payload (ya deberían venir HH:MM, pero por si acaso)
    const dayHorarios = Array.isArray(payload.horarios) ? payload.horarios.map(h => onlyHHMM(h)).filter(Boolean) : [];

    // Si el payload ya incluye horarios (el endpoint /calendar ya los calculó y filtró), usarlos directamente
    // Esto evita una llamada redundante y evita que diferencias de parsing/timezone hagan que la
    // llamada a /api/turnos/disponibilidad devuelva un resultado vacío en algunos entornos.
    if (dayHorarios.length) {
      setHorarios(dayHorarios);
      setDisponibilidadMsg("");
      setHora(""); setSelectedHoras([]); setServicio("");
      return;
    }

    // Si no había horarios en el payload, intentar pedir disponibilidad puntual al backend
    try {
      // añadir cache-bust para evitar 304/response cached que deje datos desactualizados
      const res = await fetch(`/api/turnos/disponibilidad?fecha=${encodeURIComponent(iso)}&_=${Date.now()}`);
      if (res.ok) {
        const json = await res.json().catch(()=>null);
        if (json && Array.isArray(json.horarios)) {
          // backend devolvió horarios disponibles (HH:MM). Usamos eso.
          const normalized = json.horarios.map(h => onlyHHMM(h)).filter(Boolean);
          setHorarios(normalized);
          setDisponibilidadMsg(normalized.length ? "" : "No hay horarios disponibles para este día.");
          setHora(""); setSelectedHoras([]); setServicio("");
          return;
        }
      }
    } catch (e) {
      console.warn("Error fetch disponibilidad (fallback a payload):", e);
    }

    // fallback final: usar dayHorarios (aunque esté vacío)
    setHorarios(dayHorarios);
    setDisponibilidadMsg(dayHorarios.length ? "" : "No hay horarios disponibles para este día.");
    setHora(""); setSelectedHoras([]); setServicio("");
  };

  // resto del componente sin cambios en lógica de envío: Fecha se envía tal cual (iso)
  const allowsMultiple = (() => {
    if (!cliente) return true;
    const v = cliente["¿Puede sacar múltiples turnos?"] ?? cliente["Puede sacar múltiples turnos"] ?? cliente.puedeMultiples ?? cliente.puede_multiple ?? "";
    return String(v).trim().toLowerCase() === "si";
  })();

  const selectHora = (h) => {
    if (allowsMultiple) {
      setSelectedHoras(prev => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h]);
      setHora(h);
    } else {
      setHora(h); setSelectedHoras([]);
    }
  };

  const submitTurno = async () => {
    const hasHora = allowsMultiple ? selectedHoras.length > 0 : !!hora;
    if (!fecha || !hasHora || !servicio || !cliente) { setError("Complete Fecha, Hora y Servicio."); return; }
    setCreating(true); setError("");
    try {
      const clienteRowId = cliente["Row ID"] || cliente["RowID"] || cliente._RowNumber || cliente._rowNumber || cliente.id || cliente["Key"] || null;
      let horaParaEnviar = "";
      if (allowsMultiple) {
        const arr = selectedHoras.length ? selectedHoras : (hora ? [hora] : []);
        horaParaEnviar = arr.map(h2 => {
          const hhmm = onlyHHMM(h2);
          return (/^\d{1,2}:\d{2}$/.test(hhmm)) ? `${hhmm}:00` : hhmm;
        }).join(", ");
      } else {
        const hhmm0 = onlyHHMM(hora);
        horaParaEnviar = (/^\d{1,2}:\d{2}$/.test(hhmm0)) ? `${hhmm0}:00` : hhmm0;
      }

      // detectar membresía activa (si existe) y tomar su Row ID para enviar en la columna "Membresía ID"
      const activeMemb = (Array.isArray(membresias) ? membresias : []).find(m => {
        const s = String(m?.Estado ?? m?.["Estado"] ?? m?.estado ?? "").trim().toLowerCase();
        return s === "activa";
      });
      const membershipRowId = activeMemb ? (activeMemb["Row ID"] || activeMemb.RowID || activeMemb["RowID"] || activeMemb.id || null) : null;

      const payload = {
        contacto,
        clienteRowId,
        clienteName: cliente && (cliente["Nombre y Apellido"] || cliente.Nombre || cliente.name) || "",
        Fecha: fecha, // ISO string enviado tal cual
        Hora: horaParaEnviar,
        Servicio: servicio
        ,
        // columna adicional: id de la membresía activa si existe
        "Membresía ID": membershipRowId
      };

      const res = await fetch("/api/turnos/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(()=>null);
      if (res.ok) {
        setShowModal(false);
        // Actualizar datos del cliente con mensaje específico
        setUpdatingTurnos(true);
        await buscarCliente();
        setUpdatingTurnos(false);
      } else {
        setError(data?.message || `Error al crear turno (status ${res.status})`);
      }
    } catch {
      setError("Error de conexión al backend al crear turno.");
    } finally { setCreating(false); }
  };

  // weeks rendering: usa calendarDays[].dateObj para mostrar día numérico
  const weeks = useMemo(() => {
    if (!calendarDays || calendarDays.length === 0) return [];
    const days = calendarDays;
    const first = days[0].dateObj || new Date();
    const startWeekday = first.getDay();
    const padded = [];
    for (let i = 0; i < startWeekday; i++) padded.push(null);
    for (const d of days) padded.push(d);
    const wk = [];
    for (let i = 0; i < padded.length; i += 7) wk.push(padded.slice(i, i + 7));
    return wk;
  }, [calendarDays]);

  // render CalendarGrid: pasar selectedIso para hover/selected
  return (
    <div id="turno" className={`turno-finder-container font-sans ${contacto.length > 20 ? 'expanded' : ''}`}>
      <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl shadow-xl border border-gray-600">
        <h2 className="text-center text-2xl font-bold mb-6 text-white">Busca tu turno</h2>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
            placeholder="Ingrese correo o teléfono"
            className="flex-1 px-3 py-2.5 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 rounded-lg focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all text-sm"
          />
          <button 
            onClick={buscarCliente} 
            disabled={loading}
            className="px-4 py-2.5 bg-white text-black rounded-lg font-semibold hover:bg-gray-100 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-all duration-300 text-sm shadow-md"
          >
            {loading ? "..." : "Buscar"}
          </button>
        </div>

        {error && <p className="text-red-400 text-center mb-4 font-medium bg-red-900/20 p-2 rounded-lg border border-red-800 text-sm">{error}</p>}

      {/* Formulario de registro mostrado si no se encontró el cliente */}
      {registerMode && (
        <div className="mb-4 p-4 border border-gray-600 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900">
          <p className="text-white font-semibold mb-4 text-center text-sm">No se encontró el contacto. Regístrate para continuar.</p>
          <div className="space-y-3">
            <input
              placeholder="Nombre y Apellido"
              value={registerForm.Nombre}
              onChange={e => setRegisterForm(f => ({ ...f, Nombre: e.target.value }))}
              className="w-full p-2.5 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 rounded-lg focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all text-sm"
            />
            <input
              placeholder="Teléfono"
              value={registerForm.Telefono}
              onChange={e => setRegisterForm(f => ({ ...f, Telefono: e.target.value }))}
              className="w-full p-2.5 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 rounded-lg focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all text-sm"
            />
            <input
              placeholder="Correo"
              value={registerForm.Correo}
              onChange={e => setRegisterForm(f => ({ ...f, Correo: e.target.value }))}
              className="w-full p-2.5 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 rounded-lg focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all text-sm"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={async () => {
                  setRegisterError(""); setRegisterLoading(true);
                  if (!registerForm.Nombre) { setRegisterError("Complete Nombre y Apellido"); setRegisterLoading(false); return; }
                  if (!registerForm.Telefono && !registerForm.Correo) { setRegisterError("Complete Teléfono o Correo"); setRegisterLoading(false); return; }
                  try {
                    const res = await fetch("/api/clients/create", {
                      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(registerForm)
                    });
                    const json = await res.json().catch(()=>({}));
                    if (res.ok && json.ok) {
                      // usar cliente creado para continuar flujo
                      setCliente(json.client || registerForm);
                      try {
                        const raw = Array.isArray(json.upcoming) ? json.upcoming : [];
                        const sorted = (typeof sortUpcoming === "function") ? sortUpcoming(raw) : raw;
                        setUpcoming(Array.isArray(sorted) ? sorted : raw);
                      } catch (e) {
                        console.error("[create client] sortUpcoming error:", e);
                        setUpcoming(Array.isArray(json.upcoming) ? json.upcoming : []);
                      }

                      setRegisterMode(false);
                      setRegisterPrefill({});
                      setRegisterForm({ Nombre: "", Telefono: "", Correo: "" });
                      setError("");
                    } else {
                      setRegisterError(json.message || "No se pudo crear cliente.");
                    }
                  } catch (e) {
                    setRegisterError("Error al crear cliente.");
                  } finally { setRegisterLoading(false); }
                }}
                className="flex-1 px-3 py-2 bg-white text-black rounded-lg font-semibold hover:bg-gray-100 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 text-sm"
                disabled={registerLoading}
              >
                {registerLoading ? "..." : "Registrarse"}
              </button>
              <button 
                onClick={() => { setRegisterMode(false); setRegisterError(""); }} 
                className="px-3 py-2 border border-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-all duration-300 text-sm"
              >
                Cancelar
              </button>
            </div>
            {registerError && <div className="text-red-400 mt-3 text-center font-medium bg-red-900/20 p-2 rounded-lg border border-red-800 text-sm">{registerError}</div>}
          </div>
        </div>
      )}

      {cliente && (
        <div className="mb-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-600 rounded-xl shadow-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Tus datos</h3>
              </div>
              <div>
                {!editingClient && (
                  <button
                    onClick={() => setEditingClient(true)}
                    className="ml-3 px-3 py-1.5 bg-white hover:bg-gray-100 text-black rounded-lg text-xs font-semibold transition-all duration-300"
                  >
                    Editar
                  </button>
                )}
              </div>
            </div>

            {!editingClient ? (
              <div className="mt-4 space-y-2">
                <div className="text-xs"><span className="font-semibold text-yellow-400">Nombre:</span> <span className="text-gray-200 ml-1">{cliente["Nombre y Apellido"] ?? cliente.Nombre ?? ""}</span></div>
                <div className="text-xs"><span className="font-semibold text-yellow-400">Teléfono:</span> <span className="text-gray-200 ml-1">{cliente["Teléfono"] ?? cliente.Telefono ?? ""}</span></div>
                <div className="text-xs"><span className="font-semibold text-yellow-400">Correo:</span> <span className="text-gray-200 ml-1">{cliente["Correo"] ?? cliente.Correo ?? ""}</span></div>

                <div className="mt-4 pt-3 border-t border-gray-600">
                  <h4 className="text-sm font-semibold text-white mb-2">Próximos turnos</h4>
                  {upcoming.length === 0 ? (
                    <div className="text-xs text-gray-400 italic bg-gray-800/50 p-2 rounded-lg text-center">No hay próximos turnos.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {upcoming.map((t, i) => (
                        <div key={i} className="bg-gradient-to-r from-gray-700 to-gray-800 border border-gray-600 p-2.5 rounded-lg flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-white">{formatDateForDisplay(t.Fecha)}</div>
                            <div className="text-[10px] text-gray-300 truncate">{t.Servicio}</div>
                          </div>
                          <div className="text-xs font-bold text-yellow-400 ml-2">{onlyHHMM(t.Hora)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Membresías activas / CTA */}
                {(() => {
                  const clientRowId = cliente && (cliente["Row ID"] || cliente.RowID || cliente._RowNumber || cliente.id || cliente.Key || "");

                  // Normalizar estados (usar la columna "Estado" que definiste en AppSheet)
                  const getEstado = (m) => String(m?.Estado ?? m?.["Estado"] ?? m?.estado ?? "").trim().toLowerCase();

                  const hasActive = Array.isArray(membresias) && membresias.some(m => getEstado(m) === "activa");
                  const hasPending = Array.isArray(membresias) && membresias.some(m => getEstado(m).includes("pendiente"));

                  // --- nueva lógica: permite sacar múltiples turnos según columna Cliente["¿Puede sacar múltiples turnos?"]
                  const rawAllow = String(cliente?.["¿Puede sacar múltiples turnos?"] ?? cliente?.["Puede sacar múltiples turnos?"] ?? cliente?.PuedeSacarMultiplesTurnos ?? "").trim().toLowerCase();
                  const allowsMultiple = rawAllow === "si" || rawAllow === "sí" || rawAllow === "yes" || rawAllow === "true";

                  // calcular si hay un turno dentro de los próximos 30 días (solo para control visual)
                  const parseSafeDate = (s) => {
                    if (!s) return null;
                    try { return parseDateFromString(s); } catch (e) { const d = new Date(s); return isNaN(d) ? null : d; }
                  };
                  const within30Days = (() => {
                    if (!Array.isArray(upcoming) || upcoming.length === 0) return false;
                    const now = new Date();
                    return upcoming.some(u => {
                      const d = parseSafeDate(u.Fecha ?? u.fecha ?? u.Date);
                      if (!d) return false;
                      const diff = (d - now) / (1000*60*60*24);
                      return diff >= 0 && diff <= 30;
                    });
                  })();

                  // --- acción de sacar turno / mensaje (SIEMPRE mostrar antes de la sección de membresías)
                  const actionArea = (
                    <div className="mt-3 mb-2">
                      {allowsMultiple ? (
                        <button onClick={() => openModal()} className="px-4 py-2 bg-yellow-500 text-black rounded-lg font-semibold hover:bg-yellow-400 transition-all duration-300 text-sm shadow-lg">
                          Sacar otro turno
                        </button>
                      ) : (
                        within30Days ? (
                          <div className="flex items-center justify-between gap-3">
  <div className="text-xs text-yellow-300 bg-yellow-900/20 p-2 rounded-lg border border-yellow-700">
    Para sacar otro turno dentro de los próximos 30 días,
    <a
      href={`https://wa.me/5491160220978?text=${encodeURIComponent("Hola, quiero sacar otro turno")}`}
      target="_blank"
      rel="noreferrer"
      className="ml-1 underline text-yellow-400 hover:text-white transition-colors"
      aria-label="Escribir por Whatsapp"
    >
      escribinos por Whatsapp.
    </a>
  </div>
</div>
                        ) : (
                          <button onClick={() => openModal()} className="px-4 py-2 bg-yellow-500 text-black rounded-lg font-semibold hover:bg-yellow-400 transition-all duration-300 text-sm shadow-lg">
                            Sacar turno
                          </button>
                        )
                      )}
                    </div>
                  );

                  // Si hay membresía pendiente mostramos la sección "Membresías Activas" con estado pendiente
                  if (hasPending) {
                    const pending = (membresias || []).filter(m => getEstado(m).includes("pendiente"));
                    return (
                      <div className="mt-4">
                        {/* Acciones (botón / mensaje) arriba */}
                        {actionArea}

                        <h4 className="text-sm font-semibold text-white mb-2">Membresía Activa</h4>
                        {pending.map((m, idx) => {
                          const alias = "barbatero.mp";
                          return (
                            <div key={idx} className="p-3 rounded-md mb-2 bg-gradient-to-r from-orange-600 to-yellow-600 border border-orange-500">
                              <div className="flex items-center justify-between">
                                <div className="text-sm text-white font-semibold">
                                  {m.Membresía ?? m.membresia ?? ""}
                                  <span className="text-xs text-orange-100 ml-2"> - Pendiente de Confirmación</span>
                                </div>
                              </div>

                              {/* texto de activación arriba del alias */}
                              <div className="mt-3 text-sm text-orange-50">
                                Para activar la membresía, realizá el pago y envianos el comprobante por Whatsapp.
                              </div>

                              {/* alias + acciones repartidos en todo el ancho */}
                              <div className="mt-3 border-t border-orange-400 pt-3 w-full flex items-center">
                                {/* left: alias + copiar (ocupa todo el espacio disponible) */}
                                <div className="flex items-center gap-3 flex-1">
                                  <div className="text-sm text-orange-100">Alias:</div>

                                  {/* alias sin fondo - texto plano */}
                                  <span className="text-white font-mono font-medium">{alias}</span>

                                  {/* botón copiar: sin fondo, líneas blancas */}
                                  <button
                                    onClick={() => handleCopyAlias(alias)}
                                    title="Copiar alias"
                                    className="inline-flex items-center justify-center w-9 h-9 rounded text-white hover:text-gray-200 focus:outline-none"
                                    aria-label="Copiar alias"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <rect x="9" y="9" width="11" height="11" rx="2" ry="2"></rect>
                                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9"></path>
                                    </svg>
                                  </button>

                                  {copiedAlias && <div className="ml-2 px-3 py-1 bg-green-100 text-green-800 text-xs rounded">Alias copiado</div>}
                                </div>

                                {/* right: botón WhatsApp (pequeño, menos área verde) */}
                                <div className="ml-3 flex-shrink-0">
                                  <a
                                    href={`https://wa.me/5491160220978?text=${encodeURIComponent("Adjunto comprobante de pago para la membresía")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg transition-all duration-300 border-2 border-white"
                                    title="Enviar comprobante por WhatsApp"
                                    aria-label="Enviar comprobante por WhatsApp"
                                  >
                                    {/* WhatsApp SVG icon más reconocible */}
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="0.5">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.097"/>
                                    </svg>
                                  </a>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  // Si NO tiene membresía activa ni pendiente mostramos acciones y el CTA (sin encabezado)
                  if (!hasActive && !hasPending) {
                    return (
                      <div className="mt-6">
                        {/* Acciones (botón / mensaje) arriba */}
                        {actionArea}

                        <div className="border-t border-gray-200 pt-4">
                          <MembershipCTA 
                            clientRowId={clientRowId} 
                            hasActive={hasActive} 
                            hasPending={hasPending} 
                            onReloadClient={buscarCliente}
                          />
                        </div>

                      </div>
                    );
                  }

                  // Si tiene al menos una activa, mostramos acciones + encabezado y lista como antes
                  return (
                    <div className="mt-6">
                      {/* Acciones (botón / mensaje) arriba */}
                      {actionArea}

                      <div className="border-t border-gray-200 pt-4">
                        <h4 className="text-lg font-semibold text-black mb-3">Membresía activa</h4>
                        {membresias.filter(m => getEstado(m) === "activa").map((m, idx) => (
                          <div key={idx} className="bg-gradient-to-r from-green-600 to-emerald-600 border border-green-500 p-4 rounded-md mb-3">
                            <div className="text-sm text-white font-semibold">{m.Membresía}</div>
                            <div className="text-xs text-green-100 mt-1">Inicio: <span className="font-medium text-white">{formatDateForDisplay(m["Fecha de Inicio"])}</span></div>
                            <div className="text-xs text-green-100">Vencimiento: <span className="font-medium text-white">{formatDateForDisplay(m.Vencimiento)}</span></div>
                            <div className="text-xs text-green-100 mt-1">Turnos restantes: <span className="font-medium text-white">{m["Turnos Restantes"]}</span></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="mt-6 border-t border-gray-200 pt-4">
                <EditClientInline
                  client={cliente}
                  onSaved={(updated) => {
                    setCliente(updated);
                    setEditingClient(false);
                  }}
                  onCancel={() => setEditingClient(false)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-600 rounded-3xl shadow-2xl p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-white mb-8">Sacar turno</h3>

            <div className="mb-8">
              <label className="block font-bold text-white mb-4">Seleccione fecha</label>

              {loadingCalendar ? (
                <p className="text-gray-300 bg-gray-800/50 p-4 rounded-lg text-center">Cargando calendario...</p>
              ) : (
                <div>
                  <div className="grid grid-cols-7 gap-2 text-center mb-4 text-sm">
                    {dayNames.map((dn, idx) => <div key={idx} className="font-bold text-yellow-400 py-2">{dn}</div>)}
                  </div>

                  {weeks.length === 0 ? (
                    <div className="col-span-7 text-sm text-gray-400 bg-gray-800/50 p-4 rounded-lg text-center">No hay fechas disponibles en el rango.</div>
                  ) : (
                    <div>
                      {(() => {
                        const rows = [];
                        let lastMonth = null;
                        for (let wi = 0; wi < weeks.length; wi++) {
                          const week = weeks[wi];
                          const firstDay = week.find(d => d);
                          const weekMonth = firstDay ? firstDay.dateObj.getMonth() : null;
                          if (weekMonth !== null && weekMonth !== lastMonth) {
                            // insert month separator/header
                            const monthLabel = firstDay ? new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(firstDay.dateObj) : '';
                            rows.push(
                              <div key={"month-" + wi} className="col-span-7 text-center text-lg text-white font-bold py-4 border-b border-gray-600 mb-4">
                                {monthLabel}
                              </div>
                            );
                            // weekday header (una fila con las 7 columnas: Lunes, Martes, ...)
                            rows.push(
                              <div key={"weekday-header-" + wi} className="col-span-7 grid grid-cols-7 gap-2 text-center mb-3 text-sm">
                                {dayNames.map((dn, idx) => (
                                  <div key={idx} className="font-bold text-yellow-400 py-2">{dn}</div>
                                ))}
                              </div>
                            );
                            lastMonth = weekMonth;
                          }
                          rows.push(
                            <div key={"week-" + wi} className="col-span-7 grid grid-cols-7 gap-2">
                              {week.map((cell, ci) => {
                                if (!cell) return <div key={ci} className="h-14"></div>;
                                const isToday = cell.dateObj.toISOString().slice(0,10) === today.toISOString().slice(0,10);
                                const isSelected = cell.iso === fecha;
                                const base = cell.available ? 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-500' : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700';
                                // use inline style for selected to avoid class specificity issues
                                const style = isSelected ? { backgroundColor: '#eab308', color: '#000000', borderColor: '#eab308' } : undefined;
                                return (
                                  <button
                                    key={ci}
                                    onClick={() => selectFecha(cell.iso, cell)}
                                    disabled={!cell.available}
                                    aria-pressed={isSelected}
                                    style={style}
                                    className={`h-14 rounded-xl ${base} ${isToday ? 'ring-2 ring-yellow-400' : ''} flex items-center justify-center font-semibold transition-all duration-300 hover:scale-105`}
                                    title={cell.blocked ? "Día bloqueado" : !cell.available ? "Sin horarios" : `Horarios: ${cell.horarios.join(", ")}`}
                                  >
                                    <div className="text-sm">{cell.dateObj.getDate()}</div>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        }
                        return rows;
                      })()}
                    </div>
                  )}
                 <p className="text-sm text-gray-400 mt-4 font-medium bg-gray-800/50 p-3 rounded-lg">Fechas deshabilitadas están bloqueadas o sin horarios disponibles.</p>
                </div>
              )}
            </div>

            {/* mostrar hora solo si fecha seleccionada y disponible */}
            {fecha ? (
              <div className="mb-8">
                <label className="block font-bold text-white mb-4">Hora</label>
                {disponibilidadMsg && <p className="text-red-400 mb-4 font-medium bg-red-900/20 p-3 rounded-lg border border-red-800">{disponibilidadMsg}</p>}
                {/* Time picker: pasar las horas filtradas */}
                <TimePicker
                  options={horarios || []}        // horarios calculados por selectFecha (strings "HH:MM")
                  occupied={[]}                   // ya filtramos ocupados en backend / selectFecha; si querés pasar ocupados real, enviá aquí
                  onSelect={(h) => { setHora(h); setSelectedHoras([h]); }}
                  selected={hora}
                />
              </div>
            ) : null}

            {/* mostrar servicios solo si hora seleccionada */}
            {(allowsMultiple ? selectedHoras.length > 0 : hora) ? (
              <div className="mb-8">
                <label className="block font-bold text-white mb-4">Servicio</label>
                <select value={servicio} onChange={(e) => setServicio(e.target.value)} className="w-full p-4 border border-gray-600 bg-gray-800 text-white rounded-xl focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all">
                  <option value="">Seleccionar servicio</option>
                  {servicios.map((s, idx) => {
                    const id = s["Row ID"] || s["RowID"] || s.RowID || s.id || s["RowId"] || s["Row Id"];
                    const label = s.Servicio || s.servicio || s.name || JSON.stringify(s);
                    const value = (s.Servicio) ? s.Servicio : (id || label);
                    return <option key={idx} value={value}>{label}</option>;
                  })}
                </select>
              </div>
            ) : null}

            <div className="flex justify-end gap-4 pt-6 border-t border-gray-600">
              <button onClick={() => setShowModal(false)} className="px-6 py-3 border border-gray-600 bg-transparent hover:bg-gray-700 text-white rounded-xl font-semibold transition-all duration-300">
                Cancelar
              </button>
              {(!allowsMultiple && Array.isArray(upcoming) && upcoming.length > 0) ? (
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gray-300 font-medium bg-gray-800/50 p-3 rounded-lg">Si querés sacar más turnos este mes, por favor contactanos por Whatsapp</p>
                  <a href="https://wa.me/5491160220978?text=Hola%2C%20quiero%20sacar%20m%C3%A1s%20turnos" target="_blank" rel="noreferrer" className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-all duration-300">
                    Whatsapp
                  </a>
                </div>
              ) : (
                <button onClick={submitTurno} disabled={creating || !fecha || !(allowsMultiple ? selectedHoras.length>0 : hora) || !servicio} className="px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
                  {creating ? "Creando turno..." : "Confirmar turno"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// Componente de búsqueda/registro de cliente (named export para evitar dos default exports en el mismo archivo)
export function ClientSearchAndRegister({ onClientReady }) {
  const [contacto, setContacto] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [registerMode, setRegisterMode] = useState(false);
  const [contactType, setContactType] = useState(null); // "correo" | "teléfono"
  const [prefill, setPrefill] = useState({});
  const [form, setForm] = useState({ Nombre: "", Apellido: "", Telefono: "", Correo: "" });
  const [serverMsg, setServerMsg] = useState("");

  async function handleSearch(e) {
    e?.preventDefault();
    setErrorMsg(""); setServerMsg(""); setRegisterMode(false);
    if (!contacto) { setErrorMsg("Ingrese correo o teléfono"); return; }
    setLoading(true);
    try {
      const resp = await fetch("/api/turnos/find-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacto })
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.found) {
        setRegisterMode(false);
        setServerMsg("");
        if (onClientReady) onClientReady({ client: data.client, upcoming: data.upcoming });
      } else {
        setRegisterMode(true);
        setContactType(data.contactType || (/@/.test(contacto) ? "correo" : "teléfono"));
        setPrefill(data.prefill || {});
        setForm(prev => ({ ...prev, ...(data.prefill || {}) }));
        setServerMsg(data.message || `No se encontró el ${data.contactType || "contacto"} ingresado.`);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e?.preventDefault();
    setServerMsg(""); setErrorMsg("");
    if (!form.Nombre || !form.Apellido) { setErrorMsg("Complete Nombre y Apellido"); return; }
    if (!form.Telefono && !form.Correo) { setErrorMsg("Complete Teléfono o Correo"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/clients/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setServerMsg("Cliente creado correctamente.");
        setRegisterMode(false);
        if (onClientReady) onClientReady({ client: data.client });
      } else {
        setErrorMsg(data.message || "No se pudo crear cliente.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Error al crear cliente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Correo o Teléfono"
          value={contacto}
          onChange={e => setContacto(e.target.value)}
          style={{ width: 300, padding: 8 }}
        />
        <button type="submit" disabled={loading} style={{ marginLeft: 8 }}>
          {loading ? "..." : "Buscar"}
        </button>
      </form>

      {errorMsg && <div style={{ color: "red", marginBottom: 8 }}>{errorMsg}</div>}

      {registerMode && (
        <div style={{ border: "1px solid #ddd", padding: 12, maxWidth: 420 }}>
          <div style={{ color: "darkred", marginBottom: 8 }}>
            No se encontró el {contactType} ingresado, por favor complete sus datos para sacar un turno.
          </div>

          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: 8 }}>
              <input
                placeholder="Nombre"
                value={form.Nombre}
                onChange={e => setForm(f => ({ ...f, Nombre: e.target.value }))}
                style={{ width: "100%", padding: 8 }}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <input
                placeholder="Apellido"
                value={form.Apellido}
                onChange={e => setForm(f => ({ ...f, Apellido: e.target.value }))}
                style={{ width: "100%", padding: 8 }}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <input
                placeholder="Teléfono"
                value={form.Telefono}
                onChange={e => setForm(f => ({ ...f, Telefono: e.target.value }))}
                style={{ width: "100%", padding: 8 }}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <input
                placeholder="Correo"
                value={form.Correo}
                onChange={e => setForm(f => ({ ...f, Correo: e.target.value }))}
                style={{ width: "100%", padding: 8 }}
              />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={loading}>Crear y continuar</button>
              <button type="button" onClick={() => setRegisterMode(false)}>Cancelar</button>
            </div>

            {serverMsg && <div style={{ color: "green", marginTop: 8 }}>{serverMsg}</div>}
            {errorMsg && <div style={{ color: "red", marginTop: 8 }}>{errorMsg}</div>}
          </form>
        </div>
      )}
    </div>
  );
}

// helper para ordenar próximos turnos por Fecha (YYYY-MM-DD u otros) y por Hora (HH:MM / HH:MM:SS)
// devuelve nueva lista ordenada
const sortUpcoming = (items) => {
  if (!Array.isArray(items)) return [];
  const parseSafeDate = (s) => {
    if (!s) return null;
    try { return parseDateFromString(s); } catch (e) { const d = new Date(s); return isNaN(d) ? null : d; }
  };
  const normalizeHora = (h) => {
    const hh = onlyHHMM(h || "");
    const parts = hh.split(":").map(p => Number(p || 0));
    return { hh: parts[0] || 0, mm: parts[1] || 0 };
  };

  return items
    .map(t => ({ ...t, Fecha: String(t.Fecha ?? t.fecha ?? ""), Hora: String(t.Hora ?? t.hora ?? "") }))
    .sort((a, b) => {
      const da = parseSafeDate(a.Fecha) || new Date(a.Fecha || "");
      const db = parseSafeDate(b.Fecha) || new Date(b.Fecha || "");
      const ta = da && !isNaN(da.getTime()) ? da.getTime() : 0;
      const tb = db && !isNaN(db.getTime()) ? db.getTime() : 0;
      if (ta !== tb) return ta - tb;
      const na = normalizeHora(a.Hora);
      const nb = normalizeHora(b.Hora);
      if (na.hh !== nb.hh) return na.hh - nb.hh;
      return na.mm - nb.mm;
    });
};
