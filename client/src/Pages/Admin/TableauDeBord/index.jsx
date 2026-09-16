import { motion } from "framer-motion"
import { LayoutDashboard } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import RunsRecents from "./sections/RunsRecents"
import QualiteMatching from "./sections/QualiteMatching"
import TopOffres from "./sections/TopOffres"
import TypesMatch from "./sections/TypesMatch"
import VolumeIngestion from "./sections/VolumeIngestion"
import StatistiquesEnvoi from "./sections/StatistiquesEnvoi"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"
import StatusChip from "@/components/shared/StatusChip"
import HeroAdmin from "@/components/admin/HeroAdmin"
import { useAdminOverviewQuery } from "@/features/admin-dashboard.tools"
import CompteursTblBord from "./sections/CompteursTablBord"

const libelleStatutRun = {
  success: "Réussi",
  running: "En cours",
  pending: "En attente",
  failed: "Échoué",
}

/* ─────────────────────────────────────────────────────────────────────
  Page Tableau de bord — /admin (tous rôles).
  Orchestrateur pur : aucun fetch direct, chaque section consomme son
  hook TanStack derrière son propre ErrorBoundary.
───────────────────────────────────────────────────────────────────── */


const TableauDeBord = () => {
  const { data, isLoading } = useAdminOverviewQuery()

  const statutRun = data?.last_scrape_status
  const aRun = Boolean(data?.last_scrape_run_at)
  const chipTone =
    statutRun === "success" ? "emerald" : statutRun === "running" || statutRun === "pending" ? "navy" : "orange"
  const digests = data?.pending_digests ?? 0

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
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

      <Bloc>
        <CompteursTblBord />
      </Bloc>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Bloc className="lg:col-span-2">
          <QualiteMatching />
        </Bloc>
        <Bloc>
          <TypesMatch />
        </Bloc>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Bloc className="lg:col-span-2">
          <VolumeIngestion />
        </Bloc>
        <Bloc>
          <StatistiquesEnvoi />
        </Bloc>
      </div>

      <Bloc>
        <TopOffres />
      </Bloc>

      <Bloc>
        <RunsRecents />
      </Bloc>
    </motion.div >
  )
}

export default TableauDeBord