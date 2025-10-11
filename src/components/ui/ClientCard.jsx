import React from "react";
import { parseDateFromString, formatDateDMY } from "./utils";

export default function ClientCard({ cliente, upcoming = [], openModal }) {
  return (
    <div className="border border-gray-300 rounded-lg p-6 shadow-md bg-gray-50 text-gray-800">
      <h3 className="text-xl font-bold text-blue-700 mb-4">Cliente encontrado</h3>
      <p><span className="font-semibold">Nombre:</span> <span className="font-bold">{cliente["Nombre y Apellido"]}</span></p>
      <p><span className="font-semibold">Teléfono:</span> <span className="font-bold">{cliente["Teléfono"] || "-"}</span></p>
      <p><span className="font-semibold">Correo:</span> <span className="font-bold">{cliente.Correo || ""}</span></p>

      <div className="mt-4">
        <h4 className="font-semibold">Próximos turnos</h4>
        {upcoming.length === 0 ? (
          <div className="mt-2">
            <p>No hay turnos futuros. </p>
            <button onClick={openModal} className="mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Sacar Turno</button>
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {upcoming.map((t, i) => (
              <li key={i} className="p-2 bg-white rounded border">
                <div>
                  <span className="font-semibold">Fecha:</span>{" "}
                  {(() => {
                    const pd = parseDateFromString(t.Fecha);
                    return pd ? formatDateDMY(pd) : String(t.Fecha || "");
                  })()}
                </div>
                <div><span className="font-semibold">Hora:</span> {t.Hora}</div>
                <div><span className="font-semibold">Servicio:</span> {t.Servicio}</div>
              </li>
            ))}
            <div className="mt-3">
              <button onClick={openModal} className="px-3 py-1 text-sm bg-yellow-500 rounded">Sacar otro turno</button>
            </div>
          </ul>
        )}
      </div>
    </div>
  );
}