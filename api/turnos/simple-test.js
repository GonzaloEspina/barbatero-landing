export default async function handler(req, res) {
  console.log('🔍 SIMPLE DEBUG - Testing AppSheet connection...');

  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Simple AppSheet Test</title></head>
      <body style="font-family: Arial; margin: 40px;">
        <h1>🔍 Simple AppSheet Test</h1>
        <button onclick="testRead()">📋 Read Clientes Table</button>
        <div id="result" style="margin-top: 20px; white-space: pre-wrap; background: #f5f5f5; padding: 20px;"></div>
        
        <script>
          async function testRead() {
            const resultDiv = document.getElementById('result');
            resultDiv.textContent = 'Reading Clientes table...';
            
            try {
              const response = await fetch('/api/turnos/simple-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'read' })
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

  try {
    const BASE = process.env.APPSHEET_BASE_URL;
    const APP_KEY = process.env.APPSHEET_ACCESS_KEY;

    console.log('📍 Environment check:', {
      hasBaseUrl: !!BASE,
      hasAccessKey: !!APP_KEY
    });

    if (!BASE || !APP_KEY) {
      return res.status(500).json({ 
        error: 'Missing environment variables',
        hasBaseUrl: !!BASE,
        hasAccessKey: !!APP_KEY
      });
    }

    // Corregir URL según documentación oficial
    const correctBaseUrl = BASE.replace('api.appsheet.com', 'www.appsheet.com');
    console.log('🔗 Corrected URL:', correctBaseUrl);

    // Probar diferentes formatos según la documentación oficial
    const testQueries = [
      {
        name: "Official Find Query",
        url: `${correctBaseUrl}/tables/Clientes/Action`,
        body: { Action: "Find", Properties: { Selector: "true" }, Rows: [] }
      },
      {
        name: "Simple Find",
        url: `${correctBaseUrl}/tables/Clientes/Action`,
        body: { Action: "Find" }
      },
      {
        name: "Find with Locale",
        url: `${correctBaseUrl}/tables/Clientes/Action`,
        body: { 
          Action: "Find", 
          Properties: { 
            Locale: "en-US",
            Selector: "true"
          },
          Rows: [] 
        }
      }
    ];

    let results = {};
    
    for (const query of testQueries) {
      console.log(`📡 Testing: ${query.name}`);
      
      try {
        const response = await fetch(query.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ApplicationAccessKey": APP_KEY  // Según documentación oficial
          },
          body: JSON.stringify(query.body)
        });

        const rawText = await response.text();
        
        results[query.name] = {
          status: response.status,
          ok: response.ok,
          contentLength: rawText.length,
          hasContent: rawText.trim().length > 0,
          sample: rawText.substring(0, 200)
        };
        
        console.log(`📊 ${query.name}: Status ${response.status}, Content: ${rawText.length} chars`);
        
        // Si encontramos una que funciona, usar esa
        if (response.ok && rawText.trim().length > 0) {
          console.log(`✅ Found working query: ${query.name}`);
          
          try {
            const jsonData = JSON.parse(rawText);
            
            return res.status(200).json({
              success: true,
              workingQuery: query.name,
              totalClients: Array.isArray(jsonData) ? jsonData.length : 'N/A',
              dataType: typeof jsonData,
              isArray: Array.isArray(jsonData),
              sampleClients: Array.isArray(jsonData) ? jsonData.slice(0, 3) : jsonData,
              fullResponse: jsonData
            });
          } catch (e) {
            results[query.name].parseError = e.message;
          }
        }
      } catch (fetchError) {
        results[query.name] = { error: fetchError.message };
      }
    }
    
    // Si llegamos aquí, ninguna consulta funcionó
    return res.status(500).json({
      error: "All query formats failed",
      testedQueries: results,
      suggestion: "Check AppSheet API permissions and configuration"
    });

    console.log('📡 Making request to:', url);
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
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

    const rawText = await response.text();
    console.log('📄 Raw response length:', rawText.length);
    console.log('📄 Raw response (first 1000 chars):', rawText.substring(0, 1000));

    if (!response.ok) {
      return res.status(500).json({
        error: 'AppSheet error',
        status: response.status,
        statusText: response.statusText,
        rawResponse: rawText
      });
    }

    if (!rawText || rawText.trim() === '') {
      return res.status(200).json({
        message: 'Empty response from AppSheet',
        responseLength: rawText.length,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      });
    }

    // Intentar parsear como JSON
    let jsonData;
    try {
      jsonData = JSON.parse(rawText);
      console.log('✅ JSON parsed successfully');
      console.log('📊 JSON type:', typeof jsonData);
      console.log('📊 Is array:', Array.isArray(jsonData));
      
      if (Array.isArray(jsonData)) {
        console.log('📊 Array length:', jsonData.length);
        if (jsonData.length > 0) {
          console.log('📊 First item:', JSON.stringify(jsonData[0], null, 2));
        }
      } else {
        console.log('📊 Object keys:', Object.keys(jsonData));
      }
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError.message);
      return res.status(500).json({
        error: 'Invalid JSON response',
        parseError: parseError.message,
        rawResponse: rawText.substring(0, 500)
      });
    }

    // Buscar el email específico
    const { contacto } = req.body || {};
    let searchResult = null;
    
    if (contacto) {
      console.log('🔍 Searching for:', contacto);
      const emailLower = contacto.toLowerCase().trim();
      
      // Si tenemos un array, buscar en él
      if (Array.isArray(jsonData)) {
        searchResult = jsonData.find(client => {
          const email = (client.Correo || client["Correo"] || "").toString().toLowerCase().trim();
          const match = email === emailLower;
          if (match) {
            console.log('✅ Found match:', client);
          }
          return match;
        });
      }
    }

    return res.status(200).json({
      success: true,
      totalClients: Array.isArray(jsonData) ? jsonData.length : 'N/A',
      rawDataType: typeof jsonData,
      isArray: Array.isArray(jsonData),
      sampleClients: Array.isArray(jsonData) ? jsonData.slice(0, 3) : jsonData,
      searchTerm: contacto || 'none',
      searchResult: searchResult || 'not found',
      fullResponse: jsonData
    });

  } catch (error) {
    console.error('💥 Error:', error);
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
}