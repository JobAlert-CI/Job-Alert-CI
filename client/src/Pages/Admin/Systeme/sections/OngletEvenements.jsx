import { memo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, ChevronRight, Loader2, RefreshCw, ScrollText } from "lucide-react"
import { cn } from "cn"
import { useSystemeEvenementsQuery } from "@/features/admin-systeme.tools"
import { useFiltresSysteme } from "@/contexts/FiltresSysteme.context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { SectionErreur, SectionAucunResultat } from "../components/EtatsSection"
import BtnAction from "@/components/admin/BtnAction"


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

const formatNombre = (v) => (v ?? 0).toLocaleString("fr-FR")

const dateHeure = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return (
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  )
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
CarteEvenement.displayName = "CarteEvenement"

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

  const evenements = data?.events ?? []
  const total = data?.total ?? 0
  const pageMax = Math.max(1, Math.ceil(total / 50))
  const filtresActifs = !!source || !!severity || days !== 7


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
          <Button variant="ghost" size="sm" className="text-xs" onClick={reinitialiserEvenements}>
            Réinitialiser
          </Button>
        )}

        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
          {formatNombre(total)} événement{total > 1 ? "s" : ""} sur la fenêtre
        </span>
      </div>

      {/* ─── Fondu enchaîné au changement de filtres / page / état ─── */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${source}-${severity}-${days}-${page}-${isLoading ? "chargement" : isError ? "erreur" : "donnees"}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {isError ? (
            <div className="p-4">
              <SectionErreur onRetry={refetch} message="Impossible de charger les événements système." />
            </div>
          ) : isLoading ? (
            <div className="flex flex-col gap-2 p-4" aria-busy="true">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
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

              {/* Pagination servie (total exact). */}
              {total > 50 && (
                <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {formatNombre(total)} événement{total > 1 ? "s" : ""} · Page {page} sur {pageMax}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page <= 1}
                      aria-label="Page précédente"
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.min(pageMax, page + 1))}
                      disabled={page >= pageMax}
                      aria-label="Page suivante"
                    >
                      Suivant
                    </Button>
                  </div>
                </nav>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </SectionCardAdmin>
  )
}

export default OngletEvenements