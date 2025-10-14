export default function handler(req, res) {
  console.log('Find-client handler called:', { method: req.method, url: req.url, body: req.body });

  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { contacto } = req.body || {};
    console.log('Contacto received:', contacto);
    
    if (!contacto) {
      return res.status(400).json({ found: false, message: "Ingrese correo o teléfono." });
    }

    const input = String(contacto).trim();
    const isEmail = input.includes('@');
    
    const mockClient = {
      "Row ID": isEmail ? "mock123" : "mock456",
      "Nombre y Apellido": isEmail ? "Cliente Email Test" : "Cliente Teléfono Test",
      "Correo": isEmail ? input : "",
      "Teléfono": isEmail ? "" : input
    };

    // Mock: Agregar turnos próximos del cliente
    const upcoming = isEmail ? [
      {
        id: 'turno_1',
        Fecha: '2025-10-20',
        Hora: '10:30',
        Servicio: 'Corte + Barba',
        Estado: 'confirmado',
        Precio: '$8000'
      },
      {
        id: 'turno_2', 
        Fecha: '2025-10-25',
        Hora: '15:00',
        Servicio: 'Corte',
        Estado: 'pendiente',
        Precio: '$5000'
      }
    ] : [
      {
        id: 'turno_3',
        Fecha: '2025-10-18',
        Hora: '09:00',
        Servicio: 'Barba',
        Estado: 'confirmado',
        Precio: '$3000'
      }
    ];

    console.log('Returning client:', mockClient);
    console.log('Returning upcoming appointments:', upcoming);
    return res.json({ found: true, client: mockClient, upcoming, memberships: [] });

  } catch (e) {
    console.error('Find-client error:', e);
    return res.status(500).json({ found: false, message: "Error interno al buscar cliente." });
  }
}