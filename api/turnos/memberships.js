export default function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Manejar preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo aceptar GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  console.log('💳 Membresías request');

  // Mock: Lista de membresías disponibles
  // En producción esto consultaría AppSheet
  const memberships = [
    {
      key: "premium_monthly",
      nombre: "Premium Mensual",
      descripcion: "Acceso completo por 30 días",
      precio: "$15000",
      beneficios: [
        "Cortes ilimitados",
        "Arreglo de barba incluido",
        "Prioridad en reservas",
        "Descuento en productos"
      ],
      duracion: "30 días",
      activa: true
    },
    {
      key: "premium_quarterly",
      nombre: "Premium Trimestral", 
      descripcion: "Acceso completo por 90 días con descuento",
      precio: "$40000",
      beneficios: [
        "Cortes ilimitados",
        "Arreglo de barba incluido",
        "Prioridad en reservas",
        "Descuento en productos",
        "20% de ahorro vs mensual"
      ],
      duracion: "90 días",
      activa: true
    },
    {
      key: "basic_monthly",
      nombre: "Básica Mensual",
      descripcion: "Plan básico para uso regular",
      precio: "$8000",
      beneficios: [
        "4 cortes por mes",
        "Descuento en servicios adicionales"
      ],
      duracion: "30 días",
      activa: true
    }
  ];

  console.log('✅ Membresías disponibles:', memberships.length);

  res.status(200).json({
    memberships,
    message: `${memberships.length} membresías disponibles`
  });
}