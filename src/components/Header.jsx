import React from "react";
import Logo from "../assets/logo.svg";

export default function Header() {
  return (
    <header className="container mx-auto px-6 py-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src={Logo} alt="Barbatero" className="w-12 h-12" />
        <div>
          <h1 className="text-xl font-bold">Barbatero</h1>
          <p className="text-sm text-gray-400 -mt-1">Barbería & Estilo</p>
        </div>
      </div>

      <nav className="flex items-center gap-4">
        <a href="#about" className="text-gray-300 hover:text-white">Información</a>
        <a href="#reviews" className="text-gray-300 hover:text-white">Reseñas</a>
        <button
          className="ml-4 px-6 py-3 rounded-2xl font-semibold text-black bg-white shadow-lg transform transition hover:scale-105"
        >
          Quiero mi turno
        </button>
      </nav>
    </header>
  );
}
