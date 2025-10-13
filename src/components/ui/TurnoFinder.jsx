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
  const [loading, setLoading] = useState(false);
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
  const [creating, setCreating] = useState(false);
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
        const res = await fetch("/api/turnos/servicios");
        if (!res.ok) { setServicios([]); return; }
        const data = await res.json();
        setServicios(Array.isArray(data) ? data : []);
      } catch (e) {
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
      const res = await fetch("/api/turnos/find-client", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contacto })
      });
      const data = await res.json();
      if (res.ok && data.found) {
        setCliente(data.client);
        setUpcoming(Array.isArray(data.upcoming) ? data.upcoming.map(t => ({ ...t, Hora: onlyHHMM(t.Hora) })) : []);
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

  // helper local por seguridad (asegura HH:MM)
  const onlyHHMM = (h) => {
    if (h === null || h === undefined) return "";
    // normalizar a string y limpiar NBSP
    const s = String(h).replace(/\u00A0/g, " ").trim();
    // si normalizeToHM entrega ya HH:MM válido, retornarlo
    try {
      const fromUtil = normalizeToHM(h);
      if (fromUtil && /^\d{1,2}:\d{2}$/.test(fromUtil)) return fromUtil.padStart(5, "0");
    } catch {}
    // buscar primer patrón HH:MM (acepta seguido opcionalmente :SS)
    const m = s.match(/(\d{1,2}:\d{2})(?::\d{2})?/);
    if (m) return m[1].padStart(5, "0");
    // fallback: devolver el string original (trimmed)
    return s;
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

    // pedir disponibilidad AL BACKEND (que devuelve { horarios: [...] } con los horarios DISPONIBLES)
    try {
      // añadir cache-bust para evitar 304/response cached que deje datos desactualizados
      const res = await fetch(`/api/turnos/disponibilidad?fecha=${encodeURIComponent(iso)}&_=${Date.now()}`);
      if (res.ok) {
        const json = await res.json().catch(()=>null);
        if (json && Array.isArray(json.horarios)) {
          // backend ya nos devolvió horarios disponibles (HH:MM). Usamos eso directamente.
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

    // fallback: filtrar payload.horarios quitando ocupados (si por alguna razón backend no devolvió lista)
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

      const payload = {
        contacto,
        clienteRowId,
        clienteName: cliente && (cliente["Nombre y Apellido"] || cliente.Nombre || cliente.name) || "",
        Fecha: fecha, // ISO string enviado tal cual
        Hora: horaParaEnviar,
        Servicio: servicio
      };

      const res = await fetch("/api/turnos/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(()=>null);
      if (res.ok) {
        setShowModal(false);
        await buscarCliente();
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
    <div className="max-w-lg mx-auto mt-10 font-sans">
      <h2 className="text-center text-2xl font-bold mb-6">Busca tu turno</h2>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={contacto}
          onChange={(e) => setContacto(e.target.value)}
          placeholder="Ingrese correo o teléfono"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
        />
        <button onClick={buscarCliente} className="px-4 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors">
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {error && <p className="text-red-600 text-center mb-4">{error}</p>}

      {/* Formulario de registro mostrado si no se encontró el cliente */}
      {registerMode && (
        <div className="max-w-lg mx-auto mb-6 p-4 border rounded bg-gradient-to-r from-blue-50 to-white">
          <p className="text-blue-800 font-semibold mb-3">No se encontró el contacto ingresado. Registrate para poder sacar un turno.</p>
          {/* Se muestra sólo el encabezado amigable; no duplicar el mensaje dentro del formulario */}
          <div className="space-y-2">
            <input
              placeholder="Nombre y Apellido"
              value={registerForm.Nombre}
              onChange={e => setRegisterForm(f => ({ ...f, Nombre: e.target.value }))}
              className="w-full p-2 border rounded"
            />
            <input
              placeholder="Teléfono"
              value={registerForm.Telefono}
              onChange={e => setRegisterForm(f => ({ ...f, Telefono: e.target.value }))}
              className="w-full p-2 border rounded"
            />
            <input
              placeholder="Correo"
              value={registerForm.Correo}
              onChange={e => setRegisterForm(f => ({ ...f, Correo: e.target.value }))}
              className="w-full p-2 border rounded"
            />
            <div className="flex gap-2">
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
                      setUpcoming(Array.isArray(json.upcoming) ? json.upcoming : []);
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
                className="px-4 py-2 bg-green-600 text-white rounded"
                disabled={registerLoading}
              >
                {registerLoading ? "Creando..." : "Crear y continuar"}
              </button>
              <button onClick={() => { setRegisterMode(false); setRegisterError(""); }} className="px-4 py-2 border rounded">Cancelar</button>
            </div>
            {registerError && <div className="text-red-600 mt-2">{registerError}</div>}
          </div>
        </div>
      )}

      {cliente && (
        <div className="max-w-md mx-auto mb-6">
          <div className="bg-gray-900 text-white rounded-lg shadow-lg p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">Tus datos</h3>
                <p className="text-sm text-gray-300 mt-1">Revisá y editá si hace falta antes de sacar el turno.</p>
              </div>
              <div>
                {!editingClient && (
                  <button
                    onClick={() => setEditingClient(true)}
                    className="ml-3 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm shadow-sm"
                  >
                    Editar
                  </button>
                )}
              </div>
            </div>

            {!editingClient ? (
              <div className="mt-4 space-y-2">
                <div className="text-sm text-gray-300"><span className="font-semibold text-gray-100">Nombre:</span> {cliente["Nombre y Apellido"] ?? cliente.Nombre ?? ""}</div>
                <div className="text-sm text-gray-300"><span className="font-semibold text-gray-100">Teléfono:</span> {cliente["Teléfono"] ?? cliente.Telefono ?? ""}</div>
                <div className="text-sm text-gray-300"><span className="font-semibold text-gray-100">Correo:</span> {cliente["Correo"] ?? cliente.Correo ?? ""}</div>

                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-200 mb-2">Próximos turnos</h4>
                  {upcoming.length === 0 ? (
                    <div className="text-sm text-gray-400">No hay próximos turnos.</div>
                  ) : (
                    <div className="space-y-2">
                      {upcoming.map((t, i) => (
                        <div key={i} className="bg-gray-800 p-3 rounded-md flex items-center justify-between">
                          <div>
                            <div className="text-sm text-gray-100">{formatDateForDisplay(t.Fecha)}</div>
                            <div className="text-xs text-gray-400">{t.Servicio}</div>
                          </div>
                          <div className="text-sm font-medium text-gray-50">{onlyHHMM(t.Hora)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                                          {/* Mostrar acción para sacar turno (respeta la regla de allowsMultiple / within30Days) */}
                        <div className="mt-3">
                          {allowsMultiple ? (
                            <button onClick={() => openModal()} className="px-4 py-2 bg-blue-600 text-white rounded-md">
                              Sacar otro turno
                            </button>
                          ) : (
                             within30Days ? (
                               <div className="text-sm text-yellow-300">
                                 Ya tenés un turno en los próximos 30 días. Si necesitás sacar otro, contactanos por Whatsapp.
                               </div>
                             ) : (
                              <button onClick={() => openModal()} className="px-4 py-2 bg-blue-600 text-white rounded-md">
                                 Sacar turno
                               </button>
                             )
                           )}
                         </div>
                {/* Membresías activas / CTA */}
                {(() => {
                  const clientRowId = cliente && (cliente["Row ID"] || cliente.RowID || cliente._RowNumber || cliente.id || cliente.Key || "");

                  // Normalizar estados (usar la columna "Estado" que definiste en AppSheet)
                  const getEstado = (m) => String(m?.Estado ?? m?.["Estado"] ?? m?.estado ?? "").trim().toLowerCase();

                  const hasActive = Array.isArray(membresias) && membresias.some(m => getEstado(m).includes("activa"));
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

                  // Si hay membresía pendiente mostramos la sección "Membresías Activas" con estado pendiente
                  if (hasPending) {
                    const pending = (membresias || []).filter(m => getEstado(m).includes("pendiente"));
                    return (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-gray-200 mb-2">Membresía Activa</h4>
                        {pending.map((m, idx) => {
                          const alias = "barbatero.mp";
                          return (
                            <div key={idx} className="p-3 rounded-md mb-2 bg-gradient-to-r from-yellow-900 to-gray-800">
                              <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-100 font-semibold">
                                  {m.Membresía ?? m.membresia ?? ""}
                                  <span className="text-xs text-yellow-100 ml-2"> - Pendiente de Confirmación</span>
                                </div>
                              </div>

                              {/* texto de activación arriba del alias */}
                              <div className="mt-3 text-sm text-gray-200">
                                Para activar la membresía, realizá el pago y envianos el comprobante por Whatsapp.
                              </div>

                              {/* alias + acciones repartidos en todo el ancho */}
                              <div className="mt-3 border-t pt-3 w-full flex items-center">
                                {/* left: alias + copiar (ocupa todo el espacio disponible) */}
                                <div className="flex items-center gap-3 flex-1">
                                  <div className="text-sm text-gray-200">Alias:</div>

                                  {/* alias sin fondo - texto plano */}
                                  <span className="text-gray-100 font-mono font-medium">{alias}</span>

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
                                    href={`https://wa.me/54911XXXXXXXX?text=${encodeURIComponent("Adjunto comprobante de pago para la membresía")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center w-10 h-10 rounded-full border-2 border-green-600 bg-transparent hover:bg-green-600 transition-colors"
                                    title="Enviar comprobante por WhatsApp"
                                    aria-label="Enviar comprobante por WhatsApp"
                                  >
                                    {/* WhatsApp PNG icon (clean) */}
                                    <img
                                      src="https://cdn-icons-png.freepik.com/256/174/174879.png?semt=ais_white_label"
                                      alt="WhatsApp"
                                      className="w-5 h-5"
                                    />
                                  </a>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  // Si NO tiene membresía activa ni pendiente mostramos solo el CTA (sin encabezado)
                  if (!hasActive && !hasPending) {
                    return (
                      <div className="mt-4 mb-4">
                        <MembershipCTA clientRowId={clientRowId} hasActive={hasActive} hasPending={hasPending} />
                        {/* Mensaje secundario */}
                        <div className="text-sm text-gray-400 mt-3">No tenés una membresía activa.</div>

                        {/* botón para sacar turno: si permite múltiples, mostrar siempre; si no, mostrar solo si NO hay turno en próximos 30 días */}
                        <div className="mt-3">
                          {allowsMultiple ? (
                            <button onClick={() => openModal()} className="px-4 py-2 bg-blue-600 text-white rounded-md">
                              Sacar otro turno
                            </button>
                          ) : (
                            within30Days ? (
                              <div className="text-sm text-yellow-300">
                                Ya tenés un turno en los próximos 30 días. Si necesitás sacar otro, contactanos por Whatsapp.
                              </div>
                            ) : (
                              <button onClick={() => openModal()} className="px-4 py-2 bg-blue-600 text-white rounded-md">
                                Sacar turno
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Si tiene al menos una activa, mostramos encabezado y lista como antes
                  return (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-200 mb-2">Membresía activa</h4>
                      {membresias.filter(m => getEstado(m).includes("activa")).map((m, idx) => (
                        <div key={idx} className="bg-gradient-to-r from-green-900 to-gray-800 p-3 rounded-md mb-2">
                          <div className="text-sm text-gray-100 font-semibold">{m.Membresía}</div>
                          <div className="text-xs text-gray-300">Inicio: <span className="font-medium text-gray-200">{m["Fecha de Inicio"]}</span></div>
                          <div className="text-xs text-gray-300">Vencimiento: <span className="font-medium text-gray-200">{m.Vencimiento}</span></div>
                          <div className="text-xs text-gray-300 mt-1">Turnos restantes: <span className="font-medium text-green-200">{m["Turnos Restantes"]}</span></div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="mt-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-bold mb-4">Sacar turno</h3>

            <div className="mb-4">
              <label className="block font-semibold mb-2">Seleccione fecha</label>

              {loadingCalendar ? (
                <p>Cargando calendario...</p>
              ) : (
                <div>
                  <div className="grid grid-cols-7 gap-1 text-center mb-2 text-xs">
                    {dayNames.map((dn, idx) => <div key={idx} className="font-semibold">{dn}</div>)}
                  </div>

                  {weeks.length === 0 ? (
                    <div className="col-span-7 text-sm text-gray-600">No hay fechas disponibles en el rango.</div>
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
                              <div key={"month-" + wi} className="col-span-7 text-center text-xs text-gray-600 py-1 border-b">
                                {monthLabel}
                              </div>
                            );
                            // weekday header (una fila con las 7 columnas: Lunes, Martes, ...)
                            rows.push(
                              <div key={"weekday-header-" + wi} className="col-span-7 grid grid-cols-7 gap-1 text-center mb-1 text-xs">
                                {dayNames.map((dn, idx) => (
                                  <div key={idx} className="font-semibold text-gray-700">{dn}</div>
                                ))}
                              </div>
                            );
                            lastMonth = weekMonth;
                          }
                          rows.push(
                            <div key={"week-" + wi} className="col-span-7 grid grid-cols-7 gap-2">
                              {week.map((cell, ci) => {
                                if (!cell) return <div key={ci} className="h-10"></div>;
                                const isToday = cell.dateObj.toISOString().slice(0,10) === today.toISOString().slice(0,10);
                                const isSelected = cell.iso === fecha;
                                const base = cell.available ? 'bg-white hover:bg-blue-50 text-black' : 'bg-gray-200 text-gray-400 cursor-not-allowed';
                                // use inline style for selected to avoid class specificity issues
                                const style = isSelected ? { backgroundColor: '#2563eb', color: '#ffffff' } : undefined;
                                return (
                                  <button
                                    key={ci}
                                    onClick={() => selectFecha(cell.iso, cell)}
                                    disabled={!cell.available}
                                    aria-pressed={isSelected}
                                    style={style}
                                    className={`h-10 rounded ${base} ${isToday ? 'ring-2 ring-blue-300' : ''} flex items-center justify-center`}
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
                 <p className="text-xs text-gray-500 mt-2">Fechas deshabilitadas están bloqueadas o sin horarios disponibles.</p>
                </div>
              )}
            </div>

            {/* mostrar hora solo si fecha seleccionada y disponible */}
            {fecha ? (
              <div className="mb-4">
                <label className="block font-semibold mb-2">Hora</label>
                {disponibilidadMsg && <p className="text-red-600 mb-2">{disponibilidadMsg}</p>}
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
              <div className="mb-4">
                <label className="block font-semibold mb-2">Servicio</label>
                <select value={servicio} onChange={(e) => setServicio(e.target.value)} className="mt-1 w-full p-2 border rounded">
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

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-3 py-1 border rounded">Cancelar</button>
              {(!allowsMultiple && Array.isArray(upcoming) && upcoming.length > 0) ? (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-700">Si querés sacar más turnos este mes, por favor contactanos por Whatsapp</p>
                  <a href="https://wa.me/541160220978?text=Hola%2C%20quiero%20sacar%20m%C3%A1s%20turnos" target="_blank" rel="noreferrer" className="px-3 py-1 bg-green-600 text-white rounded">Whatsapp</a>
                </div>
              ) : (
                <button onClick={submitTurno} disabled={creating || !fecha || !(allowsMultiple ? selectedHoras.length>0 : hora) || !servicio} className="px-3 py-1 bg-blue-600 text-white rounded">
                  {creating ? "Creando..." : "Confirmar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
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
