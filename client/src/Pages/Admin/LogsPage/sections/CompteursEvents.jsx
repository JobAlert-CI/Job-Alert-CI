import { Activity, AlertCircle, AlertTriangle, CopyCheck } from "lucide-react"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { useLogsStatsQuery } from "@/features/admin-logs.tools"

const CompteursEvents = () => {
  const { data: stats, isError, refetch } = useLogsStatsQuery(30)
  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"} >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques." />
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <CarteCompteur label="Total événements" valeur={stats?.events_total ?? 0} icone={Activity} />
          <CarteCompteur label="Erreurs" valeur={stats?.events_errors ?? 0} icone={AlertCircle} href="/admin/logs" query="?niveau=error" />
          <CarteCompteur label="Avertissements" valeur={stats?.events_warnings ?? 0} icone={AlertTriangle} href="/admin/logs" query="?niveau=warning" />
          <CarteCompteur label="Doublons détectés" valeur={stats?.events_duplicates ?? 0} icone={CopyCheck} />
        </div>
      )}
    </TransitionEtat>
  )
}

export default CompteursEvents