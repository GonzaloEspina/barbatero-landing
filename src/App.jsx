import React from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import About from "./components/About";
import Reviews from "./components/Reviews";
import Footer from "./components/Footer";
import TurnoFinder from "./components/ui/TurnoFinder";
import FloatingButtons from "./components/FloatingButtons";
import MapSection from "./components/MapSection";

export default function App() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main>
        <Hero />
        <About />
        <MapSection />
        <Reviews />
      </main>
      <Footer />
      <FloatingButtons />
    </div>
  );
}
