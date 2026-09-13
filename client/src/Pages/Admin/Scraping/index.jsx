import { motion } from "framer-motion"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import EnTeteScraping from "./sections/EnTeteScraping"
import CartesSources from "./sections/CartesSources"
import CompteursScraping from "./sections/CompteursScraping"
import ChartsScraping from "./sections/ChartsScraping"
import HistoriqueRuns from "./sections/HistoriqueRuns"
import { useRunAdminDuJour } from "@/features/admin-scraping.tools"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"

/* ─────────────────────────────────────────────────────────────────────
  Page Gestion du scraping — /admin/scraping (super_admin, guard par
  route dans App.jsx).

  Règles serveur conservées :
  • 409 si un run a déjà été déclenché aujourd'hui par cet admin
    (toutes sources) — bouton grisé d'avance via useRunAdminDuJour ;
  • 503 = broker Celery injoignable — le détail serveur remonte tel quel ;
  • message de succès « en file d'attente », JAMAIS « scraping terminé ».
───────────────────────────────────────────────────────────────────── */


const Scraping = () => {
  const { profile } = useAdminAuth()
  const { data: runDuJour } = useRunAdminDuJour(profile?.id)

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <Bloc><EnTeteScraping runDuJour={runDuJour} /></Bloc>
      <Bloc><CompteursScraping /></Bloc>
      <Bloc><CartesSources /></Bloc>
      <Bloc><ChartsScraping /></Bloc>
      <Bloc><HistoriqueRuns /></Bloc>
    </motion.div>
  )
}

export default Scraping