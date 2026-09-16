import { memo, useState } from "react"
import { Link } from "react-router-dom"
import { motion, useReducedMotion } from "framer-motion"
import { Eye, Star, TrendingUp } from "lucide-react"
import { useAdminTopViewedQuery } from "@/features/admin-dashboard.tools"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SectionErreur, SectionVide, TransitionEtat } from "@/components/admin/EtatsSection"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { usePeutVoirEnvois } from "@/features/admin-matching.tools"

const FENETRES = [
  { valeur: 7, libelle: "7 jours" },
  { valeur: 30, libelle: "30 jours" },
]

const formatNombre = (v) => (v ?? 0).toLocaleString("fr-FR")

/** Initiales de l'entreprise pour l'avatar (ex. "TransCargo CI" → "TC"). */
const initiales = (nom = "") =>
  nom.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join("").toUpperCase() || "•"

/** État local de la fenêtre (7 / 30 jours) — useState simple, pas de global. */
const useFenetreVues = () => {
  const [days, setDays] = useState(7)
  return [days, setDays]
}

/* ── Badge de rang : podium sobre (pas de médaille criarde) ──────── */
const BadgeRang = ({ rang }) => {
  if (rang === 1) {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-navy font-heading text-xs font-bold text-brand-orange shadow-soft">
        {rang}
      </span>
    )
  }
  if (rang <= 3) {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-navy/10 font-heading text-xs font-bold text-brand-navy">
        {rang}
      </span>
    )
  }
  return (
    <span className="flex size-7 shrink-0 items-center justify-center text-xs font-medium tabular-nums text-muted-foreground">
      {rang}
    </span>
  )
}

/* ── Barre de popularité relative (navy : contraste AA sur blanc) ── */
const BarreVues = ({ pourcentage, index }) => {
  const mouvementReduit = useReducedMotion()
  return (
    <span aria-hidden="true" className="block h-1 w-20 overflow-hidden rounded-full bg-muted">
      <motion.span
        className="block h-full rounded-full bg-brand-navy"
        initial={mouvementReduit ? { width: `${pourcentage}%` } : { width: "0%" }}
        animate={{ width: `${pourcentage}%` }}
        transition={{ duration: 0.6, delay: 0.04 * index, ease: "easeOut" }}
      />
    </span>
  )
}

/* ── Ligne desktop mémoïsée (inchangée) ──────────────────────────── */
const LigneOffre = memo(({ offre, rang, maxVues }) => {
  const pourcentage = Math.max(4, Math.round(((offre.view_count ?? 0) / maxVues) * 100))
  return (
    <TableRow className="transition-colors hover:bg-muted/50">
      <TableCell className="w-12">
        <BadgeRang rang={rang} />
      </TableCell>
      <TableCell className="max-w-72">
        <Link
          to={`/admin/offres/${offre.id}`}
          title={offre.title}
          className="block truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {offre.title}
        </Link>
        <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden="true"
            className="flex size-5 shrink-0 items-center justify-center rounded bg-brand-navy/10 text-[8px] font-bold text-brand-navy"
          >
            {initiales(offre.company?.name)}
          </span>
          <span className="truncate">{offre.company?.name ?? "Entreprise inconnue"}</span>
        </span>
      </TableCell>
      <TableCell className="text-right">
        <span className="flex flex-col items-end gap-1.5">
          <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
            <Eye className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {formatNombre(offre.view_count)}
          </span>
          <BarreVues pourcentage={pourcentage} index={rang - 1} />
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className="inline-flex items-center gap-1 text-sm">
          <Star className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {formatNombre(offre.save_count)}
        </span>
      </TableCell>
    </TableRow>
  )
})
LigneOffre.displayName = "LigneOffre"

/* ── Carte mobile (miroir de la ligne desktop) ─────────────────────
   Toute la carte est un seul <Link> : cible tactile large + focus
   visible géré par index.css. pl-10 aligne les stats sous le titre
   (rang size-7 + gap-3 = 40px). */
const CarteOffreTopMobile = memo(function CarteOffreTopMobile({ offre, rang, maxVues }) {
  const pourcentage = Math.max(4, Math.round(((offre.view_count ?? 0) / maxVues) * 100))
  return (
    <Link
      to={`/admin/offres/${offre.id}`}
      aria-label={`Voir l'offre « ${offre.title} »`}
      className="block rounded-xl border border-border bg-card p-3 shadow-soft transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start gap-3">
        <BadgeRang rang={rang} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-primary">{offre.title}</p>
          <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              className="flex size-5 shrink-0 items-center justify-center rounded bg-brand-navy/10 text-[8px] font-bold text-brand-navy"
            >
              {initiales(offre.company?.name)}
            </span>
            <span className="truncate">{offre.company?.name ?? "Entreprise inconnue"}</span>
          </span>
        </div>
      </div>
      {/* Vues + barre de popularité / sauvegardes */}
      <div className="mt-2.5 flex items-center justify-between gap-3 pl-10">
        <span className="flex flex-col gap-1.5">
          <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
            <Eye className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {formatNombre(offre.view_count)}
          </span>
          <BarreVues pourcentage={pourcentage} index={rang - 1} />
        </span>
        <span className="inline-flex items-center gap-1 text-sm tabular-nums">
          <Star className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {formatNombre(offre.save_count)}
        </span>
      </div>
    </Link>
  )
})

/* ── SKELETONS FIDÈLES ───────────────────────────────────────────── */

const Bloc = ({ className, delay = 0 }) => (
  <Skeleton className={className} style={delay ? { animationDelay: `${delay}ms` } : undefined} />
)

