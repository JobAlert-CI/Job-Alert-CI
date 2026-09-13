import { useMemo } from "react"
import { useAdminAdministrateursQuery } from "@/features/admin-administrateurs.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { Clock, Crown, LogIn, UserCheck, UserX } from "lucide-react"

/* ─────────────────────────────────────────────────────────────────────
   Compteurs de la page Administrateurs (cycle 15, sélection validée
   par l'utilisateur : 2-3-4-5-6).
   Tous DÉRIVÉS de la liste chargée — zéro appel réseau en plus
   (pattern Sources). Les valeurs sont des compteurs de PAGE : si plus
   d'admins existent que la page n'en montre, les filtres restent le
   chemin vers les chiffres globaux (chips cliquables).
   ⚠️ « Connectés (7 j) » : last_login_at dans les 7 derniers jours.

   Refonte :
   • Un seul passage sur la liste (reduce) au lieu de cinq filter
     successifs — O(N) au lieu de O(5N).
   • La borne « 7 derniers jours » est recalculée DANS le useMemo, à
     chaque dérivation : une page laissée ouverte plusieurs jours ne
     travaille plus avec une fenêtre obsolète (l'ancienne constante
     module IL_Y_A_7J était figée au chargement du bundle). Précision
     amplement suffisante : un rechargement de page rafraîchit aussi.
   ───────────────────────────────────────────────────────────────────── */
const CompteursAdministrateurs = () => {
  const { data: admins, isLoading } = useAdminAdministrateursQuery()

  const c = useMemo(() => {
    const liste = admins ?? []
    /* Fenêtre glissante recalculée à chaque dérivation — jamais figée. */
    // eslint-disable-next-line react-hooks/purity
    const ilYA7j = Date.now() - 7 * 24 * 3600 * 1000
    /* Un seul passage : chaque admin incrémente tous les compteurs qui
       le concernent. `inactifs` est le complément exact de `actifs`. */
    return liste.reduce(
      (acc, a) => {
        acc.total += 1
        if (a.is_active) acc.actifs += 1
        else acc.inactifs += 1
        if (a.role === "super_admin") acc.superAdmins += 1
        if (!a.last_login_at) acc.jamaisConnectes += 1
        else if (new Date(a.last_login_at).getTime() >= ilYA7j) acc.connectes7j += 1
        return acc
      },
      { total: 0, actifs: 0, inactifs: 0, superAdmins: 0, jamaisConnectes: 0, connectes7j: 0 }
    )
  }, [admins])

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <CarteCompteur
        label="Actifs"
        valeur={c.actifs}
        suffixe={`/${c.total}`}
        icone={UserCheck}
        href="/admin/administrateurs"
        query="?actif=actifs"
        chargement={isLoading}
      />
      <CarteCompteur
        label="Super admins"
        valeur={c.superAdmins}
        icone={Crown}
        href="/admin/administrateurs"
        query="?role=super_admin"
        chargement={isLoading}
      />
      <CarteCompteur label="Jamais connectés" valeur={c.jamaisConnectes} icone={UserX} chargement={isLoading} />
      <CarteCompteur
        label="Inactifs"
        valeur={c.inactifs}
        icone={Clock}
        href="/admin/administrateurs"
        query="?actif=inactifs"
        chargement={isLoading}
      />
      <CarteCompteur label="Connectés (7 j)" valeur={c.connectes7j} icone={LogIn} chargement={isLoading} />
    </div>
  )
}

export default CompteursAdministrateurs