import { useMemo } from "react"
import { ChevronRight, Inbox, RefreshCw, ScrollText } from "lucide-react"
import { useSystemeEvenementsQuery } from "@/features/admin-systeme.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { SectionErreur } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Événements système (audit 4, G.1 — Lot 6).

   Journal des échecs et événements ops tracés par log_system_event()
   dans les tasks Celery (digests, emails, IA, maintenance) : la réponse
   à « pourquoi le digest de ce matin a échoué » sans SSH ni logs Render.

   GET /api/admin/system/events — enveloppe paginée honnête
   { total, limit, days, events[] }, plus récents en tête.
   Filtres : source (celery|email|scraping|ia|api), severity
   (info|warning|error|critical), fenêtre days (≤ 90).
   ⚠ 400 explicite sur valeur inconnue (pas de liste vide trompeuse).

   Pas de polling : volume faible par construction (échecs seulement),
   rafraîchissement manuel / changement de filtres.
   ───────────────────────────────────────────────────────────────────── */

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

const dateHeure = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

const OngletEvenements = ({ source, severity, days, page, onChangement }) => {
  // Miroir strict des Query params serveur (limit 50, offset paginé).
  const params = useMemo(
    () => ({
      source: source || undefined,
      severity: severity || undefined,
      days,
      limit: 50,
      offset: (page - 1) * 50,
    }),
    [source, severity, days, page]
  )

  const { data, isLoading, isError, isFetching, refetch } = useSystemeEvenementsQuery(params)

  const evenements = data?.events ?? []
  const total = data?.total ?? 0
  // Pagination honnête : le total est servi par l'endpoint.
  const pageMax = Math.max(1, Math.ceil(total / 50))

  return (
    <div className="flex flex-col gap-4">
      {/* ─── En-tête + rafraîchissement manuel ─── */}
      <section aria-label="En-tête événements système" className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-sm font-bold">
            <ScrollText className="size-4 text-primary" aria-hidden /> Journal des événements
          </h2>
          <p className="text-xs text-muted-foreground">
            Échecs de tasks Celery, d'envois d'emails et du pipeline IA tracés en base (audit 4, G.1) —
            purge automatique à 90 jours.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? "animate-spin" : undefined} aria-hidden />
          {isFetching ? "Chargement…" : "Rafraîchir"}
        </Button>
      </section>

      {/* ─── Filtres : source / sévérité / fenêtre ─── */}
      <section aria-label="Filtres événements" className="flex flex-wrap items-center gap-2">
        <select
          value={source}
          onChange={(e) => onChangement({ source: e.target.value, page: 1 })}
          aria-label="Filtrer par source"
          className="h-9 rounded-md border border-border bg-background px-2 text-xs"
        >
          <option value="">Toutes les sources</option>
          {SOURCES.map((s) => (
            <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => onChangement({ severity: e.target.value, page: 1 })}
          aria-label="Filtrer par sévérité"
          className="h-9 rounded-md border border-border bg-background px-2 text-xs"
        >
          <option value="">Toutes sévérités</option>
          {SEVERITES.map((s) => (
            <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
          ))}
        </select>
        <select
          value={days}
          onChange={(e) => onChangement({ days: Number(e.target.value), page: 1 })}
          aria-label="Fenêtre temporelle"
          className="h-9 rounded-md border border-border bg-background px-2 text-xs"
        >
          {FENETRES.map((f) => (
            <option key={f.valeur} value={f.valeur}>{f.libelle}</option>
          ))}
        </select>
        <span className="text-[11px] text-muted-foreground" aria-live="polite">
          {total} événement{total > 1 ? "s" : ""} sur la fenêtre
        </span>
      </section>

      {/* ─── Liste ─── */}
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les événements système." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : !evenements.length ? (
        <Empty className="rounded-xl border border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
            <EmptyTitle>Aucun événement</EmptyTitle>
            <EmptyDescription>
              Aucun événement système sur cette fenêtre — bonne nouvelle : aucune task en échec tracée.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ol className="flex flex-col gap-2" aria-label="Événements système">
          {evenements.map((evenement) => {
            const severite = SEVERITES.find((s) => s.valeur === evenement.severity)
            return (
              <li
                key={evenement.id}
                className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={severite?.variante ?? "outline"} className={severite?.classe}>
                    {severite?.libelle ?? evenement.severity}
                  </Badge>
                  <Badge variant="outline">{LIBELLE_SOURCE[evenement.source] ?? evenement.source}</Badge>
                  <span className="font-mono text-[10px] text-muted-foreground">{evenement.event_type}</span>
                  <span className="ml-auto text-[10px] whitespace-nowrap text-muted-foreground tabular-nums">
                    {dateHeure(evenement.created_at)}
                  </span>
                </div>
                <p className="text-xs leading-relaxed">{evenement.message}</p>
                {evenement.context && Object.keys(evenement.context).length > 0 && (
                  <details className="group">
                    <summary className="flex cursor-pointer items-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                      <ChevronRight className="size-3 transition-transform group-open:rotate-90" aria-hidden />
                      Contexte technique
                    </summary>
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-muted p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                      {JSON.stringify(evenement.context, null, 2)}
                    </pre>
                  </details>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {/* ─── Pagination servie (total exact) ─── */}
      {!isLoading && total > 50 && (
        <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground tabular-nums">
            {total} événement{total > 1 ? "s" : ""} · Page {page} sur {pageMax}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChangement({ page: Math.max(1, page - 1) })}
              disabled={page <= 1}
              aria-label="Page précédente"
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChangement({ page: Math.min(pageMax, page + 1) })}
              disabled={page >= pageMax}
              aria-label="Page suivante"
            >
              Suivant
            </Button>
          </div>
        </nav>
      )}
    </div>
  )
}

export default OngletEvenements
