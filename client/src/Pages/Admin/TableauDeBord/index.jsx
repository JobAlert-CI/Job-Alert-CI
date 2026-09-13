import { motion } from "framer-motion"
import EnTeteCompteurs from "./sections/EnTeteDashboard"
import RunsRecents from "./sections/RunsRecents"
import QualiteMatching from "./sections/QualiteMatching"
import TopOffres from "./sections/TopOffres"
import TypesMatch from "./sections/TypesMatch"
import VolumeIngestion from "./sections/VolumeIngestion"
import StatistiquesEnvoi from "./sections/StatistiquesEnvoi"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"

/* ─────────────────────────────────────────────────────────────────────
  Page Tableau de bord — /admin (tous rôles).
  Orchestrateur pur : aucun fetch direct, chaque section consomme son
  hook TanStack derrière son propre ErrorBoundary.
───────────────────────────────────────────────────────────────────── */


const TableauDeBord = () => (
  <motion.div
    variants={VARIANTS_PAGE}
    initial="cache"
    animate="visible"
    className="mx-auto flex w-full max-w-6xl flex-col gap-6"
  >
    <Bloc>
      <EnTeteCompteurs />
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
  </motion.div>
)

export default TableauDeBord