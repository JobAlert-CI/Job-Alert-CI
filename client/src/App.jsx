import { useState } from "react";
import { BrowserRouter, Routes, Route, Outlet, useLocation } from "react-router-dom";
import Home from "./Pages/Home";
import { TooltipProvider } from "./components/ui/tooltip";
import Header from "./components/layouts/Header";
import Footer from "./components/layouts/Footer";
import HowItWorks from "./Pages/HowItWorks";
import { useEffect } from "react";
import DetailsFiliere from "./Pages/DetailsFiliere/DetailsFiliere";
import Filieres from "./Pages/Filieres";
import Offres from "./Pages/Offres";
import DetailsOffre from "./Pages/DetailsOffre";
import BootLoader from "./components/BootLoader";
import Conseils from "./Pages/Conseils";
import DetailsConseil from "./Pages/DetailsConseil";
import Sources from "./Pages/Sources";
import Registered from "./Pages/Registered";
import Faq from "./Pages/Support/FAQ";
import MentionsLegales from "./Pages/Support/MentionsLegales";
import Contact from "./Pages/Support/Contact";
import AdminRoot from "./Pages/Admin/index"
import { RequireAdmin } from "./Pages/Admin/routes/guards"
import { AdminLayout } from "./Pages/Admin/layout/AdminLayout"
import { LoginPage } from "./Pages/Admin/pages/LoginPage"
import { DashboardPage } from "./Pages/Admin/pages/DashboardPage"
import { AdministratorsPage } from "./Pages/Admin/pages/AdministratorsPage"
import { AuditLogPage } from "./Pages/Admin/pages/AuditLogPage"
import { FilieresPage } from "./Pages/Admin/pages/FilieresPage"
import { SourcesPage } from "./Pages/Admin/pages/SourcesPage"
import { ReferentialsPage } from "./Pages/Admin/pages/ReferentialsPage"
import { OffersListPage } from "./Pages/Admin/pages/OffersListPage"
import { OfferFormPage } from "./Pages/Admin/pages/OfferFormPage"
import { UsersListPage } from "./Pages/Admin/pages/UsersListPage"
import { UserDetailPage } from "./Pages/Admin/pages/UserDetailPage"
import { ScrapingPage } from "./Pages/Admin/pages/ScrapingPage"
import { RunDetailPage } from "./Pages/Admin/pages/RunDetailPage"
import { SendCustomPage } from "./Pages/Admin/pages/SendCustomPage"
import { ErrorLogsPage } from "./Pages/Admin/pages/ErrorLogsPage"
import { ContentPage } from "./Pages/Admin/pages/ContentPage"
import { SettingsPage } from "./Pages/Admin/pages/SettingsPage"
import { AiPage } from "./Pages/Admin/pages/AiPage"
import { RoleGate } from "./Pages/Admin/routes/guards"
import { prefetchHome } from "./tools/home.tools";
import { prefetchHowItWorks } from "./tools/ccm.tools";
import { OffresFiltersProvider } from "./contexts/Offres.context";

// Matrice rôles → pages (cf. §8 du cahier des charges)
const ALL = ["super_admin", "gestionnaire_offres", "gestionnaire_utilisateurs", "moderateur"]
const SUPER = ["super_admin"]

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
};

const Layout = () => {
  return (
    <>
      <Header />
      <Outlet />
      <Footer />
    </>
  );
};

const App = () => {
  const [ready, setReady] = useState(false);

  return (
    <TooltipProvider>
      {/* {!ready && <BootLoader onFinish={() => setReady(true)} />} */}

      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* ═══ Site public ═══ */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} loader={prefetchHome} />
            <Route path="comment-ca-marche" element={<HowItWorks />} loader={prefetchHowItWorks} />
            <Route path="sources" element={<Sources />} />
            <Route path="inscription" element={<Registered />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/mentions-legales" element={<MentionsLegales />} />

            <Route path="offres" element={<Offres />} />
            <Route path="filieres" element={<Filieres />} />
            <Route path="filieres/:filiere" element={<DetailsFiliere />} />
            <Route path="/offres/:id" element={<DetailsOffre />} />
            <Route path="/conseils" element={<Conseils />} />
            <Route path="/conseils/:slug" element={<DetailsConseil />} />
          </Route>

          {/* ═══ Back-office admin — 18 pages (cf. §1) ═══ */}
          <Route path="/admin" element={<AdminRoot />}>
            {/* 1. Connexion (public) */}
            <Route path="connexion" element={<LoginPage />} />

            {/* Garde de session : doit être authentifié pour tout ce qui suit */}
            <Route element={<RequireAdmin />}>
              {/* Layout sidebar/header, appliqué à toutes les pages protégées */}
              <Route element={<AdminLayout />}>
                {/* 2. Tableau de bord (tous rôles) */}
                <Route index element={<RoleGate roles={ALL}><DashboardPage /></RoleGate>} />

                {/* Phase 2 — CRUD métier */}
                {/* 8-9. Offres (liste + créer/éditer) */}
                <Route path="offres" element={<RoleGate roles={["super_admin", "gestionnaire_offres"]}><OffersListPage /></RoleGate>} />
                <Route path="offres/nouvelle" element={<RoleGate roles={["super_admin", "gestionnaire_offres"]}><OfferFormPage /></RoleGate>} />
                <Route path="offres/:id" element={<RoleGate roles={["super_admin", "gestionnaire_offres"]}><OfferFormPage /></RoleGate>} />

                {/* 10-11. Utilisateurs + détail · 14. Envoi personnalisé */}
                <Route path="utilisateurs" element={<RoleGate roles={["super_admin", "gestionnaire_utilisateurs"]}><UsersListPage /></RoleGate>} />
                <Route path="utilisateurs/:id" element={<RoleGate roles={["super_admin", "gestionnaire_utilisateurs"]}><UserDetailPage /></RoleGate>} />
                <Route path="utilisateurs/:id/envoyer" element={<RoleGate roles={["super_admin", "gestionnaire_utilisateurs"]}><SendCustomPage /></RoleGate>} />

                {/* 16. Contenu (4 onglets) */}
                <Route path="contenu" element={<RoleGate roles={["super_admin", "moderateur"]}><ContentPage /></RoleGate>} />

                {/* Super admin uniquement */}
                <Route path="administrateurs" element={<RoleGate roles={SUPER}><AdministratorsPage /></RoleGate>} />
                <Route path="journal" element={<RoleGate roles={SUPER}><AuditLogPage /></RoleGate>} />
                <Route path="filieres" element={<RoleGate roles={SUPER}><FilieresPage /></RoleGate>} />
                <Route path="sources" element={<RoleGate roles={SUPER}><SourcesPage /></RoleGate>} />
                <Route path="referentiels" element={<RoleGate roles={SUPER}><ReferentialsPage /></RoleGate>} />
                <Route path="scraping" element={<RoleGate roles={SUPER}><ScrapingPage /></RoleGate>} />
                <Route path="scraping/runs/:id" element={<RoleGate roles={SUPER}><RunDetailPage /></RoleGate>} />
                <Route path="logs" element={<RoleGate roles={SUPER}><ErrorLogsPage /></RoleGate>} />
                <Route path="parametres" element={<RoleGate roles={SUPER}><SettingsPage /></RoleGate>} />
                <Route path="ia" element={<RoleGate roles={SUPER}><AiPage /></RoleGate>} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
};

export default App;