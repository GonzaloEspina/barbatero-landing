import { useEffect, useState } from "react";
import CalendarGrid from "./CalendarGrid";
import TimePicker from "./TimePicker";
import ServiceSelect from "./ServiceSelect";
import NewClientForm from "./NewClientForm";
import ClientCard from "./ClientCard";
import { normalizeToHM, parseDateFromString, formatDateDMY, formatDateISO } from "./utils";
 
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

  // fecha: se usa internamente en MM/DD/YYYY (para lógica/payload)
  const [fecha, setFecha] = useState("");
  // fechaDisplay: lo que ve el usuario en DD/MM/YYYY
  const [fechaDisplay, setFechaDisplay] = useState("");
  // form state
   const [hora, setHora] = useState("");
   const [servicio, setServicio] = useState("");
   const [horarios, setHorarios] = useState([]);
   const [servicios, setServicios] = useState([]);
   const [creating, setCreating] = useState(false);
   const [disponibilidadMsg, setDisponibilidadMsg] = useState("");

  // calendar state
  const [calendarDays, setCalendarDays] = useState([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  const today = new Date();
  const maxDateObj = new Date(today);
  maxDateObj.setMonth(maxDateObj.getMonth() + 1);
  const minDateISO = formatDateISO(today);
  const maxDateISO = formatDateISO(maxDateObj);

  // helper: formatear Date -> MM/DD/YYYY (para lógica)
  const formatDateMMDD = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
  };
  // helper: formatear Date -> DD/MM/YYYY (para mostrar al usuario)
  const formatDateDDMM = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  const buscarCliente = async () => {
    if (!contacto) { setError("Ingrese un correo."); return; }
    setLoading(true); setCliente(null); setUpcoming([]); setError(""); setClientNotFound(false);
    try {
      const res = await fetch("/api/turnos/find-client", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contacto }) });
      const data = await res.json();
      if (res.ok && data.found) {
        setCliente(data.client);
        // mostrar upcoming en formato DD/MM/YYYY para el usuario
        const mapped = (data.upcoming || []).map(t => {
          try {
            const dt = parseDateFromString(t.Fecha);
            return { ...t, Fecha: dt ? formatDateDMY(dt) : (t.Fecha || "") };
          } catch { return t; }
        });
        setUpcoming(mapped);
        setClientNotFound(false);
      }
      else { setError(""); setClientNotFound(true); setNuevoNombre(""); setNuevoTelefono(""); }
    } catch (err) { console.error(err); setError("Error de conexión al backend."); }
    finally { setLoading(false); }
  };

  const crearYSeleccionarCliente = async () => {
    if (!contacto || !nuevoNombre) { setError("Ingrese nombre y correo para crear el cliente."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/turnos/create-client", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo: contacto, nombre: nuevoNombre, telefono: nuevoTelefono }) });
      const data = await res.json();
      if (res.ok) {
        // re-fetch client to obtain Row ID
        try {
          const r2 = await fetch("/api/turnos/find-client", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contacto }) });
          const d2 = await r2.json();
          if (r2.ok && d2.found) { setCliente(d2.client); setClientNotFound(false); setUpcoming(d2.upcoming || []); openModal(); }
          else { setCliente(data.client || { "Correo": contacto, "Nombre y Apellido": nuevoNombre, "Teléfono": nuevoTelefono }); setClientNotFound(false); openModal(); }
        } catch (e) { setCliente(data.client || { "Correo": contacto, "Nombre y Apellido": nuevoNombre, "Teléfono": nuevoTelefono }); setClientNotFound(false); openModal(); }
      } else setError(data.message || "No se pudo crear cliente.");
    } catch (e) { console.error(e); setError("Error creando cliente."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const loadServicios = async () => {
      try {
        const res = await fetch("/api/turnos/servicios");
        if (!res.ok) { setServicios([]); return; }
        const data = await res.json();
        setServicios(Array.isArray(data) ? data : []);
      } catch (e) { console.error("No se pudieron cargar servicios", e); setServicios([]); }
    };
    loadServicios();
  }, []);

  const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

  const buildDateRange = (fromISO, toISO) => {
    const out = [];
    const from = new Date(fromISO + "T00:00:00");
    const to = new Date(toISO + "T00:00:00");
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      out.push(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
    }
    return out;
  };

  const openModal = () => {
    setShowModal(true); setFecha(""); setFechaDisplay(""); setHora(""); setServicio(""); setHorarios([]); setDisponibilidadMsg(""); setCalendarDays([]); setLoadingCalendar(true);
    (async () => {
      try {
        const url = `/api/turnos/calendar?start=${encodeURIComponent(minDateISO)}&end=${encodeURIComponent(maxDateISO)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("calendar fetch failed " + res.status);
        const json = await res.json();
        const mapped = (json.days || []).map(d => ({
          iso: d.iso,
          dateObj: new Date(d.iso + "T00:00:00"),
          available: !!d.available,
          blocked: !!d.blocked,
          horarios: (d.horarios || []).map(normalizeToHM),
        }));
        setCalendarDays(mapped);
      } catch (e) {
        console.error("Error construyendo calendario:", e);
        const fallback = buildDateRange(minDateISO, maxDateISO).map(d => ({ iso: formatDateISO(d), dateObj: d, available: false, blocked: true, horarios: [] }));
        setCalendarDays(fallback);
      } finally { setLoadingCalendar(false); }
    })();
  };

  const selectFecha = (iso, payload) => {
    if (!payload || !payload.available) {
      setDisponibilidadMsg("El día ingresado no está disponible, por favor pruebe ingresando otra fecha.");
      setFecha(""); setFechaDisplay(""); setHorarios([]); setHora(""); setServicio(""); return;
    }
    const d = new Date(iso + "T00:00:00");
    setFecha(formatDateMMDD(d));          // lógica / payload -> MM/DD/YYYY
    setFechaDisplay(formatDateDDMM(d));  // lo que ve el usuario -> DD/MM/YYYY
    setHorarios((payload.horarios || []).map(normalizeToHM)); setDisponibilidadMsg(""); setHora(""); setServicio("");
  };

  const selectHora = (h) => setHora(h);

  // permitir múltiples turnos según columna de Clientes
  const allowsMultiple = (() => {
    if (!cliente) return true; // por defecto permitir si no hay info
    const v = cliente["¿Puede sacar múltiples turnos?"] ?? cliente["Puede sacar múltiples turnos"] ?? cliente.puedeMultiples ?? cliente.puede_multiple ?? "";
    return String(v).trim().toLowerCase() === "si";
  })();

  const hasUpcoming = Array.isArray(upcoming) && upcoming.length > 0;

  const submitTurno = async () => {
    if (!fecha || !hora || !servicio || !cliente) { setError("Complete Fecha, Hora y Servicio."); return; }
    setCreating(true); setError("");
    try {
      const clienteRowId = cliente["Row ID"] || cliente["RowID"] || cliente._RowNumber || cliente._rowNumber || cliente.id || cliente["Key"] || null;
      const horaParaEnviar = (hora && hora.match(/^\d{1,2}:\d{2}$/)) ? `${hora}:00` : hora;
      const payload = {
            contacto,
            clienteRowId,
            clienteName: cliente && (cliente["Nombre y Apellido"] || cliente.Nombre || cliente.name) || "",
            // enviar Fecha en MM/DD/YYYY (fecha tiene formato MM/DD/YYYY para la lógica)
            Fecha: fecha,
            Hora: horaParaEnviar,
            Servicio: servicio // esperamos que sea Row ID del servicio o nombre
        };
       const res = await fetch("/api/turnos/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
       const data = await res.json().catch(()=>null);
       if (res.ok) { setShowModal(false); await buscarCliente(); }
       else { console.error("create turno failed:", res.status, data); setError(data?.message || `Error al crear turno (status ${res.status})`); }
    } catch (e) { console.error(e); setError("Error de conexión al backend al crear turno."); }
    finally { setCreating(false); }
  };

  return (
    <div className="max-w-lg mx-auto mt-10 font-sans text-app-black">
      <h2 className="text-center text-2xl font-bold mb-6">Busca tu turno</h2>

      <div className="flex gap-2 mb-4">
        <input type="email" value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Ingrese correo del cliente" className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black" />
        <button onClick={buscarCliente} className="px-4 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors">{loading ? "Buscando..." : "Buscar"}</button>
      </div>

      {error && <p className="text-red-600 text-center mb-4">{error}</p>}

      {clientNotFound && <NewClientForm nuevoNombre={nuevoNombre} setNuevoNombre={setNuevoNombre} nuevoTelefono={nuevoTelefono} setNuevoTelefono={setNuevoTelefono} onCreate={crearYSeleccionarCliente} onCancel={() => setClientNotFound(false)} loading={loading} />}

      {cliente && (
        <div className="border border-gray-300 rounded-lg p-6 shadow-md bg-gray-50 text-black">
          <h3 className="text-xl font-bold text-blue-700 mb-4">Cliente encontrado</h3>
          <p><span className="font-semibold">Nombre:</span> <span className="font-bold">{cliente["Nombre y Apellido"]}</span></p>
          <p><span className="font-semibold">Teléfono:</span> <span className="font-bold">{cliente["Teléfono"] || "-"}</span></p>
          <p><span className="font-semibold">Correo:</span> <span className="font-bold">{cliente.Correo || contacto}</span></p>

          <div className="mt-4">
            <h4 className="font-semibold">Próximos turnos</h4>
            {(!Array.isArray(upcoming) || upcoming.length === 0) ? (
              <div className="mt-2">
                <p>No hay turnos futuros.</p>
                <button
                  onClick={openModal}
                  className="mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Sacar Turno
                </button>
              </div>
            ) : (
              <div className="mt-2">
                <ul className="space-y-2">
                  {upcoming.map((t, i) => (
                    <li key={i} className="p-2 bg-white rounded border">
                      <div><span className="font-semibold">Fecha:</span> {t.Fecha}</div>
                      <div><span className="font-semibold">Hora:</span> {t.Hora}</div>
                      <div><span className="font-semibold">Servicio:</span> {t.Servicio}</div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3">
                  {(!allowsMultiple) ? (
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-gray-700">Si querés sacar más turnos este mes, por favor contactanos por Whatsapp</p>
                      <a
                        href="https://wa.me/541160220978?text=Hola%2C%20quiero%20sacar%20un%20turno"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 bg-green-600 text-white rounded"
                      >
                        Whatsapp
                      </a>
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-bold mb-4">Sacar turno</h3>

            <div className="mb-4">
              <label className="block font-semibold mb-2">Seleccione fecha</label>
              <CalendarGrid calendarDays={calendarDays} loading={loadingCalendar} minDateISO={minDateISO} dayNames={dayNames} onSelectFecha={selectFecha} />
              <p className="text-xs text-gray-500 mt-2">Fechas deshabilitadas están bloqueadas o sin horarios disponibles.</p>
            </div>

            {fecha && (
              <div className="mb-4">
                <label className="block font-semibold mb-2">Hora</label>
                <TimePicker horarios={horarios} hora={hora} onSelectHora={selectHora} disponibilidadMsg={disponibilidadMsg} />
              </div>
            )}

            {hora && (
              <div className="mb-4">
                <label className="block font-semibold mb-2">Servicio</label>
                <ServiceSelect servicios={servicios} servicio={servicio} setServicio={setServicio} />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-3 py-1 border rounded">Cancelar</button>

              {(!allowsMultiple && hasUpcoming) ? (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-700">Si querés sacar más turnos este mes, por favor contactanos por Whatsapp</p>
                  <a
                    href="https://wa.me/541160220978?text=Hola%2C%20quiero%20sacar%20m%C3%A1s%20turnos"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 bg-green-600 text-white rounded"
                  >
                    Whatsapp
                  </a>
                </div>
              ) : (
                <button onClick={submitTurno} disabled={creating || !fecha || !hora || !servicio} className="px-3 py-1 bg-blue-600 text-white rounded">{creating ? "Creando..." : "Confirmar"}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}