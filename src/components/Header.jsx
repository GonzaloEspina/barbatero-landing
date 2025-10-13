import React from "react";
import Logo from "../assets/logo-modificado-blanco.svg";

export default function Header() {
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
    <header className="site-header">
      <div className="container-narrow header-grid">
        {/* left: logo + name */}
        <div className="header-left">
          <img src={Logo} alt="Barbatero" className="logo" />
          <span className="site-name">Barbatero</span>
        </div>

        {/* center: nav */}
        <nav className="nav-center" aria-label="Main navigation">
          <a href="#about" onClick={(e)=>{e.preventDefault(); scrollTo("about");}} className="nav-link">Nosotros</a>
          <a href="#services" onClick={(e)=>{e.preventDefault(); scrollTo("services");}} className="nav-link">Servicios</a>
          <a href="#reviews" onClick={(e)=>{e.preventDefault(); scrollTo("reviews");}} className="nav-link">Reseñas</a>
        </nav>

        {/* right: CTA */}
        <div className="header-right">
          <button onClick={() => scrollTo("turno")} className="btn-cta" aria-label="Quiero mi turno">Quiero mi turno</button>
        </div>
      </div>
    </header>
  );
}
