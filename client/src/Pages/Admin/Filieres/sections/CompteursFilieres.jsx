import { useMemo } from "react"
import {
  useAdminFilieresQuery,
  useStatsOffresParFiliere, useStatsAbonnesParFiliere,
} from "@/features/admin-filieres.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { Briefcase, FolderGit2, Tag, Users } from "lucide-react"


const CompteursFilieres = () => {
  const { data: filieres, isLoading } = useAdminFilieresQuery()
  const { data: statsOffres, isLoading: offresChargement } = useStatsOffresParFiliere()
  const { data: statsAbonnes, isLoading: abonnesChargement } = useStatsAbonnesParFiliere()

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

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <CarteCompteur
        label="Filières actives"
        valeur={actives}
        suffixe={`/${filieres?.length ?? 0}`}
        icone={FolderGit2}
        chargement={isLoading}
      />
      <CarteCompteur
        label="Offres rattachées"
        valeur={offresTotal}
        icone={Briefcase}
        chargement={offresChargement}
      />
      <CarteCompteur
        label="Abonnés rattachés"
        valeur={abonnesTotal}
        icone={Users}
        chargement={abonnesChargement}
      />
      <CarteCompteur
        label="Filières sans mot-clé"
        valeur={sansMotCle}
        icone={Tag}
        chargement={isLoading}
      />
    </div>
  )
}

export default CompteursFilieres
