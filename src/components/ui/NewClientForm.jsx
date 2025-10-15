import React from "react";

export default function NewClientForm({ nuevoNombre, setNuevoNombre, nuevoTelefono, setNuevoTelefono, onCreate, onCancel, loading }) {
  return (
    <div className="mb-6 p-6 border-2 border-black rounded-lg bg-white shadow-lg">
      <h3 className="text-lg font-bold text-black mb-4">Crear nuevo cliente</h3>
      <p className="mb-4 text-gray-700">No se encontró cliente con ese correo. Complete los datos para crear uno:</p>
      
      <div className="mb-4">
        <label className="block text-sm font-semibold text-black mb-1">Nombre y Apellido</label>
        <input 
          className="w-full p-3 border-2 border-black rounded focus:border-gray-600 focus:outline-none text-black" 
          placeholder="Nombre y Apellido" 
          value={nuevoNombre} 
          onChange={(e) => setNuevoNombre(e.target.value)} 
        />
      </div>
      
      <div className="mb-6">
        <label className="block text-sm font-semibold text-black mb-1">Teléfono</label>
        <input 
          className="w-full p-3 border-2 border-black rounded focus:border-gray-600 focus:outline-none text-black" 
          placeholder="Teléfono (opcional)" 
          value={nuevoTelefono} 
          onChange={(e) => setNuevoTelefono(e.target.value)} 
        />
      </div>
      
      <div className="flex gap-3">
        <button 
          onClick={onCreate} 
          className="flex-1 px-4 py-3 bg-black hover:bg-gray-800 text-white rounded-md font-semibold transition-colors disabled:opacity-50" 
          disabled={loading}
        >
          {loading ? "Creando cliente..." : "Crear cliente"}
        </button>
        <button 
          onClick={onCancel} 
          className="flex-1 px-4 py-3 border-2 border-black bg-white hover:bg-gray-100 text-black rounded-md font-semibold transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}