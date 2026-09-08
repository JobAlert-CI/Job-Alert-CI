import { useMemo } from "react"
import { useJournalStatsQuery } from "@/features/admin-journal.tools"
import { useFiltresJournalAdmin } from "@/contexts/FiltresJournalAdmin.context"
import CarteCompteur from "@/components/admin/CarteCompteur"

/* ─────────────────────────────────────────────────────────────────────
   Compteurs du Journal d'activité (cycle 16, sélection validée :
   G-E-F-C-B).

   G — Total historique   : stats.total (endpoint dédié, VRAI total)
   E — Auteurs distincts  : stats.top_auteurs.length (fenêtre 30 j)
   F — Actions (fenêtre 30 j) : Σ stats.par_jour[].total
   C — Modifications     : stats.by_action.modification
   B — Créations         : stats.by_action.creation

   Tous servis par UN SEUL appel (/audit/stats). Les compteurs B et C
   sont cliquables → appliquent le filtre action correspondant.
   ───────────────────────────────────────────────────────────────────── */

const CompteursJournal = () => {
  const { setAction } = useFiltresJournalAdmin()
  const { data: stats, isLoading } = useJournalStatsQuery(30)

  const valeurs = useMemo(() => {
    const parAction = stats?.by_action ?? {}
    const fenetre = (stats?.par_jour ?? []).reduce((acc, j) => acc + (j.total || 0), 0)
    return {
      total: stats?.total ?? 0,
      auteurs: stats?.top_auteurs?.length ?? 0,
      fenetre30j: fenetre,
      modifications: parAction.modification ?? 0,
      creations: parAction.creation ?? 0,
    }
  }, [stats])

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <CarteCompteur label="Total historique" valeur={valeurs.total} chargement={isLoading} />
      <CarteCompteur label="Auteurs distincts" valeur={valeurs.auteurs} chargement={isLoading} />
      <CarteCompteur label="Actions (30 j)" valeur={valeurs.fenetre30j} chargement={isLoading} />
      <button
        type="button"
        onClick={() => setAction("modification")}
        className="text-left"
        aria-label={`Voir les modifications (${valeurs.modifications})`}
      >
        <CarteCompteur label="Modifications" valeur={valeurs.modifications} chargement={isLoading} />
      </button>
      <button
        type="button"
        onClick={() => setAction("creation")}
        className="text-left"
        aria-label={`Voir les créations (${valeurs.creations})`}
      >
        <CarteCompteur label="Créations" valeur={valeurs.creations} chargement={isLoading} />
      </button>
    </div>
  )
}

export default CompteursJournal
