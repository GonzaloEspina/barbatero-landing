// Importar directamente la función del controller que ya funciona
import { getCalendarAvailability } from "../../backend/controllers/availabilityController.js";

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Simplemente delegar al controller que ya funciona
    console.log('📅 Calendar request delegando al controller original...');
    await getCalendarAvailability(req, res);
  } catch (err) {
    console.error("[calendar handler] error:", err);
    return res.status(500).json({ message: "Error calculando disponibilidad del calendario", errorDetails: err.message });
  }
}