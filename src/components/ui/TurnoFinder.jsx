import { useEffect, useState, useMemo } from "react";
import CalendarGrid from "./CalendarGrid";
import TimePicker from "./TimePicker";
import ServiceSelect from "./ServiceSelect";
import NewClientForm from "./NewClientForm";
import ClientCard from "./ClientCard";
import { normalizeToHM, parseDateFromString } from "./utils";

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
  const [clientNotFound, setClientNotFound] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTelefono, setNuevoTelefono] = useState("");
  const [upcoming, setUpcoming] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

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
    try {
      const res = await fetch("/api/turnos/find-client", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contacto })
      });
      const data = await res.json();
      if (res.ok && data.found) {
        setCliente(data.client);
        setUpcoming(Array.isArray(data.upcoming) ? data.upcoming.map(t => ({ ...t, Hora: onlyHHMM(t.Hora) })) : []);
        setClientNotFound(false);
      } else {
        setError(data.message || "No se encontró cliente con ese correo.");
        setClientNotFound(true);
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
    // si existe normalizeToHM importada, probarla primero
    try {
      const fromUtil = normalizeToHM(h);
      if (fromUtil && /^\\d{1,2}:\\d{2}$/.test(fromUtil)) return fromUtil;
    } catch {}
    const s = String(h).replace(/\\u00A0/g, " ").trim();
    // buscar la primera aparición de HH:MM en cualquiera parte del string (maneja "12/30/1899 09:30:00")
    const m = s.match(/(\\d{1,2}:\\d{2})/);
    if (m) return m[1].padStart(5, "0");
    // fallback: devolver trimmed original
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
    setFechaDisplay(formatDateForDisplay(iso));

    // normalizar horarios del payload (ya deberían venir HH:MM, pero por si acaso)
    const dayHorarios = Array.isArray(payload.horarios) ? payload.horarios.map(h => onlyHHMM(h)).filter(Boolean) : [];

    // pedir disponibilidad AL BACKEND (que devuelve { horarios: [...] } con los horarios DISPONIBLES)
    try {
      const res = await fetch(`/api/turnos/disponibilidad?fecha=${encodeURIComponent(iso)}`);
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
          type="email"
          value={contacto}
          onChange={(e) => setContacto(e.target.value)}
          placeholder="Ingrese correo del cliente"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
        />
        <button onClick={buscarCliente} className="px-4 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors">
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {error && <p className="text-red-600 text-center mb-4">{error}</p>}

      {cliente && (
        <div className="border border-gray-300 rounded-lg p-6 shadow-md bg-gray-50 text-gray-800">
          <h3 className="text-xl font-bold text-blue-700 mb-4">Cliente encontrado</h3>
          <p><span className="font-semibold">Nombre:</span> <span className="font-bold">{cliente["Nombre y Apellido"]}</span></p>
          <p><span className="font-semibold">Teléfono:</span> <span className="font-bold">{cliente["Teléfono"] || "-"}</span></p>
          <p><span className="font-semibold">Correo:</span> <span className="font-bold">{cliente.Correo || contacto}</span></p>

          <div className="mt-4">
            <h4 className="font-semibold">Próximos turnos</h4>
            {(!Array.isArray(upcoming) || upcoming.length === 0) ? (
              <div className="mt-2">
                <p>No hay turnos futuros.</p>
                <button onClick={openModal} className="mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Sacar Turno</button>
              </div>
            ) : (
              <div className="mt-2">
                <ul className="space-y-2">
                  {upcoming.map((t, i) => (
                    <li key={i} className="p-2 bg-white rounded border">
                      <div><span className="font-semibold">Fecha:</span> {formatDateForDisplay(t.Fecha)}</div>
                      <div><span className="font-semibold">Hora:</span> {t.Hora}</div>
                      <div><span className="font-semibold">Servicio:</span> {t.Servicio}</div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3">
                  {(!allowsMultiple) ? (
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-gray-700">Si querés sacar más turnos este mes, por favor contactanos por Whatsapp</p>
                      <a href="https://wa.me/541160220978?text=Hola%2C%20quiero%20sacar%20m%C3%A1s%20turnos" target="_blank" rel="noreferrer" className="px-3 py-1 bg-green-600 text-white rounded">Whatsapp</a>
                    </div>
                  ) : (
                    <button onClick={openModal} className="px-3 py-1 text-sm bg-yellow-500 rounded">Sacar otro turno</button>
                  )}
                </div>
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