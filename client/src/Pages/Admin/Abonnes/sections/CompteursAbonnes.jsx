import { useStatsAbonnesOverview, useStatsEnvoisParJour } from "@/features/admin-abonnes.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { MailWarning, MailX, UserCheck, UserCog, UserMinus, Users } from "lucide-react"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"


const CompteursAbonnes = () => {
  const { data: stats, isError, refetch } = useStatsAbonnesOverview()
  const { data: envois } = useStatsEnvoisParJour({ days: 30 })

  const total = stats?.total ?? 0
  const byStatus = stats?.by_status ?? {}
  const desinscrits = byStatus.unsubscribed ?? 0
  const rebonds = byStatus.bouncing ?? 0
  const actifs = byStatus.active ?? 0

  // Taux d'échec des envois sur 30 jours (digests).
  let envoyes = 0
  let echoues = 0
  for (const jour of envois ?? []) {
    envoyes += jour.sent ?? 0
    echoues += jour.failed ?? 0
  }
  const totalEnvois = envoyes + echoues
  const tauxEchec = totalEnvois > 0 ? Math.round((echoues / totalEnvois) * 100) : 0
  const tauxDesinscription = total > 0 ? Math.round((desinscrits / total) * 100) : 0
  const tauxRebond = total > 0 ? Math.round((rebonds / total) * 100) : 0

  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"} >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques." />
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          <CarteCompteur label="Abonnés totaux" valeur={total} icone={Users} />
          <CarteCompteur label="Actifs" valeur={actifs} icone={UserCheck} href="/admin/utilisateurs" query="?status=active" />
          <CarteCompteur label="Sans filière configurée" valeur={stats?.without_filiere ?? 0} icone={UserCog} href="/admin/utilisateurs" query="?status=active" />
          <CarteCompteur label="Taux de désinscription" valeur={tauxDesinscription} icone={UserMinus} suffixe="%" />
          <CarteCompteur label="Digests échoués (30 j)" valeur={tauxEchec} icone={MailX} suffixe="%" />
          <CarteCompteur label="Taux de rebond" valeur={tauxRebond} suffixe="%" icone={MailWarning} />
        </div>
      )}
    </TransitionEtat>
  )
}

export default CompteursAbonnes