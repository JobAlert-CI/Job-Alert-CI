import { Fragment, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check, SlidersHorizontal, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { paletteDepuisHex } from "@/lib/hues"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useRegistered } from "@/contexts/Registered.context"

export const EtapePreferences = () => {
  const { form, toggleFiliere, filieres, isLoadingReferentials } = useRegistered()
  const [q, setQ] = useState("")

  const query = q.trim().toLowerCase()
  const liste = useMemo(() => {
    return filieres.filter(
      (f) =>
        !query ||
        f.label?.toLowerCase().includes(query) ||
        f.keywords?.some((k) => k.toLowerCase().includes(query)) ||
        f.tagline?.toLowerCase().includes(query) ||
        f.description?.toLowerCase().includes(query)
    )
  }, [filieres, query])

  const plein = form.filieres.length >= 3

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-extrabold tracking-tight text-brand-navy sm:text-3xl">
            Choisissez vos <span className="text-brand-orange">filières</span>.
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">
            1 à 3 filières. Vous ne recevrez que leurs offres, jamais le reste.
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-3.5 py-1.5 font-heading text-sm font-extrabold transition-colors",
            form.filieres.length > 0
              ? "bg-brand-orange/15 text-[#B45309]"
              : "bg-surface-container text-muted-foreground"
          )}
        >
          {form.filieres.length}/3
        </span>
      </div>

      {/* Jauge visuelle de sélection */}
      <div className="mt-3.5 flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            initial={false}
            animate={{ opacity: i < form.filieres.length ? 1 : 0.35 }}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i < form.filieres.length ? "bg-brand-orange" : "bg-outline-variant/50"
            )}
          />
        ))}
      </div>

      {/* Barre de recherche */}
      <div className="relative mt-5">
        <SlidersHorizontal className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un métier, un mot-clé (ex: dev, finance, rh)…"
          aria-label="Rechercher une filière"
          className="h-11 w-full rounded-lg border border-outline-variant/60 bg-card pl-10 pr-4 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
        />
      </div>

      {/* Loader discret en cas de premier chargement */}
      {isLoadingReferentials && filieres.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-brand-orange" />
          <p className="text-xs font-medium">Chargement des filières…</p>
        </div>
      ) : (
        /* Grille des filières */
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {liste.map((f) => {
            const sel = form.filieres.includes(f.code)
            const bloque = plein && !sel
            const hue = f.palette ?? paletteDepuisHex(f.color_hex ?? f.colorHex)
            const Icon = f.icon || SlidersHorizontal

            const btn = (
              <button
                type="button"
                onClick={() => !bloque && toggleFiliere(f.code)}
                aria-pressed={sel}
                disabled={bloque}
                className={cn(
                  "group relative flex w-full flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all duration-200 cursor-pointer",
                  sel
                    ? "border-brand-navy bg-brand-navy/3 shadow-soft ring-1 ring-brand-navy/20"
                    : "border-outline-variant/60 bg-card hover:-translate-y-0.5 hover:border-brand-navy/35 hover:shadow-soft",
                  bloque && "cursor-not-allowed opacity-40 hover:translate-y-0 hover:border-outline-variant/60 hover:shadow-none"
                )}
              >
                <span
                  style={hue.style}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-md transition-colors duration-200",
                    hue?.tile || "bg-blue-500/10 text-blue-600",
                    !bloque && "group-hover:bg-opacity-20"
                  )}
                >
                  <Icon className="size-4.5" strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  <span className="block line-clamp-2 md:truncate-2 text-[12px] font-bold leading-tight text-brand-navy">
                    {f.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">
                    {f.actives ?? 0} offre{f.actives > 1 ? "s" : ""} active{f.actives > 1 ? "s" : ""}
                  </span>
                </span>
                <AnimatePresence>
                  {sel && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-brand-orange text-on-primary shadow-soft"
                    >
                      <Check className="size-3" strokeWidth={3.5} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            )

            return bloque ? (
              <Tooltip key={f.code}>
                <TooltipTrigger>
                  <div className="w-full">{btn}</div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  3 filières maximum — désélectionnez-en une pour en choisir une autre.
                </TooltipContent>
              </Tooltip>
            ) : (
              <Fragment key={f.code}>{btn}</Fragment>
            )
          })}
        </div>
      )}

      {liste.length === 0 && !isLoadingReferentials && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Aucune filière ne correspond à « {q} ».
        </p>
      )}
    </div>
  )
}

export default EtapePreferences
