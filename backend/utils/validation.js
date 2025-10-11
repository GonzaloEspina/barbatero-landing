import { findRows } from "../services/appsheetService.js";

/* Helpers */
const weekdayNames = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

function parseDateISO(dateStr) {
  // espera 'YYYY-MM-DD'
  return new Date(dateStr + "T00:00:00");
}
function formatDateISO(d) {
  return d.toISOString().slice(0,10);
}

/* Funciones que consultan AppSheet (a través de findRows) */
export async function getClientByContact(contacto) {
  // Buscamos por Correo o Teléfono
  const q = await findRows("Clientes", [{ "Correo": contacto }, { "Teléfono": contacto }]);
  return q.rows[0] || null;
}

export async function getServiceByIdOrName({ servicioId, servicioName }) {
  if (servicioId) {
    const q = await findRows("Servicios", [{ "Row ID": servicioId }]);
    if (q.rows.length) return q.rows[0];
  }
  if (servicioName) {
    const q = await findRows("Servicios", [{ "Servicio": servicioName }]);
    if (q.rows.length) return q.rows[0];
  }
  return null;
}

export async function getDisponibilidadForDate(fechaISO) {
  const d = parseDateISO(fechaISO);
  const dayName = weekdayNames[d.getUTCDay()]; // usar getUTCDay para evitar zone-shift en T00:00:00
  const q = await findRows("Disponibilidad", [{ "Día": dayName }]);
  const row = q.rows[0] || null;
  if (!row || !row.Horarios) return [];
  // convertir string "09:30, 10:00, 10:30" -> lista limpia
  return row.Horarios.split(",").map(s => s.trim()).filter(Boolean);
}

export async function getOccupiedHoursForDate(fechaISO) {
  const q = await findRows("Turnos", [{ "Fecha": fechaISO }]);
  // return array of Hora values
  const horas = q.rows.map(r => (r.Hora || "").toString().trim()).filter(Boolean);
  return horas;
}

export async function getActiveMembershipForClient(clienteId, fechaISO) {
  const q = await findRows("Membresías Activas", [{ "Cliente": clienteId }]);
  const rows = q.rows;
  if (!rows.length) return null;
  // buscar si alguna tiene Fecha de Inicio <= fecha <= Vencimiento
  const target = parseDateISO(fechaISO).getTime();
  for (const r of rows) {
    if (!r["Fecha de Inicio"] || !r.Vencimiento) continue;
    const inicio = parseDateISO(r["Fecha de Inicio"]).getTime();
    const fin = parseDateISO(r.Vencimiento).getTime();
    if (inicio <= target && target <= fin) return r;
  }
  return null;
}

/* Validación principal */
export async function validateTurnData({ clienteId, fecha, hora, servicioId, servicioName }) {
  // Campos obligatorios
  if (!clienteId) return { ok: false, error: "clienteId requerido." };
  if (!fecha) return { ok: false, error: "fecha requerida (YYYY-MM-DD)." };
  if (!hora) return { ok: false, error: "hora requerida (ej: '09:30')." };

  // Convertir fechas y límites
  const hoy = new Date();
  hoy.setUTCHours(0,0,0,0);
  const fechaObj = parseDateISO(fecha);
  fechaObj.setUTCHours(0,0,0,0);
  const maxDate = new Date(hoy);
  maxDate.setUTCDate(maxDate.getUTCDate() + 30);

  if (fechaObj < hoy) return { ok: false, error: "La fecha debe ser hoy o posterior." };
  if (fechaObj > maxDate) return { ok: false, error: "La fecha no puede ser mayor a 30 días desde hoy." };

  // Cliente existe?
  const clientQ = await findRows("Clientes", [{ "Row ID": clienteId }]);
  const client = clientQ.rows[0];
  if (!client) return { ok: false, error: "Cliente no encontrado." };

  // Servicio existe?
  const service = await getServiceByIdOrName({ servicioId, servicioName });
  if (!service) return { ok: false, error: "Servicio no encontrado." };

  // Día permitido en Disponibilidad?
  const horariosDisponibles = await getDisponibilidadForDate(fecha);
  if (!horariosDisponibles.length) return { ok: false, error: "El día seleccionado no está disponible." };

  // Hora elegida está dentro de la lista de horarios del día?
  const horaNormalized = hora.trim();
  if (!horariosDisponibles.includes(horaNormalized)) {
    return { ok: false, error: `Hora no permitida. Horarios disponibles: ${horariosDisponibles.join(", ")}` };
  }

  // Verificar que no exista ya un turno en esa misma Fecha+Hora
  const ocupadas = await getOccupiedHoursForDate(fecha);
  if (ocupadas.includes(horaNormalized)) {
    return { ok: false, error: "La hora ya está reservada para esa fecha." };
  }

  // Validar membresía activa (opcional: devolvemos la membresía si existe)
  const membership = await getActiveMembershipForClient(clienteId, fecha);

  // OK: devolvemos payload final que usaremos para crear el turno
  return {
    ok: true,
    client,
    service,
    membership,
    finalRow: {
      "Row ID": null, // lo setea quien crea (backend)
      "Cliente": client["Nombre y Apellido"] || "",
      "Cliente ID": client["Row ID"],
      "Fecha": fecha,
      "Hora": horaNormalized,
      "Servicio": service["Servicio"] || "",
      "Valor": service["Valor"] || service["Valor en Efectivo"] || 0,
      "Contador": 0,
      // si querés agregar Membresía ID:
      "Membresía ID": membership ? membership["Row ID"] : ""
    }
  };
}

export function isEmail(v) {
  if (!v || typeof v !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
