import React from "react";

export default function NewClientForm({ nuevoNombre, setNuevoNombre, nuevoTelefono, setNuevoTelefono, onCreate, onCancel, loading }) {
  return (
    <div className="mb-4 p-4 border rounded bg-white text-black">
      <p className="mb-2">No se encontró cliente. Complete los datos para crear uno:</p>
      <input className="w-full mb-2 p-2 border" placeholder="Nombre y Apellido" value={nuevoNombre} onChange={(e)=>setNuevoNombre(e.target.value)} />
      <input className="w-full mb-2 p-2 border" placeholder="Teléfono (opcional)" value={nuevoTelefono} onChange={(e)=>setNuevoTelefono(e.target.value)} />
      <div className="flex gap-2">
        <button onClick={onCreate} className="px-3 py-1 bg-green-600 text-white rounded" disabled={loading}>{loading ? "..." : "Crear cliente"}</button>
        <button onClick={onCancel} className="px-3 py-1 border rounded">Cancelar</button>
      </div>
    </div>
  );
}