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

  console.log('💳 Reservar membresía request:', {
    body: req.body
  });

  const { clientRowId, membershipKey } = req.body;

  // Validar datos requeridos
  if (!clientRowId || !membershipKey) {
    return res.status(400).json({ 
      error: 'Faltan datos requeridos: clientRowId, membershipKey',
      ok: false
    });
  }

  // Mock: Simular reserva de membresía
  // En producción esto crearía el registro en AppSheet
  const reserva = {
    id: `membership_${Date.now()}`,
    clientRowId,
    membershipKey,
    estado: 'reservada',
    fechaReserva: new Date().toISOString(),
    fechaVencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 días
  };

  console.log('✅ Membresía reservada (mock):', reserva);

  res.status(200).json({
    ok: true,
    reserva,
    message: `Membresía ${membershipKey} reservada para cliente ${clientRowId}`
  });
}