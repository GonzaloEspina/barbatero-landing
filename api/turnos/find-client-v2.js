// Utilidades copiadas de la versión original que funcionaba
function valueToString(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const cand = v.value ?? v.displayValue ?? v.text ?? v.label ?? null;
    if (cand === null || cand === undefined) {
      try { return String(v); } catch (e) { return ""; }
    }
    if (typeof cand === "object") return JSON.stringify(cand);
    return String(cand);
  }
  return String(v);
}

function normalizeRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.rows && Array.isArray(data.rows)) return data.rows;
  if (data.Rows && Array.isArray(data.Rows)) return data.Rows;
  return [data];
}

function extractClientRowId(client) {
  if (!client) return null;
  const candidates = [
    client["Row ID"],
    client.RowID,
    client["RowID"], 
    client["Row Id"],
    client.id,
    client.ID
  ];
  
  for (const c of candidates) {
    const v = valueToString(c).trim();
    if (v) return v;
  }
  return null;
}

function isEmail(str) {
  if (!str) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(str).trim());
}

function digitsOnly(v) {
  if (v === null || v === undefined) return "";
  return valueToString(v).replace(/\D/g, "");
}

function rowContainsEmail(row, emailLower) {
  try {
    for (const key of Object.keys(row || {})) {
      const v = row[key];
      if (v === null || v === undefined) continue;
      const s = valueToString(v).trim().toLowerCase();
      if (s === emailLower) return true;
      if (s.includes(emailLower)) return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

// Función principal usando la lógica original exacta
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
    console.log('📞 Original logic - Searching for contacto:', contacto);
    
    if (!contacto) {
      return res.status(400).json({ found: false, message: "Ingrese correo o teléfono." });
    }

    const input = String(contacto).trim();
    const emailMode = isEmail(input);
    const CLIENTES_TABLE = "Clientes";

    console.log('🔍 Search params:', { input, emailMode });

    // Implementar la lógica original de AppSheet
    const BASE = process.env.APPSHEET_BASE_URL;
    const APP_KEY = process.env.APPSHEET_ACCESS_KEY;
    const correctBaseUrl = BASE.replace('api.appsheet.com', 'www.appsheet.com');

    // Función doAction original adaptada
    async function doAction(tableName, body) {
      const url = `${correctBaseUrl}/tables/${encodeURIComponent(tableName)}/Action`;
      const headers = {
        "Content-Type": "application/json",
        "ApplicationAccessKey": APP_KEY
      };

      console.log('📡 DoAction request:', { url, body });

      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const raw = await resp.text().catch(() => "");
      let json = null;
      try { 
        json = raw ? JSON.parse(raw) : null; 
      } catch (err) { 
        json = raw; 
      }

      console.log('📡 DoAction response:', { 
        status: resp.status, 
        ok: resp.ok,
        hasData: !!json,
        isArray: Array.isArray(json)
      });

      return json;
    }

    // Lógica de búsqueda original
    let rows = [];
    if (emailMode) {
      const filter = `([Correo] = "${input.replace(/"/g, '\\"')}")`;
      try {
        console.log('📧 Email search filter:', filter);
        const clientResp = await doAction(CLIENTES_TABLE, {
          Action: "Find",
          Properties: { Selector: filter },
          Rows: []
        });
        rows = normalizeRows(clientResp) || [];
        console.log('📧 Email search results:', rows.length);
      } catch (e) {
        console.warn('❌ findRows por email falló, intentar readRows', e?.message ?? e);
        const all = await doAction(CLIENTES_TABLE, {
          Action: "Find",
          Properties: { Selector: "true" },
          Rows: []
        });
        rows = normalizeRows(all) || [];
      }
    } else {
      // teléfono: intentar readRows y filtrar localmente
      const digitsTarget = digitsOnly(input);
      console.log('📞 Phone search target:', { input, digitsTarget });
      
      try {
        const all = await doAction(CLIENTES_TABLE, {
          Action: "Find", 
          Properties: { Selector: "true" },
          Rows: []
        });
        rows = normalizeRows(all) || [];
        console.log('📞 Total clients read:', rows.length);
      } catch (e) {
        console.error('❌ Error reading clients:', e);
        return res.status(500).json({ found: false, message: "Error al buscar cliente." });
      }
    }
    
    console.log('📡 Making request to:', url);

    // Probar diferentes selectores para encontrar el formato correcto
    const isEmail = contacto.includes('@');
    
    const testSelectors = [
      // Selector 1: Todos los registros (para ver si hay datos)
      { 
        name: "All records",
        body: { Action: "Find", Properties: { Selector: "true" }, Rows: [] }
      },
      // Selector 2: Email exacto
      { 
        name: "Email exact match",
        body: { 
          Action: "Find", 
          Properties: { Selector: `([Correo] = "${contacto.replace(/"/g, '\\"')}")` }, 
          Rows: [] 
        }
      },
      // Selector 3: Email con CONTAINS
      { 
        name: "Email contains", 
        body: { 
          Action: "Find", 
          Properties: { Selector: `CONTAINS([Correo], "${contacto.replace(/"/g, '\\"')}")` }, 
          Rows: [] 
        }
      },
      // Selector 4: Sin Properties
      { 
        name: "No Properties",
        body: { Action: "Find", Rows: [] }
      }
    ];
    
    let workingSelector = null;
    let allResults = {};
    
    for (const test of testSelectors) {
      console.log(`🧪 Testing selector: ${test.name}`);
      
      try {
        const testResponse = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ApplicationAccessKey": APP_KEY
          },
          body: JSON.stringify(test.body)
        });
        
        const testText = await testResponse.text();
        let testData = [];
        
        try {
          testData = JSON.parse(testText);
        } catch (e) {
          console.log(`❌ ${test.name}: Parse error`);
          continue;
        }
        
        const count = Array.isArray(testData) ? testData.length : 0;
        console.log(`📊 ${test.name}: ${count} results`);
        
        allResults[test.name] = {
          count,
          sample: count > 0 ? testData.slice(0, 2) : null
        };
        
        // Si encontramos datos y es una búsqueda específica, usar este selector
        if (count > 0 && !workingSelector) {
          if (test.name === "All records") {
            // Si "All records" funciona, buscar manualmente en los datos
            console.log(`📋 Searching manually in ${count} clients for: ${contacto}`);
            
            if (isEmail) {
              const foundClient = testData.find(client => {
                const email = (client.Correo || client["Correo"] || "").toString().toLowerCase().trim();
                const searchEmail = contacto.toLowerCase().trim();
                console.log(`🔍 Comparing: "${email}" === "${searchEmail}"`);
                return email === searchEmail;
              });
              
              if (foundClient) {
                console.log(`✅ Found client manually:`, foundClient["Nombre y Apellido"]);
                workingSelector = { method: "manual_search", data: [foundClient] };
              } else {
                console.log(`❌ Email not found in ${count} clients`);
                // Mostrar muestra de emails para debugging
                const sampleEmails = testData.slice(0, 5).map(c => c.Correo || c["Correo"]);
                console.log(`📧 Sample emails:`, sampleEmails);
              }
            } else {
              // Búsqueda por teléfono
              const foundClient = testData.find(client => {
                const phone = (client.Teléfono || client["Teléfono"] || client.Telefono || "").toString().trim();
                const searchPhone = contacto.trim();
                console.log(`📞 Comparing: "${phone}" === "${searchPhone}"`);
                return phone === searchPhone;
              });
              
              if (foundClient) {
                console.log(`✅ Found client manually:`, foundClient["Nombre y Apellido"]);
                workingSelector = { method: "manual_search", data: [foundClient] };
              }
            }
          } else {
            workingSelector = { method: "selector", data: testData };
          }
        }
        
      } catch (e) {
        console.log(`❌ ${test.name}: Error -`, e.message);
        allResults[test.name] = { error: e.message };
      }
    }
    
    // Si no encontramos nada, devolver información de debugging
    if (!workingSelector) {
      console.log('❌ No working selector found');
      return res.json({
        found: false,
        message: "No se pudo conectar correctamente con AppSheet",
        debug: {
          testedSelectors: allResults,
          searchTerm: contacto,
          isEmail
        }
      });
    }
    
    const clients = workingSelector.data;
    console.log(`✅ Found ${clients.length} clients using ${workingSelector.method}`);



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