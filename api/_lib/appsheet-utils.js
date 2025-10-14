// Utilidades compartidas para las funciones API
export function normalizeRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.rows && Array.isArray(data.rows)) return data.rows;
  if (data.Rows && Array.isArray(data.Rows)) return data.Rows;
  return [data];
}

export function valueToString(v) {
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

export function extractClientRowId(client) {
  if (!client) return null;
  const candidates = [
    client["Row ID"],
    client.RowID,
    client["RowID"],
    client["Row Id"],
    client.id,
    client.ID
  ];
  
  for (const c of candidates) {
    const v = valueToString(c).trim();
    if (v) return v;
  }
  return null;
}

export function isEmail(str) {
  if (!str) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(str).trim());
}

export function digitsOnly(v) {
  if (v === null || v === undefined) return "";
  return valueToString(v).replace(/\D/g, "");
}

// AppSheet service functions
const BASE = process.env.APPSHEET_BASE_URL;
const APP_KEY = process.env.APPSHEET_ACCESS_KEY;

async function doAction(tableName, body) {
  const url = `${BASE}/tables/${encodeURIComponent(tableName)}/Action`;
  const headers = {
    "Content-Type": "application/json",
  };
  if (APP_KEY) headers.ApplicationAccessKey = APP_KEY;

  // Use dynamic import for fetch if not available globally (Node.js compatibility)
  const fetchFn = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch')).default;
  
  const resp = await fetchFn(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const raw = await resp.text().catch(() => "");
  let json = null;
  try { 
    json = raw ? JSON.parse(raw) : null; 
  } catch (err) { 
    json = raw; 
  }

  return json;
}

export async function readRows(tableName) {
  const body = { Action: "Read", Properties: {}, Rows: [] };
  return await doAction(tableName, body);
}

export async function findRows(tableName, selector) {
  const body = { 
    Action: "Find", 
    Properties: { Selector: selector }, 
    Rows: [] 
  };
  return await doAction(tableName, body);
}

export async function addRow(tableName, rowData) {
  const body = { 
    Action: "Add", 
    Properties: {}, 
    Rows: [rowData] 
  };
  return await doAction(tableName, body);
}