// Utilidades inline para evitar problemas de import
function normalizeRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.rows && Array.isArray(data.rows)) return data.rows;
  if (data.Rows && Array.isArray(data.Rows)) return data.Rows;
  return [data];
}

function valueToString(v) {
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

function isEmail(str) {
  if (!str) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(str).trim());
}

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

    // Por ahora, simulamos una búsqueda exitosa para testing
    // Una vez que funcione, conectaremos con AppSheet
    if (emailMode || input.includes('@')) {
      // Simulamos cliente encontrado por email
      const mockClient = {
        "Row ID": "mock123",
        "Nombre y Apellido": "Cliente de Prueba",
        "Correo": input,
        "Teléfono": ""
      };
      return res.status(200).json({ 
        found: true, 
        client: mockClient, 
        upcoming: [], 
        memberships: [] 
      });
    } else {
      // Simulamos cliente encontrado por teléfono
      const mockClient = {
        "Row ID": "mock456", 
        "Nombre y Apellido": "Cliente Teléfono",
        "Teléfono": input,
        "Correo": ""
      };
      return res.status(200).json({ 
        found: true, 
        client: mockClient, 
        upcoming: [], 
        memberships: [] 
      });
    }

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