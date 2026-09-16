import { useMemo } from "react"
import { useAdminAdministrateursQuery } from "@/features/admin-administrateurs.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { Clock, Crown, LogIn, UserCheck, UserX } from "lucide-react"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"


const CompteursAdministrateurs = () => {
  const { data: admins, isError, refetch } = useAdminAdministrateursQuery()

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
    <TransitionEtat etat={isError ? "erreur" : "donnees"} >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les administrateurs." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 xl:grid-cols-5">
          <CarteCompteur
            label="Actifs"
            valeur={c.actifs}
            suffixe={`/${c.total}`}
            icone={UserCheck}
            href="/admin/administrateurs"
            query="?actif=actifs"
            className="sm:col-span-2 xl:col-span-1"
          />
          <CarteCompteur
            label="Super admins"
            valeur={c.superAdmins}
            icone={Crown}
            href="/admin/administrateurs"
            query="?role=super_admin"
            className="sm:col-span-2 xl:col-span-1"
          />
          <CarteCompteur label="Jamais connectés" valeur={c.jamaisConnectes} icone={UserX} className="sm:col-span-2 xl:col-span-1" />
          <CarteCompteur
            label="Inactifs"
            valeur={c.inactifs}
            icone={Clock}
            href="/admin/administrateurs"
            query="?actif=inactifs"
            className="sm:col-span-3 xl:col-span-1"
          />
          <CarteCompteur label="Connectés (7 j)" valeur={c.connectes7j} icone={LogIn} className="col-span-2 sm:col-span-3 xl:col-span-1" />
        </div>
      )}
    </TransitionEtat>
  )
}

export default CompteursAdministrateurs