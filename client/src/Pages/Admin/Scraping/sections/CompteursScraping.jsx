import { useMemo } from "react"
import { Globe, Package, Target, Timer } from "lucide-react"
import {
  useAdminScrapingStatusQuery,
  useAdminScrapingSummaryQuery,
  useAdminScrapingRunsQuery,
  STATUTS_ACTIFS,
} from "@/features/admin-scraping.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { dureeLisible } from "../components/statuts-scraping"


const CompteursScraping = () => {
  const { data: sources } = useAdminScrapingStatusQuery()
  const { data: runs } = useAdminScrapingRunsQuery({ limit: 10 })
  const { data: summary } = useAdminScrapingSummaryQuery()

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

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <CarteCompteur
        label="Sources opérationnelles"
        valeur={sourcesOk}
        suffixe={`/${totalSources}`}
        icone={Globe}
      />
      <CarteCompteur
        label="Durée moy. (10 derniers runs)"
        valeur={dureeMoyenne ?? 0}
        suffixe={dureeMoyenne !== null ? `ms (${dureeLisible(dureeMoyenne)})` : ""}
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
        texte={summary?.success_rate == null ? "—" : `${summary.success_rate} %`}
        icone={Target}
      />
    </div>
  )
}

export default CompteursScraping