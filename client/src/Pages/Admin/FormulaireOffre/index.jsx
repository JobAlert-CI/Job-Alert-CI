import { useLocation, useNavigate, useParams } from "react-router-dom"
import { ErrorBoundary } from "react-error-boundary"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import { useAdminOfferDetailQuery } from "@/features/admin-offres.tools"
import { useReferentialsQuery } from "@/lib/referentiels-query"
import { SectionErreur } from "./components/EtatsPage"
import FormulaireOffre from "./components/FormulaireOffre"

/* ─────────────────────────────────────────────────────────────────────
   Page Créer / modifier une offre — /admin/offres/nouvelle et
   /admin/offres/:id (édition).

   Objectif (doc v3 §4) : ajouter une offre non captée par le scraping
   ou corriger une offre mal extraite. super_admin + gestionnaire_offres
   (guard par route dans App.jsx).

   Points critiques (vérifiés schemas/offers.py + services/offers.py) :
   1. Champs de référence par CODE (pas UUID) — sélecteurs alimentés
      par le référentiel PUBLIC (route /api/referentials ouverte à
      tous les rôles ; le router admin referentials est super_admin
      seul alors que cette page sert aussi gestionnaire_offres).
   2. company_name / location_label : texte libre (get-or-create).
   3. Dédoublonnage silencieux à la création : create_offer renvoie
      l'offre EXISTANTE sans erreur → détection par origin ≠ manuel,
      bandeau + redirection (géré dans FormulaireOffre).
   4. Édition : OfferUpdate est partiel — payload des champs soumis.

   La key={offre?.id ?? "nouvelle"} remonte le formulaire à chaque
   changement d'offre : initialisation une seule fois, zéro setState
   dans un effect.
   ───────────────────────────────────────────────────────────────────── */

const CreerModifierOffre = () => {
  const { id: offerId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const edition = !!offerId

  const { data: offre, isLoading, isError, refetch } = useAdminOfferDetailQuery(offerId, {
    enabled: edition,
  })
  const { data: referentiels } = useReferentialsQuery()

  const onRetour = () => navigate(location.state?.from || "/admin/offres")

  if (edition && isError) {
    return <SectionErreur onRetry={refetch} message="Impossible de charger cette offre." />
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ErrorBoundary FallbackComponent={AdminSectionFallback}>
        <FormulaireOffre
          key={offre?.id ?? "nouvelle"}
          edition={edition}
          offre={offre}
          chargementOffre={isLoading || (edition && !offre)}
          referentiels={referentiels}
          onRetour={onRetour}
        />
      </ErrorBoundary>
    </div>
  )
}

export default CreerModifierOffre
