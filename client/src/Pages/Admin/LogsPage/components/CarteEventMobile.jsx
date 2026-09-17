import { memo } from "react"
import { Link } from "react-router-dom"
import {Copy, ExternalLink} from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import { dateHeure } from "@/lib/dates"
import {LIBELLE_ACTION_EVENT, VARIANTE_NIVEAU,} from "@/features/admin-logs.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import BlocSkel from "./BlocSkel"

/* ─── Carte mobile (miroir de la ligne desktop) ─────────────────────
   Toutes les actions restent accessibles : copie de hash, lien offre,
   lien croisé vers le run parent. */
const CarteEventMobile = memo(function CarteEventMobile({ evt, runParent }) {
  const notify = useNotify()
  return (
    <article
      aria-label={`Événement du ${dateHeure(evt.created_at)}`}
      className="rounded-xl border border-border bg-card p-4 shadow-soft"
    >
      {/* En-tête : date / badge de niveau */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] tabular-nums text-muted-foreground">{dateHeure(evt.created_at)}</p>
        <Badge variant={VARIANTE_NIVEAU[evt.niveau] ?? "outline"}>{evt.niveau}</Badge>
      </div>

      {/* Action */}
      <p className="mt-2 text-sm font-medium">{LIBELLE_ACTION_EVENT[evt.action] ?? evt.action}</p>

      {/* Message (tronqué sur 2 lignes, title complet) */}
      {evt.message && (
        <p className="mt-1.5 line-clamp-2 font-mono text-[10px] text-muted-foreground" title={evt.message}>
          {evt.message}
        </p>
      )}

      {/* Lien croisé vers le run parent */}
      <div className="mt-2 text-xs">
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
          <span className="text-muted-foreground">—</span>
        )}
      </div>

      {/* Pied : copie de hash + offre liée (si présentes) */}
      {(evt.hash_unique || evt.offer_id) && (
        <div className="mt-2.5 flex items-center justify-end gap-1 border-t border-border pt-2">
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
      )}
    </article>
  )
})


/* Carte mobile : miroir de CarteEventMobile. */
const SkeletonCarteEventMobile = ({ delay = 0 }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-soft" aria-hidden="true">
    <div className="flex items-start justify-between gap-2">
      <BlocSkel className="h-2.5 w-24" delay={delay} />
      <BlocSkel className="h-5 w-16 shrink-0 rounded-full" delay={delay} />
    </div>
    <BlocSkel className="mt-2 h-3.5 w-28" delay={delay} />
    <div className="mt-1.5 space-y-1.5">
      <BlocSkel className="h-2.5 w-full" delay={delay} />
      <BlocSkel className="h-2.5 w-4/5" delay={delay} />
    </div>
    <BlocSkel className="mt-2 h-3 w-20" delay={delay} />
    <div className="mt-2.5 flex justify-end gap-1 border-t border-border pt-2">
      <BlocSkel className="size-7 rounded-md" delay={delay} />
      <BlocSkel className="size-7 rounded-md" delay={delay} />
    </div>
  </div>
)

export { CarteEventMobile, SkeletonCarteEventMobile }

export default CarteEventMobile