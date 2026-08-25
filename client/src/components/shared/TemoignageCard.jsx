
import { BadgeCheck, Quote } from "lucide-react"
import { cn } from "@/lib/utils"

const CarteVedette = ({ t, className }) => (
  <figure className={cn("relative flex w-[320px] shrink-0 flex-col overflow-hidden rounded-xl bg-brand-navy p-7 text-white sm:w-115 sm:p-8", className)}>
    <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,166,35,0.16),transparent_55%)]" aria-hidden />
    <div className="relative flex items-center justify-between gap-3">
      <Quote className="size-8 text-brand-orange" strokeWidth={1.5} aria-hidden />
      <span className="rounded-full border border-white/15 bg-card/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/80">
        {t.secteur}
      </span>
    </div>
    <blockquote className="relative mt-5 flex-1 font-heading text-[13px] font-semibold leading-relaxed sm:text-[19px]">
      « {t.texte} »
    </blockquote>
    <figcaption className="relative mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
      <div className="flex items-center gap-3">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full text-xs font-black ring-2 ring-white/20", t.avatar)}>
          {t.initiales}
        </span>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold">
            {t.nom}
            <BadgeCheck className="size-4 text-brand-orange" />
          </p>
          <p className="text-[11px] text-white/60">{t.ville}</p>
        </div>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange px-3 py-1.5 text-[11px] font-bold">
        <BadgeCheck className="size-3.5" />
        {t.resultat}
      </span>
    </figcaption>
  </figure>
)

const CarteStandard = ({ t, className }) => (
  <figure className={cn("flex w-72.5 shrink-0 flex-col rounded-xl border border-outline-variant/40 bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-orange/40 hover:shadow-hover sm:w-87.5", className)}>
    <div className="flex items-center justify-between gap-3">
      <Quote className="size-6 text-brand-orange/40" strokeWidth={1.5} aria-hidden />
      <span className="rounded-full bg-surface-container-low px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
        {t.secteur}
      </span>
    </div>
    <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-on-surface-variant">
      « {t.texte} »
    </blockquote>
    <figcaption className="mt-5 flex items-center gap-3 border-t border-outline-variant/30 pt-4">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-black text-white", t.avatar)}>
        {t.initiales}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-sm font-bold text-brand-navy">
          {t.nom}
          <BadgeCheck className="size-3.5 shrink-0 text-brand-orange" />
        </p>
        <p className="truncate text-[11px] text-muted-foreground">{t.ville}</p>
      </div>
    </figcaption>
    <span className="mt-3.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
      <BadgeCheck className="size-3" />
      {t.resultat}
    </span>
  </figure>
)

const TemoignageCard = ({ t, variant = "standard", className }) =>
  variant === "vedette"
    ? <CarteVedette t={t} className={className} />
    : <CarteStandard t={t} className={className} />

export default TemoignageCard