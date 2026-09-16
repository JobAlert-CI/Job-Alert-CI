import { useMemo } from "react"
import {
  useAdminFilieresQuery,
  useStatsOffresParFiliere, useStatsAbonnesParFiliere,
} from "@/features/admin-filieres.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { Briefcase, FolderGit2, Tag, Users } from "lucide-react"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"


const CompteursFilieres = () => {
  const { data: filieres, isError: filieresErreur, refetch: refetchFilieres } = useAdminFilieresQuery()
  const { data: statsOffres, isError: offresErreur, refetch: refetchOffres } = useStatsOffresParFiliere()
  const { data: statsAbonnes, isError: abonnesErreur, refetch: refetchAbonnes } = useStatsAbonnesParFiliere()

  const actives = useMemo(
    () => (filieres ?? []).filter((f) => f.is_active).length,
    [filieres]
  )
  const sansMotCle = useMemo(
    () => (filieres ?? []).filter((f) => !(f.keywords?.length ?? 0)).length,
    [filieres]
  )
  // Sommes sur les filières PEUPLÉES uniquement : les endpoints ne
  // renvoient pas les zéros (affiché tel quel, pas de total inventé).
  const offresTotal = useMemo(
    () => (statsOffres ?? []).reduce((acc, f) => acc + (f.total_offers ?? 0), 0),
    [statsOffres]
  )
  const abonnesTotal = useMemo(
    () => (statsAbonnes ?? []).reduce((acc, f) => acc + (f.subscribers_count ?? 0), 0),
    [statsAbonnes]
  )

  const isError = filieresErreur || offresErreur || abonnesErreur

  const refetch = () => {
    refetchFilieres()
    refetchOffres()
    refetchAbonnes()
  }

  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"} >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les filieres." />
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <CarteCompteur
            label="Filières actives"
            valeur={actives}
            suffixe={`/${filieres?.length ?? 0}`}
            icone={FolderGit2}
          />
          <CarteCompteur
            label="Offres rattachées"
            valeur={offresTotal}
            icone={Briefcase}
          />
          <CarteCompteur
            label="Abonnés rattachés"
            valeur={abonnesTotal}
            icone={Users}
          />
          <CarteCompteur
            label="Filières sans mot-clé"
            valeur={sansMotCle}
            icone={Tag}
          />
        </div>
      )
      }
    </TransitionEtat>
  )
}

export default CompteursFilieres
