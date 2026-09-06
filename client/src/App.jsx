import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Outlet, useLocation } from "react-router-dom";
import { MotionConfig } from "framer-motion";
// Home reste en import statique (chunk d'entrée) pour préserver le LCP.
import Home from "./Pages/Home";
import { TooltipProvider } from "./components/ui/tooltip";
import { NotifyProvider } from "@/contexts/Notify.context";
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

/* ─── Back-office admin (lazy, layout + guard dédiés) ─────────────────
   Le layout admin vit hors du layout public : pas de Header/Footer.
   RequireAdmin protège TOUTES les pages sous /admin sauf /admin/connexion
   (publique). L'ordre des routes importe : /admin/connexion AVANT la
   route layout pour ne pas être captée par le guard. */
const AdminConnexion = lazy(() => import("./Pages/Admin/ConnexionAdmin"));
const AdminTableauDeBord = lazy(() => import("./Pages/Admin/TableauDeBord"));
const AdminOffres = lazy(() => import("./Pages/Admin/Offres"));
const AdminFormulaireOffre = lazy(() => import("./Pages/Admin/FormulaireOffre"));
const AdminDoublons = lazy(() => import("./Pages/Admin/Offres/sections/DoublonsPage"));
const AdminEntreprises = lazy(() => import("./Pages/Admin/Entreprises"));
const AdminAbonnes = lazy(() => import("./Pages/Admin/Abonnes"));
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const RequireAdmin = lazy(() => import("./components/admin/AdminGuard"));
import { AdminAuthProvider } from "@/contexts/AdminAuth.context";
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

/* Layout admin : provider d'auth + guard + layout. Monté en dehors du
   layout public. Le provider vit au-dessus du guard pour que le guard
   (et toutes les pages) puissent consommer useAdminAuth. */
/* Layout admin : guard + layout. Le provider AdminAuthProvider est
   monté UNE seule fois au niveau de la route /admin (voir Routes) —
   il enveloppe déjà la connexion ET les pages protégées. */
const AdminLayoutRoute = () => (
  <RequireAdmin>
    <AdminLayout />
  </RequireAdmin>
);

const App = () => (
  <TooltipProvider>
    {/* Reduced motion global : respecte prefers-reduced-motion de l'OS. Cf. Audit.md P1-8. */}
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ScrollToTop />
        <NotifyProvider>
          <Suspense fallback={<FallbackPage />}>
            <Routes>
              {/* ═══════════════════════════════════════════════════════════════
                  ROUTES PUBLIQUES (site public, navigation libre)
                  ═══════════════════════════════════════════════════════════════ */}
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="comment-ca-marche" element={<HowItWorks />} />
                <Route path="sources" element={<Sources />} />
                <Route path="inscription" element={<Registered />} />
                <Route path="inscription/confirmation/:token" element={<ConfirmationInscription />} />
                <Route path="preferences/:token" element={<GestionPreferences />} />
                <Route path="desinscription/:token" element={<Desinscription />} />
                <Route path="contact" element={<Contact />} />
                <Route path="faq" element={<Faq />} />
                <Route path="mentions-legales" element={<MentionsLegales />} />
                <Route path="offres" element={<Offres />} />
                <Route path="filieres" element={<Filieres />} />
                <Route path="filieres/:filiere" element={<DetailsFiliere />} />
                <Route path="offres/:id" element={<DetailsOffre />} />
                <Route path="conseils" element={<Conseils />} />
                <Route path="conseils/:slug" element={<DetailsConseil />} />
                <Route path="test" element={<FallbackPage />} />
                {/* Toute URL inconnue → page 404 explicite (noindex). */}
                <Route path="*" element={<PageIntrouvable />} />
              </Route>

              {/* ═══════════════════════════════════════════════════════════════
                  ROUTES ADMIN (espace d'administration, authentification requise)
                  ═══════════════════════════════════════════════════════════════ */}
              <Route
                path="/admin"
                element={
                  <AdminAuthProvider>
                    <Outlet />
                  </AdminAuthProvider>
                }
              >
                {/* Page de connexion (hors AdminLayout, pas de sidebar) */}
                <Route path="connexion" element={<AdminConnexion />} />

                {/* Toutes les autres routes admin sont sous AdminLayout (avec sidebar) */}
                <Route element={<AdminLayoutRoute />}>
                  <Route index element={<AdminTableauDeBord />} />
                  <Route
                    path="offres"
                    element={
                      <RequireAdmin roles={["super_admin", "gestionnaire_offres"]}>
                        <Outlet />
                      </RequireAdmin>
                    }
                  >
                    <Route index element={<AdminOffres />} />
                    <Route path="nouvelle" element={<AdminFormulaireOffre />} />
                    <Route path="doublons" element={<AdminDoublons />} />
                    <Route path=":id" element={<AdminFormulaireOffre />} />
                  </Route>
                  <Route
                    path="entreprises"
                    element={
                      <RequireAdmin roles={["super_admin"]}>
                        <AdminEntreprises />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="utilisateurs"
                    element={
                      <RequireAdmin roles={["super_admin", "gestionnaire_utilisateurs"]}>
                        <AdminAbonnes />
                      </RequireAdmin>
                    }
                  />
                  {/* Autres routes admin à ajouter ici */}
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </NotifyProvider>
      </BrowserRouter>
    </MotionConfig>
  </TooltipProvider>
);

export default App;
