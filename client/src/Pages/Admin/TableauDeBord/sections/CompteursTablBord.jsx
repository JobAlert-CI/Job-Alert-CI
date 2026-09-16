
import { Briefcase, BriefcaseBusiness, Globe, MessageSquare, UserCheck, Users } from "lucide-react"
import { useAdminOverviewQuery } from "@/features/admin-dashboard.tools"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import CarteCompteur from "@/components/admin/CarteCompteur"


const COMPTEURS = [
  { cle: "offers_total", label: "Offres totales", icone: Briefcase, href: "/admin/offres" },
  { cle: "offers_active", label: "Offres actives", icone: BriefcaseBusiness, href: "/admin/offres", query: "?status=active" },
  { cle: "subscribers_total", label: "Abonnés", icone: Users, href: "/admin/utilisateurs" },
  { cle: "subscribers_active", label: "Abonnés actifs", icone: UserCheck, href: "/admin/utilisateurs", query: "?status=active" },
  { cle: "contact_messages_new", label: "Messages nouveaux", icone: MessageSquare, href: "/admin/logs" },
  { cle: "sources_active", label: "Sources actives", icone: Globe, href: "/admin/sources" },
]

const CompteursTblBord = () => {
  const { data, isError, refetch } = useAdminOverviewQuery()

  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"} >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger la vue d'ensemble." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COMPTEURS.map(({ cle, label, icone, href, query }) => (
            <CarteCompteur
              key={cle}
              label={label}
              valeur={data?.[cle]}
              icone={icone}
              href={href}
              query={query}
            />
          ))}
        </div>
      )}
    </TransitionEtat >
  )
}

export default CompteursTblBord