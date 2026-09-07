import { useMemo } from "react"
import {
  useAdminScrapingStatusQuery,
  useAdminScrapingSummaryQuery,
  useAdminScrapingRunsQuery,
  STATUTS_ACTIFS,
} from "@/features/admin-scraping.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { dureeLisible } from "../components/statuts-scraping"

/* ─────────────────────────────────────────────────────────────────────
   Compteurs du haut de la page Scraping (cycle 10, option A+B).

   Sélection validée par l'utilisateur :
   - Sources OK (x/N)        ← /status (déjà chargé par les cartes) ;
   - Durée moy. 10 derniers  ← /runs limit 10 (même queryKey que
                               l'historique → zéro appel en plus) ;
   - Offres collectées       ← /stats/summary all-time (endpoint créé
                               pour ce cycle) ;
   - Taux de réussite         ← /stats/summary (runs terminés).

   Aucun appel réseau supplémentaire pour les 2 premiers : ils
   dérivent des requêtes déjà présentes sur la page.
   ───────────────────────────────────────────────────────────────────── */

const CompteursScraping = () => {
  const { data: sources, isLoading: sourcesChargement } = useAdminScrapingStatusQuery()
  const { data: runs, isLoading: runsChargement } = useAdminScrapingRunsQuery({ limit: 10 })
  const { data: summary, isLoading: summaryChargement } = useAdminScrapingSummaryQuery()

  const sourcesOk = useMemo(
    () => (sources ?? []).filter((s) => s.last_status === "success").length,
    [sources]
  )
  const totalSources = sources?.length ?? 0

  // Durée moyenne des 10 derniers runs TERMINÉS (fenêtre honnête).
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
        label="Sources OK"
        valeur={sourcesOk}
        texte={`${sourcesOk}/${totalSources}`}
        chargement={sourcesChargement}
      />
      <CarteCompteur
        label="Durée moy. (10 derniers runs)"
        valeur={dureeMoyenne ?? 0}
        texte={dureeMoyenne !== null ? dureeLisible(dureeMoyenne) : "—"}
        chargement={runsChargement}
      />
      <CarteCompteur
        label="Offres collectées (all-time)"
        valeur={summary?.total_raw_all_time}
        chargement={summaryChargement}
      />
      <CarteCompteur
        label="Taux de réussite"
        valeur={summary?.success_rate ?? 0}
        texte={summary?.success_rate == null ? "—" : `${summary.success_rate} %`}
        chargement={summaryChargement}
      />
    </div>
  )
}

export default CompteursScraping
