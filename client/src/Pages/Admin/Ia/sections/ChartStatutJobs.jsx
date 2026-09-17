import { useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import { Cell, Legend, Pie, PieChart, Tooltip, } from "recharts"
import { STATUTS_JOB, useStatsIaQuery, } from "@/features/admin-ia.tools"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { BrainCircuit } from "lucide-react"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import CadreChart from "@/components/admin/CadreChart"
import TooltipChartIA from "../components/TooltipChartIA"

const COULEURS_STATUT_JOB = {
  completed: "#0F2D4D",
  partial_failure: "#f59e0b",
  failed: "#ef4444",
  running: "#F5A623",
  pending: "#94a3b8",
}

/**
 * État de chargement du PieChart de répartition des offres par statut (donut).
 * Reproduit la géométrie réelle :
 *  - anneau entre 55% et 80% du rayon → trou central de (1 - 55/80)/2 ≈ 15,6% d'inset ;
 *  - gaps de 2° entre segments (paddingAngle) ;
 *  - 5 segments proportionnels à une répartition réaliste des statuts
 *    (active ≈ 55%, expired ≈ 18%, filled ≈ 12%, archived ≈ 9%, en_relecture ≈ 6%).
 * `height` doit correspondre à la hauteur du ResponsiveContainer réel.
 */
const ChartStatutsJobsSkeleton = ({ height = 220 }) => (
  <div
    role="status"
    aria-label="Chargement du graphique de répartition des offres par statut"
    className="flex h-full w-full animate-pulse flex-col items-center justify-center gap-3"
    style={{ height }}
  >
    {/* Donut : 5 segments neutres séparés par des gaps de 2° */}
    <div className="relative aspect-square w-full max-w-37.5">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(
            var(--color-muted) 0deg 192deg,
            transparent 192deg 194deg,
            var(--color-surface-container-high) 194deg 257deg,
            transparent 257deg 259deg,
            var(--color-muted) 259deg 301deg,
            transparent 301deg 303deg,
            var(--color-surface-container-high) 303deg 335deg,
            transparent 335deg 337deg,
            var(--color-muted) 337deg 358deg,
            transparent 358deg 360deg
          )`,
        }}
      />
      {/* Trou central (innerRadius 55% / outerRadius 80%) */}
      <div className="absolute rounded-full bg-card" style={{ inset: "15.6%" }} />
    </div>

    {/* Légende : équivalent du <Legend wrapperStyle={{ fontSize: 10 }}> — 5 statuts */}
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Skeleton className="h-2.5 w-2.5 rounded-xs" />
          <Skeleton className="h-2 w-14 rounded-xs" />
        </div>
      ))}
    </div>
  </div>
);

const ChartStatusJobs = () => {
  const mouvementReduit = useReducedMotion()
  const { data: stats, isLoading, isError, refetch } = useStatsIaQuery(30)

  // C2 : donut statuts — ordre du vocabulaire, zéros filtrés.
  const parStatut = useMemo(
    () =>
      Object.entries(STATUTS_JOB)
        .map(([valeur, conf]) => ({
          statut: conf.libelle,
          total: stats?.jobs_par_statut?.[valeur] ?? 0,
          couleur: COULEURS_STATUT_JOB[valeur],
        }))
        .filter((e) => e.total > 0),
    [stats]
  )

  const etat = isError ? "erreur" : isLoading ? "chargement" : !stats?.jobs_par_jour?.length ? "vide" : "donnees"

  return (
    <SectionCardAdmin
      title="Statut des jobs (30 jours)"
      icon={BrainCircuit}
    >
      <TransitionEtat etat={etat}>
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger l'état du croisement." />
        ) : isLoading ? (
          <ChartStatutsJobsSkeleton />
        ) : (
          <CadreChart
            vide={!parStatut.length}
            videMessage="Aucun job sur la fenêtre."
          >
            <PieChart>
              <Tooltip content={<TooltipChartIA suffixe=" job(s)" />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Pie
                data={parStatut}
                dataKey="total"
                nameKey="statut"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={2}
                strokeWidth={0}
                isAnimationActive={!mouvementReduit}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {parStatut.map((e) => <Cell key={e.statut} fill={e.couleur} />)}
              </Pie>
            </PieChart>
          </CadreChart>
        )}
      </TransitionEtat>
    </SectionCardAdmin>
  )
}

export default ChartStatusJobs