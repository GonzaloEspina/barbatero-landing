import * as appsheet from "../services/appsheetService.js";
import { normalizeRows, extractClientRowId, extractTimeHHMM } from "../utils/turnsUtils.js";

const TURNOS_TABLE = "Turnos";
const SERVICIOS_TABLE = "Servicios";
const CLIENTES_TABLE = "Clientes";

const pad2 = n => String(n).padStart(2, "0");
const safe = v => (v === null || v === undefined) ? "" : String(v).trim();
const safeLower = v => safe(v).toLowerCase();

async function findClienteById(id) {
  if (!id) return null;
  const safeId = safe(id).replace(/"/g, '\\"');
  try {
    let resp = await appsheet.findRows(CLIENTES_TABLE, `([Row ID] = "${safeId}")`);
    let rows = normalizeRows(resp) || [];
    if (rows.length) return rows[0];
    if (typeof appsheet.readRows === "function") {
      const all = await appsheet.readRows(CLIENTES_TABLE);
      if (!all) return null; // <-- proteger contra body vacío
      const allRows = normalizeRows(all) || [];
      return allRows.find(r => {
        const rid = safe(r["Row ID"] ?? r["RowID"] ?? r._RowNumber ?? r._RowKey);
        return rid === safeId;
      }) || null;
    }
    return null;
  } catch {
    return null;
  }
}

async function findClienteByName(name) {
  if (!name) return null;
  const safeName = safe(name).replace(/"/g, '\\"');
  try {
    let resp = await appsheet.findRows(CLIENTES_TABLE, `([Nombre y Apellido] = "${safeName}")`);
    let rows = normalizeRows(resp) || [];
    if (rows.length) return rows[0];
    if (typeof appsheet.readRows === "function") {
      const all = await appsheet.readRows(CLIENTES_TABLE);
      if (!all) return null; // <-- proteger contra body vacío
      const allRows = normalizeRows(all) || [];
      return allRows.find(r => safe(r["Nombre y Apellido"] ?? r.Nombre) === safe(name)) || null;
    }
    return null;
  } catch {
    return null;
  }
}

// --- nuevo: buscar cliente por correo (primero) o teléfono (fallback) ---
async function findClienteByContact(contact) {
  if (!contact) return null;
  const sc = safe(contact);
  const scEsc = sc.replace(/"/g, '\\"');
  const scLower = sc.toLowerCase();
  try {
    // buscar primero por Correo exacto con findRows (si devuelve algo, validar que el correo coincida)
    let resp = await appsheet.findRows(CLIENTES_TABLE, `([Correo] = "${scEsc}")`);
    let rows = normalizeRows(resp) || [];
    if (rows.length) {
      const candidate = rows[0];
      if (safeLower(candidate["Correo"]) === scLower) return candidate;
      // si findRows devolvió algo pero el correo no coincide (posible incoherencia), ignorar y seguir
    }

    // si findRows no devolvió match exacto, leer todas y comparar case-insensitive
    if (typeof appsheet.readRows === "function") {
      const all = await appsheet.readRows(CLIENTES_TABLE);
      if (!all) return null; // <-- proteger contra body vacío
      const allRows = normalizeRows(all) || [];
      const match = allRows.find(r => safeLower(r["Correo"]) === scLower);
      if (match) return match;
      // fallback por teléfono si no hay match por correo
      return allRows.find(r => safe(r["Teléfono"]) === sc) || null;
    }

    // si no hay readRows y findRows no encontró por correo, intentar teléfono con findRows (validando también)
    resp = await appsheet.findRows(CLIENTES_TABLE, `([Teléfono] = "${scEsc}")`);
    rows = normalizeRows(resp) || [];
    if (rows.length) {
      const candidate = rows[0];
      if (safe(candidate["Teléfono"]) === sc) return candidate;
    }

    return null;
  } catch {
    return null;
  }
}

function formatFechaDDMMAA(raw) {
  const v = safe(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-");
    return `${pad2(Number(d))}/${pad2(Number(m))}/${String(y).slice(-2)}`;
  }
  const dt = new Date(v);
  if (!isNaN(dt.getTime())) {
    return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${String(dt.getFullYear()).slice(-2)}`;
  }
  return v;
}

export async function createTurno(req, res) {
  try {
    const { contacto, clienteRowId, Fecha, Hora, Servicio, clienteName } = req.body;
    if (!Fecha || !Hora || (!clienteRowId && !clienteName && !contacto)) {
      return res.status(400).json({ message: "Faltan datos requeridos (Fecha, Hora y clienteRowId o clienteName o contacto)." });
    }

    const fechaForSheet = formatFechaDDMMAA(Fecha);
    const horaGuardar = (() => {
      const hm = safe(Hora);
      const m = hm.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
      return m ? `${String(Number(m[1])).padStart(2,'0')}:${m[2]}:00` : hm;
    })();

    // aceptar clienteRowId recibido tal cual (el frontend debe enviarlo) y usar clienteName si viene
    const clienteIdRaw = clienteRowId ? String(clienteRowId).trim() : "";
    let clienteIdNormalized = clienteIdRaw;
    let clienteNombre = clienteName ? safe(clienteName) : "";

    // intentar obtener nombre por id solo si no vino clienteName (no sobrescribir clienteId)
    if (!clienteNombre && clienteIdRaw) {
      const byId = await findClienteById(clienteIdRaw).catch(() => null);
      if (byId) {
        clienteNombre = safe(byId["Nombre y Apellido"] ?? byId.Nombre ?? byId["Nombre"]);
        // no tocar clienteIdNormalized; confiar en el clienteRowId enviado
      }
    }

    // Si por alguna razón aún no tenemos ID, fallar (no usar primer cliente)
    if (!clienteIdNormalized) {
      return res.status(400).json({ message: "No se pudo resolver Cliente ID. Verifique los datos de cliente." });
    }

    const servicioId = safe(Servicio);

    const newRow = {
      // enviar el Row ID EXACTO en Cliente ID (clave de la referencia)
      "Cliente ID": clienteIdNormalized,
      // enviar el nombre conocido (si existe) para evitar ambigüedad en AppSheet
      "Cliente": clienteNombre || "",
      "Fecha": fechaForSheet,
      "Hora": horaGuardar,
      "Servicio": servicioId
    };

    delete newRow["Row ID"];
    delete newRow["RowID"];
    delete newRow["_RowNumber"];
    delete newRow["_RowKey"];

    if (!appsheet || typeof appsheet.addRow !== "function") {
      return res.status(500).json({ message: "Servicio de datos no disponible" });
    }

    const created = await appsheet.addRow(TURNOS_TABLE, newRow);
    if (created) return res.status(201).json({ created: true, turno: created });

    // si addRow fue falsy, devolver error para que el frontend lo muestre
    return res.status(502).json({ message: "No se pudo crear turno en AppSheet (addRow devolvió vacío).", newRow });

    const esc = v => String(v || "").replace(/"/g, '\\"');
    const safeFecha = esc(fechaForSheet);
    const safeHora = esc(horaGuardar);
    const safeCid = esc(clienteIdNormalized || clienteRowId || "");
    const safeServicio = esc(servicioId);

    const filters = [
      `([Fecha] = "${safeFecha}") AND ([Hora] = "${safeHora}") AND ([Cliente ID] = "${safeCid}")`,
      `([Fecha] = "${safeFecha}") AND ([Hora] = "${safeHora}") AND ([Cliente] = "${safeCid}")`,
      `([Fecha] = "${safeFecha}") AND ([Hora] = "${safeHora}") AND ([Servicio] = "${safeServicio}")`
    ];

    let found = null;
    for (let attempt = 0; attempt < 3 && !found; attempt++) {
      for (const filter of filters) {
        try {
          const resp = await appsheet.findRows(TURNOS_TABLE, filter);
          const rows = normalizeRows(resp) || [];
          if (rows.length > 0) {
            found = rows[0];
            break;
          }
        } catch {
          // silencio en fallos internos de confirmación
        }
      }
      if (!found) {
        // esperar un poco antes de reintentar (evitar bombear el servidor con requests en caso de error)
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Si se encontró el turno creado, devolver confirmación
    if (found) {
      return res.status(201).json({ created: true, turno: found });
    }

    // Si después de reintentos no se encontró, devolver error
    return res.status(502).json({ message: "Turno creado pero no se pudo confirmar en AppSheet (findRows devolvió vacío)." });

  } catch (e) {
    console.error("Error en createTurno:", e);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
}

// --- confirmarTurno (nuevo) ---
export async function confirmarTurno(req, res) {
  try {
    const { turnoId, fecha, hora, servicio } = req.body;
    if (!turnoId || !fecha || !hora) {
      return res.status(400).json({ message: "Faltan datos requeridos (turnoId, fecha y hora)." });
    }

    const esc = v => String(v || "").replace(/"/g, '\\"');
    const safeTurnoId = esc(turnoId);
    const safeFecha = esc(formatFechaDDMMAA(fecha));
    const safeHora = esc(safe(hora));
    const safeServicio = esc(servicio);

    const filter = `([Row ID] = "${safeTurnoId}")`;

    // Buscar el turno por ID
    let resp = await appsheet.findRows(TURNOS_TABLE, filter);
    let rows = normalizeRows(resp) || [];
    if (rows.length === 0) {
      return res.status(404).json({ message: "Turno no encontrado." });
    }

    const turno = rows[0];

    // Confirmar que la fecha, hora y servicio coinciden
    const fechaHoraServicioCoinciden = (
      safe(turno.Fecha) === safeFecha &&
      safe(turno.Hora) === safeHora &&
      safe(turno.Servicio) === safeServicio
    );

    if (!fechaHoraServicioCoinciden) {
      return res.status(400).json({ message: "Los datos del turno no coinciden con los proporcionados." });
    }

    // --- aquí se podría agregar lógica adicional para la confirmación ---
    // Por ejemplo marcar una columna "Confirmado" en AppSheet (opcional, comentar si no aplica).
    try {
      const rowId = turno["Row ID"] ?? turno["RowID"] ?? turno._RowNumber ?? turno._rowNumber ?? null;
      if (rowId && typeof appsheet.updateRow === "function") {
        // intentar marcar como confirmado (no bloquear si falla)
        await appsheet.updateRow(TURNOS_TABLE, rowId, { Confirmado: true });
      }
    } catch {
      // ignorar fallos no críticos al intentar actualizar
    }

    // devolver confirmación y el registro del turno
    return res.status(200).json({ confirmed: true, turno });

  } catch (e) {
    console.error("Error en confirmarTurno:", e);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
}

export async function getServicios(req, res) {
  try {
    let resp = await appsheet.findRows(SERVICIOS_TABLE, `([Servicio] <> "")`);
    let rows = normalizeRows(resp) || [];
    if ((!rows || rows.length === 0) && typeof appsheet.readRows === "function") {
      const fallback = await appsheet.readRows(SERVICIOS_TABLE);
      rows = normalizeRows(fallback) || [];
    }
    return res.status(200).json(rows);
  } catch {
    return res.status(500).json({ message: "Error leyendo servicios" });
  }
}
