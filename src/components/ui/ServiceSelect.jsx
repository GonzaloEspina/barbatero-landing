import React from "react";

export default function ServiceSelect({ servicios = [], servicio, setServicio }) {
  return (
    <select value={servicio} onChange={(e) => setServicio(e.target.value)} className="mt-1 w-full p-2 border rounded text-black">
      <option value="">Seleccionar servicio</option>
      {servicios.map((s, idx) => {
        const id = s["Row ID"] || s["RowID"] || s.RowID || s.id || s["RowId"] || s["Row Id"];
        const label = s.Servicio || s.servicio || s.name || JSON.stringify(s);
        const value = (s.Servicio) ? s.Servicio : (id || label);
        return <option key={idx} value={value}>{label}</option>;
      })}
    </select>
  );
}