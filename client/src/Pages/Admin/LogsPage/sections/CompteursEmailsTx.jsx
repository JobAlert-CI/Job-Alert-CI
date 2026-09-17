import { AlertCircle, CalendarX, History, ListOrdered } from "lucide-react"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { useEmailsTxStatsQuery } from "@/features/admin-logs.tools"

const CompteursEmailsTx = () => {
  // Stats 30 j (M1-M3, M5, M6) + stats 1 j (M4 badge « aujourd'hui »).
  const { data: stats, isError, refetch } = useEmailsTxStatsQuery(30)
  const { data: statsJour } = useEmailsTxStatsQuery(1)
  const echecsJour = statsJour?.echecs_fenetre ?? 0

  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"}>
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques." />
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <CarteCompteur label="Total (historique)" valeur={stats?.total ?? 0} icone={History} />
          <CarteCompteur
            label="Échecs"
            valeur={stats?.par_statut?.failed ?? 0}
            icone={AlertCircle}
            href="/admin/logs"
            query="?onglet=emails&statut=failed"
          />
          <CarteCompteur
            label="En file"
            valeur={stats?.par_statut?.queued ?? 0}
            icone={ListOrdered}
            href="/admin/logs"
            query="?onglet=emails&statut=queued"
          />
          <CarteCompteur
            label="Échecs aujourd'hui"
            valeur={echecsJour}
            icone={CalendarX}
            suffixe={`échec${echecsJour > 1 ? "s" : ""}`}
          />
        </div>
      )}
    </TransitionEtat>
  )
}

export default CompteursEmailsTx