/* Ligne desktop : rang + titre/entreprise (avec avatar) + vues/barre + saves. */
const SkeletonLigneTop = ({ delay = 0 }) => (
  <div className="flex items-center gap-4 px-4 py-3" aria-hidden="true">
    <Bloc className="size-7 shrink-0 rounded-full" delay={delay} />
    <div className="min-w-0 flex-1 space-y-1.5">
      <Bloc className="h-3.5 w-3/4" delay={delay} />
      <div className="flex items-center gap-1.5">
        <Bloc className="size-5 shrink-0 rounded" delay={delay} />
        <Bloc className="h-2.5 w-1/3" delay={delay} />
      </div>
    </div>
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <Bloc className="h-3.5 w-12" delay={delay} />
      <Bloc className="h-1 w-20 rounded-full" delay={delay} />
    </div>
    <Bloc className="h-3.5 w-8 shrink-0" delay={delay} />
  </div>
)

/* Carte mobile : miroir exact de CarteOffreTopMobile. */
const SkeletonCarteTopMobile = ({ delay = 0 }) => (
  <div className="rounded-xl border border-border bg-card p-3 shadow-soft" aria-hidden="true">
    <div className="flex items-start gap-3">
      <Bloc className="size-7 shrink-0 rounded-full" delay={delay} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Bloc className="h-3.5 w-4/5" delay={delay} />
        <div className="flex items-center gap-1.5">
          <Bloc className="size-5 shrink-0 rounded" delay={delay} />
          <Bloc className="h-2.5 w-1/3" delay={delay} />
        </div>
      </div>
    </div>
    <div className="mt-2.5 flex items-center justify-between gap-3 pl-10">
      <div className="flex flex-col gap-1.5">
        <Bloc className="h-3.5 w-12" delay={delay} />
        <Bloc className="h-1 w-20 rounded-full" delay={delay} />
      </div>
      <Bloc className="h-3.5 w-8" delay={delay} />
    </div>
  </div>
)

const TopOffresSkeleton = ({ nbLignes = 5 }) => {
  const lignes = Array.from({ length: nbLignes }, (_, i) => i)
  return (
    <div role="status" aria-label="Chargement du classement des offres les plus consultées">
      {/* Mobile : cartes */}
      <ul className="flex flex-col gap-2 px-4 py-2 md:hidden" aria-hidden="true">
        {lignes.map((i) => (
          <li key={i}><SkeletonCarteTopMobile delay={i * 80} /></li>
        ))}
      </ul>
      {/* Desktop : lignes */}
      <div className="hidden md:block" aria-hidden="true">
        {lignes.map((i) => <SkeletonLigneTop key={i} delay={i * 80} />)}
      </div>
    </div>
  )
}

/* ── COMPOSANT PRINCIPAL ─────────────────────────────────────────── */
const TopOffres = () => {
  const autorise = usePeutVoirEnvois()
  const [days, setDays] = useFenetreVues()
  const { data, isLoading, isError, refetch } = useAdminTopViewedQuery({ limit: 10, days })  
  const maxVues = Math.max(1, ...(data ?? []).map((o) => o.view_count ?? 0))
  const totalVues = (data ?? []).reduce((acc, o) => acc + (o.view_count ?? 0), 0)

  /* Clé d'état pour la transition — `days` inclus : le fondu joue
     aussi au basculement 7/30 jours. */
  const etat = !autorise
    ? "refuse"
    : isError
      ? "erreur"
      : isLoading
        ? "chargement"
        : !data?.length
          ? "vide"
          : "donnees"

  return (
    <SectionCardAdmin
      title="Offres les plus consultées"
      description={`Classement sur les ${days} derniers jours`}
      icon={TrendingUp}
      badge={
        !isLoading &&
        totalVues > 0 && (
          <Badge variant="secondary" className="tabular-nums font-black">
            {formatNombre(totalVues)} vues
          </Badge>
        )
      }
      contentClassName="p-0 sm:p-0"
      action={
        <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <TabsList className="h-8">
            {FENETRES.map((f) => (
              <TabsTrigger key={f.valeur} value={String(f.valeur)} className="text-xs">
                {f.libelle}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      }
    >
      <TransitionEtat etat={`${days}-${etat}`}>
        {!autorise ? (
          <SectionVide message="Statistiques d'envoi réservées aux super admins et gestionnaires utilisateurs." className="m-4" />
        ) : isError ? (
          <div className="p-4">
            <SectionErreur onRetry={refetch} message="Impossible de charger le top des offres." />
          </div>
        ) : isLoading ? (
          <TopOffresSkeleton nbLignes={5} />
        ) : !data?.length ? (
          <div className="p-4">
            <SectionVide message="Aucune offre consultée sur cette période." />
          </div>
        ) : (
          <>
            {/* ── Mobile : cartes ────────────────────────────── */}
            <ul className="flex flex-col gap-2 px-4 py-2 md:hidden">
              {data.map((offre, i) => (
                <li key={offre.id}>
                  <CarteOffreTopMobile offre={offre} rang={i + 1} maxVues={maxVues} />
                </li>
              ))}
            </ul>

            {/* ── Desktop : tableau ──────────────────────────── */}
            <div className="hidden overflow-x-auto scrollbar-thin md:block">
              <Table>
                <caption className="sr-only">
                  Classement des {data.length} offres les plus consultées sur les {days} derniers jours
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"><span className="sr-only">Rang</span></TableHead>
                    <TableHead>Offre</TableHead>
                    <TableHead className="text-right">Vues</TableHead>
                    <TableHead className="text-right">Sauvegardes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((offre, i) => (
                    <LigneOffre key={offre.id} offre={offre} rang={i + 1} maxVues={maxVues} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </TransitionEtat>
    </SectionCardAdmin>
  )
}

export default TopOffres