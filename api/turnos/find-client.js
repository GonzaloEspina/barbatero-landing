import { findRows, readRows } from '../_lib/appsheet-utils.js';

// Utilidades copiadas del backend original
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

export default async function handler(req, res) {
  console.log('Find-client handler called:', { method: req.method, url: req.url, body: req.body });

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
    console.log('Contacto received:', contacto);
    
    if (!contacto) {
      return res.status(400).json({ found: false, message: "Ingrese correo o teléfono." });
    }

    const input = String(contacto).trim();
    const emailMode = isEmail(input);
    const CLIENTES_TABLE = "Clientes";

    console.log('Searching for client:', { input, emailMode });

    // Buscar cliente en AppSheet
    let rows = [];
    
    console.log('Environment check:', {
      hasBaseUrl: !!process.env.APPSHEET_BASE_URL,
      hasAccessKey: !!process.env.APPSHEET_ACCESS_KEY,
      baseUrl: process.env.APPSHEET_BASE_URL ? 'CONFIGURED' : 'MISSING'
    });

    try {
      // Siempre leer todos los clientes para mayor confiabilidad
      console.log('Reading all clients from AppSheet...');
      const all = await readRows(CLIENTES_TABLE);
      const allRows = normalizeRows(all) || [];
      console.log('Total clients read from AppSheet:', allRows.length);
      
      if (allRows.length > 0) {
        console.log('Sample client structure:', JSON.stringify(allRows[0], null, 2));
      }
      
      rows = allRows;
    } catch (e) {
      console.error('Error reading clients from AppSheet:', e);
      return res.status(500).json({ 
        found: false, 
        message: "Error al conectar con la base de datos.",
        error: e.message 
      });
    }

    // Filtrar resultados con logging detallado
    console.log('Filtering clients for:', { input, emailMode });
    
    if (emailMode) {
      const emailLower = input.toLowerCase();
      console.log('Looking for email:', emailLower);
      
      // Mostrar sample de emails en la BD
      const sampleEmails = rows.slice(0, 5).map(r => ({
        correo: valueToString(r.Correo ?? r["Correo"] ?? r.email ?? r.Email ?? "").trim(),
        allFields: Object.keys(r).filter(k => k.toLowerCase().includes('correo') || k.toLowerCase().includes('email'))
      }));
      console.log('Sample emails from database:', sampleEmails);
      
      rows = (rows || []).filter(r => {
        const emailFields = [
          r.Correo, r["Correo"], r.email, r.Email, r.Mail, r.mail,
          r["E-mail"], r["Correo Electrónico"], r["Correo electronico"]
        ];
        
        for (const field of emailFields) {
          const emailValue = valueToString(field).trim().toLowerCase();
          if (emailValue === emailLower) {
            console.log('Email match found:', emailValue);
            return true;
          }
        }
        return false;
      });
    } else {
      const digitsTarget = digitsOnly(input);
      console.log('Looking for phone digits:', digitsTarget);
      
      // Mostrar sample de teléfonos en la BD
      const samplePhones = rows.slice(0, 5).map(r => ({
        telefono: valueToString(r["Teléfono"] ?? r.Telefono ?? r.phone ?? r.Phone ?? "").trim(),
        digits: digitsOnly(r["Teléfono"] ?? r.Telefono ?? r.phone ?? r.Phone ?? ""),
        allFields: Object.keys(r).filter(k => k.toLowerCase().includes('tel') || k.toLowerCase().includes('phone'))
      }));
      console.log('Sample phones from database:', samplePhones);
      
      rows = (rows || []).filter(r => {
        const phoneFields = [
          r["Teléfono"], r.Telefono, r.phone, r.Phone, r.Tel, r.tel,
          r["Número"], r.Numero, r["Celular"], r.celular
        ];
        
        for (const field of phoneFields) {
          const phoneStr = valueToString(field).trim();
          const pd = digitsOnly(field);
          
          // Comparación exacta primero
          if (phoneStr === input) {
            console.log('Phone exact match found:', phoneStr);
            return true;
          }
          
          // Comparación por dígitos
          if (pd && pd === digitsTarget) {
            console.log('Phone digits match found:', pd);
            return true;
          }
          
          // Comparación flexible (contiene)
          if (pd && digitsTarget && (pd.includes(digitsTarget) || digitsTarget.includes(pd))) {
            console.log('Phone flexible match found:', { pd, digitsTarget });
            return true;
          }
        }
        return false;
      });
    }

    console.log('Filtered clients found:', rows.length);
    if (rows.length > 0) {
      console.log('Found client sample:', JSON.stringify(rows[0], null, 2));
    }

    // Si no encontramos cliente
    if (!rows || rows.length === 0) {
      const contactType = emailMode ? "correo" : "teléfono";
      const prefill = emailMode ? { Correo: input } : { Telefono: input };
      const message = `No se encontró el ${contactType} ingresado, por favor complete sus datos para sacar un turno.`;
      return res.status(200).json({ found: false, contactType, prefill, message });
    }

    const client = rows[0];
    const clientRowId = extractClientRowId(client);
    console.log('Client found:', { clientRowId, name: client["Nombre y Apellido"] });

    // Buscar turnos del cliente
    let upcoming = [];
    try {
      if (clientRowId) {
        const filterTurnos = `([Cliente ID] = "${String(clientRowId).replace(/"/g,'\\"')}")`;
        console.log('Searching turnos with filter:', filterTurnos);
        
        try {
          const turnosResp = await findRows("Turnos", filterTurnos);
          let turnosRows = normalizeRows(turnosResp) || [];
          console.log('Turnos found:', turnosRows.length);
          
          // Filtrar solo turnos futuros
          const now = new Date();
          const today = now.toISOString().split('T')[0];
          
          upcoming = turnosRows.filter(t => {
            const fechaStr = String(t.Fecha ?? t['Fecha'] ?? "");
            if (!fechaStr) return false;
            
            // Intentar parsear fecha en formato ISO
            if (fechaStr >= today) return true;
            
            return false;
          });
          
          console.log('Future turnos:', upcoming.length);
        } catch (e) {
          console.warn('Error searching turnos:', e);
        }
      }
    } catch (e) {
      console.warn('Error fetching turnos:', e);
    }

    // Buscar membresías (simplificado por ahora)
    let memberships = [];

    console.log('Returning client data:', { 
      found: true, 
      clientId: clientRowId, 
      upcomingCount: upcoming.length 
    });

    return res.json({ 
      found: true, 
      client, 
      upcoming, 
      memberships 
    });

  } catch (e) {
    console.error('Find-client error:', e);
    return res.status(500).json({ found: false, message: "Error interno al buscar cliente." });
  }
}