import React from "react";
import HeroIllustration from "../assets/hero-illustration.jpeg";

export default function Hero() {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.pushState(null, "", `#${id}`);
    } else {
      window.location.href = `#${id}`;
    }
  };

  return (
    <section
      className="hero-full"
      style={{
        backgroundImage: `url(${HeroIllustration})`,
      }}
    >
      <div className="hero-overlay">
        <div className="hero-overlay-box text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
            Bienvenido a{" "}
            <span className="text-white">Barbatero</span>
          </h1>
          <p className="text-lg max-w-2xl mx-auto mb-8 opacity-90">
            Tradición y estilo en cada corte. Reserva tu turno y viví la
            experiencia Barbatero con barberos profesionales y ambiente único.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <button onClick={() => scrollTo("turno")} className="btn-cta text-lg px-8 py-4 min-w-[192px]">
              Quiero mi turno
            </button>
            <button onClick={() => scrollTo("about")} className="btn-outline text-lg px-8 min-w-[192px]">
              Conocé más
            </button>
          </div>

          <div className="text-center text-white">
            <div className="inline-flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-6 py-3">
              <span className="text-lg font-bold">Horario:</span>
              <span className="text-lg">Lun - Sáb: 09:30 - 19:00</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
