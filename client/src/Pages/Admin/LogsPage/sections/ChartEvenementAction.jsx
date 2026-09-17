import { useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts"
import { useLogsStatsQuery, LIBELLE_ACTION_EVENT } from "@/features/admin-logs.tools"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { Activity } from "lucide-react"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import TooltipChart from "../components/TooltipChart"
import CadreChart from "@/components/admin/CadreChart"

const COULEURS_ACTION = ["#0F2D4D", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"]

/**
 * État de chargement du PieChart « Répartition par action » (journal d'audit).
 * Reprend la géométrie du chart réel :
 *  - rayons absolus innerRadius=50 / outerRadius=75 → pour un carré
 *    de 150px (max-w-[150px]), le trou fait 100px de diamètre,
 *    soit inset: 16.7% ;
 *  - gaps de 2° entre segments (paddingAngle) ;
 *  - 4 segments correspondant aux 4 actions réellement instrumentées
 *    (creation, modification, suppression, envoi — « connexion »
 *     n'est jamais émise côté backend, cf. cahier des charges §2.3).
 * Proportions réalistes d'un journal d'audit :
 *  - modification ≈ 40 % (la plus fréquente)
 *  - creation ≈ 30 %
 *  - envoi ≈ 20 %
 *  - suppression ≈ 10 % (rare, avec confirmation)
 * `height` doit correspondre à la hauteur du CadreChart / ResponsiveContainer réel.
 */
const ChartActionsAuditSkeleton = ({ height = 220 }) => (
  <div
    role="status"
    aria-label="Chargement du graphique de répartition par action"
    className="flex h-full w-full animate-pulse flex-col items-center justify-center gap-3"
    style={{ height }}
  >
    {/* Donut : 4 segments neutres séparés par des gaps de 2° */}
    <div className="relative aspect-square w-full max-w-37.5">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(
            var(--color-muted) 0deg 141deg,
            transparent 141deg 143deg,
            var(--color-surface-container-high) 143deg 249deg,
            transparent 249deg 251deg,
            var(--color-muted) 251deg 321deg,
            transparent 321deg 323deg,
            var(--color-surface-container-high) 323deg 358deg,
            transparent 358deg 360deg
          )`,
        }}
      />
      {/* Trou central : ratio innerRadius/outerRadius = 50/75 = 0.667,
          soit un trou de 100px dans un carré de 150px → inset 16.7% */}
      <div className="absolute rounded-full bg-card" style={{ inset: "16.7%" }} />
    </div>

    {/* Légende : équivalent du <Legend wrapperStyle={{ fontSize: 11 }}>
        — 4 actions (creation, modification, suppression, envoi).
        Légèrement plus grande que les fontSize:10 des autres charts. */}
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Skeleton className="h-2.5 w-2.5 rounded-xs" />
          <Skeleton className="h-2.5 w-16 rounded-xs" />
        </div>
      ))}
    </div>
  </div>
);

const ChartEvenementAction = () => {
  const mouvementReduit = useReducedMotion()
  const { data: stats, isLoading, isError, refetch } = useLogsStatsQuery(30)

  const parAction = useMemo(
    () =>
      (stats?.events_par_action ?? []).map((a) => ({
        action: LIBELLE_ACTION_EVENT[a.action] ?? a.action,
        total: a.total,
      })),
    [stats]
  )

  const etat = isError ? "erreur" : isLoading ? "chargement" : !stats?.jobs_par_jour?.length ? "vide" : "donnees"

  return (
    <SectionCardAdmin
      title="Événements par action"
      description="Statistiques des événements par action (total par action)."
      icon={Activity}
    >
      <TransitionEtat etat={etat}>
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger l'état du croisement." />
        ) : isLoading ? (
          <ChartActionsAuditSkeleton />
        ) : (
          <CadreChart vide={!parAction.length} videMessage="Aucune action dans la fenêtre.">
            <PieChart>
              <Tooltip content={<TooltipChart />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Pie
                data={parAction}
                dataKey="total"
                nameKey="action"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
                isAnimationActive={!mouvementReduit}
                animationDuration={600}
                animationEasing="ease-out"
              >
                {parAction.map((entree, i) => (
                  <Cell key={entree.action} fill={COULEURS_ACTION[i % COULEURS_ACTION.length]} />
                ))}
              </Pie>
            </PieChart>
          </CadreChart>
        )}
      </TransitionEtat>
    </SectionCardAdmin>
  )
}

export default ChartEvenementAction