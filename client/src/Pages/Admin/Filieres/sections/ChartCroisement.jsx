import { useMemo } from "react"
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import {
  useAdminFilieresQuery,
  useStatsOffresParFiliere, useStatsAbonnesParFiliere,
} from "@/features/admin-filieres.tools"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"

/* ─────────────────────────────────────────────────────────────────────
   Chart « Offre vs Demande » (cycle 12, sélection utilisateur — le
   seul chart retenu) : barres duales par filière, offre (offres
   actives rattachées) contre demande (abonnés inscrits).

   Croisement LOCAL de 3 sources déjà chargées sur la page :
   - liste admin (toutes les filières — remplit les zéros) ;
   - /api/stats/offers/by-filiere (public — filières peuplées) ;
   - top-filieres (cycle 7 — filières peuplées).
   Zéro appel réseau en plus.

   Lecture : une filière avec beaucoup d'abonnés et peu d'offres =
   attente insatisfaite ; l'inverse = gisement d'offres non exploité.
   Recharts confiné au chunk lazy, isAnimationActive={false}
   (MotionConfig reducedMotion global), légende HTML (lecteurs d'écran).
   ───────────────────────────────────────────────────────────────────── */

const COULEUR_OFFRE = "#2563eb"
const COULEUR_DEMANDE = "#10b981"

const ChartCroisement = () => {
  const { data: filieres, isLoading: filieresChargement } = useAdminFilieresQuery()
  const { data: statsOffres, isLoading: offresChargement } = useStatsOffresParFiliere()
  const { data: statsAbonnes, isLoading: abonnesChargement } = useStatsAbonnesParFiliere()

  const donnees = useMemo(() => {
    const offresParCode = new Map((statsOffres ?? []).map((f) => [f.code, f.total_offers ?? 0]))
    const abonnesParCode = new Map((statsAbonnes ?? []).map((f) => [f.code, f.subscribers_count ?? 0]))
    return (filieres ?? []).map((f) => ({
      nom: f.label,
      offres: offresParCode.get(f.code) ?? 0,
      abonnes: abonnesParCode.get(f.code) ?? 0,
    }))
  }, [filieres, statsOffres, statsAbonnes])

  const chargement = filieresChargement || offresChargement || abonnesChargement
  const aDesDonnees = donnees.some((d) => d.offres > 0 || d.abonnes > 0)

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
        Offre vs demande par filière
      </h2>
      <p className="text-[10px] text-muted-foreground">
        Offres actives rattachées (bleu) face aux abonnés inscrits (vert) — un déséquilibre
        marque une attente insatisfaite ou un gisement d'offres non exploité.
      </p>
      {chargement ? (
        <Skeleton className="w-full rounded-lg" style={{ height: 260 }} />
      ) : !aDesDonnees ? (
        <Empty className="py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon" />
            <EmptyTitle>Pas encore de données</EmptyTitle>
            <EmptyDescription>
              Aucune offre ni abonné rattaché à une filière — le croisement apparaîtra
              dès les premières données de matching.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={donnees} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="nom" fontSize={9} tickLine={false} interval={0} angle={-35} textAnchor="end" height={70} />
              <YAxis allowDecimals={false} fontSize={10} tickLine={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="offres" name="Offres actives" fill={COULEUR_OFFRE} isAnimationActive={false} radius={[3, 3, 0, 0]} />
              <Bar dataKey="abonnes" name="Abonnés" fill={COULEUR_DEMANDE} isAnimationActive={false} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default ChartCroisement
