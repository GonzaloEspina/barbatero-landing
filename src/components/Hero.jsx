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
        <div className="hero-overlay-box container-narrow text-center">
          <h2 className="text-5xl md:text-6xl font-extrabold leading-tight mb-4">
            Bienvenido a{" "}
            <span className="text-white">Barbatero</span>
          </h2>
          <p className="text-muted max-w-2xl mx-auto mb-6">
            Tradición y estilo en cada corte. Reserva tu turno y viví la
            experiencia Barbatero con barberos profesionales y ambiente único.
          </p>

          <div className="flex items-center justify-center gap-4">
            <button onClick={() => scrollTo("turno")} className="btn-cta">
              Quiero mi turno
            </button>
            <button onClick={() => scrollTo("about")} className="btn-outline">
              Conocé más
            </button>
          </div>

          <div className="mt-6 text-sm text-muted">
            <strong className="text-white">Horario:</strong> Lun - Sáb: 09:00 -
            20:00
          </div>
        </div>
      </div>
    </section>
  );
}
