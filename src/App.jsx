import React from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import About from "./components/About";
import Reviews from "./components/Reviews";
import Footer from "./components/Footer";
import TurnoFinder from "./components/ui/TurnoFinder";
import FloatingButtons from "./components/FloatingButtons";
import MapSection from "./components/MapSection";
import OneSignal from 'react-onesignal';


export default function App() {

   useEffect(() => {
    OneSignal.init({
      appId: "673c275c-b1a1-4b14-9c9f-23af9fa6cc07",
      allowLocalhostAsSecureOrigin: true,
    });

    // Opcional: mostrar prompt después de unos segundos
    setTimeout(() => {
      OneSignal.showSlidedownPrompt();
    }, 5000);

  }, []);

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
