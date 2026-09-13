import { Link } from "react-router-dom"
import { Radar, RotateCw } from "lucide-react"
import { aUnRunActif, useAdminScrapingRunsQuery } from "@/features/admin-scraping.tools"
import StatusChip from "@/components/shared/StatusChip"
import { LIBELLE_STATUT_RUN, TONE_STATUT_RUN, dateHeure, ilYA } from "../components/statuts-scraping"
import HeroAdmin from "@/components/admin/HeroAdmin"
import BtnAction from "@/components/admin/BtnAction"
import DialogRunScraping from "@/components/dialog/DialogRunScraping"
import { useState } from "react"


const EnTeteScraping = ({ runDuJour = null }) => {
  const [dialogOuvert, setDialogOuvert] = useState(false)
  const { data: runs } = useAdminScrapingRunsQuery({ limit: 10 })
  const enCours = aUnRunActif(runs)
  const dernier = Array.isArray(runs) ? runs.find((r) => !["pending", "running"].includes(r?.status)) : null
  const statutGlobal = enCours ? "running" : dernier?.status ?? null


  return (
    <section aria-label="État de la collecte">
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

      <DialogRunScraping dialogOuvert={dialogOuvert} setDialogOuvert={setDialogOuvert} />
    </section>
  )
}

export default EnTeteScraping