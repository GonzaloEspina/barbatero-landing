import React from 'react';

export default function MapSection() {
  const address = "Faustino Nicolás Cesio 243, B1706 Haedo, Provincia de Buenos Aires";
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  
  return (
    <section id="ubicacion" className="map-section py-16 bg-gradient-to-br from-gray-900 to-black">
      <div className="container-narrow">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-white mb-4">Ubicación</h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Visitanos en nuestro local ubicado en el corazón de Haedo
          </p>
        </div>
        
        <div className="max-w-5xl mx-auto">
          {/* Mapa principal */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-4 rounded-2xl border border-gray-600 shadow-xl mb-6">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3283.0126449736893!2d-58.59239582426097!3d-34.646510199999985!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95bcc7962ed2c59f%3A0x492da6898c998e63!2sBarbatero%20Barber%20Studio!5e0!3m2!1ses!2sar!4v1728000000000!5m2!1ses!2sar"
              width="100%"
              height="450"
              style={{ border: 0, borderRadius: '12px' }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Ubicación de Barbatero Barber Studio"
              className="w-full rounded-xl"
            />
          </div>
          
          {/* Información compacta de contacto */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl border border-gray-600 shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <h3 className="text-white font-semibold mb-2 flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Dirección
                </h3>
                <p className="text-gray-300 text-sm">{address}</p>
              </div>
              
              <div>
                <h3 className="text-white font-semibold mb-2 flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Horarios
                </h3>
                <p className="text-gray-300 text-sm">Lun - Sáb: 09:30 - 19:00</p>
                <p className="text-gray-300 text-sm">Domingo: Cerrado</p>
              </div>
              
              <div>
                <h3 className="text-white font-semibold mb-2 flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Contacto
                </h3>
                <a href="tel:+5491160220978" className="text-yellow-400 hover:text-yellow-300 transition-colors text-sm">
                  1160220978
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}