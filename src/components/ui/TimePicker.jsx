import React from "react";

export default function TimePicker({ horarios = [], hora, onSelectHora, disponibilidadMsg }) {
  return (
    <div>
      {disponibilidadMsg && <p className="text-red-600 mb-2">{disponibilidadMsg}</p>}
      {horarios.length === 0 ? (
        <p className="text-sm text-gray-600">No hay horarios para la fecha seleccionada.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {horarios.map((h, idx) => (
            <button
              key={idx}
              onClick={() => onSelectHora(h)}
              className={`px-3 py-1 border rounded ${hora === h ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-100 text-black'}`}
            >
              {h}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}