import React from "react";
import HeroIllustration from "../assets/hero-illustration.svg"; // opcional; si no la tenés, la imagen puede omitirse

export default function Hero() {
  return (
    <section className="container mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
      <div className="space-y-6">
        <h2 className="text-5xl md:text-6xl font-extrabold leading-tight">
          Bienvenido a <span className="text-white">Barbatero</span>
        </h2>
        <p className="text-gray-300 max-w-xl">
          Tradición y estilo en cada corte. Reserva tu turno y viví la experiencia Barbero con barberos profesionales y ambiente único.
        </p>

        <div className="flex items-center gap-4">
          <button className="px-8 py-4 rounded-3xl font-bold text-black bg-white text-lg shadow-xl">
            Quiero mi turno
          </button>
          <a href="#about" className="text-gray-300 hover:text-white">Conocé más</a>
        </div>

        <div className="mt-6 text-sm text-gray-500">
          <strong>Horario:</strong> Lun - Sáb: 09:00 - 20:00
        </div>
      </div>

      <div className="hidden md:flex justify-center items-center">
        {/*
          Puedes reemplazar con una ilustración propia. Si no querés imagen,
          comentá o eliminá la etiqueta <img>.
        */}
        <img src={HeroIllustration} alt="Barber illustration" className="w-3/4 opacity-90" />
      </div>
    </section>
  );
}
