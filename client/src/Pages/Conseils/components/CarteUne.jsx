// src/pages/conseils/components/CarteUne.jsx
import { Link } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUpRight, Clock, MoveHorizontal, Newspaper, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { HUES } from "@/lib/hues"
import useCarrousel from "@/hooks/use-carrousel"
import { useGlissement } from "@/hooks/use-glissement"
import { CtaLink, SegmentsProgression } from "@/components/shared"
import { dateLabel } from "@/lib/dates"
import { fmtVus } from "@/lib/query-helpers"
import { DUREE_UNE, joursDepuis, variantsGlissement } from "@/tools/conseils.tools"

export const CarteUneVide = () => (
  <div className="relative w-full max-md:mx-auto max-md:max-w-md">
    <div className="rounded-2xl border border-dashed border-outline-variant/60 bg-white p-10 text-center shadow-soft">
      <Newspaper className="mx-auto size-8 text-muted-foreground/50" aria-hidden />
      <p className="mt-4 font-heading text-lg font-bold text-brand-navy">Aucun conseil à la une</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Les prochains contenus sont en cours de préparation.
      </p>
      <CtaLink to="#bibliotheque" variant="secondary" className="mt-5">
        Explorer la bibliothèque
      </CtaLink>
    </div>
  </div>
)

const CarrouselUne = ({ articles }) => {
  const { idx, setIdx, progression, pause, reprendre } = useCarrousel({
    count: articles.length,
    duree: DUREE_UNE,
  })
  const { direction, onSelect, propsGlissement } = useGlissement({
    count: articles.length, idx, setIdx, pause, reprendre,
  })

  const indexSur = ((idx % articles.length) + articles.length) % articles.length
  const a = articles[indexSur]
  if (!a) return <CarteUneVide />
  const hue = HUES[a.category?.hue] || HUES.sky

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, rotate: 1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={pause}
      onMouseLeave={reprendre}
      className="relative w-full min-w-0 max-md:mx-auto max-md:max-w-md"
    >
      <motion.div
        className="absolute -inset-8 rounded-full blur-3xl"
        animate={{ backgroundColor: `${hue.hex}30` }}
        transition={{ duration: 0.9 }}
        aria-hidden
      />
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, y: [0, -7, 0] }}
        transition={{ delay: 0.9, opacity: { duration: 0.4 }, scale: { duration: 0.4 }, y: { duration: 4.6, repeat: Infinity, ease: "easeInOut" } }}
        className="absolute -top-4 left-5 z-20 inline-flex -rotate-3 items-center gap-1.5 rounded-full bg-brand-orange px-3.5 py-1.5 text-[11px] font-bold text-white shadow-lg sm:-left-4"
      >
        <Newspaper className="size-3" aria-hidden />
        À la une
      </motion.span>
      <motion.span
        key={`lecture-${a.slug}`}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
        transition={{ opacity: { duration: 0.3, delay: 0.1 }, scale: { duration: 0.3, delay: 0.1 }, y: { duration: 5.2, repeat: Infinity, ease: "easeInOut" } }}
        className="absolute -top-3 right-6 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3 py-1.5 text-[11px] font-bold text-brand-navy shadow-soft"
      >
        <Clock className="size-3 text-brand-orange" aria-hidden />
        {a.reading_minutes} min de lecture
      </motion.span>
      <motion.span
        key={`vus-${a.slug}`}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
        transition={{ opacity: { duration: 0.3, delay: 0.2 }, scale: { duration: 0.3, delay: 0.2 }, y: { duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 0.6 } }}
        className="absolute -bottom-4 right-8 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3.5 py-1.5 text-[11px] font-bold text-emerald-600 shadow-hover"
      >
        <TrendingUp className="size-3" aria-hidden />
        {fmtVus(a.view_count)} lectures
      </motion.span>

      <motion.div
        {...propsGlissement}
        className="relative flex cursor-grab select-none flex-col overflow-hidden rounded-2xl bg-brand-navy text-white shadow-[0_24px_48px_-16px_rgba(15,45,77,0.35)] active:cursor-grabbing"
      >
        <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />
        <motion.div
          className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full blur-3xl"
          animate={{ backgroundColor: `${hue.hex}3d` }}
          transition={{ duration: 0.9 }}
          aria-hidden
        />

        <div className="relative px-6 pt-5">
          <SegmentsProgression
            count={articles.length}
            idx={indexSur}
            progression={progression}
            onSelect={onSelect}
            tone="dark"
            labels={articles.map((x) => x.title)}
          />
        </div>

        <div className="relative flex items-center gap-3 border-b border-white/10 px-6 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white font-heading text-[11px] font-black text-white">
            <img src="/logo2.svg" alt="Logo JobAlert CI" className="h-full w-full" loading="lazy" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold">Le brief JobAlert CI</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={a.slug}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.25 }}
                className="truncate text-[11px] text-white/60"
              >
                À la une · {dateLabel(joursDepuis(a.published_at))} · {indexSur + 1}/{articles.length}
              </motion.p>
            </AnimatePresence>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={a.slug}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="shrink-0 text-[11px] font-semibold text-white/60"
            >
              {a.reading_minutes} min
            </motion.span>
          </AnimatePresence>
          <MoveHorizontal className="pointer-coarse:block hidden size-3.5 shrink-0 text-white/40" aria-hidden />
        </div>

        <div className="relative flex min-h-90 flex-1 flex-col sm:min-h-94">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={a.slug}
              custom={direction}
              variants={variantsGlissement}
              initial="entrer"
              animate="visible"
              exit="sortir"
              className="flex flex-1 flex-col px-6 py-6"
            >
              <span className={cn("inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white", hue.solid)}>
                {a.category?.label}
              </span>
              <Link
                to={`/conseils/${a.slug}`}
                className="mt-4 line-clamp-3 font-heading text-2xl font-extrabold leading-snug transition-colors duration-300 hover:text-brand-orange sm:text-[1.7rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 rounded-sm"
              >
                {a.title}
              </Link>
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/70">{a.excerpt}</p>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/10 pt-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-full bg-white/10 text-[10px] font-black ring-1 ring-white/20">
                    RC
                  </span>
                  <div>
                    <p className="text-xs font-bold">La rédaction</p>
                    <p className="text-[10px] text-white/50">Analystes marché · JobAlert CI</p>
                  </div>
                </div>
                <Link
                  to={`/conseils/${a.slug}`}
                  className="group inline-flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2.5 text-xs font-bold text-white transition-all duration-300 hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  Lire l'article
                  <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}

const CarteUne = ({ articles }) =>
  articles.length ? <CarrouselUne articles={articles} /> : <CarteUneVide />

export default CarteUne