export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { contacto } = req.body || {};
    console.log('📞 Searching for contacto:', contacto);
    
    if (!contacto) {
      return res.status(400).json({ found: false, message: "Ingrese correo o teléfono." });
    }

    const BASE = process.env.APPSHEET_BASE_URL;
    const APP_KEY = process.env.APPSHEET_ACCESS_KEY;

    if (!BASE || !APP_KEY) {
      return res.status(500).json({ 
        found: false, 
        message: "Error de configuración del servidor."
      });
    }

    // Usar el formato que funciona en simple-test
    const correctBaseUrl = BASE.replace('api.appsheet.com', 'www.appsheet.com');
    const url = `${correctBaseUrl}/tables/Clientes/Action`;
    
    console.log('📡 Making request to:', url);

    // Buscar por email específico si es un email
    const isEmail = contacto.includes('@');
    let body;
    
    if (isEmail) {
      // Buscar email específico
      body = { 
        Action: "Find", 
        Properties: { 
          Selector: `([Correo] = "${contacto.replace(/"/g, '\\"')}")`
        }, 
        Rows: [] 
      };
    } else {
      // Buscar teléfono específico
      body = { 
        Action: "Find", 
        Properties: { 
          Selector: `([Teléfono] = "${contacto.replace(/"/g, '\\"')}")`
        }, 
        Rows: [] 
      };
    }

    console.log('📡 Request body:', JSON.stringify(body, null, 2));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ApplicationAccessKey": APP_KEY
      },
      body: JSON.stringify(body)
    });

    console.log('📥 Response status:', response.status);

    if (!response.ok) {
      console.error('❌ AppSheet error:', response.status, response.statusText);
      const errorText = await response.text();
      return res.status(500).json({
        found: false,
        message: `Error de AppSheet: ${response.status}`,
        debug: { status: response.status, error: errorText }
      });
    }

    const rawText = await response.text();
    console.log('📄 Raw response length:', rawText.length);

    if (!rawText || rawText.trim() === '') {
      console.log('📄 Empty response from AppSheet');
      return res.status(200).json({
        found: false,
        message: "No se encontró el contacto ingresado.",
        contactType: isEmail ? "correo" : "teléfono",
        prefill: isEmail ? { Correo: contacto } : { Telefono: contacto }
      });
    }

    let jsonData;
    try {
      jsonData = JSON.parse(rawText);
      console.log('✅ JSON parsed, type:', typeof jsonData, 'isArray:', Array.isArray(jsonData));
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError.message);
      return res.status(500).json({
        found: false,
        message: "Error procesando respuesta de AppSheet",
        debug: { parseError: parseError.message }
      });
    }

    // Procesar respuesta
    const clients = Array.isArray(jsonData) ? jsonData : [];
    console.log('📊 Clients found:', clients.length);

    if (clients.length === 0) {
      console.log('📄 No clients found in response');
      return res.status(200).json({
        found: false,
        message: `No se encontró el ${isEmail ? 'correo' : 'teléfono'} ingresado, por favor complete sus datos para sacar un turno.`,
        contactType: isEmail ? "correo" : "teléfono",
        prefill: isEmail ? { Correo: contacto } : { Telefono: contacto }
      });
    }

    // Cliente encontrado
    const client = clients[0];
    console.log('✅ Client found:', client["Nombre y Apellido"] || client.Nombre);

    // TODO: Buscar turnos próximos y membresías
    const upcoming = [];
    const memberships = [];

    return res.json({
      found: true,
      client,
      upcoming,
      memberships
    });

  } catch (error) {
    console.error('💥 Error:', error);
    return res.status(500).json({
      found: false,
      message: "Error interno al buscar cliente.",
      error: error.message
    });
  }
}