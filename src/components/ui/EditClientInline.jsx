import React, { useState } from "react";

// Componente simple para editar un cliente y guardar cambios
export default function EditClientInline({ client, onSaved, onCancel }) {
  const initial = {
    rowId: client["Row ID"] ?? client.rowId ?? client["Row ID"] ?? "",
    Nombre: client["Nombre y Apellido"] ?? client.Nombre ?? "",
    Telefono: client["Teléfono"] ?? client.Telefono ?? "",
    Correo: client["Correo"] ?? client.Correo ?? ""
  };
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError(""); setLoading(true);
    // enviar payload con Row ID y sólo las columnas editables
    const payload = {
      "Row ID": form.rowId,
      "Teléfono": form.Telefono,
      "Correo": form.Correo
    };
    try {
      const res = await fetch("/api/clients/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        if (onSaved) onSaved(data.client || { ...client, ...payload });
      } else {
        setError(data.message || "No se pudo actualizar cliente.");
      }
    } catch (e) {
      setError("Error de conexión al actualizar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 rounded-lg bg-white border-2 border-black shadow-lg max-w-2xl w-full mx-auto">
      <h4 className="text-lg font-bold text-black mb-6">Editar datos</h4>
      
      <div className="mb-6">
        <div className="text-sm font-semibold text-black mb-2">Nombre y Apellido</div>
        <div className="text-gray-700 bg-gray-50 p-3 rounded border border-gray-200">{form.Nombre}</div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-semibold text-black mb-2">Teléfono</label>
        <input
          className="w-full p-3 rounded border-2 border-black focus:border-gray-600 focus:outline-none text-black bg-white"
          value={form.Telefono}
          onChange={e => setForm(f => ({ ...f, Telefono: e.target.value }))}
          placeholder="Teléfono"
        />
      </div>
      
      <div className="mb-8">
        <label className="block text-sm font-semibold text-black mb-2">Correo</label>
        <input
          className="w-full p-3 rounded border-2 border-black focus:border-gray-600 focus:outline-none text-black bg-white"
          value={form.Correo}
          onChange={e => setForm(f => ({ ...f, Correo: e.target.value }))}
          placeholder="Correo"
        />
      </div>
      
      <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
        <button 
          className="px-6 py-3 border-2 border-black bg-white hover:bg-gray-100 text-black rounded-md font-semibold transition-colors order-2 sm:order-1" 
          onClick={() => onCancel && onCancel()}
        >
          Cancelar
        </button>
        <button
          className="px-6 py-3 bg-black hover:bg-gray-800 text-white rounded-md font-semibold transition-colors disabled:opacity-50 order-1 sm:order-2 whitespace-nowrap"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
      {error && <div className="text-red-600 mt-4 font-medium">{error}</div>}
    </div>
  );
}