import React from "react";

export default function About() {
  return (
    <section id="about" className="container mx-auto px-6 py-12">
      <div className="max-w-4xl mx-auto bg-gray-900/40 p-8 rounded-2xl">
        <h3 className="text-2xl font-bold mb-4">Información</h3>
        <p className="text-gray-300 mb-4">
          En <strong>Barbatero</strong> ofrecemos cortes clásicos y modernos, afeitados tradicionales con toalla caliente y tratamientos de barba con productos seleccionados.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h4 className="font-semibold">Dirección</h4>
            <p className="text-gray-400">Av. Ejemplo 123, Ciudad</p>
          </div>
          <div>
            <h4 className="font-semibold">Contacto</h4>
            <p className="text-gray-400">+54 9 11 1234 5678</p>
          </div>
          <div>
            <h4 className="font-semibold">Servicios</h4>
            <p className="text-gray-400">Cortes, barba, diseño, coloración</p>
          </div>
        </div>
      </div>
    </section>
  );
}
