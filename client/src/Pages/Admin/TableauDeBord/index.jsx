import { ErrorBoundary } from "react-error-boundary"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import EnTeteCompteurs from "./sections/EnTeteCompteurs"
import RunsRecents from "./sections/RunsRecents"
import QualiteMatching from "./sections/QualiteMatching"
import TopOffres from "./sections/TopOffres"
import TypesMatch from "./sections/TypesMatch"
import VolumeIngestion from "./sections/VolumeIngestion"
import StatistiquesEnvoi from "./sections/StatistiquesEnvoi"

/* ─────────────────────────────────────────────────────────────────────
   Page Tableau de bord — /admin (tous rôles).

   Orchestrateur pur (pattern src/Pages/Offres) : aucun fetch direct,
   chaque section consomme son hook TanStack et porte son
   ErrorBoundary dédié — une section qui plante n'emporte pas la page.

   Sections :
   1. EnTeteCompteurs    — salutation, 6 compteurs cliquables, dernier
                          run, digests en attente (1 appel : overview).
   2. RunsRecents        — mini-historique 5 derniers runs (polling 60 s
                          partagé avec overview).
   3. QualiteMatching   — barres empilées T0-T5 + code couleur alerte.
                          Router sending : gate rôle interne (super_admin
                          + gestionnaire_utilisateurs), les autres rôles
                          voient un message explicite, pas un 403.
   4. VolumeIngestion   — barres groupées par run (même queryKey que
                          RunsRecents : zéro appel réseau en plus).
   5. TypesMatch        — donut match_kind_distribution (même réponse
                          que tier-stats : zéro appel en plus).
   6. StatistiquesEnvoi — envoyés/échoués/sautés + taux de succès 30 j
                          (router sending : gate rôle interne).
   7. TopOffres         — top 10 all-time (days non branché backend).

   La recherche globale vit dans le layout (toutes pages admin).
   ───────────────────────────────────────────────────────────────────── */

const TableauDeBord = () => (
  <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <ErrorBoundary FallbackComponent={AdminSectionFallback}>
        <EnTeteCompteurs />
      </ErrorBoundary>

      <div className="grid gap-6 lg:grid-cols-2">
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <RunsRecents />
        </ErrorBoundary>

        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <VolumeIngestion />
        </ErrorBoundary>
      </div>

      {/* Widgets du router sending : chaque section porte son gate
          interne (message explicite si rôle non autorisé, hook
          enabled: false → aucune requête déclenchée). */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <QualiteMatching />
        </ErrorBoundary>

        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <TypesMatch />
        </ErrorBoundary>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <StatistiquesEnvoi />
        </ErrorBoundary>

        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <TopOffres />
        </ErrorBoundary>
      </div>
    </div>
)

export default TableauDeBord
