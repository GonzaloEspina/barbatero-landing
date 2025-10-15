import React from "react";

export default function Footer() {
  return (
    <footer className="footer-section py-6 bg-black">
      <div className="container-narrow">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <p className="text-sm text-gray-300">© {new Date().getFullYear()} Barbatero</p>
          </div>
          <div className="text-center md:text-right">
            <p className="text-sm text-gray-300">Estilo y distinción desde el primer corte</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
