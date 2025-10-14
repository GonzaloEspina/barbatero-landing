export default function handler(req, res) {
  console.log('Turnos index handler:', { method: req.method, url: req.url });

  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.json({ 
    ok: true, 
    message: "API Turnos funcionando",
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      "GET /api/turnos/servicios",
      "POST /api/turnos/find-client"
    ]
  });
}