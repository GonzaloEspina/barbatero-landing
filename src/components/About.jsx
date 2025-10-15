import React from "react";
import Foto from "../assets/foto-cortando-pelo.jpeg";
import { Scissors } from "lucide-react";

export default function About() {
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

            <div className="grid grid-cols-1 gap-6">
              <div className="about-card flex items-start gap-4">
                <Scissors className="w-6 h-6 text-gray-500 mt-1 shrink-0" />
                <div>
                  <h4 className="font-semibold mb-2">Nuestros Servicios</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Cortes clásicos y modernos</li>
                    <li>• Afeitado tradicional</li>
                    <li>• Arreglo de barba y diseño</li>
                    <li>• Atención personalizada</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 italic">
                  "Cada corte es una obra de arte. Nuestro compromiso es que salgas sintiéndote renovado y con la confianza de lucir tu mejor versión."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
