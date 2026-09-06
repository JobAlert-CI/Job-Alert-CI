import { ErrorBoundary } from "react-error-boundary"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import { FiltresOffresAdminProvider } from "@/contexts/FiltresOffresAdmin.context"
import ListeOffres from "./sections/ListeOffres"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion des offres — /admin/offres (super_admin +
   gestionnaire_offres ; guard par route dans App.jsx).

   Orchestrateur pur : le contexte de filtres (URL) enveloppe la
   section unique ; les mutations invalident le cache via les hooks
   de features/admin-offres.tools.js.

   Fonctionnalités (doc v3 §3) :
   - liste paginée (filtres serveur q/status/origin/visible_site/
     filiere_id/source_id), toutes offres y compris masquées/archivées ;
   - toggle visibilité + statut à la volée par ligne ;
   - sélection multiple + action groupée POST /bulk-status ;
   - archivage (soft delete, libellé honnête) ;
   - import CSV/JSON (dialog dédié, rapport ligne par ligne) ;
   - export CSV/JSON respectant les filtres actifs (streaming → blob) ;
   - badge « X doublons potentiels » → /admin/offres/doublons (cycle 5).
   ───────────────────────────────────────────────────────────────────── */

const Offres = () => (
  <FiltresOffresAdminProvider>
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <ErrorBoundary FallbackComponent={AdminSectionFallback}>
        <ListeOffres />
      </ErrorBoundary>
    </div>
  </FiltresOffresAdminProvider>
)

export default Offres
