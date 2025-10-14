import { normalizeRows, addRow } from '../_lib/appsheet-utils.js';

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

async function createClient(req, res) {
  try {
    const payload = req.body || {};
    const CLIENTES_TABLE = "Clientes";

    const fullName = (payload["Nombre y Apellido"] ?? payload.Nombre ?? payload.name ?? "").toString().trim();
    const telefono = (payload["Teléfono"] ?? payload.Telefono ?? payload.telefono ?? payload.phone ?? "").toString().trim();
    const correo = (payload["Correo"] ?? payload.correo ?? payload.email ?? "").toString().trim();

    if (!fullName) return res.status(400).json({ ok: false, message: "Faltan datos: Nombre y Apellido." });
    if (!telefono && !correo) return res.status(400).json({ ok: false, message: "Faltan datos: Teléfono o Correo." });

    const row = {
      "Nombre y Apellido": fullName,
      "Teléfono": telefono,
      "Correo": correo,
      "¿Puede sacar múltiples turnos?": "No"
    };

    try {
      const addedRaw = await addRow(CLIENTES_TABLE, row);
      const created = normalizeRows(addedRaw) || [];
      const client = (created && created[0]) ? created[0] : row;
      return res.status(201).json({ ok: true, client, raw: addedRaw });
    } catch (e) {
      console.error("[createClient] addRow error:", e);
      return res.status(201).json({ ok: true, client: row, raw: null, message: "Cliente no persistido: addRow falló." });
    }
  } catch (err) {
    console.error("[createClient] error:", err);
    return res.status(500).json({ ok: false, message: "Error al crear cliente." });
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
    await createClient(req, res);
  } catch (error) {
    console.error('Error in create-client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}