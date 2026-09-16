import { useMemo } from "react"
import { useJournalStatsQuery } from "@/features/admin-journal.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { FileEdit, FilePlus2, LogIn, ScrollText, UserCheck } from "lucide-react"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Compteurs du Journal d'activité (cycle 16, sélection validée :
   G-E-F-C-B — ajustée audit 4).

   ⚠ Audit 4, K.1 : stats.total est FENÊTRÉ sur days (plus de COUNT
   plein-table) — les cartes G et F d'origine affichaient alors la même
   valeur. G devient « Total (30 j) » et F devient « Connexions (30 j) »
   (action la plus fréquente, cliquable → filtre, pattern B/C).

   G — Total (30 j)        : stats.total (fenêtre days — audit 4, K.1)
   E — Auteurs distincts   : stats.top_auteurs.length (fenêtre 30 j)
   F — Connexions (30 j)   : stats.by_action.connexion (cliquable)
   C — Modifications (30 j) : stats.by_action.modification
   B — Créations (30 j)    : stats.by_action.creation

   Tous servis par UN SEUL appel (/audit/stats). Les cartes B, C et F
   sont cliquables → appliquent le filtre action correspondant.
   ───────────────────────────────────────────────────────────────────── */

const CompteursJournal = () => {
  const { data: stats, isError, refetch } = useJournalStatsQuery(30)

  const valeurs = useMemo(() => {
    const parAction = stats?.by_action ?? {}
    return {
      total: stats?.total ?? 0,
      auteurs: stats?.top_auteurs?.length ?? 0,
      connexions: parAction.connexion ?? 0,
      modifications: parAction.modification ?? 0,
      creations: parAction.creation ?? 0,
    }
  }, [stats])

  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"} >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger le journal d'activité." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 xl:grid-cols-5">
          <CarteCompteur
            label="Total (30 j)"
            valeur={valeurs.total}
            icone={ScrollText}
            className="sm:col-span-2 xl:col-span-1"
          />
          <CarteCompteur label="Auteurs distincts" valeur={valeurs.auteurs} icone={UserCheck} className="sm:col-span-2 xl:col-span-1" />
          <CarteCompteur
            label="Connexions (30 j)"
            valeur={valeurs.connexions}
            icone={LogIn}
            href="/admin/journal"
            query="?action=connexion"
            className="sm:col-span-2 xl:col-span-1"
          />
          <CarteCompteur
            label="Modifications (30 j)"
            valeur={valeurs.modifications}
            icone={FileEdit}
            href="/admin/journal"
            query="?action=modification"
            className="sm:col-span-3 xl:col-span-1"
          />
          <CarteCompteur
            label="Créations (30 j)"
            valeur={valeurs.creations}
            icone={FilePlus2}
            href="/admin/journal"
            className="col-span-2 sm:col-span-3 xl:col-span-1"
          />
        </div>
      )}
    </TransitionEtat>
  )
}

export default CompteursJournal
