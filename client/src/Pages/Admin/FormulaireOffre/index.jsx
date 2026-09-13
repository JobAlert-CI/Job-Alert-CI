import { useLocation, useNavigate, useParams } from "react-router-dom"
import { ErrorBoundary } from "react-error-boundary"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import { useAdminOfferDetailQuery } from "@/features/admin-offres.tools"
import { useReferentialsQuery } from "@/lib/referentiels-query"
import { SectionErreur } from "./components/EtatsPage"
import FormulaireOffre from "./components/FormulaireOffre"
import FormulaireSkeleton from "./components/FormulaireSkeleton"

/* ─────────────────────────────────────────────────────────────────────
   Page Créer / modifier une offre — /admin/offres/nouvelle et
   /admin/offres/:id (édition). Orchestre le chargement de l'offre et
   du référentiel public, puis délègue au FormulaireOffre.
   Le chargement affiche désormais un Skeleton fidèle (plus de Spinner).
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

  const chargement = isLoading || (edition && !offre)
  const onRetour = () => navigate(location.state?.from || "/admin/offres")

  if (edition && isError) {
    return <SectionErreur onRetry={refetch} message="Impossible de charger cette offre." />
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-8">
      <ErrorBoundary FallbackComponent={AdminSectionFallback}>
        {chargement ? (
          <FormulaireSkeleton />
        ) : (
          <FormulaireOffre
            key={offre?.id ?? "nouvelle"}
            edition={edition}
            offre={offre}
            referentiels={referentiels}
            onRetour={onRetour}
          />
        )}
      </ErrorBoundary>
    </div>
  )
}

export default CreerModifierOffre