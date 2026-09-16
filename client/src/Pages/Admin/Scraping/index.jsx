import { useState } from "react"
import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import { Radar, RotateCw } from "lucide-react"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import CartesSources from "./sections/CartesSources"
import CompteursScraping from "./sections/CompteursScraping"
import ChartsScraping from "./sections/ChartsScraping"
import HistoriqueRuns from "./sections/HistoriqueRuns"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"
import { aUnRunActif, useAdminScrapingRunsQuery, useRunAdminDuJour } from "@/features/admin-scraping.tools"
import StatusChip from "@/components/shared/StatusChip"
import { LIBELLE_STATUT_RUN, TONE_STATUT_RUN, dateHeure, ilYA } from "./components/statuts-scraping"
import HeroAdmin from "@/components/admin/HeroAdmin"
import BtnAction from "@/components/admin/BtnAction"
import DialogRunScraping from "@/components/dialog/DialogRunScraping"

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
  const [dialogOuvert, setDialogOuvert] = useState(false)
  const { data: runs } = useAdminScrapingRunsQuery({ limit: 10 })

  const enCours = aUnRunActif(runs)
  const dernier = Array.isArray(runs) ? runs.find((r) => !["pending", "running"].includes(r?.status)) : null
  const statutGlobal = enCours ? "running" : dernier?.status ?? null

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <Bloc>
        <HeroAdmin
          title="Gestion du scraping"
          titleBdge="Pilotage"
          icon={Radar}
          description="Collecte quotidienne des sources partenaires : surveillance de l'état, diagnostic des runs et relance manuelle."
          badges={
            <>
              {statutGlobal && (
                <StatusChip
                  tone={TONE_STATUT_RUN[statutGlobal] ?? "navy"}
                  ping={enCours}
                  tooltip={
                    enCours
                      ? "Un run de scraping est en file d'attente ou en cours d'exécution."
                      : `Dernier run terminé : ${LIBELLE_STATUT_RUN[statutGlobal] ?? statutGlobal}${dernier?.finished_at ? ` (${dateHeure(dernier.finished_at)})` : ""}`
                  }
                >
                  {enCours ? "Collecte en cours…" : `Dernier run : ${LIBELLE_STATUT_RUN[statutGlobal] ?? statutGlobal}`}
                </StatusChip>
              )}
              {dernier && !enCours && (
                <span className="text-xs text-muted-foreground">{ilYA(dernier.finished_at ?? dernier.started_at)}</span>
              )}
            </>
          }
        >
          {runDuJour ? (
            <span className="flex flex-col items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Toutes sources déjà déclenché aujourd'hui —
              <Link
                to={`/admin/scraping/runs/${runDuJour?.id}`}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                voir le run du jour
              </Link>
              <BtnAction size="sm" variant="outline" className="ml-1" onClick={() => setDialogOuvert(true)}>
                Source seule…
              </BtnAction>
            </span>
          ) : (
            <BtnAction
              size="sm"
              variant="primary"
              onClick={() => setDialogOuvert(true)}
              className="h-6 text-[11px]"
            >
              <RotateCw aria-hidden className="size-4 transition-transform duration-300 group-hover:rotate-34" />
              Lancer un scraping
            </BtnAction>
          )}
        </HeroAdmin>
      </Bloc>
      <Bloc><CompteursScraping /></Bloc>
      <Bloc><CartesSources /></Bloc>
      <Bloc><ChartsScraping /></Bloc>
      <Bloc><HistoriqueRuns /></Bloc>

      <Bloc><DialogRunScraping dialogOuvert={dialogOuvert} setDialogOuvert={setDialogOuvert} /></Bloc>
    </motion.div>
  )
}

export default Scraping