import { memo } from "react"
import { motion } from "framer-motion"
import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { teinteProtection } from "../components/protection"
import ActionsSource from "./ActionsSource"

const LIBELLE_STATUT = {
  active: ["Active", "secondary"],
  paused: ["En pause", "outline"],
  disabled: ["Désactivée", "outline"],
  error: ["En erreur", "destructive"],
}

const dateCourte = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) : "—"


/* ─── Carte mémoïsée (vue mobile) ─── */
export const CarteSourceMobile = memo(function CarteSourceMobile({
  source, statutEnCours, onBasculer, onEditer, onSupprimer,
}) {
  const [libelle, variante] = LIBELLE_STATUT[source.status] ?? [source.status, "outline"]
  const teinte = teinteProtection(source.anti_scraping_level ?? 0)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={() => onEditer(source)}
      className="flex cursor-pointer flex-col gap-2.5 border-b border-border p-4 transition-colors hover:bg-muted/40 motion-reduce:transition-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {source.color_hex && (
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: source.color_hex }} aria-hidden />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{source.name}</p>
            <p className="font-mono text-[10px] text-muted-foreground">{source.code}</p>
          </div>
        </div>
        <Badge variant={variante} className="shrink-0">{libelle}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>Priorité <span className="font-semibold tabular-nums text-foreground">{source.priority}</span></span>
        <span className={cn("inline-flex items-center gap-1", teinte.texte)}>
          <span className={cn("size-1.5 rounded-full", teinte.fond)} aria-hidden />
          Anti-scraping {source.anti_scraping_level}/5 · {teinte.libelle}
        </span>
        <span>Scrapée le {dateCourte(source.last_scraped_at)}</span>
      </div>
      {source.base_url && (
        <p className="truncate text-[10px] text-muted-foreground" title={source.base_url}>{source.base_url}</p>
      )}
      <ActionsSource
        source={source}
        statutEnCours={statutEnCours}
        onBasculer={onBasculer}
        onEditer={onEditer}
        onSupprimer={onSupprimer}
      />
    </motion.div>
  )
})

export const CarteSkeletonMobile = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.18 }}
    className="flex flex-col gap-3 border-b border-border p-4"
  >
    <div className="flex items-center justify-between gap-2">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
    <Skeleton className="h-3 w-full max-w-64" />
    <Skeleton className="h-3 w-48" />
  </motion.div>
)