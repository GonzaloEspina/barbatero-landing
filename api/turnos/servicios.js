// Configurar CORS
function setCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

async function getServicios(req, res) {
  try {
    // Servicios de ejemplo para testing
    const mockServicios = [
      {
        key: "corte",
        servicio: "Corte de Cabello",
        duracion: "30 min",
        precio: "$15000"
      },
      {
        key: "barba",
        servicio: "Arreglo de Barba",
        duracion: "20 min", 
        precio: "$10000"
      },
      {
        key: "combo",
        servicio: "Corte + Barba",
        duracion: "50 min",
        precio: "$22000"
      }
    ];

    return res.json({ ok: true, servicios: mockServicios });
  } catch (e) {
    console.error("[getServicios] error:", e);
    return res.status(500).json({ ok: false, message: "Error obteniendo servicios" });
  }
}

export default async function handler(req, res) {
  setCors(res);
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await getServicios(req, res);
  } catch (error) {
    console.error('Error in servicios:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}