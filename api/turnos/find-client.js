export default function handler(req, res) {
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
    const isEmail = input.includes('@');
    
    const mockClient = {
      "Row ID": isEmail ? "mock123" : "mock456",
      "Nombre y Apellido": isEmail ? "Cliente Email Test" : "Cliente Teléfono Test",
      "Correo": isEmail ? input : "",
      "Teléfono": isEmail ? "" : input
    };

    console.log('Returning client:', mockClient);
    return res.json({ found: true, client: mockClient, upcoming: [], memberships: [] });

  } catch (e) {
    console.error('Find-client error:', e);
    return res.status(500).json({ found: false, message: "Error interno al buscar cliente." });
  }
}