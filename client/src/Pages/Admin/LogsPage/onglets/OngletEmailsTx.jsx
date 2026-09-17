import { motion } from "framer-motion"
import { AlertTriangle } from "lucide-react"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"
import { useEmailsTxStatsQuery } from "@/features/admin-logs.tools"
import CompteursEmailsTx from "../sections/CompteursEmailsTx"
import ListeEmailsTx from "../sections/ListeEmailsTx"
import ChartEnvoieEmail from "../sections/ChartEnvoieEmail"
import ChartEnvoisMotif from "../sections/ChartEnvoisMotif"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Emails transactionnels (cycle 17, doc v3 §17.3).
   Refonte alignée sur OngletEvents / OngletContacts :
   • Orchestrateur fin — sections autonomes (compteurs, charts, liste).
   • Mode mobile : cartes + tri par Select dans ListeEmailsTx.
   • TransitionEtat pour les animations d'état.
   • Skeleton fidèle (mobile + desktop).
   • Retour en haut du tableau au changement de page.
   • Alerte opérationnelle : taux d'échec = signal Resend.
───────────────────────────────────────────────────────────────────── */
const OngletEmailsTx = () => {
  const { data: statsJour } = useEmailsTxStatsQuery(1)
  const echecsJour = statsJour?.echecs_fenetre ?? 0

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* ─── Compteurs M1-M4 ─── */}
      <Bloc>
        <CompteursEmailsTx />
      </Bloc>

      {/* Alerte opérationnelle doc v3 §17.3 : taux d'échec = signal Resend. */}
      {echecsJour > 0 && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-brand-orange px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          {echecsJour} échec{echecsJour > 1 ? "s" : ""} aujourd'hui — un taux élevé peut indiquer un problème
          côté fournisseur d'email (Resend) plutôt qu'un problème d'inscription.
        </p>
      )}

      {/* ─── Charts M5-M6 ─── */}
      <div className="grid gap-4 xl:grid-cols-3">
      <Bloc className="xl:col-span-2">
        <ChartEnvoieEmail />
      </Bloc>

      <Bloc>
        <ChartEnvoisMotif />
      </Bloc>
    </div>

      {/* ─── Table des emails ─── */}
      <Bloc>
        <ListeEmailsTx />
      </Bloc>
    </motion.div>
  )
}

export default OngletEmailsTx