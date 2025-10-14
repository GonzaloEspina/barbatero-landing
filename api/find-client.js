function isEmail(str) {
  if (!str) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(str).trim());
}

export default function handler(req, res) {
  console.log('Find-client API called:', { method: req.method, url: req.url, body: req.body });

  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { contacto } = req.body;
    if (!contacto) return res.status(400).json({ found: false, message: "Ingrese correo o teléfono." });

    const input = String(contacto).trim();
    const emailMode = isEmail(input);

    // Datos mock para testing
    if (emailMode || input.includes('@')) {
      const mockClient = {
        "Row ID": "mock123",
        "Nombre y Apellido": "Cliente de Prueba",
        "Correo": input,
        "Teléfono": ""
      };
      return res.status(200).json({ 
        found: true, 
        client: mockClient, 
        upcoming: [], 
        memberships: [] 
      });
    } else {
      const mockClient = {
        "Row ID": "mock456", 
        "Nombre y Apellido": "Cliente Teléfono",
        "Teléfono": input,
        "Correo": ""
      };
      return res.status(200).json({ 
        found: true, 
        client: mockClient, 
        upcoming: [], 
        memberships: [] 
      });
    }

  } catch (e) {
    console.error("[findClient] error:", e);
    return res.status(500).json({ found: false, message: "Error interno al buscar cliente." });
  }
}