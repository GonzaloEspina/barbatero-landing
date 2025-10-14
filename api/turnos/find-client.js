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
    
    // Generar nombre basado en el email/teléfono específico
    let nombre, apellido;
    if (isEmail) {
      const emailPart = input.split('@')[0];
      if (emailPart.includes('.')) {
        const parts = emailPart.split('.');
        nombre = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        apellido = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
      } else {
        nombre = emailPart.charAt(0).toUpperCase() + emailPart.slice(1);
        apellido = 'Cliente';
      }
    } else {
      // Para teléfonos, usar nombres genéricos basados en los últimos dígitos
      const lastDigits = input.slice(-2);
      const nombres = ['María', 'Juan', 'Ana', 'Carlos', 'Lucia', 'Pedro'];
      const apellidos = ['González', 'Rodríguez', 'López', 'Martínez', 'García', 'Fernández'];
      nombre = nombres[parseInt(lastDigits) % nombres.length];
      apellido = apellidos[parseInt(lastDigits) % apellidos.length];
    }
    
    const mockClient = {
      "Row ID": `cliente_${Date.now()}`,
      "Nombre y Apellido": `${nombre} ${apellido}`,
      "Correo": isEmail ? input : "",
      "Teléfono": isEmail ? "" : input
    };

    // Mock: Agregar turnos próximos específicos para este contacto
    const baseDate = new Date();
    const upcoming = [];
    
    // Generar 1-3 turnos basados en el hash del contacto
    const contactHash = input.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const numTurnos = (contactHash % 3) + 1;
    
    for (let i = 0; i < numTurnos; i++) {
      const futureDate = new Date(baseDate.getTime() + (i + 3) * 24 * 60 * 60 * 1000);
      const servicios = ['Corte', 'Barba', 'Corte + Barba', 'Combo Completo'];
      const precios = ['$5000', '$3000', '$8000', '$12000'];
      const estados = ['confirmado', 'pendiente'];
      const horas = ['09:00', '10:30', '12:00', '15:00', '16:30', '18:00'];
      
      const servicioIndex = (contactHash + i) % servicios.length;
      
      upcoming.push({
        id: `turno_${contactHash}_${i}`,
        Fecha: futureDate.toISOString().split('T')[0],
        Hora: horas[(contactHash + i) % horas.length],
        Servicio: servicios[servicioIndex],
        Estado: estados[i % estados.length],
        Precio: precios[servicioIndex]
      });
    }

    console.log('Returning client:', mockClient);
    console.log('Returning upcoming appointments:', upcoming);
    return res.json({ found: true, client: mockClient, upcoming, memberships: [] });

  } catch (e) {
    console.error('Find-client error:', e);
    return res.status(500).json({ found: false, message: "Error interno al buscar cliente." });
  }
}