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
    <div className="p-3 rounded bg-gray-800 text-white max-w-sm">
      <div className="mb-2 text-sm text-gray-300">
        <div className="font-semibold text-gray-100">Nombre y Apellido</div>
        <div>{form.Nombre}</div>
      </div>

      <input
        className="w-full mb-2 p-2 rounded bg-gray-700 text-white border border-gray-600"
        value={form.Telefono}
        onChange={e => setForm(f => ({ ...f, Telefono: e.target.value }))}
        placeholder="Teléfono"
      />
      <input
        className="w-full mb-2 p-2 rounded bg-gray-700 text-white border border-gray-600"
        value={form.Correo}
        onChange={e => setForm(f => ({ ...f, Correo: e.target.value }))}
        placeholder="Correo"
      />
      <div className="flex gap-2">
        <button
          className="px-3 py-1 bg-blue-600 text-white rounded"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Guardando..." : "Guardar"}
        </button>
        <button className="px-3 py-1 border rounded bg-gray-700 text-white" onClick={() => onCancel && onCancel()}>
          Cancelar
        </button>
      </div>
      {error && <div className="text-red-400 mt-2">{error}</div>}
    </div>
  );
}