import dotenv from "dotenv";
import fetch from "node-fetch";
dotenv.config();

const APP_ID = process.env.APPSHEET_APP_ID;
const API_KEY = process.env.APPSHEET_API_KEY;
const BASE_FROM_ENV = process.env.APPSHEET_BASE_URL;
const ACCESS_KEY = process.env.APPSHEET_ACCESS_KEY;

// Construir base: si pasaste APPSHEET_BASE_URL (por ejemplo "https://api.appsheet.com/api/v2/apps/<APP_ID>")
// úsala tal cual (sin slash final), si no, usar APP_ID para formar la URL.
const BASE = (BASE_FROM_ENV && BASE_FROM_ENV.replace(/\/$/, "")) ||
             (APP_ID ? `https://api.appsheet.com/api/v2/apps/${APP_ID}` : "https://api.appsheet.com/api/v2/apps");

const API_KEY_USED = API_KEY || ACCESS_KEY;

if ((!APP_ID && !BASE_FROM_ENV) || !API_KEY_USED) {
  console.warn("AppSheet env: falta APPSHEET_BASE_URL o APPSHEET_APP_ID / falta APPSHEET_ACCESS_KEY o APPSHEET_API_KEY");
}

async function doAction(tableName, body) {
  const base = BASE_FROM_ENV || `https://api.appsheet.com/api/v2/apps/${APP_ID}`;
  const url = `${base}/tables/${encodeURIComponent(tableName)}/Action`;
  const headers = {
    "Content-Type": "application/json",
    "ApplicationAccessKey": ACCESS_KEY || API_KEY || "",
  };
  if (APP_ID) headers["ApplicationId"] = APP_ID;
  if (API_KEY) headers["Authorization"] = `ApiKey ${API_KEY}`;

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
export async function addRow(table, row) {
  const body = { Action: "Add", Properties: {}, Rows: [row] };
  return await doAction(table, body);
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
