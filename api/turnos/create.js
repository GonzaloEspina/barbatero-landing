export default function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Manejar preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo aceptar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  console.log('📝 Crear turno request:', {
    body: req.body
  });

  const { 
    clienteId, 
    servicioId, 
    fecha, 
    hora, 
    precio,
    servicio,
    cliente 
  } = req.body;

  // Validar datos requeridos
  if (!clienteId || !servicioId || !fecha || !hora) {
    return res.status(400).json({ 
      error: 'Faltan datos requeridos: clienteId, servicioId, fecha, hora',
      success: false
    });
  }

  // Mock: Simular creación de turno
  // En producción esto crearía el registro en AppSheet
  const nuevoTurno = {
    id: `turno_${Date.now()}`,
    clienteId,
    servicioId,
    fecha,
    hora,
    precio: precio || 0,
    servicio: servicio || 'Servicio',
    cliente: cliente || 'Cliente',
    estado: 'confirmado',
    fechaCreacion: new Date().toISOString()
  };

  console.log('✅ Turno creado (mock):', nuevoTurno);

  res.status(201).json({
    success: true,
    turno: nuevoTurno,
    message: `Turno creado para ${fecha} a las ${hora}`
  });
}