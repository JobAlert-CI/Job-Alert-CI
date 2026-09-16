import { memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronDown, ChevronUp
} from "lucide-react"
import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import EditeurMotsCles from "./EditeurMotsCles"
import SectionSpecialites from "./EditeurSpecialites"
import MenuActionsFiliere from "./MenuActionsFiliere"

/* ─── Carte mobile (miroir de la ligne desktop) ─────────────────────
   Le panneau d'expansion (mots-clés + spécialités) est INTÉGRÉ à la
   carte : même état `etendue` que la table, une seule fiche ouverte. */

export const CarteFiliereMobile = memo(function CarteFiliereMobile({
  filiere, ouverte, nbOffres, nbAbonnes,
  onEtendre, onFermer, onEditer, onSupprimer, keywordsMutation,
}) {
  const stats = [
    { label: "Mots-clés", valeur: filiere.keywords?.length ?? 0 },
    { label: "Offres", valeur: nbOffres },
    { label: "Abonnés", valeur: nbAbonnes },
    { label: "Spécialités", valeur: filiere.specialties?.length ?? 0 },
  ]
  return (
    <article
      aria-label={`Filière ${filiere.label}`}
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-soft transition-colors",
        ouverte && "border-primary/30 bg-muted/30"
      )}
    >
      {/* En-tête : pastille + libellé + code·ordre / statut + menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            {filiere.color_hex && (
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: filiere.color_hex }}
                aria-hidden
              />
            )}
            <span className="truncate" title={filiere.label}>{filiere.label}</span>
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {filiere.code} · ordre {filiere.sort_order}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={filiere.is_active ? "secondary" : "outline"}>
            {filiere.is_active ? "Active" : "Inactive"}
          </Badge>
          <MenuActionsFiliere
            filiere={filiere}
            onEtendre={onEtendre}
            onEditer={onEditer}
            onSupprimer={onSupprimer}
          />
        </div>
      </div>

      {/* 4 indicateurs en grille 2×2 */}
      <dl className="mt-3 grid grid-cols-2 gap-2">
        {stats.map(({ label, valeur }) => (
          <div key={label} className="rounded-lg bg-muted/40 px-2 py-1.5">
            <dt className="truncate text-[10px] text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium tabular-nums">{valeur}</dd>
          </div>
        ))}
      </dl>

      {/* Panneau d'expansion : même animation height 0 → auto que la table */}
      <AnimatePresence initial={false}>
        {ouverte && (
          <motion.div
            key="panneau-mobile"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden motion-reduce:transition-none"
          >
            <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
              <EditeurMotsCles
                filiere={filiere}
                mutation={keywordsMutation}
                onFermer={onFermer}
                compact
              />
              <SectionSpecialites filiereId={filiere.id} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pied : déplier / replier (cible tactile pleine largeur) */}
      <button
        type="button"
        onClick={onEtendre}
        aria-expanded={ouverte}
        aria-label={ouverte ? `Replier ${filiere.label}` : `Déplier ${filiere.label} (mots-clés et spécialités)`}
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-md border border-border px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-muted/50"
      >
        {ouverte ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
        {ouverte ? "Replier mots-clés et spécialités" : "Mots-clés et spécialités"}
      </button>
    </article>
  )
})
