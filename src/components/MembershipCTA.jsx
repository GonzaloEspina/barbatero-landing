import React, { useState } from "react";
const API_BASE = "/api/turnos";
const ALIAS = "barbatero.mp";
const WHATSAPP_NUMBER = "5491160220978"; // número correcto con código de país
const CLIP_ICON = "https://cdn.iconscout.com/icon/premium/png-256-thumb/copiar-alt-iv-icon-svg-download-png-7284084.png?f=webp&w=128";

function formatValor(v){
  if(!v && v !== 0) return "";
  const s = String(v).trim();
  return s.startsWith("$") ? s : `$${s}`;
}

export default function MembershipCTA({ clientRowId, hasActive, hasPending, onReloadClient }) {
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
        // Recargar los datos del cliente en lugar de recargar toda la página
        if (onReloadClient) {
          await onReloadClient();
        }
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
      <div className="space-y-4">
        <div className="bg-white border-2 border-black rounded-lg p-4 shadow-lg">
          <div className="text-lg font-bold text-black">
            ¡Comprá una membresía y ahorrá en tus próximos cortes!
          </div>
          <p className="text-gray-700 mt-2">Accedé a precios especiales y beneficios exclusivos</p>
        </div>
        <button
          onClick={openModal}
          className="w-full px-6 py-3 bg-black hover:bg-gray-800 text-white rounded-md font-bold text-lg transition-colors"
        >
          Comprar Membresía
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border-2 border-black rounded-lg shadow-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-black mb-3">Comprar Membresía</h3>
                <p className="text-sm text-gray-700 font-medium">
                  Para activar la membresía, realizá el pago
                  en efectivo en el local o por transferencia al Alias y envianos
                  el comprobante por Whatsapp.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="ml-4 px-3 py-1.5 border-2 border-gray-300 bg-white hover:bg-gray-100 text-black rounded-md text-sm font-semibold transition-colors flex-shrink-0"
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="text-lg font-medium text-black">Cargando membresías...</div>
              </div>
            ) : error ? (
              <div className="text-red-600 font-medium bg-red-50 p-4 rounded-md border border-red-200">{error}</div>
            ) : memberships.length === 0 ? (
              <div className="text-sm text-gray-600 text-center py-6">No hay membresías disponibles.</div>
            ) : (
              <div className="space-y-4">
                {memberships.map((m) => (
                  <div
                    key={m.key}
                    className="border-2 border-black rounded-lg p-4 bg-white shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-bold text-lg text-black mb-2">
                          {m.membresia}
                        </div>
                        <div className="text-sm text-gray-700 space-y-1">
                          <div>
                            <span className="font-semibold text-black">Cantidad de turnos:</span>{" "}
                            <span className="font-bold text-black">{m.cantidadTurnos}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-black">Válido por:</span>{" "}
                            <span className="font-bold text-black">{m.mesesActiva} meses</span>
                          </div>
                          <div>
                            <span className="font-semibold text-black">Valor:</span>{" "}
                            <span className="font-bold text-lg text-black">{formatValor(m.valor)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4">
                        <button
                          onClick={() => reserve(m.key)}
                          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-md font-bold transition-colors disabled:opacity-50"
                          disabled={loading}
                        >
                          Reservar
                        </button>
                      </div>
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