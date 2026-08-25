import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Outlet, useLocation } from "react-router-dom";
import { MotionConfig } from "framer-motion";
// Home reste en import statique (chunk d'entrée) pour préserver le LCP.
import Home from "./Pages/Home";
import { TooltipProvider } from "./components/ui/tooltip";
import Header from "./components/layouts/Header";
import Footer from "./components/layouts/Footer";
import FallbackPage from "./components/shared/FallbackPage";

/* ─── Code-Splitting par route (Cf. Audit.md P1-13) ────────────────────
   Chaque page est un chunk séparé, chargé à la navigation. Seule Home
   voyage dans le bundle d'entrée ; le fallback Suspense est un spinner
   léger (pas de skeleton métier, inutile hors pages de liste). */
const HowItWorks = lazy(() => import("./Pages/HowItWorks"));
const DetailsFiliere = lazy(() => import("./Pages/DetailsFiliere"));
const Filieres = lazy(() => import("./Pages/Filieres"));
const Offres = lazy(() => import("./Pages/Offres"));
const DetailsOffre = lazy(() => import("./Pages/DetailsOffre"));
const Conseils = lazy(() => import("./Pages/Conseils"));
const DetailsConseil = lazy(() => import("./Pages/DetailsConseil"));
const Sources = lazy(() => import("./Pages/Sources"));
const Registered = lazy(() => import("./Pages/Registered"));
const ConfirmationInscription = lazy(() => import("./Pages/ConfirmationInscription"));
const GestionPreferences = lazy(() => import("./Pages/GestionPreferences"));
const Desinscription = lazy(() => import("./Pages/Desinscription"));
const PageIntrouvable = lazy(() => import("./Pages/PageIntrouvable"));
const Faq = lazy(() => import("./Pages/Support/FAQ"));
const MentionsLegales = lazy(() => import("./Pages/Support/MentionsLegales"));
const Contact = lazy(() => import("./Pages/Support/Contact"));
import { prefetchHome } from "./features/home.tools";
import { prefetchHowItWorks } from "./features/ccm.tools";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
};

/* ─── Préchargement du cache TanStack avant navigation ────────────────
   Sous <BrowserRouter>, la prop `loader` de react-router est IGNORÉE
   (elle n'existe que sur le Data Router). On précharge donc le cache
   explicitement au montage du layout (home + « comment ça marche »).
   Cf. Audit.md P0-2. */

/** Chauffe le cache au premier rendu — home + « comment ça marche » (requêtes légères). */
const usePrefetchHomeOnMount = () => {
  useEffect(() => {
    prefetchHome();
    prefetchHowItWorks();
  }, []);
};

const Layout = () => {
  usePrefetchHomeOnMount();
  return (
    <>
      <Header />
      <Outlet />
      <Footer />
    </>
  );
};

const App = () => (
  <TooltipProvider>
    {/* Reduced motion global : respecte prefers-reduced-motion de l'OS. Cf. Audit.md P1-8. */}
    <MotionConfig reducedMotion="user">
    <BrowserRouter>
      <ScrollToTop />
        <Suspense fallback={<FallbackPage />}>
        <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="comment-ca-marche" element={<HowItWorks />} />
              <Route path="sources" element={<Sources />} />
              <Route path="inscription" element={<Registered />} />
              <Route path="inscription/confirmation/:token" element={<ConfirmationInscription />} />
              <Route path="/preferences/:token" element={<GestionPreferences />} />
              <Route path="/desinscription/:token" element={<Desinscription />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/faq" element={<Faq />} />
              <Route path="/mentions-legales" element={<MentionsLegales />} />

              <Route path="offres" element={<Offres />} />
              <Route path="filieres" element={<Filieres />} />
              <Route path="filieres/:filiere" element={<DetailsFiliere />} />
              <Route path="/offres/:id" element={<DetailsOffre />} />
              <Route path="/conseils" element={<Conseils />} />
              <Route path="/conseils/:slug" element={<DetailsConseil />} />

              {/* Toute URL inconnue → page 404 explicite (noindex). */}
              <Route path="*" element={<PageIntrouvable />} />
            </Route>
        </Routes>
        </Suspense>
    </BrowserRouter>
    </MotionConfig>
  </TooltipProvider>
);

export default App;
