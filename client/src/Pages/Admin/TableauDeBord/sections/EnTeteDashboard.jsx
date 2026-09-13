import { Briefcase, BriefcaseBusiness, Users, UserCheck, MessageSquare, Globe, LayoutDashboard } from "lucide-react"
import { useAdminOverviewQuery } from "@/features/admin-dashboard.tools"
import { SectionErreur } from "../components/EtatsSection"
import { Badge } from "@/components/ui/badge"
import StatusChip from "@/components/shared/StatusChip"
import CarteCompteur from "@/components/admin/CarteCompteur"
import HeroAdmin from "@/components/admin/HeroAdmin"


const COMPTEURS = [
  { cle: "offers_total", label: "Offres totales", icone: Briefcase, href: "/admin/offres" },
  { cle: "offers_active", label: "Offres actives", icone: BriefcaseBusiness, href: "/admin/offres", query: "?status=active" },
  { cle: "subscribers_total", label: "Abonnés", icone: Users, href: "/admin/utilisateurs" },
  { cle: "subscribers_active", label: "Abonnés actifs", icone: UserCheck, href: "/admin/utilisateurs", query: "?status=active" },
  { cle: "contact_messages_new", label: "Messages nouveaux", icone: MessageSquare, href: "/admin/logs" },
  { cle: "sources_active", label: "Sources actives", icone: Globe, href: "/admin/sources" },
]

const libelleStatutRun = {
  success: "Réussi",
  running: "En cours",
  pending: "En attente",
  failed: "Échoué",
}

const EnTeteCompteurs = () => {
  const { data, isLoading, isError, refetch } = useAdminOverviewQuery()

  if (isError) {
    return <SectionErreur onRetry={refetch} message="Impossible de charger la vue d'ensemble." />
  }

  const statutRun = data?.last_scrape_status
  const aRun = Boolean(data?.last_scrape_run_at)
  const chipTone =
    statutRun === "success" ? "emerald" : statutRun === "running" || statutRun === "pending" ? "navy" : "orange"
  const digests = data?.pending_digests ?? 0

  return (
    <section aria-label="Vue d'ensemble" className="flex flex-col gap-4">
      <HeroAdmin
        title="Tableau de bord"
        titleBdge="Pilotage"
        icon={LayoutDashboard}
        description="Voici le statut actuel de votre écosystème : flux d'offres de recrutement, automatismes IA et journaux d'activité."
        badges={
          <>
            {!isLoading && digests > 0 && (
              <Badge variant="secondary" className="text-xs">
                {digests} digest{digests > 1 ? "s" : ""} en file
              </Badge>
            )}
            {aRun && (
              <StatusChip
                tone={chipTone}
                ping={statutRun === "running"}
                tooltip={`Dernier scraping : ${libelleStatutRun[statutRun] ?? statutRun}`}
              >
                Dernier scraping : {libelleStatutRun[statutRun] ?? statutRun}
              </StatusChip>
            )}
          </>
        }
      />
      {/* 6 compteurs */}
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
    </section>
  )
}

export default EnTeteCompteurs