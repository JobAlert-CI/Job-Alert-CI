import { memo } from "react"
import { Link } from "react-router-dom"
import { Copy, ExternalLink,} from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import { dateHeure } from "@/lib/dates"
import {
  LIBELLE_ACTION_EVENT, VARIANTE_NIVEAU,
} from "@/features/admin-logs.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TableRow, TableCell } from "@/components/ui/table"
import BlocSkel from "./BlocSkel"

/* ─── Ligne desktop mémoïsée ─────────────────────────────────────── */
const LigneEvent = memo(function LigneEvent({ evt, runParent }) {
  const notify = useNotify()
  return (
    <TableRow className="transition-colors hover:bg-muted/50">
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{dateHeure(evt.created_at)}</TableCell>
      <TableCell><Badge variant={VARIANTE_NIVEAU[evt.niveau] ?? "outline"}>{evt.niveau}</Badge></TableCell>
      <TableCell className="text-xs">{LIBELLE_ACTION_EVENT[evt.action] ?? evt.action}</TableCell>
      <TableCell className="max-w-72 truncate font-mono text-[10px] text-muted-foreground" title={evt.message ?? ""}>
        {evt.message ?? "—"}
      </TableCell>
      <TableCell className="text-xs">
        {/* Résolution sous-run → run PARENT (fix cycle 17). */}
        {runParent ? (
          <Link to={`/admin/scraping/runs/${runParent}`} className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
            Voir le run <ExternalLink className="size-3" aria-hidden />
          </Link>
        ) : evt.source_scrape_run_id ? (
          <span
            className="text-[10px] text-muted-foreground"
            title="Run trop ancien pour le lien (hors des 100 derniers runs) — voir l'historique Scraping"
          >
            Run #… <ExternalLink className="inline size-3 opacity-40" aria-hidden />
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {evt.hash_unique && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copier le hash"
              onClick={() => { navigator.clipboard?.writeText(evt.hash_unique); notify("Hash copié", "success") }}
            >
              <Copy className="size-3.5" aria-hidden />
            </Button>
          )}
          {evt.offer_id && (
            <Link
              to={`/admin/offres/${evt.offer_id}`}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Voir l'offre liée"
            >
              <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
})

/* Ligne desktop : 6 cellules aux largeurs des vraies colonnes. */
const SkeletonLigneEvent = ({ delay = 0 }) => (
  <TableRow className="hover:bg-transparent">
    <TableCell><BlocSkel className="h-3.5 w-24" delay={delay} /></TableCell>
    <TableCell><BlocSkel className="h-5 w-16 rounded-full" delay={delay} /></TableCell>
    <TableCell><BlocSkel className="h-3.5 w-20" delay={delay} /></TableCell>
    <TableCell><BlocSkel className="h-3 w-56" delay={delay} /></TableCell>
    <TableCell><BlocSkel className="h-3.5 w-24" delay={delay} /></TableCell>
    <TableCell>
      <div className="flex justify-end gap-1">
        <BlocSkel className="size-7 rounded-md" delay={delay} />
        <BlocSkel className="size-7 rounded-md" delay={delay} />
      </div>
    </TableCell>
  </TableRow>
)

export { LigneEvent, SkeletonLigneEvent }

export default LigneEvent