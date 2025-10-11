import React, { useEffect, useState, useRef } from "react";

const REVIEWS = [
  {
    name: "Martín R.",
    stars: 5,
    text: "Excelente servicio, ambiente muy copado y el corte perfecto. Volveré seguro."
  },
  {
    name: "Lucía P.",
    stars: 5,
    text: "Profesionales y súper amables. Me encantó el afeitado clásico."
  },
  {
    name: "Santiago M.",
    stars: 5,
    text: "Muy buena atención y puntualidad. Recomendado 100%."
  }
];

export default function Reviews() {
  const [index, setIndex] = useState(0);
  const intervalRef = useRef(null);
  const delay = 4000;

  useEffect(() => {
    startAutoPlay();
    return stopAutoPlay;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startAutoPlay() {
    stopAutoPlay();
    intervalRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % REVIEWS.length);
    }, delay);
  }

  function stopAutoPlay() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function prev() {
    setIndex((i) => (i - 1 + REVIEWS.length) % REVIEWS.length);
    startAutoPlay();
  }

  function next() {
    setIndex((i) => (i + 1) % REVIEWS.length);
    startAutoPlay();
  }

  return (
    <section id="reviews" className="container mx-auto px-6 py-12">
      <div className="max-w-3xl mx-auto text-center">
        <h3 className="text-3xl font-bold mb-4">Reseñas de clientes</h3>

        <div
          onMouseEnter={stopAutoPlay}
          onMouseLeave={startAutoPlay}
          className="relative bg-gray-900/30 p-8 rounded-2xl shadow-inner"
        >
          <div className="min-h-[120px] flex items-center justify-center">
            {REVIEWS.map((r, i) => (
              <article
                key={i}
                className={`transition-all duration-500 ease-in-out transform ${
                  i === index ? "opacity-100 translate-x-0" : "opacity-0 absolute -translate-x-full"
                } max-w-xl`}
              >
                <div className="mb-4">
                  <div className="flex items-center justify-center gap-2">
                    {Array.from({ length: r.stars }).map((_, s) => (
                      <svg key={s} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.173c.969 0 1.371 1.24.588 1.81l-3.377 2.455a1 1 0 00-.364 1.118l1.287 3.967c.3.921-.755 1.688-1.54 1.118l-3.377-2.455a1 1 0 00-1.176 0l-3.377 2.455c-.785.57-1.84-.197-1.54-1.118l1.287-3.967a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.173a1 1 0 00.95-.69L9.049 2.927z" />
                      </svg>
                    ))}
                  </div>
                </div>

                <p className="text-gray-200 italic">"{r.text}"</p>
                <p className="mt-4 font-semibold text-gray-300">— {r.name}</p>
              </article>
            ))}
          </div>

          {/* controles */}
          <button onClick={prev} aria-label="Anterior" className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20">
            ‹
          </button>
          <button onClick={next} aria-label="Siguiente" className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20">
            ›
          </button>

          {/* indicadores */}
          <div className="mt-6 flex items-center justify-center gap-2">
            {REVIEWS.map((_, i) => (
              <button
                key={i}
                onClick={() => { setIndex(i); startAutoPlay(); }}
                className={`w-3 h-3 rounded-full ${i === index ? "bg-white" : "bg-white/30"}`}
                aria-label={`Ir a reseña ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
