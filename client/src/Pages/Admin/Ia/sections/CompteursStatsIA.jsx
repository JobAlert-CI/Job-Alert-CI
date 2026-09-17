import CarteCompteur from "@/components/admin/CarteCompteur"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { useStatsIaQuery } from "@/features/admin-ia.tools"
import { BellRing, Gauge, KeyRound, Layers, Lightbulb, TrendingUp } from "lucide-react"
import { formatNombre } from "@/lib/utils"

const CompteursStatsIA = () => {
  const { data: stats, isError, refetch } = useStatsIaQuery(30)
  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"} >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques." />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <CarteCompteur label="Backlog brut" valeur={stats?.backlog_brut ?? 0} icone={Layers} />
          <CarteCompteur label="Jobs (30 j)" valeur={stats?.jobs_fenetre ?? 0} icone={TrendingUp} />
          <CarteCompteur label="Taux d'activation" valeur={stats?.taux_activation ?? 0} suffixe="%" icone={Gauge} />
          <CarteCompteur label="Suggestions en attente" valeur={stats?.suggestions_par_statut?.pending ?? 0} icone={Lightbulb} />
          <CarteCompteur
            label="Alertes non acquittées"
            valeur={Object.values(stats?.alertes_non_acquittees ?? {}).reduce((a, b) => a + b, 0)}
            icone={BellRing}
          />
          <CarteCompteur
            label="Clés actives"
            valeur={stats?.cles_actives ?? 0}
            suffixe={`/ ${formatNombre(stats?.cles_total ?? 0)}`}
            icone={KeyRound}
          />
        </div>
      )}
    </TransitionEtat>
  )
}

export default CompteursStatsIA