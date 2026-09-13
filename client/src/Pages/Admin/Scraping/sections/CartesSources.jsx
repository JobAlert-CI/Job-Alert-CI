import { motion } from "framer-motion"
import { Globe, TriangleAlert } from "lucide-react"
import { cn } from "cn"
import { useAdminScrapingStatusQuery } from "@/features/admin-scraping.tools"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { SectionErreur, SectionVide } from "../components/EtatsSection"
import { dureeLisible, dateHeure, ilYA } from "../components/statuts-scraping"


const LIBELLE_STATUT_SOURCE = {
  success: ["Réussi", "secondary"],
  running: ["En cours", "default"],
  pending: ["En attente", "outline"],
  partial_failure: ["Échec partiel", "destructive"],
  failed: ["Échec", "destructive"],
}

/* Liseré latéral = signal de statut sans lire le badge. */
const LISERE_STATUT = {
  success: "border-l-emerald-500",
  running: "border-l-brand-navy",
  pending: "border-l-brand-navy",
  partial_failure: "border-l-destructive",
  failed: "border-l-destructive",
}

const VARIANTS_GRILLE = {
  cache: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

const VARIANTS_CARTE = {
  cache: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}

const CarteSource = ({ source }) => {
  const [libelle, variante] = LIBELLE_STATUT_SOURCE[source.last_status] ?? [source.last_status ?? "Jamais", "outline"]
  const duree = dureeLisible(source.last_duration_ms, null, null)
  const dernierPassage = dateHeure(source.last_run_at)

  return (
    <motion.article
      variants={VARIANTS_CARTE}
      aria-label={`Source ${source.source_name}`}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border border-l-[3px] border-l-border bg-card p-4 shadow-soft",
        source.last_status && LISERE_STATUT[source.last_status]
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-navy text-brand-orange" aria-hidden="true">
            <Globe className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{source.source_name}</p>
            <p className="font-mono text-[10px] text-muted-foreground">{source.source_code}</p>
          </div>
        </div>
        <Badge variant={source.last_status ? variante : "outline"} >
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
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 wrap-break-word">{source.last_error}</span>
        </p>
      )}
    </motion.article>
  )
}

const CartesSources = () => {
  const { data, isLoading, isError, refetch } = useAdminScrapingStatusQuery()
  const sourcesOk = (data ?? []).filter((s) => s.last_status === "success").length

  return (
    <SectionCardAdmin
      title="Sources surveillées"
      description="Dernier passage, durée et dernière erreur de chaque source scrapée."
      icon={Globe}
      badge={
        data?.length > 0 && (
          <Badge variant="secondary">
            {sourcesOk}/{data.length} réussies
          </Badge>
        )
      }
    >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger l'état des sources." />
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : !data?.length ? (
        <SectionVide message="Aucune source configurée. Lancez le seed des sources (npm run seed:scraper-sources)." />
      ) : (
        /* Apparition en cascade des cartes à l'arrivée des données. */
        <motion.div
          variants={VARIANTS_GRILLE}
          initial="cache"
          animate="visible"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {data.map((source) => (
            <CarteSource key={source.source_code} source={source} />
          ))}
        </motion.div>
      )}
    </SectionCardAdmin>
  )
}

export default CartesSources