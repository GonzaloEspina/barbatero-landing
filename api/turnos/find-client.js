import { 
  normalizeRows, 
  valueToString, 
  extractClientRowId, 
  isEmail, 
  digitsOnly,
  readRows, 
  findRows 
} from '../_lib/appsheet-utils.js';

// Configurar CORS
function setCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

function phoneMatches(pd, target) {
  if (!pd || !target) return false;
  if (pd === target) return true;
  if (pd.endsWith(target) || target.endsWith(pd)) return true;
  return false;
}

function rowContainsEmail(row, emailLower) {
  try {
    for (const key of Object.keys(row || {})) {
      const v = row[key];
      if (v === null || v === undefined) continue;
      const s = valueToString(v).trim().toLowerCase();
      if (s === emailLower || s.includes(emailLower)) return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

async function findClient(req, res) {
  try {
    const { contacto } = req.body;
    if (!contacto) return res.status(400).json({ found: false, message: "Ingrese correo o teléfono." });

    const input = String(contacto).trim();
    const emailMode = isEmail(input);
    const CLIENTES_TABLE = "Clientes";

    // Buscar cliente
    let rows = [];
    if (emailMode) {
      const esc = v => String(v || "").replace(/"/g, '\\"');
      const filter = `([Correo] = "${esc(input)}")`;
      try {
        const clientResp = await findRows(CLIENTES_TABLE, filter);
        rows = normalizeRows(clientResp) || [];
      } catch (e) {
        console.warn("[findClient] findRows por email falló, intentar readRows", e?.message ?? e);
        const all = await readRows(CLIENTES_TABLE);
        rows = normalizeRows(all) || [];
      }
    } else {
      // Búsqueda por teléfono
      try {
        const all = await readRows(CLIENTES_TABLE);
        rows = normalizeRows(all) || [];
      } catch (e) {
        console.warn("[findClient] readRows falló:", e?.message ?? e);
        rows = [];
      }
    }

    // Filtrado según modo
    if (emailMode) {
      const emailLower = input.toLowerCase();
      rows = (rows || []).filter(r => rowContainsEmail(r, emailLower));
    } else {
      const digitsTarget = digitsOnly(input);
      rows = (rows || []).filter(r => {
        const phoneRaw = r["Teléfono"] ?? r.Telefono ?? r.phone ?? r.Phone ?? "";
        const phoneStr = valueToString(phoneRaw).trim();
        const pd = digitsOnly(phoneRaw);
        
        if (phoneStr && phoneStr === input) return true;
        if (pd && pd === digitsTarget) return true;
        return false;
      });
    }

    // Si no encontramos cliente
    if (!rows || rows.length === 0) {
      const contactType = emailMode ? "correo" : "teléfono";
      const prefill = emailMode ? { Correo: input } : { Telefono: input };
      const message = `No se encontró el ${contactType} ingresado, por favor complete sus datos para sacar un turno.`;
      return res.status(200).json({ found: false, contactType, prefill, message });
    }

    const client = rows[0];
    const clientRowId = extractClientRowId(client);

    // Normalizar correo
    const emailCols = ['Correo','Email','Mail','mail','correo','email'];
    let foundEmail = "";
    for (const col of emailCols) {
      const v = valueToString(client[col] ?? "");
      if (isEmail(v.trim())) { 
        foundEmail = v.trim(); 
        break; 
      }
    }
    client.Correo = foundEmail || "";

    return res.status(200).json({ 
      found: true, 
      client, 
      upcoming: [], 
      memberships: [] 
    });

  } catch (e) {
    console.error("[findClient] error:", e);
    return res.status(500).json({ found: false, message: "Error interno al buscar cliente." });
  }
}

export default async function handler(req, res) {
  setCors(res);
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await findClient(req, res);
  } catch (error) {
    console.error('Error in find-client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}