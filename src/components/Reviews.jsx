import React, { useEffect, useState, useRef } from "react";

// Reseñas de respaldo en caso de que falle la API de Google
const FALLBACK_REVIEWS = [
  {
    author: "Nicolas Andrés",
    rating: 5,
    text: "Excelente atención y muy buen servicio. El lugar está muy bueno, súper recomendable."
  },
  {
    author: "Facundo Ezequiel",
    rating: 5,
    text: "Muy buena atención, excelente trabajo y ambiente. 100% recomendable."
  },
  {
    author: "Franco Luján",
    rating: 5,
    text: "Excelente lugar, súper prolijo el trabajo y muy buena onda. Totalmente recomendable."
  },
  {
    author: "Agustín Carballo",
    rating: 5,
    text: "Muy buen servicio, excelente atención y ambiente agradable. Volveré sin dudas."
  },
  {
    author: "Matías González",
    rating: 5,
    text: "Profesional y detallista. El corte quedó perfecto, muy recomendable el lugar."
  }
];

export default function Reviews() {
  const [reviews, setReviews] = useState(FALLBACK_REVIEWS);
  const [placeInfo, setPlaceInfo] = useState({ rating: 5.0, totalReviews: 0 });
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const intervalRef = useRef(null);
  const delay = 4000;

  // Cargar reseñas de Google Places API
  useEffect(() => {
    const fetchGoogleReviews = async () => {
      try {
        const response = await fetch('/api/reviews/google-places');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.reviews.length > 0) {
            setReviews(data.reviews);
            setPlaceInfo({
              rating: data.place.rating,
              totalReviews: data.place.totalReviews
            });
          }
        }
      } catch (error) {
        console.warn('Error cargando reseñas de Google, usando reseñas de respaldo:', error);
        // Mantiene las reseñas de respaldo si falla la API
      } finally {
        setLoading(false);
      }
    };

    fetchGoogleReviews();
  }, []);

  useEffect(() => {
    if (!loading) {
      startAutoPlay();
    }
    return stopAutoPlay;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  function startAutoPlay() {
    stopAutoPlay();
    intervalRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % reviews.length);
    }, delay);
  }

  function stopAutoPlay() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function prev() {
    setIndex((i) => (i - 1 + reviews.length) % reviews.length);
    startAutoPlay();
  }

  function next() {
    setIndex((i) => (i + 1) % reviews.length);
    startAutoPlay();
  }

  if (loading) {
    return (
      <section id="reviews" className="reviews-section">
        <div className="container-narrow">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-4xl font-bold mb-12 text-white">Reseñas de clientes</h3>
            <div className="bg-gradient-to-br from-gray-900 to-black p-12 rounded-3xl shadow-2xl border border-gray-700">
              <div className="min-h-[180px] flex items-center justify-center">
                <div className="text-gray-400">Cargando reseñas...</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="reviews" className="reviews-section">
      <div className="container-narrow">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-4 mb-8">
            <h3 className="text-4xl font-bold text-white">Reseñas de clientes</h3>
            <div className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-full">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${i < Math.floor(placeInfo.rating) ? 'text-yellow-400' : 'text-gray-400'}`} viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-white font-semibold">{placeInfo.rating}</span>
              <span className="text-gray-400 text-sm">({placeInfo.totalReviews} reseñas)</span>
            </div>
          </div>

          <div
            onMouseEnter={stopAutoPlay}
            onMouseLeave={startAutoPlay}
            className="relative bg-gradient-to-br from-gray-900 to-black p-12 rounded-3xl shadow-2xl border border-gray-700"
          >
            <div className="min-h-[180px] flex items-center justify-center">
              {reviews.map((r, i) => (
                <article
                  key={i}
                  className={`transition-all duration-700 ease-in-out transform ${
                    i === index ? "opacity-100 translate-x-0 scale-100" : "opacity-0 absolute -translate-x-full scale-95"
                  } max-w-2xl`}
                >
                  <div className="mb-6">
                    <div className="flex items-center justify-center gap-2">
                      {Array.from({ length: r.rating }).map((_, s) => (
                        <svg key={s} xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.173c.969 0 1.371 1.24.588 1.81l-3.377 2.455a1 1 0 00-.364 1.118l1.287 3.967c.3.921-.755 1.688-1.54 1.118l-3.377-2.455a1 1 0 00-1.176 0l-3.377 2.455c-.785.57-1.84-.197-1.54-1.118l1.287-3.967a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.173a1 1 0 00.95-.69L9.049 2.927z" />
                        </svg>
                      ))}
                    </div>
                  </div>

                  <p className="text-2xl text-white italic font-light leading-relaxed">"{r.text}"</p>
                  <p className="mt-6 text-xl font-semibold text-accent">— {r.author}</p>
                </article>
              ))}
            </div>

            {/* controles */}
            <button 
              onClick={prev} 
              aria-label="Anterior" 
              className="absolute left-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/10 hover:bg-accent/20 transition-all duration-300 text-white text-2xl font-bold"
            >
              ‹
            </button>
            <button 
              onClick={next} 
              aria-label="Siguiente" 
              className="absolute right-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/10 hover:bg-accent/20 transition-all duration-300 text-white text-2xl font-bold"
            >
              ›
            </button>

            {/* indicadores */}
            <div className="mt-8 flex items-center justify-center gap-3">
              {reviews.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setIndex(i); startAutoPlay(); }}
                  className={`w-4 h-4 rounded-full transition-all duration-300 border-2 ${
                    i === index 
                      ? "bg-yellow-400 border-yellow-400 scale-125 shadow-lg shadow-yellow-400/50" 
                      : "bg-gray-600 border-gray-400 hover:bg-gray-500 hover:border-gray-300 hover:scale-110"
                  }`}
                  aria-label={`Ir a reseña ${i + 1}`}
                />
              ))}
            </div>
            
            {/* Enlace a Google Reviews */}
            <div className="mt-6 text-center">
              <a
                href="https://www.google.com/maps/place/Barbatero+Barber+Studio/@-34.6465102,-58.5923958,17z/data=!4m15!1m8!3m7!1s0x95bcc7962ed2c59f:0x492da6898c998e63!2sBarbatero+Barber+Studio!8m2!3d-34.646329!4d-58.592641!10e1!16s%2Fg%2F11y0pf6nf5!3m5!1s0x95bcc7962ed2c59f:0x492da6898c998e63!8m2!3d-34.646329!4d-58.592641!16s%2Fg%2F11y0pf6nf5?entry=ttu&g_ep=EgoyMDI1MTAxMi4wIKXMDSoASAFQAw%3D%3D"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-300 border border-white/20 hover:border-white/40"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Ver todas las reseñas en Google
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
