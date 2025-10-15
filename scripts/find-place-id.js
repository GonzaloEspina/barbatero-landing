// Utilidad para encontrar el Place ID de tu negocio
// Ejecuta esto una vez para obtener tu Place ID

async function findPlaceId() {
  const GOOGLE_API_KEY = 'AIzaSyCYgt3oYvTnVXhBB5pY1gPPyZd7lMM9eig';
  const businessName = 'Barbatero Barber Studio';
  const address = 'Faustino Nicolás Cesio 243, Haedo';
  
  try {
    // Buscar lugar por nombre y dirección
    const searchQuery = encodeURIComponent(`${businessName} ${address}`);
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${searchQuery}&inputtype=textquery&fields=place_id,name,formatted_address&key=${GOOGLE_API_KEY}`
    );
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.candidates.length > 0) {
      console.log('Place ID encontrado:', data.candidates[0].place_id);
      console.log('Nombre:', data.candidates[0].name);
      console.log('Dirección:', data.candidates[0].formatted_address);
      return data.candidates[0].place_id;
    } else {
      console.log('No se encontró el lugar');
      return null;
    }
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

// Ejecuta esta función para obtener tu Place ID
findPlaceId();