export function normalizeRows(resp) {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  return resp?.Rows || resp?.rows || resp?.rows || [];
}

export function extractClientRowId(client) {
  if (!client || typeof client !== "object") return null;
  return (
    client["Row ID"] ||
    client["RowID"] ||
    client["_RowNumber"] ||
    client["_RowKey"] ||
    client["Id"] ||
    client["id"] ||
    client["Key"] ||
    client["Cliente ID"] ||
    null
  );
}

export function toISODate(d) {
  if (!d) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

export function parseFechaDMY(fechaRaw) {
  if (!fechaRaw && fechaRaw !== 0) return null;
  const s = String(fechaRaw).replace(/\u00A0/g, " ").trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    // AppSheet usa formato MM/DD/YYYY - interpretar como mes/día/año
    let mm = parseInt(m[1], 10), dd = parseInt(m[2], 10), yy = m[3];
    if (yy.length === 2) yy = '20' + yy;
    const yyyy = parseInt(yy, 10);
    const dt = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0));
    if (!isNaN(dt.getTime())) return dt;
  }
  const dt2 = new Date(s);
  if (!isNaN(dt2.getTime())) return new Date(Date.UTC(dt2.getFullYear(), dt2.getMonth(), dt2.getDate(), 0, 0, 0));
  return null;
}

export function extractTimeHHMM(s) {
  if (!s && s !== 0) return "";
  if (typeof s === 'object') s = s.value ?? s.displayValue ?? s.text ?? JSON.stringify(s);
  const str = String(s).replace(/\u00A0/g,' ').trim();
  const m = str.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return str;
  const hh = String(Number(m[1])).padStart(2,'0');
  const mm = m[2];
  return `${hh}:${mm}`;
}