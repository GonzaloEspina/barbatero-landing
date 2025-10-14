export default async function handler(req, res) {
  console.log('🔍 DEBUG find-client handler called:', { 
    method: req.method, 
    url: req.url, 
    body: req.body,
    timestamp: new Date().toISOString()
  });

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
    console.log('📞 Contacto received:', contacto);
    
    if (!contacto) {
      return res.status(400).json({ found: false, message: "Ingrese correo o teléfono." });
    }

    // Verificar variables de entorno
    const hasBaseUrl = !!process.env.APPSHEET_BASE_URL;
    const hasAccessKey = !!process.env.APPSHEET_ACCESS_KEY;
    
    console.log('🔐 Environment check:', {
      hasBaseUrl,
      hasAccessKey,
      baseUrlLength: process.env.APPSHEET_BASE_URL?.length || 0,
      accessKeyLength: process.env.APPSHEET_ACCESS_KEY?.length || 0
    });

    if (!hasBaseUrl || !hasAccessKey) {
      console.error('❌ Missing AppSheet credentials!');
      return res.status(500).json({ 
        found: false, 
        message: "Error de configuración del servidor.",
        debug: { hasBaseUrl, hasAccessKey }
      });
    }

    // Hacer una prueba básica de conexión
    console.log('🌐 Testing AppSheet connection...');
    
    const BASE = process.env.APPSHEET_BASE_URL;
    const APP_KEY = process.env.APPSHEET_ACCESS_KEY;
    
    console.log('🔗 Connection details:', {
      baseUrl: BASE ? `${BASE.substring(0, 30)}...` : 'MISSING',
      hasKey: !!APP_KEY
    });

    // Intentar una consulta simple para probar la conexión
    const testUrl = `${BASE}/tables/Clientes/Action`;
    const testBody = { 
      Action: "Read", 
      Properties: {}, 
      Rows: [] 
    };
    
    console.log('📡 Making test request to:', testUrl);
    
    const fetchFn = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch')).default;
    
    const testResponse = await fetchFn(testUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ApplicationAccessKey": APP_KEY
      },
      body: JSON.stringify(testBody)
    });

    console.log('📥 Test response status:', testResponse.status);
    console.log('📥 Test response headers:', Object.fromEntries(testResponse.headers.entries()));

    const rawText = await testResponse.text();
    console.log('📄 Raw response (first 500 chars):', rawText.substring(0, 500));
    
    let testJson;
    try {
      testJson = JSON.parse(rawText);
      console.log('✅ JSON parsed successfully');
      console.log('📊 Response type:', typeof testJson);
      console.log('📊 Response keys:', Object.keys(testJson || {}));
      
      if (Array.isArray(testJson)) {
        console.log('📊 Array length:', testJson.length);
        if (testJson.length > 0) {
          console.log('📊 First item keys:', Object.keys(testJson[0] || {}));
        }
      }
    } catch (e) {
      console.error('❌ JSON parse error:', e.message);
      return res.status(500).json({ 
        found: false, 
        message: "Error en respuesta de AppSheet",
        debug: { rawResponse: rawText.substring(0, 200) }
      });
    }

    // Buscar el contacto específico
    const input = String(contacto).trim();
    const isEmail = input.includes('@');
    
    console.log('🔍 Searching for:', { input, isEmail });
    
    // Normalizar datos de AppSheet
    let rows = [];
    if (Array.isArray(testJson)) {
      rows = testJson;
    } else if (testJson && testJson.rows) {
      rows = testJson.rows;
    } else if (testJson && testJson.Rows) {
      rows = testJson.Rows;
    }
    
    console.log('📋 Total clients found:', rows.length);
    
    if (rows.length > 0) {
      console.log('📝 Sample client structure:', JSON.stringify(rows[0], null, 2));
      
      // Mostrar las primeras 3 entradas para debug
      console.log('📝 First 3 clients:', rows.slice(0, 3).map(r => ({
        nombre: r["Nombre y Apellido"] || r.Nombre || r.nombre,
        correo: r.Correo || r.Email || r.email,
        telefono: r["Teléfono"] || r.Telefono || r.phone
      })));
    }
    
    // Buscar coincidencia exacta
    let foundClient = null;
    
    if (isEmail) {
      const emailLower = input.toLowerCase();
      foundClient = rows.find(r => {
        const emails = [
          r.Correo, r.Email, r.email, r["Correo"], r["E-mail"]
        ].map(e => (e || "").toString().trim().toLowerCase());
        
        console.log('🔍 Checking emails:', emails, 'against:', emailLower);
        return emails.includes(emailLower);
      });
    } else {
      foundClient = rows.find(r => {
        const phones = [
          r["Teléfono"], r.Telefono, r.phone, r.Phone
        ].map(p => (p || "").toString().trim());
        
        console.log('🔍 Checking phones:', phones, 'against:', input);
        return phones.includes(input);
      });
    }
    
    if (foundClient) {
      console.log('✅ Client found!', foundClient);
      return res.json({ 
        found: true, 
        client: foundClient, 
        upcoming: [], 
        memberships: [] 
      });
    } else {
      console.log('❌ No client found for:', input);
      const contactType = isEmail ? "correo" : "teléfono";
      const prefill = isEmail ? { Correo: input } : { Telefono: input };
      return res.json({ 
        found: false, 
        contactType, 
        prefill, 
        message: `No se encontró el ${contactType} ingresado, por favor complete sus datos para sacar un turno.`,
        debug: {
          searchTerm: input,
          isEmail,
          totalClientsFound: rows.length,
          sampleData: rows.slice(0, 2)
        }
      });
    }

  } catch (e) {
    console.error('💥 Find-client error:', e);
    return res.status(500).json({ 
      found: false, 
      message: "Error interno al buscar cliente.",
      error: e.message,
      stack: e.stack
    });
  }
}