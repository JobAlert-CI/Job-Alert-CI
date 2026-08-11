// src/pages/conseils/components/Sidebar.jsx
import { useMemo } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Bell, BookOpen, Clock, Flame } from "lucide-react"
import { cn } from "@/lib/utils"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { HUES } from "@/lib/hues"
import { CtaLink, ReassuranceList } from "@/components/shared"
import { fmtVus } from "@/lib/query-helpers"
import { dateLabel } from "@/lib/dates"
import { REASSURANCES } from "@/data/constanteMetier"
import { joursDepuis, useArticlesQuery, usePopularQuery, useSeriesQuery } from "@/tools/conseils.tools"
import { ListeSkeleton } from "./SkeletonsConseils"

/* ─────────────── Les plus lus — autonome, avec repli sur la liste complète ─────────────── */
export const PlusLus = () => {
  const popular = usePopularQuery()
  const { data: articles } = useArticlesQuery()

  const top = useMemo(() => {
    if (popular.data.length) return popular.data
    return [...articles]
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
      .slice(0, 5)
  }, [popular.data, articles])

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-white p-5 shadow-soft">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <Flame className="size-3.5 text-brand-orange" aria-hidden />
        Les plus lus
      </p>

      {popular.isPending && top.length === 0 ? (
        <ListeSkeleton rows={5} className="mt-4" />
      ) : top.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Aucun conseil disponible pour le moment.
        </p>
      ) : (
        <ol className="mt-4 space-y-1">
          {top.map((a, i) => {
            const hue = HUES[a.category?.hue] || HUES.sky
            return (
              <HoverCard key={a.slug ?? a.id} openDelay={200}>
                <HoverCardTrigger asChild>
                  <li>
                    <Link
                      to={`/conseils/${a.slug}`}
                      className="group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="font-heading text-lg font-black leading-none text-brand-navy/15 transition-colors group-hover:text-brand-orange/40">
                        0{i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-on-surface transition-colors group-hover:text-brand-orange">
                          {a.title}
                        </p>
                        <p className="mt-0.5 flex items-center gap-2 text-[10px] font-semibold text-muted-foreground">
                          <span className={cn("size-1.5 rounded-full", hue.dot)} aria-hidden />
                          {a.category?.label} · {fmtVus(a.view_count)} lectures
                        </p>
                      </div>
                    </Link>
                  </li>
                </HoverCardTrigger>
                <HoverCardContent align="start" className="w-72">
                  {/* Corrigé : l'API expose `title`, pas `titre` */}
                  <p className="font-heading text-sm font-bold text-brand-navy">{a.title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{a.excerpt}</p>
                  <p className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                    <Clock className="size-3 text-brand-orange" aria-hidden />
                    {a.reading_minutes} min · {dateLabel(joursDepuis(a.published_at))}
                  </p>
                </HoverCardContent>
              </HoverCard>
            )
          })}
        </ol>
      )}
    </div>
  )
}

/* ─────────────── Séries à suivre — autonome ─────────────── */
export const SeriesListe = () => {
  const { data: series, isPending } = useSeriesQuery()

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-white p-5 shadow-soft">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <BookOpen className="size-3.5 text-brand-orange" aria-hidden />
        Séries à suivre
      </p>

      {isPending && series.length === 0 ? (
        <ListeSkeleton rows={2} className="mt-4" />
      ) : series.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Aucune série proposée pour le moment.
        </p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {series.map((s) => {
            const hue = HUES[s.hue] || HUES.sky
            const aProgression =
              typeof s.lus === "number" && typeof s.total === "number" && s.total > 0
            return (
              <Link
                key={s.id}
                to="/conseils"
                className="group block rounded-lg border border-outline-variant/50 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-navy/30 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-bold text-brand-navy transition-colors group-hover:text-brand-orange">
                    {s.title}
                  </p>
                  <ArrowRight className="size-3.5 shrink-0 text-outline-variant transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand-orange" aria-hidden />
                </div>
                {aProgression ? (
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-container">
                      <div className={cn("h-full rounded-full", hue.solid)} style={{ width: `${(s.lus / s.total) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {s.lus}/{s.total}
                    </span>
                  </div>
                ) : (
                  <p className="mt-2.5 line-clamp-2 text-xs text-muted-foreground">
                    {s.description || "Une série de conseils JobAlert CI."}
                  </p>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─────────────── Mini-alerte — statique, visible en desktop ─────────────── */
export const MiniAlerte = () => (
  <div className="relative overflow-hidden rounded-xl bg-brand-navy p-5 text-white max-lg:hidden">
    <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />
    <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-brand-orange/20 blur-3xl" aria-hidden />
    <div className="relative">
      <span className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em]">
        <Bell className="size-3" aria-hidden />
        Le brief quotidien
      </span>
      <p className="mt-3 font-heading text-lg font-extrabold leading-snug">
        1 conseil + vos offres, chaque matin à <span className="text-brand-orange">8h00</span>.
      </p>
      <CtaLink to="/inscription" size="md" icon={Bell} animateIcon className="mt-4 w-full">
        Créer mon alerte
      </CtaLink>
      <div className="mt-3.5 border-t border-white/10 pt-3.5">
        <ReassuranceList items={REASSURANCES} tone="dark" className="gap-x-4 gap-y-1.5" />
      </div>
    </div>
  </div>
)