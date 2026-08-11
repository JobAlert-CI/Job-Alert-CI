// src/pages/sources/components/CarteSource.jsx
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowUpRight, Clock, Crown, ShieldAlert, ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CountUp } from "@/components/shared"
import { HUES } from "@/lib/hues"
import { SourceLogo } from "@/components/shared"

const StatsSource = ({ s }) => (
  <div className="grid grid-cols-2 gap-3">
    {[
      { v: s.total, l: "offres actives" },
      { v: s.nouveaux, l: "ce matin" },
    ].map((x) => (
      <div
        key={x.l}
        className="rounded-lg border border-outline-variant/40 bg-surface-container-low/50 px-3.5 py-3"
      >
        <p className="font-heading text-2xl font-black text-brand-navy">
          <CountUp to={x.v} />
        </p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {x.l}
        </p>
      </div>
    ))}
    <div className="col-span-2 flex items-center justify-between rounded-lg border border-outline-variant/40 bg-surface-container-low/50 px-3.5 py-3">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-on-surface-variant">
        <Clock className="size-3.5 text-brand-orange" aria-hidden />
        Passage à {s.passage}
      </span>
      <span className="font-mono text-[11px] text-muted-foreground">
        {s.duree ?? "—"}
      </span>
    </div>
  </div>
)

const CarteSource = ({ s, index, featured = false, className }) => {
  const hue = HUES[s.hue] ?? HUES.sky

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.55,
        delay: (index % 4) * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-outline-variant/40 bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-hover",
        className
      )}
      style={{ borderTop: `3px solid ${s.hex}` }}
    >
      <div className="relative h-1 overflow-hidden bg-surface-container" aria-hidden>
        <motion.span
          className="absolute inset-y-0 w-1/3 rounded-full"
          style={{ backgroundColor: s.hex }}
          animate={{ left: ["-35%", "105%"] }}
          transition={{
            duration: 2.8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: index * 0.5,
          }}
        />
      </div>

      {featured ? (
        /* ═══ Carte mise en avant (source principale) ═══ */
        <div className="grid gap-6 p-6 sm:p-7 lg:grid-cols-[1.2fr_0.8fr] max-lg:grid-cols-1">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <SourceLogo code={s.code} className="size-16" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading text-xl font-extrabold tracking-tight text-brand-navy">
                    {s.code}
                  </h3>
                  {s.principal && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#B45309]">
                      <Crown className="size-3" aria-hidden />
                      Source principale
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                  {s.type}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
              {s.description}
            </p>
            {s.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2" role="list">
                {s.tags.map((t) => (
                  <span
                    key={t}
                    role="listitem"
                    className="rounded-full border border-outline-variant/60 bg-surface-container-low/60 px-2.5 py-1 text-[11px] font-medium text-on-surface-variant"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            <p
              className={cn(
                "mt-4 flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-[12px] font-medium",
                s.prudent ? "bg-amber-500/10 text-amber-700" : hue.tile
              )}
            >
              {s.prudent ? (
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              ) : (
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              )}
              {s.note}
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <StatsSource s={s} />
            <div className="mt-auto flex flex-wrap items-center gap-2.5">
              <Link
                to={`/offres?src=${encodeURIComponent(s.slug || s.rawCode)}`}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-xs font-bold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  hue.solid
                )}
              >
                Voir les offres
              </Link>
              {s.url && (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-outline-variant/60 px-4 text-xs font-bold text-on-surface-variant transition-all duration-200 hover:border-brand-navy/40 hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Visiter le site
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ═══ Carte compacte ═══ */
        <div className="flex h-full flex-col p-6">
          <div className="flex items-center gap-3">
            <SourceLogo code={s.code} />
            <div className="min-w-0">
              <h3 className="truncate font-heading text-lg font-extrabold tracking-tight text-brand-navy">
                {s.code}
              </h3>
              <p className="text-[11px] font-semibold text-muted-foreground">{s.type}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
            {s.description}
          </p>
          {s.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2" role="list">
              {s.tags.map((t) => (
                <span
                  key={t}
                  role="listitem"
                  className="rounded-full border border-outline-variant/60 bg-surface-container-low/60 px-2.5 py-1 text-[11px] font-medium text-on-surface-variant"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          <p
            className={cn(
              "mt-4 flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-[12px] font-medium",
              s.prudent ? "bg-amber-500/10 text-amber-700" : hue.tile
            )}
          >
            {s.prudent ? (
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            ) : (
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            )}
            {s.note}
          </p>
          <div className="mt-5">
            <StatsSource s={s} />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-outline-variant/40 pt-4">
            <Link
              to={`/offres?src=${encodeURIComponent(s.slug || s.rawCode)}`}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-xs font-bold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                hue.solid
              )}
            >
              Voir les offres
            </Link>
            {s.url && (
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-outline-variant/60 px-4 text-xs font-bold text-on-surface-variant transition-all duration-200 hover:border-brand-navy/40 hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Visiter le site
                <ArrowUpRight className="size-3.5" aria-hidden />
              </a>
            )}
          </div>
        </div>
      )}
    </motion.article>
  )
}

export default CarteSource