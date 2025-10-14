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

  console.log('👤 Crear cliente request:', {
    body: req.body
  });

  const { 
    nombre, 
    apellido, 
    telefono, 
    email, 
    fechaNacimiento,
    notas 
  } = req.body;

  // Validar datos requeridos
  if (!nombre || (!telefono && !email)) {
    return res.status(400).json({ 
      error: 'Faltan datos requeridos: nombre y al menos telefono o email',
      success: false
    });
  }

  // Mock: Simular creación de cliente
  // En producción esto crearía el registro en AppSheet
  const nuevoCliente = {
    id: `cliente_${Date.now()}`,
    nombre: nombre.trim(),
    apellido: apellido?.trim() || '',
    telefono: telefono?.trim() || '',
    email: email?.trim() || '',
    fechaNacimiento: fechaNacimiento || '',
    notas: notas?.trim() || '',
    fechaRegistro: new Date().toISOString(),
    activo: true
  };

  console.log('✅ Cliente creado (mock):', nuevoCliente);

  res.status(201).json({
    success: true,
    cliente: nuevoCliente,
    message: `Cliente ${nombre} creado exitosamente`
  });
}