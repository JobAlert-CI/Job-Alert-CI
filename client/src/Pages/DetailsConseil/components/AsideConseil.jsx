// src/pages/conseils/detail/components/AsideConseil.jsx
import { memo, useMemo } from "react"
import { Link } from "react-router-dom"
import { Bell, RefreshCw, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { CtaLink, Sommaire } from "@/components/shared"
import { fmtVus } from "@/lib/query-helpers"
import { useConseilDetail } from "@/contexts/DetailsConseil.context"
import { Skel } from "./Etats"

/* ─────────────── Suggestions — chargement/erreur/vide délégués ─────────────── */
const MemeTheme = () => {
  const { hue, similar, similarQuery } = useConseilDetail()

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-white p-5 shadow-soft">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <Sparkles className="size-3.5 text-brand-orange" aria-hidden />
        Sur le même thème
      </p>

      {similarQuery.isPending ? (
        <>
          <span className="sr-only" role="status">Chargement des suggestions…</span>
          <div className="mt-4 space-y-3" aria-hidden="true">
            {[0, 1, 2].map((i) => <Skel key={`suggestion-skel-${i}`} className="h-12 w-full rounded-lg" />)}
          </div>
        </>
      ) : similarQuery.isError ? (
        <>
          <p className="mt-4 text-xs text-muted-foreground">
            Les suggestions ne peuvent pas être chargées pour le moment.
          </p>
          <button
            type="button"
            onClick={() => similarQuery.refetch()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-brand-navy/20 px-4 py-2 text-xs font-bold text-brand-navy transition-all hover:border-brand-navy hover:bg-brand-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Recharger
          </button>
        </>
      ) : similar.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Pas encore d'autres conseils sur ce thème.
        </p>
      ) : (
        <ul className="mt-4 space-y-1">
          {similar.map((x) => (
            <HoverCard key={x.slug} openDelay={200}>
              <HoverCardTrigger asChild>
                <li>
                  <Link
                    to={`/conseils/${x.slug}`}
                    className="group flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", hue.dot)} aria-hidden />
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-on-surface transition-colors group-hover:text-brand-orange">
                        {x.titre}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                        {x.lecture} min · {fmtVus(x.vus)} lectures
                      </p>
                    </div>
                  </Link>
                </li>
              </HoverCardTrigger>
              <HoverCardContent align="start" className="w-72">
                <p className="text-xs leading-relaxed text-muted-foreground">{x.extrait}</p>
              </HoverCardContent>
            </HoverCard>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ─────────────── Mini-alerte ─────────────── */
const MiniAlerte = memo(function MiniAlerte() {
  const { cat, hue } = useConseilDetail()
  return (
    <div className="relative overflow-hidden rounded-xl bg-brand-navy p-5 text-white">
      <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />
      <div className={cn("pointer-events-none absolute -right-16 -top-16 size-56 rounded-full blur-3xl", hue.glow)} aria-hidden />
      <div className="relative">
        <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em]", hue.solid)}>
          <Bell className="size-3" aria-hidden />
          Alerte {cat.label}
        </span>
        <p className="mt-3 font-heading text-lg font-extrabold leading-snug">
          Ces conseils + vos offres, chaque matin à <span className="text-brand-orange">8h00</span>.
        </p>
        <CtaLink to="/inscription" size="md" icon={Bell} animateIcon className="mt-4 w-full">
          Créer mon alerte
        </CtaLink>
        <p className="mt-3 text-center text-[10px] text-white/50">
          Gratuit · 1 email par jour · 1 clic pour partir
        </p>
      </div>
    </div>
  )
})

/* ─────────────── Assemblée : sommaire + suggestions + alerte ─────────────── */
const AsideConseil = () => {
  const { article, contenu } = useConseilDetail()

  const sectionsSommaire = useMemo(
    () => contenu.sections.map((s) => ({ id: s.id, titre: s.titre })),
    [contenu.sections]
  )

  return (
    <aside
      className="sticky top-24 flex flex-col gap-6 self-start max-lg:static"
      aria-label="Sommaire et suggestions"
    >
      {contenu.sections.length > 0 && (
        <Sommaire sections={sectionsSommaire} lecture={article.lecture} className="max-lg:hidden" />
      )}
      <MemeTheme />
      <MiniAlerte />
    </aside>
  )
}

export default AsideConseil