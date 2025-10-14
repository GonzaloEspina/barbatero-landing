// Debug: Verificar qué tablas existen en AppSheet
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('🔍 DEBUG TABLES - Starting table verification');

  const BASE = process.env.APPSHEET_BASE_URL;
  const APP_KEY = process.env.APPSHEET_ACCESS_KEY;
  const correctBaseUrl = BASE.replace('api.appsheet.com', 'www.appsheet.com');

  async function checkTable(tableName) {
    const url = `${correctBaseUrl}/tables/${encodeURIComponent(tableName)}/Action`;
    const headers = {
      "Content-Type": "application/json",
      "ApplicationAccessKey": APP_KEY
    };

    console.log(`📊 Checking table: ${tableName}`);

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          Action: "Find",
          Properties: { Selector: "true" },
          Rows: []
        }),
      });

      const raw = await resp.text().catch(() => "");
      let json = null;
      try { 
        json = raw ? JSON.parse(raw) : null; 
      } catch (err) { 
        json = raw; 
      }

      const isArray = Array.isArray(json);
      const length = isArray ? json.length : 0;
      
      console.log(`📊 Table ${tableName}: status=${resp.status}, isArray=${isArray}, length=${length}`);
      
      return {
        table: tableName,
        status: resp.status,
        hasData: !!json,
        isArray,
        length,
        success: resp.status === 200 && isArray,
        sampleData: isArray && length > 0 ? json[0] : null
      };
    } catch (error) {
      console.log(`❌ Table ${tableName}: error=${error.message}`);
      return {
        table: tableName,
        error: error.message,
        success: false
      };
    }
  }

  // Probar diferentes nombres posibles
  const tablesToCheck = [
    'Clientes',    // Plural
    'Cliente',     // Singular  
    'clientes',    // Minúscula
    'cliente',     // Singular minúscula
    'CLIENTES',    // Mayúscula
    'CLIENTE'      // Singular mayúscula
  ];

  console.log(`🔍 Checking ${tablesToCheck.length} possible table names...`);

  const results = [];
  for (const tableName of tablesToCheck) {
    const result = await checkTable(tableName);
    results.push(result);
  }

  // Encontrar tablas exitosas
  const successful = results.filter(r => r.success);
  const withData = results.filter(r => r.success && r.length > 0);

  console.log(`✅ Found ${successful.length} accessible tables, ${withData.length} with data`);

  return res.json({
    summary: {
      tablesChecked: tablesToCheck.length,
      accessible: successful.length,
      withData: withData.length
    },
    results,
    successful,
    withData
  });
}