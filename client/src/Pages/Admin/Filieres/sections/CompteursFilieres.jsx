import { useMemo } from "react"
import {
  useAdminFilieresQuery,
  useStatsOffresParFiliere, useStatsAbonnesParFiliere,
} from "@/features/admin-filieres.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"

/* ─────────────────────────────────────────────────────────────────────
   Compteurs du haut de la page Filières (cycle 12, sélection user) :
   - Filières actives (x/N)     ← liste admin déjà chargée (0 appel) ;
   - Offres rattachées           ← /api/stats/offers/by-filiere (somme
                                   des filières peuplées — « au moins ») ;
   - Abonnés rattachés           ← top-filieres cycle 7 (idem) ;
   - Filières sans mot-clé       ← liste admin (indicateur qualité :
                                   une filière sans mot-clé n'est jamais
                                   détectée par le matching automatique).
   ───────────────────────────────────────────────────────────────────── */

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
        texte={`${actives}/${filieres?.length ?? 0}`}
        chargement={isLoading}
      />
      <CarteCompteur
        label="Offres rattachées"
        valeur={offresTotal}
        chargement={offresChargement}
      />
      <CarteCompteur
        label="Abonnés rattachés"
        valeur={abonnesTotal}
        chargement={abonnesChargement}
      />
      <CarteCompteur
        label="Filières sans mot-clé"
        valeur={sansMotCle}
        chargement={isLoading}
      />
    </div>
  )
}

export default CompteursFilieres
