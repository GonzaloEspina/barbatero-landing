// Debug: Buscar todas las tablas posibles con datos de clientes
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('🔍 SEARCHING ALL POSSIBLE TABLES - Starting comprehensive search');

  const BASE = process.env.APPSHEET_BASE_URL;
  const APP_KEY = process.env.APPSHEET_ACCESS_KEY;
  
  console.log('🔧 AppSheet config:', { BASE, hasKey: !!APP_KEY });

  async function checkTable(tableName) {
    const url = `${BASE}/tables/${encodeURIComponent(tableName)}/Action`;
    const headers = {
      "Content-Type": "application/json",
      "ApplicationAccessKey": APP_KEY
    };

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
      
      let sampleRecord = null;
      if (isArray && length > 0) {
        sampleRecord = json[0];
        console.log(`📊 Table ${tableName}: FOUND ${length} records!`);
        console.log(`   Sample keys: ${Object.keys(sampleRecord).join(', ')}`);
        
        // Buscar campos que parezcan email o teléfono
        const emailFields = Object.keys(sampleRecord).filter(key => 
          key.toLowerCase().includes('email') || 
          key.toLowerCase().includes('correo') || 
          key.toLowerCase().includes('mail')
        );
        const phoneFields = Object.keys(sampleRecord).filter(key => 
          key.toLowerCase().includes('telefono') || 
          key.toLowerCase().includes('phone') || 
          key.toLowerCase().includes('tel')
        );
        
        if (emailFields.length > 0 || phoneFields.length > 0) {
          console.log(`   ✅ POTENTIAL CLIENT TABLE: emails=${emailFields.join(',')}, phones=${phoneFields.join(',')}`);
        }
      }
      
      return {
        table: tableName,
        status: resp.status,
        hasData: !!json,
        isArray,
        length,
        success: resp.status === 200 && isArray,
        sampleRecord,
        hasClientFields: sampleRecord && (
          Object.keys(sampleRecord).some(key => 
            key.toLowerCase().includes('email') || 
            key.toLowerCase().includes('correo') || 
            key.toLowerCase().includes('telefono') || 
            key.toLowerCase().includes('phone')
          )
        )
      };
    } catch (error) {
      return {
        table: tableName,
        error: error.message,
        success: false
      };
    }
  }

  // Nombres más amplios de tablas que podrían contener clientes
  const tablesToCheck = [
    // Clientes
    'Clientes', 'Cliente', 'clientes', 'cliente', 'CLIENTES', 'CLIENTE',
    
    // Usuarios
    'Usuarios', 'Usuario', 'usuarios', 'usuario', 'USUARIOS', 'USUARIO',
    'Users', 'User', 'users', 'user', 'USERS', 'USER',
    
    // Personas
    'Personas', 'Persona', 'personas', 'persona', 'PERSONAS', 'PERSONA',
    'People', 'Person', 'people', 'person', 'PEOPLE', 'PERSON',
    
    // Contactos
    'Contactos', 'Contacto', 'contactos', 'contacto', 'CONTACTOS', 'CONTACTO',
    'Contacts', 'Contact', 'contacts', 'contact', 'CONTACTS', 'CONTACT',
    
    // Turnos (por si los datos están ahí)
    'Turnos', 'Turno', 'turnos', 'turno', 'TURNOS', 'TURNO',
    'Appointments', 'Appointment', 'appointments', 'appointment',
    
    // Membresías
    'Membresias', 'Membresia', 'membresias', 'membresia',
    'Memberships', 'Membership', 'memberships', 'membership'
  ];

  console.log(`🔍 Checking ${tablesToCheck.length} possible table names...`);

  const results = [];
  for (const tableName of tablesToCheck) {
    const result = await checkTable(tableName);
    results.push(result);
    
    // Si encontramos una tabla con datos, mostramos más info
    if (result.success && result.length > 0) {
      console.log(`🎯 FOUND DATA IN: ${tableName} (${result.length} records)`);
    }
  }

  // Filtrar tablas con datos
  const withData = results.filter(r => r.success && r.length > 0);
  const withClientFields = withData.filter(r => r.hasClientFields);

  console.log(`✅ Summary: ${withData.length} tables with data, ${withClientFields.length} potential client tables`);

  return res.json({
    summary: {
      tablesChecked: tablesToCheck.length,
      withData: withData.length,
      withClientFields: withClientFields.length
    },
    tablesWithData: withData.map(r => ({
      table: r.table,
      length: r.length,
      hasClientFields: r.hasClientFields,
      sampleKeys: r.sampleRecord ? Object.keys(r.sampleRecord) : []
    })),
    potentialClientTables: withClientFields,
    allResults: results.filter(r => r.success)
  });
}