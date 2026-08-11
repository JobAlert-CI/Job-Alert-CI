
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { HUES } from "@/lib/hues"
import BadgeNouveau from "./BadgeNouveau"
import getFiliereTheme from "@/lib/filiere-theme"

const FiliereLargeCard = ({ f, index, className }) => {
  const hue = HUES[f.hue] || HUES["sky"]
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.5, delay: (index % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className={cn("sm:col-span-2 lg:col-span-2", className)}
    >
      <Link
        to={`/filieres/${f.code}`}
        className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-outline-variant/50 bg-white p-6 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-hover"
        style={{ borderTop: `3px solid ${hue.hex}` }}
      >
        <div className={cn("pointer-events-none absolute -right-16 -top-16 size-44 rounded-full blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100", hue.glow)} aria-hidden />
        <div className="flex items-start gap-3">
          <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-lg transition-all duration-400 group-hover:scale-110 group-hover:-rotate-3", hue.tile, hue.tileHover)}>
            <f.icon className="size-6" strokeWidth={1.9} />
          </span>
          <div className="ml-auto flex items-center gap-2">
            {f.nouvelles > 0 && <BadgeNouveau label={`+${f.nouvelles} ce matin`} />}
          </div>
        </div>
        <h3 className="mt-4 font-heading text-xl font-extrabold tracking-tight text-brand-navy transition-colors duration-300 group-hover:text-brand-orange">
          {f.label}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.tagline}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {f.keywords.slice(0, 3).map((kw) => (
            <Tooltip key={kw}>
              <TooltipTrigger asChild>
                <span className="cursor-help rounded-full border border-outline-variant/60 bg-surface-container-low/60 px-2.5 py-1 text-[11px] font-medium text-on-surface-variant transition-colors hover:border-brand-navy/40 hover:text-brand-navy">
                  {kw}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">Les offres contenant « {kw} » sont tagguées {f.label}.</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-6 border-t border-outline-variant/40 pt-4">
          <div>
            <p className="font-heading text-lg font-extrabold leading-none text-brand-navy">{f.actives}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">offres actives</p>
          </div>
          <div>
            <p className={cn("font-heading text-lg font-extrabold leading-none", hue.accent)}>{f.nouvelles}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">ce matin</p>
          </div>
          <div>
            <p className="font-heading text-lg font-extrabold leading-none text-brand-navy">{f.abonnes.toLocaleString("fr-FR")}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">abonnés</p>
          </div>
          <span className="ml-auto hidden items-center gap-1 text-xs font-bold text-brand-navy opacity-0 transition-all duration-300 group-hover:opacity-100 sm:inline-flex">
            Voir
            <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

const FiliereCompactCard = ({ f, index, className }) => {
  const hue = HUES[f.hue] || HUES["sky"]
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.45, delay: (index % 4) * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className={cn("lg:col-span-3 overflow-x-hidden", className)}
    >
      <Link
        to={`/filieres/${f.code}`}
        className="group flex items-center gap-4 rounded-xl border border-outline-variant/50 bg-white p-4 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-hover"
        style={{ borderLeft: `3px solid ${hue.hex}` }}
      >
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg transition-all duration-400 group-hover:scale-110", hue.tile, hue.tileHover)}>
          <f.icon className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate-2 font-heading text-[15px] font-bold text-brand-navy transition-colors duration-300 group-hover:text-brand-orange">
            {f.label}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{f.tagline}</p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <p className="font-heading text-lg font-extrabold leading-none text-brand-navy">{f.actives}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">offres</p>
        </div>
        {f.nouvelles > 0 && (
          <span className="shrink-0 rounded-full bg-brand-orange/15 px-2 py-0.5 text-[10px] font-bold text-[#B45309]">+{f.nouvelles}</span>
        )}
        <ArrowUpRight className="size-4 shrink-0 text-outline-variant transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-orange" />
      </Link>
    </motion.div>
  )
}

const FiliereCard = ({ f, index = 0, variant = "compact", className }) =>
  variant === "large"
    ? <FiliereLargeCard f={f} index={index} className={className} />
    : <FiliereCompactCard f={f} index={index} className={className} />

export default FiliereCard