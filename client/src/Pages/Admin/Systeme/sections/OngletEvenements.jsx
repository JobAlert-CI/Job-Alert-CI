import { memo, useRef, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { CheckCircle2, ChevronRight, Loader2, RefreshCw, ScrollText } from "lucide-react"
import { cn } from "cn"
import { useSystemeEvenementsQuery } from "@/features/admin-systeme.tools"
import { useFiltresSysteme } from "@/contexts/FiltresSysteme.context"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { SectionErreur, SectionAucunResultat, TransitionEtat } from "@/components/admin/EtatsSection"
import BtnAction from "@/components/admin/BtnAction"
import { dateHeure } from "@/lib/dates"
import { formatNombre } from "@/lib/utils"
import Bloc from "@/components/admin/Bloc"
import PaginationListe from "@/components/admin/PaginationListe"

const SOURCES = [
  { valeur: "celery", libelle: "Celery" },
  { valeur: "email", libelle: "Email" },
  { valeur: "scraping", libelle: "Scraping" },
  { valeur: "ia", libelle: "IA" },
  { valeur: "api", libelle: "API" },
]

const SEVERITES = [
  { valeur: "info", libelle: "Info", variante: "secondary", classe: "text-sky-600" },
  { valeur: "warning", libelle: "Avertissement", variante: "secondary", classe: "text-amber-600" },
  { valeur: "error", libelle: "Erreur", variante: "destructive", classe: "text-destructive" },
  { valeur: "critical", libelle: "Critique", variante: "destructive", classe: "text-destructive" },
]

const FENETRES = [
  { valeur: 1, libelle: "24 h" },
  { valeur: 7, libelle: "7 jours" },
  { valeur: 30, libelle: "30 jours" },
  { valeur: 90, libelle: "90 jours" },
]

const LIBELLE_SOURCE = { celery: "Celery", email: "Email", scraping: "Scraping", ia: "IA", api: "API" }

/* Liseré latéral par sévérité — scan visuel immédiat du journal. */
const LISERE_SEVERITE = {
  info: "border-l-sky-400",
  warning: "border-l-amber-500",
  error: "border-l-destructive",
  critical: "border-l-destructive",
}

const VARIANTS_LISTE = {
  cache: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
}

const VARIANTS_CARTE = {
  cache: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
}


/* ── Coloration JSON maison (zéro dépendance) ── */
const TeinteJson = ({ valeur }) => {
  if (valeur === null || valeur === undefined)
    return <span className="italic text-muted-foreground">null</span>
  if (typeof valeur === "boolean")
    return <span className="font-semibold text-violet-700">{String(valeur)}</span>
  if (typeof valeur === "number")
    return <span className="text-amber-700">{valeur.toLocaleString("fr-FR")}</span>
  if (typeof valeur === "string") return <span className="text-emerald-700">"{valeur}"</span>
  return null
}

/** Mini-renderer récursif : clés bleues, chaînes vertes, nombres ambre, booléens violets. */
const JsonView = ({ valeur }) => {
  if (valeur !== null && typeof valeur === "object") {
    const entrees = Object.entries(valeur)
    if (!entrees.length)
      return <span className="text-muted-foreground">{Array.isArray(valeur) ? "[]" : "{}"}</span>
    return (
      <span className="block pl-3">
        {entrees.map(([cle, val]) => (
          <span key={cle} className="block">
            <span className="text-sky-700">{Array.isArray(valeur) ? cle : `"${cle}"`}</span>
            <span className="text-muted-foreground"> : </span>
            <JsonView valeur={val} />
          </span>
        ))}
      </span>
    )
  }
  return <TeinteJson valeur={valeur} />
}

/** Bloc skeleton avec délai décalé (cascade carte par carte). */
const BlocSkel = ({ className, delay = 0 }) => (
  <Skeleton className={className} style={delay ? { animationDelay: `${delay}ms` } : undefined} />
);

/**
 * État de chargement d'une carte d'événement (timeline d'activité).
 * Reprend la géométrie exacte de CarteEvenement :
 *  - même wrapper `border-l-4` (liséré de sévérité) ;
 *  - en-tête : badge sévérité + badge source + event_type mono + date ;
 *  - 2 lignes de message ;
 *  - bouton « Contexte technique » (présent dans ~50 % des événements).
 */
const CarteEvenementSkeleton = ({ avecContexte = true, delay = 0 }) => (
  <li
    className="flex flex-col gap-1.5 rounded-xl border border-border border-l-4 border-l-border bg-card p-3"
    aria-hidden="true"
  >
    {/* En-tête : badge sévérité + source + event_type + date */}
    <div className="flex flex-wrap items-center gap-2">
      <BlocSkel className="h-5 w-20 rounded-full" delay={delay} />
      <BlocSkel className="h-5 w-16 rounded-full" delay={delay} />
      <BlocSkel className="h-2.5 w-24" delay={delay} />
      <BlocSkel className="ml-auto h-2.5 w-28" delay={delay} />
    </div>

    {/* Message : 2 lignes de texte */}
    <div className="space-y-1.5 py-0.5">
      <BlocSkel className="h-2.5 w-full" delay={delay} />
      <BlocSkel className="h-2.5 w-4/5" delay={delay} />
    </div>

    {/* Bouton « Contexte technique » (chevron + libellé) */}
    {avecContexte && (
      <div className="flex items-center gap-1 pt-0.5">
        <BlocSkel className="size-3 rounded-sm" delay={delay} />
        <BlocSkel className="h-2.5 w-28" delay={delay} />
      </div>
    )}
  </li>
);

/* ── Carte événement : liseré sévérité + contexte en accordéon animé ── */
const CarteEvenement = memo(({ evenement }) => {
  const [ouvert, setOuvert] = useState(false)
  const severite = SEVERITES.find((s) => s.valeur === evenement.severity)
  const aContexte = evenement.context && Object.keys(evenement.context).length > 0

  return (
    <motion.li
      variants={VARIANTS_CARTE}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border border-border border-l-4 bg-card p-3",
        LISERE_SEVERITE[evenement.severity] ?? "border-l-border"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={severite?.variante ?? "outline"} className={severite?.classe}>
          {severite?.libelle ?? evenement.severity}
        </Badge>
        <Badge variant="outline">{LIBELLE_SOURCE[evenement.source] ?? evenement.source}</Badge>
        <span className="font-mono text-[10px] text-muted-foreground">{evenement.event_type}</span>
        <span className="ml-auto whitespace-nowrap text-[10px] tabular-nums text-muted-foreground">
          {dateHeure(evenement.created_at)}
        </span>
      </div>

      <p className="text-xs leading-relaxed">{evenement.message}</p>

      {aContexte && (
        <div>
          <button
            type="button"
            onClick={() => setOuvert((o) => !o)}
            aria-expanded={ouvert}
            className="flex items-center gap-1 rounded-sm text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight
              className={cn("size-3 transition-transform duration-200", ouvert && "rotate-90")}
              aria-hidden="true"
            />
            Contexte technique
          </button>

          {/* Hauteur animée (accordéon) au lieu du <details> natif brutal. */}
          <AnimatePresence initial={false}>
            {ouvert && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="overflow-hidden motion-reduce:transition-none"
              >
                <div className="mt-1.5 overflow-x-auto rounded-lg bg-muted/60 p-2.5 font-mono text-[11px] leading-relaxed">
                  <JsonView valeur={evenement.context} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.li>
  )
})

/* État vide positif : pas d'événement = le système va bien. */
const EtatPositif = () => (
  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 p-8 text-center">
    <CheckCircle2 className="size-8 text-emerald-600" aria-hidden="true" />
    <p className="text-sm font-medium text-emerald-700">Aucun événement système sur cette fenêtre</p>
    <p className="max-w-md text-xs text-muted-foreground">
      Bonne nouvelle : aucune task en échec tracée — le pipeline tourne sans accroc.
    </p>
  </div>
)

const OngletEvenements = () => {
  const {
    source, severity, days, page, paramsEvenements,
    setSource, setSeverity, setDays, setPage, reinitialiserEvenements,
  } = useFiltresSysteme()

  const { data, isLoading, isError, isFetching, refetch } = useSystemeEvenementsQuery(paramsEvenements)
  const mouvementReduit = useReducedMotion()

  const evenements = data?.events ?? []
  const total = data?.total ?? 0
  const filtresActifs = !!source || !!severity || days !== 7

  const refEve = useRef(null)
  const changerPageEvenements = (nouvellePage) => {
    setPage(nouvellePage)
    refEve.current?.scrollIntoView({
      behavior: mouvementReduit ? "auto" : "smooth",
      block: "start",
    })
  }

  const pageSuivantePossible = evenements?.length === paramsEvenements.limit

  const etat = isError ? "erreur" : isLoading ? "chargement" : !evenements.length ? "vide" : "donnees"

  return (
    <SectionCardAdmin
      title="Journal des événements"
      description="Échecs de tasks Celery, d'envois d'emails et du pipeline IA tracés en base (audit 4, G.1) — purge automatique à 90 jours."
      icon={ScrollText}
      contentClassName="p-0 sm:p-0"
      action={
        <BtnAction variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-3.5" aria-hidden="true" />
          )}
          {isFetching ? "Chargement…" : "Rafraîchir"}
        </BtnAction>
      }
    >
      {/* ─── Filtres : source / sévérité / fenêtre (URL-synchronisés) ─── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        {/* Sentinelles « toutes » : Radix refuse la valeur vide. */}
        <Select value={source || "toutes"} onValueChange={(v) => setSource(v === "toutes" ? "" : v)}>
          <SelectTrigger className="h-8 w-40 text-xs" aria-label="Filtrer par source">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="toutes">Toutes les sources</SelectItem>
            {SOURCES.map((s) => <SelectItem key={s.valeur} value={s.valeur}>{s.libelle}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={severity || "toutes"} onValueChange={(v) => setSeverity(v === "toutes" ? "" : v)}>
          <SelectTrigger className="h-8 w-44 text-xs" aria-label="Filtrer par sévérité">
            <SelectValue placeholder="Sévérité" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="toutes">Toutes sévérités</SelectItem>
            {SEVERITES.map((s) => <SelectItem key={s.valeur} value={s.valeur}>{s.libelle}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="h-8 w-32 text-xs" aria-label="Fenêtre temporelle">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FENETRES.map((f) => <SelectItem key={f.valeur} value={String(f.valeur)}>{f.libelle}</SelectItem>)}
          </SelectContent>
        </Select>

        {filtresActifs && (
          <BtnAction variant="outline" size="xs" className="text-xs" onClick={reinitialiserEvenements}>
            Réinitialiser
          </BtnAction>
        )}

        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
          {formatNombre(total)} événement{total > 1 ? "s" : ""} sur la fenêtre
        </span>
      </div>

      {/* ─── Fondu enchaîné au changement de filtres / page / état ─── */}
      <Bloc>
        <TransitionEtat etat={etat} >
          {isError ? (
            <div className="p-4">
              <SectionErreur onRetry={refetch} message="Impossible de charger les événements système." />
            </div>
          ) : isLoading ? (
            <ul className="flex flex-col gap-2 p-4" role="status" aria-label="Chargement de la timeline">
              {Array.from({ length: 5 }, (_, i) => (
                <CarteEvenementSkeleton
                  key={i}
                  avecContexte={i % 2 === 0}
                  delay={i * 80}
                />
              ))}
            </ul>
          ) : !evenements.length ? (
            <div className="p-4">
              {filtresActifs ? (
                <SectionAucunResultat
                  message="Aucun événement ne correspond aux filtres."
                  onReset={reinitialiserEvenements}
                />
              ) : (
                <EtatPositif />
              )}
            </div>
          ) : (
            <>
              <motion.ol
                variants={VARIANTS_LISTE}
                initial="cache"
                animate="visible"
                aria-label="Événements système"
                className="flex list-none flex-col gap-2 p-4"
              >
                {evenements.map((evenement) => (
                  <CarteEvenement key={evenement.id} evenement={evenement} />
                ))}
              </motion.ol>

              {!isFetching && (
                <PaginationListe page={page} pagePleine={pageSuivantePossible} total={total} onPageChange={changerPageEvenements} className="p-2 border-t" />
              )}
            </>
          )}
        </TransitionEtat>
      </Bloc>
    </SectionCardAdmin>
  )
}

export default OngletEvenements