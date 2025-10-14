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

  console.log('📅 Disponibilidad request:', {
    query: req.query,
    fecha: req.query.fecha
  });

  const { fecha } = req.query;

  if (!fecha) {
    return res.status(400).json({ 
      error: 'Fecha requerida',
      horarios: []
    });
  }

  // Mock: Generar horarios disponibles para la fecha solicitada
  // En producción esto consultaría AppSheet para ver qué horarios están libres
  const horariosBase = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30'
  ];

  // Simular que algunos horarios ya están ocupados
  const ocupados = ['10:00', '11:30', '15:00', '17:00'];
  const disponibles = horariosBase.filter(h => !ocupados.includes(h));

  console.log('✅ Horarios disponibles generados:', disponibles);

  res.status(200).json({
    fecha,
    horarios: disponibles,
    message: `${disponibles.length} horarios disponibles para ${fecha}`
  });
}