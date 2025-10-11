export const normalizeToHM = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") v = v.value ?? v.displayValue ?? v.text ?? JSON.stringify(v);
  const s = String(v).replace(/\u00A0/g, " ").trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) {
    const hh = String(Number(m[1])).padStart(2, "0");
    const mm = m[2];
    return `${hh}:${mm}`;
  }
  return s;
};

export const parseDateFromString = (val) => {
  if (!val && val !== 0) return null;
  if (typeof val === "object") {
    const cand = val.value ?? val.displayValue ?? val.text ?? JSON.stringify(val);
    return parseDateFromString(cand);
  }
  const s = String(val).replace(/\u00A0/g, " ").trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let a = parseInt(m[1], 10), b = parseInt(m[2], 10), c = m[3];
    if (c.length === 2) c = '20' + c;
    const y = parseInt(c, 10);
    const tryDate = (day, month) => {
      if (month < 1 || month > 12 || day < 1 || day > 31) return null;
      return new Date(Date.UTC(y, month - 1, day, 0, 0, 0));
    };
    const dateDMY = tryDate(a, b);
    const dateMDY = tryDate(b, a);
    if (dateMDY && dateDMY) return dateMDY;
    if (dateMDY) return dateMDY;
    if (dateDMY) return dateDMY;
    return null;
  }
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return new Date(Date.UTC(iso.getUTCFullYear(), iso.getUTCMonth(), iso.getUTCDate(), 0, 0, 0));
  return null;
};

export const formatDateDMY = (d) => {
  if (!d || !(d instanceof Date)) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

export const formatDateISO = (d) => d.toISOString().slice(0, 10);