export default function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Manejar preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Aceptar POST y PUT
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  console.log('✏️ Actualizar cliente request:', {
    method: req.method,
    body: req.body
  });

  const { 
    id,
    nombre, 
    apellido, 
    telefono, 
    email, 
    fechaNacimiento,
    notas 
  } = req.body;

  // Validar datos requeridos
  if (!id || !nombre) {
    return res.status(400).json({ 
      error: 'Faltan datos requeridos: id, nombre',
      success: false
    });
  }

  // Mock: Simular actualización de cliente
  // En producción esto actualizaría el registro en AppSheet
  const clienteActualizado = {
    id,
    nombre: nombre.trim(),
    apellido: apellido?.trim() || '',
    telefono: telefono?.trim() || '',
    email: email?.trim() || '',
    fechaNacimiento: fechaNacimiento || '',
    notas: notas?.trim() || '',
    fechaActualizacion: new Date().toISOString()
  };

  console.log('✅ Cliente actualizado (mock):', clienteActualizado);

  res.status(200).json({
    success: true,
    cliente: clienteActualizado,
    message: `Cliente ${nombre} actualizado exitosamente`
  });
}