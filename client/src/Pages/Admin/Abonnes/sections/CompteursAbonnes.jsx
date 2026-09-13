import { useStatsAbonnesOverview, useStatsEnvoisParJour } from "@/features/admin-abonnes.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { Skeleton } from "@/components/ui/skeleton"
import { MailWarning, MailX, UserCheck, UserCog, UserMinus, Users } from "lucide-react"


const CompteursAbonnes = () => {
  const { data: stats, isLoading } = useStatsAbonnesOverview()
  const { data: envois } = useStatsEnvoisParJour({ days: 30 })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3" aria-busy="true">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    )
  }

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
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
      <CarteCompteur label="Abonnés totaux" valeur={total} icone={Users} />
      <CarteCompteur label="Actifs" valeur={actifs} icone={UserCheck} href="/admin/utilisateurs" query="?status=active" />
      <CarteCompteur label="Sans filière configurée" valeur={stats?.without_filiere ?? 0} icone={UserCog} href="/admin/utilisateurs" query="?status=active" />
      <CarteCompteur label="Taux de désinscription" valeur={tauxDesinscription} icone={UserMinus} suffixe="%" />
      <CarteCompteur label="Digests échoués (30 j)" valeur={tauxEchec} icone={MailX} suffixe="%" />
      <CarteCompteur label="Taux de rebond" valeur={tauxRebond} suffixe="%" icone={MailWarning} />
    </div>
  )
}

export default CompteursAbonnes