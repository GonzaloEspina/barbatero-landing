import fetch from "node-fetch"; // si ya usas global fetch omitir esta línea
import dotenv from "dotenv";
dotenv.config();

const BASE = process.env.APPSHEET_BASE_URL; // ya tenés en .env
const APP_KEY = process.env.APPSHEET_APPLICATION_KEY || process.env.APPSHEET_API_KEY || process.env.APPLICATIONACCESSKEY || process.env.APPSHEET_ACCESS_KEY;

if (!BASE) {
  console.warn("AppSheet env: falta APPSHEET_BASE_URL");
}

async function doAction(tableName, body) {
  const base = BASE;
  const url = `${base}/tables/${encodeURIComponent(tableName)}/Action`;
  const headers = {
    "Content-Type": "application/json",
  };
  if (APP_KEY) headers.ApplicationAccessKey = APP_KEY;
  console.log("[AppSheet] POST", url, "body:", JSON.stringify(body));
  console.log("[AppSheet] request headers:", headers);

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    // optional: timeout handling if your fetch lib supports it
  });

  // log response headers
  try {
    const hdrs = {};
    resp.headers.forEach((v,k) => hdrs[k] = v);
    console.log("[AppSheet] response headers:", hdrs);
  } catch(e) { /* ignore */ }

  const raw = await resp.text().catch(() => "");
  console.log(`[AppSheet] response status ${resp.status} raw:`, raw);

  let json = null;
  try { json = raw ? JSON.parse(raw) : null; } catch (err) { console.warn("[AppSheet] response not JSON"); json = raw; }

  // return whatever AppSheet returned (even null) so caller can inspect
  return json;
}

/**
 * Lectura sencilla de todas las filas (puede paginarse según AppSheet)
 */
export async function readRows(tableName) {
  const body = { Action: "Read", Properties: {}, Rows: [] };
  return await doAction(tableName, body);
}

/**
 * Búsqueda por filtro (AppSheet usa expresiones en Filter)
 * filter example: '([Correo] = "user@example.com")'
 */
export async function findRows(table, filter) {
  const body = { Action: "Find", Properties: {}, Rows: [], Filter: filter || "" };
  return await doAction(table, body);
}

/**
 * Agregar fila nueva
 * newRow: objeto con columnas
 */
export async function addRow(table, rowObject) {
  if (!BASE) throw new Error("APPSHEET_BASE_URL no configurado");
  const url = `${BASE.replace(/\/$/, "")}/tables/${encodeURIComponent(table)}/Action`;
  const body = {
    Action: "Add",
    Properties: {},
    Rows: [rowObject]
  };
  const headers = {
    "Content-Type": "application/json",
  };
  if (APP_KEY) headers.ApplicationAccessKey = APP_KEY;
  const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!resp.ok) {
    const txt = await resp.text().catch(()=>null);
    throw new Error(`AppSheet addRow failed status=${resp.status} body=${txt}`);
  }
  const json = await resp.json().catch(() => null);
  return json;
}

// Agregar updateRow (Action: "Edit") - rowObject debe incluir "Row ID"
export async function updateRow(table, rowObject) {
  if (!BASE) throw new Error("APPSHEET_BASE_URL no configurado");
  const url = `${BASE.replace(/\/$/, "")}/tables/${encodeURIComponent(table)}/Action`;
  const body = {
    Action: "Edit",
    Properties: {},
    Rows: [rowObject]
  };
  const headers = {
    "Content-Type": "application/json",
  };
  if (APP_KEY) headers.ApplicationAccessKey = APP_KEY;
  const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => null);
    throw new Error(`AppSheet updateRow failed status=${resp.status} body=${txt}`);
  }
  const json = await resp.json().catch(() => null);
  return json;
}

/**
 * Buscar cliente por correo electrónico
 */
export async function findClientByEmail(email) {
  console.log("[findClientByEmail] buscando:", email);
  const safeEmail = String(email || "").trim();
  const safeEscaped = safeEmail.replace(/"/g, '\\"');
  const normalize = s => String(s || "").trim().toLowerCase();

  const pickByEmail = (rows) => {
    if (!Array.isArray(rows)) return null;
    const target = normalize(safeEmail);
    return rows.find(r => normalize(r.Correo) === target) || null;
  };

  // Intento Filter
  try {
    const filter = `([Correo] = "${safeEscaped}")`;
    const byFilter = await findRows("Clientes", filter);
    let rows = [];
    if (Array.isArray(byFilter)) rows = byFilter;
    else rows = byFilter?.Rows || byFilter?.rows || [];
    console.log("[findClientByEmail] byFilter rows:", rows.length);
    const match = pickByEmail(rows);
    if (match) return match;
  } catch (err) {
    console.error("[findClientByEmail] error filter:", err.message);
  }

  // Fallback: enviar Rows en body
  try {
    const url = `${BASE}/tables/${encodeURIComponent("Clientes")}/Action`;
    const body = { Action: "Find", Properties: {}, Rows: [{ "Correo": safeEmail }] };
    console.log("[findClientByEmail] fallback POST body:", body);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "ApplicationAccessKey": API_KEY_USED },
      body: JSON.stringify(body)
    });
    const text = await res.text().catch(() => "");
    const raw = text ? JSON.parse(text) : null;
    const rows = Array.isArray(raw) ? raw : (raw?.Rows || raw?.rows || []);
    console.log("[findClientByEmail] fallback rows:", rows.length);
    const match = pickByEmail(rows);
    if (match) return match;
  } catch (err) {
    console.error("[findClientByEmail] error fallback:", err.message);
  }

  return null;
}
