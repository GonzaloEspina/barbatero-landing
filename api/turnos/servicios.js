import { normalizeRows, valueToString, readRows } from '../_lib/appsheet-utils.js';

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

async function getServicios(req, res) {
  try {
    const SERVICIOS_TABLE = "Servicios";
    const serviciosResp = await readRows(SERVICIOS_TABLE);
    const servicios = normalizeRows(serviciosResp) || [];
    
    const formatted = servicios.map(s => ({
      key: valueToString(s["Servicio"] ?? s.servicio ?? s.Servicio ?? s["Row ID"] ?? ""),
      servicio: valueToString(s["Servicio"] ?? s.servicio ?? s.Servicio ?? ""),
      duracion: valueToString(s["Duración"] ?? s.duracion ?? s.Duracion ?? ""),
      precio: valueToString(s["Precio"] ?? s.precio ?? s.Precio ?? "")
    }));

    return res.json({ ok: true, servicios: formatted });
  } catch (e) {
    console.error("[getServicios] error:", e);
    return res.status(500).json({ ok: false, message: "Error obteniendo servicios" });
  }
}

export default async function handler(req, res) {
  setCors(res);
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await getServicios(req, res);
  } catch (error) {
    console.error('Error in servicios:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}