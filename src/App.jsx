import React from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import About from "./components/About";
import Reviews from "./components/Reviews";
import Footer from "./components/Footer";
import TurnoFinder from "./components/ui/TurnoFinder";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      <Header />
      <main className="flex-1">
        <Hero />
        <About />
        <Reviews />
        <TurnoFinder />
      </main>
      <Footer />
    </div>
  );
}
