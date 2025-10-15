// API endpoint para obtener reseñas de Google Places
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Temporalmente hardcodeado para testing
    const GOOGLE_API_KEY = "AIzaSyCYgt3oYvTnVXhBB5pY1gPPyZd7lMM9eig";
    const PLACE_ID = "ChIJn8XSLpbHvJURY46ZjImmLUk";
    
    if (!GOOGLE_API_KEY || !PLACE_ID) {
      return res.status(500).json({ error: 'Configuración de API faltante' });
    }

    // Obtener detalles del lugar con reseñas
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=name,rating,reviews,user_ratings_total&key=${GOOGLE_API_KEY}&language=es`
    );

    if (!response.ok) {
      throw new Error(`Error de Google API: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error(`Google Places API error: ${data.status}`);
    }

    const place = data.result;
    
    // Formatear reseñas para tu componente
    const formattedReviews = (place.reviews || []).map(review => ({
      id: review.time, // timestamp como ID único
      author: review.author_name,
      rating: review.rating,
      text: review.text,
      time: new Date(review.time * 1000).toLocaleDateString('es-ES'),
      profilePhoto: review.profile_photo_url,
      relativeTime: review.relative_time_description
    }));

    // Cache por 1 hora (3600 segundos)
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    res.status(200).json({
      success: true,
      place: {
        name: place.name,
        rating: place.rating,
        totalReviews: place.user_ratings_total
      },
      reviews: formattedReviews.slice(0, 5) // Solo las últimas 5 reseñas
    });

  } catch (error) {
    console.error('Error obteniendo reseñas:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
}