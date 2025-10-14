export default function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Esta función maneja TODAS las rutas de /api/turnos/*
  const { query } = req;
  const { path = [] } = query;
  
  console.log('API Request:', { method: req.method, path, query, url: req.url });

  try {
    // Manejar /api/turnos/servicios
    if (path.length === 1 && path[0] === 'servicios') {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const mockServicios = [
        {
          key: "corte",
          servicio: "Corte de Cabello",
          duracion: "30 min",
          precio: "$15000"
        },
        {
          key: "barba",
          servicio: "Arreglo de Barba", 
          duracion: "20 min",
          precio: "$10000"
        },
        {
          key: "combo",
          servicio: "Corte + Barba",
          duracion: "50 min",
          precio: "$22000"
        }
      ];

      return res.json({ ok: true, servicios: mockServicios });
    }

    // Manejar /api/turnos/find-client
    if (path.length === 1 && path[0] === 'find-client') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { contacto } = req.body || {};
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

      return res.status(200).json({ 
        found: true, 
        client: mockClient, 
        upcoming: [], 
        memberships: [] 
      });
    }

    // Manejar /api/turnos/disponibilidad
    if (path.length === 1 && path[0] === 'disponibilidad') {
      return res.json({ ok: true, disponibilidad: [], horarios: [] });
    }

    // Manejar /api/turnos/create
    if (path.length === 1 && path[0] === 'create') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }
      return res.json({ ok: true, message: "Turno creado (simulación)" });
    }

    // Ruta base /api/turnos
    if (path.length === 0) {
      return res.json({ 
        ok: true, 
        message: "API Turnos funcionando",
        availableEndpoints: [
          "GET /api/turnos/servicios",
          "POST /api/turnos/find-client", 
          "GET /api/turnos/disponibilidad",
          "POST /api/turnos/create"
        ]
      });
    }

    // Ruta no encontrada
    return res.status(404).json({ 
      error: 'Endpoint not found', 
      path, 
      method: req.method 
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}