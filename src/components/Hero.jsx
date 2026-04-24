import React, { useEffect, useState } from "react";
import HeroIllustration from "../assets/hero-illustration.jpeg";
import OneSignal from "react-onesignal";

const whatsappUrl = `https://wa.me/5491160220978?text=${encodeURIComponent(
  "Hola, quiero sacar un turno"
)}`;

export default function Hero() {
  const [mostrarNotiBtn, setMostrarNotiBtn] = useState(true);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.pushState(null, "", `#${id}`);
    } else {
      window.location.href = `#${id}`;
    }
  };

  useEffect(() => {
    // Verifica si ya aceptó notificaciones
    OneSignal.isPushNotificationsEnabled().then((enabled) => {
      if (enabled) {
        setMostrarNotiBtn(false);
      }
    });
  }, []);

  const activarNotificaciones = async () => {
    await OneSignal.showSlidedownPrompt();

    // Espera un poco y vuelve a chequear
    setTimeout(() => {
      OneSignal.isPushNotificationsEnabled().then((enabled) => {
        if (enabled) {
          setMostrarNotiBtn(false);
        }
      });
    }, 2000);
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
            Bienvenido a <span className="text-white">Barbatero</span>
          </h1>

          <p className="text-lg max-w-2xl mx-auto mb-8 opacity-90">
            Tradición y estilo en cada corte. Reserva tu turno y viví la
            experiencia Barbatero con barberos profesionales y ambiente único.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <button
              onClick={() => window.open(whatsappUrl, "_blank")}
              className="btn-cta"
              aria-label="Quiero mi turno"
            >
              Quiero mi turno
            </button>

            <button
              onClick={() => scrollTo("about")}
              className="btn-outline text-lg px-8 min-w-[192px]"
            >
              Conocé más
            </button>
          </div>

          {mostrarNotiBtn && (
            <button
              onClick={activarNotificaciones}
              className="mt-3 text-sm text-yellow-400 border border-yellow-400 px-4 py-2 rounded-full hover:bg-yellow-400 hover:text-black transition"
            >
              🔔 Recibir recordatorios
            </button>
          )}

          <div className="text-center text-white mt-6">
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