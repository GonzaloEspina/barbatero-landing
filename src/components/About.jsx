import React from "react";
import Foto from "../assets/foto-cortando-pelo.jpeg";
import { Clock, MapPin, Phone, Scissors } from "lucide-react";

export default function About() {
  const address = "Faustino Nicolás Cesio 243, B1706 Haedo, Provincia de Buenos Aires";
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const whatsappNumberInternational = "5491160220978";
  const whatsappUrl = `https://wa.me/${whatsappNumberInternational}?text=${encodeURIComponent("Hola, quiero sacar un turno")}`;

  return (
    <section id="about" className="about-section py-16">
      <div className="container-narrow mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div>
            <img src={Foto} alt="Cortando pelo" className="rounded-xl shadow-lg w-full object-cover max-h-96" />
          </div>

          <div>
            <h3 className="text-3xl font-bold mb-4 text-gray-900">Sobre Barbatero</h3>
            <p className="text-gray-700 mb-8">
              En <strong>Barbatero</strong> combinamos técnicas tradicionales de barbería con las últimas tendencias en cortes masculinos. Nuestro equipo de barberos profesionales se dedica a brindarte una experiencia única y personalizada.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="about-card flex items-start gap-4">
                <Clock className="w-6 h-6 text-gray-500 mt-1 shrink-0" />
                <div>
                  <h4 className="font-semibold mb-2">Horarios</h4>
                  <div className="text-sm text-gray-600">
                    Lun - Vie: 09:30 - 19:00<br />
                    Sábados: 09:30 - 20:00<br />
                    Domingos: Cerrado
                  </div>
                </div>
              </div>

              <div className="about-card flex items-start gap-4">
                <MapPin className="w-6 h-6 text-gray-500 mt-1 shrink-0" />
                <div>
                  <h4 className="font-semibold mb-2">Ubicación</h4>
                  <div className="text-sm text-gray-600">
                    <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-gray-700 hover:underline">
                      {address}
                    </a>
                  </div>
                </div>
              </div>

              <div className="about-card flex items-start gap-4">
                <Phone className="w-6 h-6 text-gray-500 mt-1 shrink-0" />
                <div>
                  <h4 className="font-semibold mb-2">Contacto</h4>
                  <div className="text-sm text-gray-600">
                    <a href={whatsappUrl} target="_blank" rel="noreferrer" className="text-gray-700 hover:underline">
                      +54 9 11 6022 0978
                    </a>
                    <div className="text-xs text-gray-500 mt-2">También respondemos por WhatsApp.</div>
                  </div>
                </div>
              </div>

              <div className="about-card flex items-start gap-4">
                <Scissors className="w-6 h-6 text-gray-500 mt-1 shrink-0" />
                <div>
                  <h4 className="font-semibold mb-2">Servicios</h4>
                  <ul className="text-sm text-gray-600 list-disc list-inside">
                    <li>Cortes clásicos y modernos</li>
                    <li>Afeitado tradicional</li>
                    <li>Arreglo de barba y diseño</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
