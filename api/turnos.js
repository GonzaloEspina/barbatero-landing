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

function isEmail(str) {
  if (!str) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(str).trim());
}

async function findClient(req, res) {
  try {
    const { contacto } = req.body;
    if (!contacto) return res.status(400).json({ found: false, message: "Ingrese correo o teléfono." });

    const input = String(contacto).trim();
    const emailMode = isEmail(input);

    // Datos mock para testing
    if (emailMode || input.includes('@')) {
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

  // Manejar diferentes rutas
  const { url } = req;
  
  if (url.includes('/servicios')) {
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
  
  if (url.includes('/find-client')) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    return await findClient(req, res);
  }
  
  if (url.includes('/create-client')) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const payload = req.body || {};
    const fullName = (payload["Nombre y Apellido"] ?? payload.Nombre ?? payload.name ?? "").toString().trim();
    const telefono = (payload["Teléfono"] ?? payload.Telefono ?? payload.telefono ?? payload.phone ?? "").toString().trim();
    const correo = (payload["Correo"] ?? payload.correo ?? payload.email ?? "").toString().trim();

    if (!fullName) return res.status(400).json({ ok: false, message: "Faltan datos: Nombre y Apellido." });
    if (!telefono && !correo) return res.status(400).json({ ok: false, message: "Faltan datos: Teléfono o Correo." });

    const mockClient = {
      "Row ID": "new_" + Date.now(),
      "Nombre y Apellido": fullName,
      "Teléfono": telefono,
      "Correo": correo
    };

    return res.status(201).json({ ok: true, client: mockClient });
  }

  // Otras rutas por defecto
  return res.json({ ok: true, message: "API funcionando", availableRoutes: ['/servicios', '/find-client', '/create-client'] });
}