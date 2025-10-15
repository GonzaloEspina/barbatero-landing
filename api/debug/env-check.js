// Endpoint de diagnóstico para verificar variables de entorno
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
    const PLACE_ID = process.env.GOOGLE_PLACE_ID;
    
    return res.status(200).json({
      hasApiKey: !!GOOGLE_API_KEY,
      hasPlaceId: !!PLACE_ID,
      apiKeyLength: GOOGLE_API_KEY ? GOOGLE_API_KEY.length : 0,
      placeIdLength: PLACE_ID ? PLACE_ID.length : 0,
      // No exponemos las claves completas por seguridad
      apiKeyPreview: GOOGLE_API_KEY ? GOOGLE_API_KEY.substring(0, 10) + '...' : 'no definida',
      placeIdPreview: PLACE_ID ? PLACE_ID.substring(0, 10) + '...' : 'no definido'
    });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Error al verificar configuración',
      details: error.message 
    });
  }
}