import { memo } from "react"
import { motion } from "framer-motion"
import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { teinteProtection } from "../components/protection"
import { TableCell, } from "@/components/ui/table"
import ActionsSource from "./ActionsSource"


const LIBELLE_STATUT = {
  active: ["Active", "secondary"],
  paused: ["En pause", "outline"],
  disabled: ["Désactivée", "outline"],
  error: ["En erreur", "destructive"],
}

const dateCourte = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) : "—"


/* ─── Ligne mémoïsée (table desktop) ────────────────────────────────
   La LIGNE ENTIERE ouvre l'édition au clic (raccourci souris) ; les
   boutons restent le chemin clavier/lecteur d'écran. Feedback
   anti-scraping : pastille colorée selon la sévérité. */
export const LigneSource = memo(function LigneSource({
  source, statutEnCours, onBasculer, onEditer, onSupprimer,
}) {
  const [libelle, variante] = LIBELLE_STATUT[source.status] ?? [source.status, "outline"]
  const teinte = teinteProtection(source.anti_scraping_level ?? 0)
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={() => onEditer(source)}
      className="cursor-pointer transition-colors hover:bg-muted/50 motion-reduce:transition-none"
    >
      <TableCell>
        <div className="flex items-center gap-2">
          {source.color_hex && (
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: source.color_hex }} aria-hidden />
          )}
          <span className="font-medium">{source.name}</span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{source.code}</span>
      </TableCell>
      <TableCell>
        <Badge variant={variante}>{libelle}</Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">{source.priority}</TableCell>
      <TableCell className="text-right">
        <span
          className={cn("inline-flex items-center gap-1.5 tabular-nums", teinte.texte)}
          title={`Protection ${teinte.libelle.toLowerCase()} (${source.anti_scraping_level}/5)`}
        >
          <span className={cn("size-1.5 rounded-full", teinte.fond)} aria-hidden />
          {source.anti_scraping_level}/5
        </span>
      </TableCell>
      <TableCell className="hidden whitespace-nowrap text-right text-muted-foreground tabular-nums md:table-cell">
        {dateCourte(source.last_scraped_at)}
      </TableCell>
      <TableCell className="hidden max-w-40 truncate text-muted-foreground lg:table-cell" title={source.base_url}>
        {source.base_url}
      </TableCell>
      <TableCell>
        <ActionsSource
          source={source}
          statutEnCours={statutEnCours}
          onBasculer={onBasculer}
          onEditer={onEditer}
          onSupprimer={onSupprimer}
        />
      </TableCell>
    </motion.tr>
  )
})

/* ─── Skeleton aux largeurs réalistes (pas de layout shift) ─── */
export const LigneSkeleton = () => (
  <motion.tr
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.18 }}
    className="hover:bg-transparent"
  >
    <TableCell>
      <div className="flex flex-col gap-1.5 py-0.5">
        <div className="flex items-center gap-2">
          <Skeleton className="size-2.5 rounded-full" />
          <Skeleton className="h-3.5 w-32" />
        </div>
        <Skeleton className="h-2.5 w-16" />
      </div>
    </TableCell>
    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
    <TableCell className="text-right"><Skeleton className="ml-auto h-3.5 w-8" /></TableCell>
    <TableCell className="text-right"><Skeleton className="ml-auto h-3.5 w-10" /></TableCell>
    <TableCell className="hidden md:table-cell"><Skeleton className="ml-auto h-3.5 w-20" /></TableCell>
    <TableCell className="hidden lg:table-cell"><Skeleton className="h-3 w-40" /></TableCell>
    <TableCell>
      <div className="flex items-center justify-end gap-1">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
      </div>
    </TableCell>
  </motion.tr>
)