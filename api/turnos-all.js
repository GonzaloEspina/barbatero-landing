export default function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url, method, query, body } = req;
  console.log('API Request:', { method, url, query, body });

  // Determinar la ruta desde la URL
  const pathMatch = url.match(/\/api\/turnos\/(.+)/);
  const route = pathMatch ? pathMatch[1].split('?')[0] : '';
  
  console.log('Route:', route);

  try {
    // GET /api/turnos/servicios
    if (route === 'servicios' && method === 'GET') {
      const mockServicios = [
        { key: "corte", servicio: "Corte de Cabello", duracion: "30 min", precio: "$15000" },
        { key: "barba", servicio: "Arreglo de Barba", duracion: "20 min", precio: "$10000" },
        { key: "combo", servicio: "Corte + Barba", duracion: "50 min", precio: "$22000" }
      ];
      return res.json({ ok: true, servicios: mockServicios });
    }

    // POST /api/turnos/find-client
    if (route === 'find-client' && method === 'POST') {
      const { contacto } = body || {};
      if (!contacto) return res.status(400).json({ found: false, message: "Ingrese correo o teléfono." });
      
      const input = String(contacto).trim();
      const isEmail = input.includes('@');
      
      const mockClient = {
        "Row ID": isEmail ? "mock123" : "mock456",
        "Nombre y Apellido": isEmail ? "Cliente Email Test" : "Cliente Teléfono Test",
        "Correo": isEmail ? input : "",
        "Teléfono": isEmail ? "" : input
      };

      return res.json({ found: true, client: mockClient, upcoming: [], memberships: [] });
    }

    // POST /api/turnos/create-client  
    if (route === 'create-client' && method === 'POST') {
      const payload = body || {};
      const fullName = (payload["Nombre y Apellido"] ?? payload.Nombre ?? "").toString().trim();
      const telefono = (payload["Teléfono"] ?? payload.Telefono ?? payload.phone ?? "").toString().trim();
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

    // GET /api/turnos/disponibilidad
    if (route === 'disponibilidad' && method === 'GET') {
      return res.json({ ok: true, disponibilidad: [], horarios: [] });
    }

    // GET /api/turnos/calendar
    if (route === 'calendar' && method === 'GET') {
      return res.json({ ok: true, calendar: [], events: [] });
    }

    // POST /api/turnos/create
    if (route === 'create' && method === 'POST') {
      return res.json({ ok: true, message: "Turno creado (simulación)", turno: { id: Date.now() } });
    }

    // GET /api/turnos/memberships
    if (route === 'memberships' && method === 'GET') {
      const mockMemberships = [
        { key: "basic", membresia: "Básica", cantidadTurnos: "5", mesesActiva: "3", valor: "$50000" },
        { key: "premium", membresia: "Premium", cantidadTurnos: "10", mesesActiva: "6", valor: "$90000" }
      ];
      return res.json({ ok: true, memberships: mockMemberships });
    }

    // POST /api/turnos/memberships/reserve
    if (route === 'memberships/reserve' && method === 'POST') {
      const { clientRowId, membershipKey } = body || {};
      if (!clientRowId || !membershipKey) {
        return res.status(400).json({ ok: false, message: "clientRowId y membershipKey requeridos." });
      }
      return res.json({ ok: true, message: "Membresía reservada", activeMembership: { id: Date.now() } });
    }

    // PUT /api/clients/update (esta ruta está en /clients pero la incluyo aquí también)
    if (route === '../clients/update' && method === 'PUT') {
      const payload = body || {};
      const rowId = payload["Row ID"] ?? payload.rowId;
      if (!rowId) return res.status(400).json({ ok: false, message: "Falta Row ID del cliente." });
      
      return res.json({ ok: true, client: { ...payload, updated: true } });
    }

    // Ruta base /api/turnos
    if (!route || route === '') {
      return res.json({ 
        ok: true, 
        message: "API Turnos funcionando",
        availableEndpoints: [
          "GET /api/turnos/servicios",
          "POST /api/turnos/find-client", 
          "POST /api/turnos/create-client",
          "GET /api/turnos/disponibilidad",
          "GET /api/turnos/calendar",
          "POST /api/turnos/create",
          "GET /api/turnos/memberships",
          "POST /api/turnos/memberships/reserve"
        ]
      });
    }

    // Ruta no encontrada
    return res.status(404).json({ error: 'Endpoint not found', route, method });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}