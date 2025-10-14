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
    if (emailMode) {
      const filter = `([Correo] = "${input.replace(/"/g, '\\"')}")`;
      try {
        console.log('Email search filter:', filter);
        const clientResp = await findRows(CLIENTES_TABLE, filter);
        rows = normalizeRows(clientResp) || [];
        console.log('Email search results:', rows.length);
      } catch (e) {
        console.warn('findRows por email falló, intentar readRows', e?.message ?? e);
        const all = await readRows(CLIENTES_TABLE);
        rows = normalizeRows(all) || [];
      }
    } else {
      // Búsqueda por teléfono
      const digitsTarget = digitsOnly(input);
      console.log('Phone search target:', { input, digitsTarget });
      
      try {
        const all = await readRows(CLIENTES_TABLE);
        rows = normalizeRows(all) || [];
        console.log('Total clients read:', rows.length);
      } catch (e) {
        console.error('Error reading clients:', e);
        return res.status(500).json({ found: false, message: "Error al buscar cliente." });
      }
    }

    // Filtrar resultados
    if (emailMode) {
      const emailLower = input.toLowerCase();
      rows = (rows || []).filter(r => {
        const c = valueToString(r.Correo ?? r["Correo"] ?? r.email ?? r.Email ?? "").trim().toLowerCase();
        if (c === emailLower) return true;
        return rowContainsEmail(r, emailLower);
      });
    } else {
      const digitsTarget = digitsOnly(input);
      rows = (rows || []).filter(r => {
        const phoneRaw = r["Teléfono"] ?? r.Telefono ?? r.phone ?? r.Phone ?? "";
        const phoneStr = valueToString(phoneRaw).trim();
        const pd = digitsOnly(phoneRaw);
        
        if (phoneStr && phoneStr === input) return true;
        if (pd && pd === digitsTarget) return true;
        return false;
      });
    }

    console.log('Filtered clients found:', rows.length);

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