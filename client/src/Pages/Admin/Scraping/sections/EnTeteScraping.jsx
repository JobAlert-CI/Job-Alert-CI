import { Radar, RotateCw } from "lucide-react"
import {
  aUnRunActif,
  useAdminScrapingRunsQuery,
} from "@/features/admin-scraping.tools"
import StatusChip from "@/components/shared/StatusChip"
import { Button } from "@/components/ui/button"
import {
  LIBELLE_STATUT_RUN, TONE_STATUT_RUN, dateHeure, ilYA,
} from "../components/statuts-scraping"

/* ─────────────────────────────────────────────────────────────────────
   Section 1 — En-tête de la page Scraping : titre + état global de
   la collecte (StatusChip) + bouton de déclenchement manuel.

   L'état global est dérivé des runs (pas un champ serveur) :
   - un run pending/running dans les 10 derniers → « collecte en cours » ;
   - sinon, statut du dernier run connu (success/partial_failure/failed) ;
   - aucun run → pas de chip.

   Le bouton ouvre le dialog de déclenchement (confirmation) porté
   par la page (index.jsx) : choix source unique ou toutes, + notes.
   ───────────────────────────────────────────────────────────────────── */

const EnTeteScraping = ({ onDeclencher }) => {
  // Les runs servent uniquement à l'état global : même queryKey que
  // l'historique → zéro appel réseau supplémentaire. Une erreur ici
  // n'est pas bloquante : l'en-tête reste utilisable sans la chip.
  const { data: runs } = useAdminScrapingRunsQuery({ limit: 10 })

  const enCours = aUnRunActif(runs)
  const dernier = Array.isArray(runs) ? runs.find((r) => !["pending", "running"].includes(r?.status)) : null
  const statutGlobal = enCours ? "running" : dernier?.status ?? null

  return (
    <section
      aria-label="État de la collecte"
      className="flex flex-wrap items-end justify-between gap-3"
    >
      <div>
        <h1 className="flex items-center gap-2 font-heading text-lg font-bold">
          <Radar className="size-5 text-primary" aria-hidden />
          Gestion du scraping
        </h1>
        <p className="text-xs text-muted-foreground">
          Collecte quotidienne GoAfrica · JobIvoire · Éducarrière — surveillance et relance manuelle.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {statutGlobal && (
          <StatusChip
            tone={TONE_STATUT_RUN[statutGlobal] ?? "navy"}
            ping={enCours}
            tooltip={
              enCours
                ? "Un run de scraping est en file d'attente ou en cours d'exécution."
                : `Dernier run terminé : ${LIBELLE_STATUT_RUN[statutGlobal] ?? statutGlobal}${
                    dernier?.finished_at ? ` (${dateHeure(dernier.finished_at)})` : ""
                  }`
            }
          >
            {enCours ? "Collecte en cours…" : `Dernier run : ${LIBELLE_STATUT_RUN[statutGlobal] ?? statutGlobal}`}
          </StatusChip>
        )}
        {dernier && !enCours && (
          <span className="text-xs text-muted-foreground">{ilYA(dernier.finished_at ?? dernier.started_at)}</span>
        )}
        <Button size="sm" onClick={onDeclencher}>
          <RotateCw aria-hidden /> Lancer un scraping
        </Button>
      </div>
    </section>
  )
}

export default EnTeteScraping
