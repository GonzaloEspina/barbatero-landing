// Script para actualizar reseñas manualmente desde Google Maps
// Este script puedes ejecutarlo periódicamente para mantener las reseñas actualizadas

import fs from 'fs';
import path from 'path';

// Reseñas actualizadas manualmente desde Google Maps
const UPDATED_REVIEWS = [
  {
    author: "Nicolas Andrés",
    rating: 5,
    text: "Excelente atención y muy buen servicio. El lugar está muy bueno, súper recomendable.",
    date: "hace 2 semanas"
  },
  {
    author: "Facundo Ezequiel", 
    rating: 5,
    text: "Muy buena atención, excelente trabajo y ambiente. 100% recomendable.",
    date: "hace 1 mes"
  },
  {
    author: "Franco Luján",
    rating: 5,
    text: "Excelente lugar, súper prolijo el trabajo y muy buena onda. Totalmente recomendable.",
    date: "hace 1 mes"
  },
  {
    author: "Agustín Carballo",
    rating: 5,
    text: "Muy buen servicio, excelente atención y ambiente agradable. Volveré sin dudas.",
    date: "hace 2 meses"
  },
  {
    author: "Matías González",
    rating: 5,
    text: "Profesional y detallista. El corte quedó perfecto, muy recomendable el lugar.",
    date: "hace 3 meses"
  }
];

const PLACE_INFO = {
  rating: 5.0,
  totalReviews: 28
};

function updateReviewsFile() {
  const reviewsPath = path.join(process.cwd(), 'src', 'data', 'reviews.json');
  
  const reviewsData = {
    lastUpdated: new Date().toISOString(),
    place: PLACE_INFO,
    reviews: UPDATED_REVIEWS
  };

  // Crear directorio si no existe
  const dataDir = path.dirname(reviewsPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Escribir archivo
  fs.writeFileSync(reviewsPath, JSON.stringify(reviewsData, null, 2));
  console.log(`✅ Reseñas actualizadas en: ${reviewsPath}`);
  console.log(`📊 ${UPDATED_REVIEWS.length} reseñas, promedio: ${PLACE_INFO.rating} estrellas`);
}

// Ejecutar actualización
updateReviewsFile();