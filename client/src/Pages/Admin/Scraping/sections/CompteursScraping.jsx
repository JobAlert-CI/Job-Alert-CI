import { useMemo } from "react"
import { Globe, Package, Target, Timer } from "lucide-react"
import {
  useAdminScrapingStatusQuery,
  useAdminScrapingSummaryQuery,
  useAdminScrapingRunsQuery,
  STATUTS_ACTIFS,
} from "@/features/admin-scraping.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { sufixDuree } from "../components/statuts-scraping"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"


const CompteursScraping = () => {
  const { data: sources, isError: isErrorSources, refetch: refetchSources } = useAdminScrapingStatusQuery()
  const { data: runs, isError: isErrorRuns, refetch: refetchRuns } = useAdminScrapingRunsQuery({ limit: 10 })
  const { data: summary, isError: isErrorSummary, refetch: refetchSummary } = useAdminScrapingSummaryQuery()

  const sourcesOk = useMemo(
    () => (sources ?? []).filter((s) => s.last_status === "success").length,
    [sources]
  )
  const totalSources = sources?.length ?? 0

  /* Durée moyenne des 10 derniers runs TERMINÉS (fenêtre honnête). */
  const dureeMoyenne = useMemo(() => {
    const terminees = (runs ?? [])
      .filter((r) => !STATUTS_ACTIFS.includes(r?.status))
      .map((r) => (r.finished_at && r.started_at ? new Date(r.finished_at) - new Date(r.started_at) : null))
      .filter((ms) => ms !== null && !Number.isNaN(ms))
    if (!terminees.length) return null
    return Math.round(terminees.reduce((a, b) => a + b, 0) / terminees.length)
  }, [runs])

  const isError = isErrorSources || isErrorRuns || isErrorSummary

  const refetch = () => {
    refetchSources()
    refetchRuns({ limit: 10 })
    refetchSummary()
  }

  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"} >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger ces données." />
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <CarteCompteur
            label="Sources opérationnelles"
            valeur={sourcesOk}
            suffixe={`/${totalSources}`}
            icone={Globe}
          />
          <CarteCompteur
            label="Durée moy. (10 derniers runs)"
            valeur={sufixDuree(dureeMoyenne)[0] ?? 0}
            suffixe={sufixDuree(dureeMoyenne)[1]}
            icone={Timer}
          />
          <CarteCompteur
            label="Offres collectées (all-time)"
            valeur={summary?.total_raw_all_time}
            icone={Package}
          />
          <CarteCompteur
            label="Taux de réussite"
            valeur={summary?.success_rate ?? 0}
            suffixe="%"
            icone={Target}
          />
        </div>
      )}
    </TransitionEtat>
  )
}

export default CompteursScraping