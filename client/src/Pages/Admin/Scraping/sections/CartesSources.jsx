import { Globe, History, TriangleAlert } from "lucide-react"
import { useAdminScrapingStatusQuery } from "@/features/admin-scraping.tools"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionErreur, SectionVide } from "../components/EtatsSection"
import { dureeLisible, dateHeure, ilYA } from "../components/statuts-scraping"

/* ─────────────────────────────────────────────────────────────────────
   Section 2 — Carte par source (doc v3 §10) : dernier passage,
   durée, dernière erreur, nombre total de runs.

   GET /api/admin/scraping/status → liste ScrapingStatusRead
   (source_code, source_name, last_run_at, last_status,
   last_duration_ms, last_error, total_runs) — UNE source = UNE carte,
   y compris les sources jamais scrapées (last_* null → « jamais »).
   ───────────────────────────────────────────────────────────────────── */

const LIBELLE_STATUT_SOURCE = {
  success: ["Réussi", "secondary"],
  running: ["En cours", "default"],
  pending: ["En attente", "outline"],
  partial_failure: ["Échec partiel", "destructive"],
  failed: ["Échec", "destructive"],
}

const CarteSource = ({ source }) => {
  const [libelle, variante] = LIBELLE_STATUT_SOURCE[source.last_status] ?? [source.last_status ?? "Jamais", "outline"]
  const duree = dureeLisible(source.last_duration_ms, null, null)
  const dernierPassage = dateHeure(source.last_run_at)

  return (
    <article
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label={`Source ${source.source_name}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-primary" aria-hidden />
          <div>
            <p className="text-sm font-semibold leading-tight">{source.source_name}</p>
            <p className="font-mono text-[10px] text-muted-foreground">{source.source_code}</p>
          </div>
        </div>
        <Badge variant={source.last_status ? variante : "outline"}>
          {source.last_status ? libelle : "Jamais scrapée"}
        </Badge>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <div className="col-span-2 flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Dernier passage</dt>
          <dd className="font-medium tabular-nums">
            {dernierPassage ? (
              <>
                {dernierPassage} <span className="text-muted-foreground">({ilYA(source.last_run_at)})</span>
          </>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Durée</dt>
          <dd className="font-medium tabular-nums">{duree ?? "—"}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Runs totaux</dt>
          <dd className="font-medium tabular-nums">{source.total_runs}</dd>
        </div>
      </dl>

      {source.last_error && (
        <p
          role="alert"
          className="flex items-start gap-1.5 rounded-lg border border-destructive/20 bg-destructive/5 px-2 py-1.5 text-xs text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">{source.last_error}</span>
        </p>
      )}
    </article>
  )
}

const CartesSources = () => {
  const { data, isLoading, isError, refetch } = useAdminScrapingStatusQuery()

  return (
    <section aria-label="État des sources" className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-heading text-sm font-semibold">
        <History className="size-4 text-primary" aria-hidden />
        Sources surveillées
      </h2>

      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger l'état des sources." />
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : !data?.length ? (
        <SectionVide message="Aucune source configurée. Lancez le seed des sources (npm run seed:scraper-sources)." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((source) => (
            <CarteSource key={source.source_code} source={source} />
          ))}
        </div>
      )}
    </section>
  )
}

export default CartesSources
