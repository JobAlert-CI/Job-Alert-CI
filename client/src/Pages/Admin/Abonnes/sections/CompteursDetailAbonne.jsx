import CarteCompteur from "@/components/admin/CarteCompteur"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { useAdminSubscriberSendsQuery, useCompteOffresActivesFiliere } from "@/features/admin-abonnes.tools"
import { useMemo, useState } from "react"


const CompteursDetailAbonne = ({ abonneId, subscribedAt }) => {
  const { data: envois, isError, refetch } = useAdminSubscriberSendsQuery(abonneId, { limit: 100 })
  const { data: matching } = useCompteOffresActivesFiliere(abonneId)
  const [maintenant] = useState(() => Date.now())

  const anciennete = useMemo(() => {
    if (!subscribedAt) return "—"
    const jours = Math.max(0, Math.floor((maintenant - new Date(subscribedAt).getTime()) / 86400000))
    if (jours < 31) return [jours, "jours"]
    if (jours < 365) return [Math.round(jours / 30), "mois"]
    return [(jours / 365).toFixed(jours % 365 < 60 ? 0 : 1), "ans"]
  }, [subscribedAt, maintenant])

  const digests = envois ?? []
  const digestsRecus = digests.filter((e) => e.status === "sent").length
  const offresRecues = digests.reduce((somme, e) => somme + (e.offer_count ?? 0), 0)
  const echecs = digests.filter((e) => e.status === "failed").length
  const tauxSucces = digestsRecus + echecs > 0 ? Math.round((digestsRecus / (digestsRecus + echecs)) * 100) : null
  const sansOffre = digests.filter((e) => e.status === "skipped_empty").length

  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"} >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques." />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <CarteCompteur label="Digests reçus" valeur={digestsRecus} />
          <CarteCompteur label="Offres reçues" valeur={offresRecues} />
          <CarteCompteur label="Taux de succès" valeur={tauxSucces ?? 0} suffixe="%" />
          <CarteCompteur
            label="Offres actives (ses filières)"
            valeur={matching?.total ?? 0}
          />
          <CarteCompteur label="Ancienneté" valeur={anciennete?.[0]} suffixe={anciennete?.[1]} />
          <CarteCompteur label="Digests sans offre" valeur={sansOffre} />
        </div>
      )}
    </TransitionEtat>
  )
}

export default CompteursDetailAbonne