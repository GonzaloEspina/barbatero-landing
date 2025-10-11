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

  // form state
  const [fecha, setFecha] = useState("");
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

  const buscarCliente = async () => {
    if (!contacto) { setError("Ingrese un correo."); return; }
    setLoading(true); setCliente(null); setUpcoming([]); setError(""); setClientNotFound(false);
    try {
      const res = await fetch("/api/turnos/find-client", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contacto }) });
      const data = await res.json();
      if (res.ok && data.found) { setCliente(data.client); setUpcoming(data.upcoming || []); setClientNotFound(false); }
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
    setShowModal(true); setFecha(""); setHora(""); setServicio(""); setHorarios([]); setDisponibilidadMsg(""); setCalendarDays([]); setLoadingCalendar(true);
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
      setFecha(""); setHorarios([]); setHora(""); setServicio(""); return;
    }
    setFecha(iso); setHorarios((payload.horarios || []).map(normalizeToHM)); setDisponibilidadMsg(""); setHora(""); setServicio("");
  };

  const selectHora = (h) => setHora(h);

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

      {cliente && <ClientCard cliente={cliente} upcoming={upcoming} openModal={openModal} />}

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
              <button onClick={submitTurno} disabled={creating || !fecha || !hora || !servicio} className="px-3 py-1 bg-blue-600 text-white rounded">{creating ? "Creando..." : "Confirmar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}