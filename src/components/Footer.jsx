import React from "react";

export default function Footer() {
  return (
    <footer className="bg-black/80 border-t border-white/6">
      <div className="container mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-400">© {new Date().getFullYear()} Barbatero. Todos los derechos reservados.</p>
        </div>

        <div className="flex items-center gap-4">
          <a href="#" className="text-gray-300 hover:text-white text-sm">Política de privacidad</a>
          <a href="#" className="text-gray-300 hover:text-white text-sm">Contacto</a>
        </div>
      </div>
    </footer>
  );
}
