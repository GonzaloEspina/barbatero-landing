import React, { useState } from "react";
const API_BASE = "/api/turnos";
const ALIAS = "barbatero.mp";
const WHATSAPP_NUMBER = "54911XXXXXXXX"; // reemplazar por el real
const CLIP_ICON = "https://cdn.iconscout.com/icon/premium/png-256-thumb/copiar-alt-iv-icon-svg-download-png-7284084.png?f=webp&w=128";

function formatValor(v){
  if(!v && v !== 0) return "";
  const s = String(v).trim();
  return s.startsWith("$") ? s : `$${s}`;
}

export default function MembershipCTA({ clientRowId, hasActive, hasPending }) {
  // si ya tiene membresía activa o pendiente no mostramos CTA
  if (hasActive || hasPending) return null;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [memberships, setMemberships] = useState([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function openModal() {
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/memberships`);
      const j = await res.json().catch(() => ({}));
      setMemberships(j.memberships || []);
    } catch (e) {
      setError("Error cargando membresías.");
      setMemberships([]);
    } finally {
      setLoading(false);
    }
  }

  async function reserve(key) {
    if (!clientRowId) return alert("Falta identificar al cliente.");
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/memberships/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientRowId, membershipKey: key }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        setOpen(false);
        window.location.reload();
      } else {
        alert(j.message || "No se pudo reservar la membresía.");
      }
    } catch {
      alert("Error de conexión al reservar.");
    } finally {
      setLoading(false);
    }
  }

  async function copyAlias() {
    try {
      await navigator.clipboard.writeText(ALIAS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("No se pudo copiar el alias.");
    }
  }

  return (
    <>
      <div className="space-y-3">
        <div className="bg-gray-800 text-gray-100 rounded-md p-3">
          <div className="text-sm font-semibold">
            ¡Comprá una membresía y ahorrá en tus próximos cortes!
          </div>
        </div>
        <button
          onClick={openModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold"
        >
          Comprar Membresía
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600">
                  Para activar la membresía, realizá el pago
                  en efectivo en el local o por transferencia al Alias y envianos
                  el comprobante por Whatsapp.
                </p>
              </div>
              <div>
                <button
                  onClick={() => setOpen(false)}
                  className="ml-3 px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-6">Cargando...</div>
            ) : error ? (
              <div className="text-red-600">{error}</div>
            ) : memberships.length === 0 ? (
              <div className="text-sm text-gray-600">No hay membresías disponibles.</div>
            ) : (
              <div className="space-y-3">
                {memberships.map((m) => (
                  <div
                    key={m.key}
                    className="border rounded p-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-gray-800">
                        {m.membresia}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Cantidad de turnos:{" "}
                        <span className="font-medium text-gray-800">
                          {m.cantidadTurnos}
                        </span>
                        {"  -  "}
                        Válido por:{" "}
                        <span className="font-medium text-gray-800">
                          {m.mesesActiva} meses
                        </span>
                        {"  -  "}
                        Valor:{" "}
                        <span className="font-medium text-gray-800">
                          {formatValor(m.valor)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <button
                        onClick={() => reserve(m.key)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                        disabled={loading}
                      >
                        Reservar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Se eliminó la sección de alias / WhatsApp según diseño. */}
          </div>
        </div>
      )}
    </>
  );
}