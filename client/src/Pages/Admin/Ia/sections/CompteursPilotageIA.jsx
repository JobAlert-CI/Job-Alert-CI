import { CloudDownload, History, Hourglass, PlayCircle } from "lucide-react"
import { libelleStatutJob, useQueueIaQuery, } from "@/features/admin-ia.tools"
import { Badge } from "@/components/ui/badge"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { dateHeure } from "@/lib/dates"

const CompteursPilotageIA = () => {
  const { data: queue, isError, refetch } = useQueueIaQuery()
  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"} >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques." />
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <CarteCompteur label="En attente" valeur={queue?.pending ?? 0} icone={Hourglass} />
          <CarteCompteur label="En cours" valeur={queue?.running ?? 0} icone={PlayCircle} />
          <CarteCompteur label="Jobs provider en attente" valeur={queue?.pending_ai_jobs ?? 0} icone={CloudDownload} />
          <CarteCompteur
            label="Dernier sweep"
            texte={dateHeure(queue?.last_sweep_at)}
            icone={History}
            description={
              <Badge variant={queue?.last_sweep_status === "failed" ? "destructive" : "secondary"} className="mt-1">
                {libelleStatutJob(queue?.last_sweep_status)}
              </Badge>
            }
          />
        </div>
      )}
    </TransitionEtat>
  )
}

export default CompteursPilotageIA