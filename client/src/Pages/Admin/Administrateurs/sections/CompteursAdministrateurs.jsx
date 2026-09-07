import { useMemo } from "react"
import { useFiltresAdministrateursAdmin } from "@/contexts/FiltresAdministrateursAdmin.context"
import { useAdminAdministrateursQuery } from "@/features/admin-administrateurs.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"

/* ─────────────────────────────────────────────────────────────────────
   Compteurs de la page Administrateurs (cycle 15, sélection validée
   par l'utilisateur : 2-3-4-5-6).

   Tous DÉRIVÉS de la liste chargée — zéro appel réseau en plus
   (pattern Sources). Les valeurs sont des compteurs de PAGE : si plus
   d'admins existent que la page n'en montre, les filtres restent le
   chemin vers les chiffres globaux (chips cliquables).

   ⚠️ « Connectés (7 j) » : last_login_at dans les 7 derniers jours.
   ───────────────────────────────────────────────────────────────────── */

/* Borne « 7 derniers jours » captée au CHARGEMENT du module (hors rendu —
   Date.now()/new Date() sont impurs pendant le render, règle
   react-hooks/purity). Précision amplement suffisante pour un compteur :
   un rechargement de page rafraîchit la fenêtre. */
const IL_Y_A_7J = Date.now() - 7 * 24 * 3600 * 1000

const CompteursAdministrateurs = () => {
  const { data: admins, isLoading } = useAdminAdministrateursQuery()
  const { setActif } = useFiltresAdministrateursAdmin()

  const c = useMemo(() => {
    const liste = admins ?? []
    return {
      total: liste.length,
      actifs: liste.filter((a) => a.is_active).length,
      superAdmins: liste.filter((a) => a.role === "super_admin").length,
      jamaisConnectes: liste.filter((a) => !a.last_login_at).length,
      inactifs: liste.filter((a) => !a.is_active).length,
      connectes7j: liste.filter(
        (a) => a.last_login_at && new Date(a.last_login_at).getTime() >= IL_Y_A_7J
      ).length,
    }
  }, [admins])

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {/* 2 — Actifs : chip cliquable filtre la liste */}
      <button
        type="button"
        onClick={() => setActif("actifs")}
        className="text-left"
        aria-label={`Voir les administrateurs actifs (${c.actifs})`}
      >
        <CarteCompteur label="Actifs" valeur={c.actifs} texte={`${c.actifs}/${c.total}`} chargement={isLoading} />
      </button>
      {/* 3 — Super admins */}
      <CarteCompteur label="Super admins" valeur={c.superAdmins} chargement={isLoading} />
      {/* 4 — Jamais connectés : comptes créés jamais utilisés (hygiène) */}
      <CarteCompteur label="Jamais connectés" valeur={c.jamaisConnectes} chargement={isLoading} />
      {/* 5 — Inactifs : chip cliquable filtre la liste */}
      <button
        type="button"
        onClick={() => setActif("inactifs")}
        className="text-left"
        aria-label={`Voir les administrateurs inactifs (${c.inactifs})`}
      >
        <CarteCompteur label="Inactifs" valeur={c.inactifs} chargement={isLoading} />
      </button>
      {/* 6 — Connectés les 7 derniers jours */}
      <CarteCompteur label="Connectés (7 j)" valeur={c.connectes7j} chargement={isLoading} />
    </div>
  )
}

export default CompteursAdministrateurs
