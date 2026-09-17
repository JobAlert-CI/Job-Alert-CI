import { motion } from "framer-motion"
import Bloc, { VARIANTS_CONTENEUR } from "@/components/admin/Bloc"
import CompteursEvents from "../sections/CompteursEvents"
import ChartEvenements from "../sections/ChartEvenements"
import ChartEvenementAction from "../sections/ChartEvenementAction"
import ListeEvenements from "../sections/ListeEvenements"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Événements techniques (cycle 17, doc v3 §17.1) — module
   scraping seul (source: OfferIngestionEvent).
   Compteurs E1-E4 + charts E5-E6 servis par UN SEUL appel /logs/stats ;
   table via /logs/events (liste plate → pagination heuristique).
   Refonte : tri par en-tête initialisé (« Date » desc), selects shadcn
   avec surbrillance, période via MiniCalendar, retour en haut du
   tableau au changement de page, skeleton fidèle (limite de page),
   animations Recharts conditionnées par prefers-reduced-motion.
───────────────────────────────────────────────────────────────────── */

const OngletEvents = () => {

  return (
    <motion.div variants={VARIANTS_CONTENEUR} initial="cache" animate="visible" className="flex flex-col gap-4">
      <Bloc>
        <CompteursEvents />
      </Bloc>

      {/* ─── Charts E5-E6 (animations conditionnées reduced-motion) ─── */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Bloc className="xl:col-span-2">
          <ChartEvenements />
        </Bloc>

        <Bloc>
          <ChartEvenementAction />
        </Bloc>
      </div>

      <Bloc>
        <ListeEvenements />
      </Bloc>
    </motion.div>
  )
}

export default OngletEvents