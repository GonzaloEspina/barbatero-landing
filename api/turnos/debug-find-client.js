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

  if (req.method === 'GET') {
    // Para pruebas desde el navegador, mostrar un formulario simple
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Debug AppSheet Connection</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .container { max-width: 600px; }
          input, button { padding: 10px; margin: 10px 0; }
          input { width: 300px; }
          button { background: #0070f3; color: white; border: none; cursor: pointer; }
          .result { margin-top: 20px; padding: 20px; background: #f5f5f5; white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔍 Debug AppSheet Connection</h1>
          <p>Ingresa un email o teléfono para probar la conexión:</p>
          
          <input type="text" id="contacto" placeholder="exe.damiano@gmail.com" value="exe.damiano@gmail.com">
          <br>
          <button onclick="testSearch()">🔍 Buscar Cliente</button>
          
          <div id="result" class="result" style="display: none;"></div>
        </div>
        
        <script>
          async function testSearch() {
            const contacto = document.getElementById('contacto').value;
            const resultDiv = document.getElementById('result');
            
            if (!contacto) {
              alert('Ingresa un contacto');
              return;
            }
            
            resultDiv.style.display = 'block';
            resultDiv.textContent = 'Buscando...';
            
            try {
              const response = await fetch('/api/turnos/debug-find-client', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contacto })
              });
              
              const data = await response.json();
              resultDiv.textContent = JSON.stringify(data, null, 2);
            } catch (e) {
              resultDiv.textContent = 'Error: ' + e.message;
            }
          }
        </script>
      </body>
      </html>
    `);
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
      baseUrl: BASE ? `${BASE.substring(0, 50)}...` : 'MISSING',
      baseUrlFull: BASE, // Mostrar completa para debug
      hasKey: !!APP_KEY,
      keyLength: APP_KEY?.length || 0,
      keyPrefix: APP_KEY ? APP_KEY.substring(0, 8) + '...' : 'MISSING'
    });

    // Verificar formato de URL (actualizado según documentación oficial)
    if (!BASE || (!BASE.includes('www.appsheet.com') && !BASE.includes('api.appsheet.com'))) {
      console.error('❌ Invalid AppSheet base URL format');
      return res.status(500).json({ 
        found: false, 
        message: "URL de AppSheet mal configurada",
        debug: { 
          baseUrl: BASE,
          expectedFormat: 'https://www.appsheet.com/api/v2/apps/YOUR_APP_ID (preferred) or https://api.appsheet.com/api/v2/apps/YOUR_APP_ID'
        }
      });
    }

    if (!APP_KEY || APP_KEY.length < 10) {
      console.error('❌ Invalid AppSheet access key');
      return res.status(500).json({ 
        found: false, 
        message: "Clave de acceso de AppSheet mal configurada",
        debug: { 
          hasKey: !!APP_KEY,
          keyLength: APP_KEY?.length || 0
        }
      });
    }

    // Probar diferentes nombres de tabla que podrían existir
    const possibleTableNames = [
      'Clientes',
      'Cliente', 
      'clients',
      'Clients',
      'CLIENTES',
      'Usuarios',
      'Users'
    ];
    
    let workingTable = null;
    let tableResults = {};
    
    console.log('🔍 Testing possible table names...');
    
    for (const tableName of possibleTableNames) {
      const testUrl = `${BASE}/tables/${encodeURIComponent(tableName)}/Action`;
      const testBody = { 
        Action: "Read", 
        Properties: {}, 
        Rows: [] 
      };
      
      console.log(`📋 Testing table: "${tableName}"`);
      
      try {
        const response = await fetchFn(testUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ApplicationAccessKey": APP_KEY
          },
          body: JSON.stringify(testBody)
        });
        
        const text = await response.text();
        const hasData = text && text.trim().length > 0;
        
        tableResults[tableName] = {
          status: response.status,
          hasData,
          contentLength: text.length,
          sample: hasData ? text.substring(0, 100) : 'empty'
        };
        
        console.log(`📋 Table "${tableName}": Status ${response.status}, Content: ${text.length} chars`);
        
        if (response.ok && hasData && !workingTable) {
          workingTable = tableName;
          console.log(`✅ Found working table: "${tableName}"`);
        }
      } catch (e) {
        tableResults[tableName] = { error: e.message };
        console.log(`❌ Table "${tableName}": Error - ${e.message}`);
      }
    }
    
    if (!workingTable) {
      console.log('❌ No working table found');
      return res.status(500).json({ 
        found: false, 
        message: "No se encontró una tabla de clientes válida en AppSheet",
        debug: { 
          testedTables: tableResults,
          suggestion: "Verifica el nombre exacto de tu tabla en AppSheet"
        }
      });
    }
    
    console.log(`🎯 Using table: "${workingTable}"`);
    
    // Ahora usar la tabla que funciona
    const testUrl = `${BASE}/tables/${encodeURIComponent(workingTable)}/Action`;
    const testBody = { 
      Action: "Read", 
      Properties: {}, 
      Rows: [] 
    };
    
    console.log('📡 Making test request to:', testUrl);
    console.log('📡 Request headers:', {
      "Content-Type": "application/json",
      "ApplicationAccessKey": APP_KEY ? `${APP_KEY.substring(0, 10)}...` : 'MISSING'
    });
    console.log('📡 Request body:', JSON.stringify(testBody, null, 2));
    
    const fetchFn = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch')).default;
    
    let testResponse;
    try {
      testResponse = await fetchFn(testUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ApplicationAccessKey": APP_KEY
        },
        body: JSON.stringify(testBody)
      });
    } catch (fetchError) {
      console.error('❌ Fetch error:', fetchError.message);
      return res.status(500).json({ 
        found: false, 
        message: "Error de red al conectar con AppSheet",
        debug: { 
          fetchError: fetchError.message,
          testUrl,
          hasKey: !!APP_KEY
        }
      });
    }

    console.log('📥 Test response status:', testResponse.status);
    console.log('📥 Test response statusText:', testResponse.statusText);
    console.log('📥 Test response ok:', testResponse.ok);
    
    let rawText;
    try {
      rawText = await testResponse.text();
      console.log('📄 Raw response length:', rawText.length);
      console.log('📄 Raw response (first 500 chars):', rawText.substring(0, 500));
      console.log('📄 Raw response (last 100 chars):', rawText.length > 100 ? rawText.substring(rawText.length - 100) : rawText);
    } catch (textError) {
      console.error('❌ Error reading response text:', textError.message);
      return res.status(500).json({ 
        found: false, 
        message: "Error leyendo respuesta de AppSheet",
        debug: { 
          textError: textError.message,
          responseStatus: testResponse.status
        }
      });
    }

    if (!testResponse.ok) {
      console.error('❌ AppSheet returned error status:', testResponse.status, testResponse.statusText);
      return res.status(500).json({ 
        found: false, 
        message: `AppSheet error: ${testResponse.status} ${testResponse.statusText}`,
        debug: { 
          status: testResponse.status,
          statusText: testResponse.statusText,
          rawResponse: rawText.substring(0, 500),
          url: testUrl,
          hasValidKey: APP_KEY && APP_KEY.length > 10
        }
      });
    }

    if (!rawText || rawText.trim() === '') {
      console.error('❌ AppSheet returned empty response');
      return res.status(500).json({ 
        found: false, 
        message: "AppSheet devolvió respuesta vacía",
        debug: { 
          responseLength: rawText?.length || 0,
          status: testResponse.status,
          headers: Object.fromEntries(testResponse.headers.entries()),
          url: testUrl
        }
      });
    }
    
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