import { Briefcase, CircleCheckBig, Copy, FileText } from "lucide-react"
import {
  useAdminDoublonsQuery, useCompteOffresBrutes
} from "@/features/admin-offres.tools"
import { useAdminOverviewQuery } from "@/features/admin-dashboard.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"


const CompteursOffres = () => {

  const { data: overview, isError: isErrorOverview, refetch: refetchOverview } = useAdminOverviewQuery()
  const { data: brutes, isError: isErrorBrutes, refetch: refetchBrutes } = useCompteOffresBrutes()
  const { data: doublons, isError: isErrorDoublons, refetch: refetchDoublons } = useAdminDoublonsQuery({ min_similarity: 80 })

  const COMPTEURS = [
    { cle: "total", label: "Offres totales", valeur: overview?.offers_total ?? 0, icone: Briefcase },
    { cle: "actives", label: "Actives", valeur: overview?.offers_active ?? 0, icone: CircleCheckBig, href: "/admin/offres", query: "?status=active" },
    { cle: "brutes", label: "Brutes (à traiter)", icone: FileText, valeur: brutes?.total ?? 0, prefixe: brutes?.plafonne ? "+" : "", href: "/admin/offres", query: "?status=brut" },
    { cle: "doublons", label: "Doublons potentiels", icone: Copy, valeur: doublons?.length ?? 0, href: "/admin/offres/doublons" },
  ]

  const isError = isErrorOverview || isErrorBrutes || isErrorDoublons

  const refetch = () => {
    refetchOverview()
    refetchBrutes()
    refetchDoublons()
  }

  const etat = isError ? "erreur" : "donnees"

  return (
    <TransitionEtat etat={etat}>
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger ces données." />
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {COMPTEURS.map(({ cle, label, valeur, icone, prefixe, href, query }) => (
            <CarteCompteur
              key={cle}
              label={label}
              valeur={valeur}
              prefixe={prefixe}
              icone={icone}
              href={href}
              query={query}
            />
          ))}
        </div>
      )}
    </TransitionEtat>
  )
}


export default CompteursOffres