import { useMemo } from "react"
import { useJournalStatsQuery } from "@/features/admin-journal.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { FileEdit, FilePlus2, LogIn, ScrollText, UserCheck } from "lucide-react"

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
  const { data: stats, isLoading } = useJournalStatsQuery(30)

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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <CarteCompteur label="Total (30 j)" valeur={valeurs.total} icone={ScrollText} chargement={isLoading} />
      <CarteCompteur label="Auteurs distincts" valeur={valeurs.auteurs} icone={UserCheck} chargement={isLoading} />
      <CarteCompteur
        label="Connexions (30 j)"
        valeur={valeurs.connexions}
        icone={LogIn}
        href="/admin/journal"
        query="?action=connexion"
        chargement={isLoading}
      />
      <CarteCompteur
        label="Modifications (30 j)"
        valeur={valeurs.modifications}
        icone={FileEdit}
        href="/admin/journal"
        query="?action=modification"
        chargement={isLoading}
      />
      <CarteCompteur
        label="Créations (30 j)"
        valeur={valeurs.creations}
        icone={FilePlus2}
        href="/admin/journal"
        query="?action=creation"
        chargement={isLoading}
      />
    </div>
  )
}

export default CompteursJournal
