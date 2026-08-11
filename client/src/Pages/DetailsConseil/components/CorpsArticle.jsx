// src/pages/conseils/detail/components/CorpsArticle.jsx
import { memo } from "react"
import { motion } from "framer-motion"
import { BadgeCheck, Bell, Check, Lightbulb, Quote, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { CountUp, CtaLink } from "@/components/shared"
import { useConseilDetail } from "@/contexts/DetailsConseil.context"
import AsideConseil from "./AsideConseil"

/* Chiffres clés — mémoïsé (stats stables venant du cache). */
const ChiffresCles = memo(function ChiffresCles({ stats, hue }) {
  if (!stats?.length) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mt-8 grid grid-cols-3 gap-3 max-sm:grid-cols-1"
    >
      {stats.map((s) => (
        <div
          key={`${s.l}-${s.v}`}
          className="rounded-xl border border-outline-variant/40 bg-white p-4 text-center shadow-soft"
          style={{ borderTop: `3px solid ${hue.hex}` }}
        >
          <p className="font-heading text-2xl font-black text-brand-navy sm:text-3xl">
            <CountUp to={s.v} prefix={s.prefix ?? ""} suffix={s.suffix ?? ""} />
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {s.l}
          </p>
        </div>
      ))}
    </motion.div>
  )
})

/* Corps — article + sidebar, tous deux autonomes via contexte. */
const CorpsArticle = () => {
  const { contenu, hue } = useConseilDetail()

  return (
    <section className="border-b border-outline-variant/30 bg-background py-18 max-md:py-14">
      {/* Desktop-first : article + aside en base, empilé en repli */}
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_320px] gap-10 px-12 max-lg:grid-cols-1 max-md:px-6">
        <article>
          {contenu.intro && (
            <p className="text-lg leading-relaxed text-on-surface first-letter:float-left first-letter:mr-3 first-letter:font-heading first-letter:text-6xl first-letter:font-black first-letter:leading-[0.85] first-letter:text-brand-orange">
              {contenu.intro}
            </p>
          )}

          <ChiffresCles stats={contenu.stats} hue={hue} />

          {contenu.sections.length === 0 ? (
            <p className="mt-12 rounded-xl border border-dashed border-outline-variant/60 bg-white p-6 text-sm text-muted-foreground" role="status">
              Contenu détaillé en cours de rédaction — le résumé est déjà disponible.
            </p>
          ) : (
            <div className="mt-12 space-y-11">
              {contenu.sections.map((s, i) => (
                <section key={s.id} id={s.id} className="scroll-mt-24">
                  <h2 className="flex items-baseline gap-3 font-heading text-2xl font-extrabold tracking-tight text-brand-navy">
                    <span className="text-sm font-black text-brand-orange">0{i + 1}</span>
                    {s.titre}
                  </h2>
                  {s.paragraphes?.map((p, index) => (
                    <p key={`${s.id}-paragraphe-${index}`} className="mt-4 leading-relaxed text-on-surface-variant">
                      {p}
                    </p>
                  ))}
                  {s.points?.length > 0 && (
                    <ul className="mt-4 space-y-2.5">
                      {s.points.map((point, index) => (
                        <li key={`${s.id}-point-${index}`} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-on-surface-variant">
                          <span className="mt-1 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-brand-orange/10">
                            <Check className="size-2.5 text-brand-orange" strokeWidth={3.5} aria-hidden />
                          </span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Citation après la 2e section (ou la dernière) */}
                  {i === Math.min(1, contenu.sections.length - 1) && contenu.citation && (
                    <blockquote className="relative mt-8 overflow-hidden rounded-xl bg-brand-navy p-6 text-white sm:p-7">
                      <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />
                      <div className={cn("pointer-events-none absolute -right-16 -top-16 size-56 rounded-full blur-3xl", hue.glow)} aria-hidden />
                      <Quote className="relative size-7 text-brand-orange" strokeWidth={1.5} aria-hidden />
                      <p className="relative mt-3 font-heading text-lg font-semibold leading-relaxed">
                        « {contenu.citation.texte} »
                      </p>
                      <footer className="relative mt-3 text-xs font-semibold text-white/60">
                        — {contenu.citation.auteur}
                      </footer>
                    </blockquote>
                  )}
                </section>
              ))}
            </div>
          )}

          {/* À retenir */}
          {contenu.aRetenir.length > 0 && (
            <div className="mt-12 rounded-xl border-l-4 border-brand-orange bg-brand-orange/5 p-6">
              <p className="flex items-center gap-2 font-heading text-sm font-extrabold uppercase tracking-[0.14em] text-brand-navy">
                <Lightbulb className="size-4 text-brand-orange" aria-hidden />
                À retenir
              </p>
              <ul className="mt-3.5 space-y-2.5">
                {contenu.aRetenir.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-on-surface-variant">
                    <span className="mt-1 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-brand-orange/15">
                      <Check className="size-2.5 text-brand-orange" strokeWidth={3.5} aria-hidden />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mots-clés */}
          {contenu.tags.length > 0 && (
            <div className="mt-10 border-t border-outline-variant/40 pt-6">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                <Sparkles className="size-3.5 text-brand-orange" aria-hidden />
                Mots-clés associés
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {contenu.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-outline-variant/60 bg-white px-3 py-1 text-xs font-medium text-on-surface-variant transition-colors hover:border-brand-navy/40 hover:text-brand-navy"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* La rédaction — rangée en base (desktop), colonne en repli */}
          <div className="mt-8 flex flex-row items-center gap-4 rounded-xl border border-outline-variant/40 bg-white p-6 shadow-soft max-sm:flex-col max-sm:items-start">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-navy font-heading text-[13px] font-black text-white">
              RC
            </span>
            <div className="flex-1">
              <p className="flex items-center gap-1.5 font-heading text-sm font-bold text-brand-navy">
                La rédaction JobAlert CI
                <BadgeCheck className="size-4 text-brand-orange" aria-hidden />
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-on-surface-variant">
                Chaque conseil est écrit à partir des offres réellement collectées chaque matin
                sur nos sources, jamais de théorie hors-sol.
              </p>
            </div>
            <CtaLink to="/inscription" size="md" icon={Bell} animateIcon className="shrink-0">
              Recevoir le brief
            </CtaLink>
          </div>
        </article>

        <AsideConseil />
      </div>
    </section>
  )
}

export default CorpsArticle