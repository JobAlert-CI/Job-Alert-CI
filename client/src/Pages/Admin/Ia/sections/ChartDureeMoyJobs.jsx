import { useReducedMotion } from "framer-motion"
import {CartesianGrid, Line, LineChart,Tooltip, XAxis, YAxis} from "recharts"
import { useStatsIaQuery,} from "@/features/admin-ia.tools"
import { Skeleton } from "@/components/ui/skeleton"
import { Timer } from "lucide-react"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { TransitionEtat, SectionErreur } from "@/components/admin/EtatsSection"
import CadreChart from "@/components/admin/CadreChart"
import TooltipChartIA from "../components/TooltipChartIA"


/**
 * Points de la courbe fictive (viewBox 700×200) — profil réaliste
 * d'une durée moyenne qui fluctue d'un jour à l'autre.
 */
const POINTS_COURBE = [
  [0, 150], [100, 110], [200, 130], [300, 70],
  [400, 90], [500, 50], [600, 80], [700, 40],
];

/**
 * État de chargement du LineChart « Durée moyenne par jour ».
 * Reprend la géométrie du chart réel :
 *  - courbe monotone à 8 points, épaisseur 2px (strokeWidth={2}) ;
 *  - points de diamètre 4px (dot={{ r: 2 }}) → Skeleton size-1 ;
 *  - axe Y avec marge pour l'unité « s », libellés de dates en dessous.
 * `height` doit correspondre à la hauteur du CadreChart / ResponsiveContainer
 * réel pour éviter tout layout shift.
 */
const ChartDureeMoyenneSkeleton = ({ height = 220 }) => (
  <div
    role="status"
    aria-label="Chargement du graphique de durée moyenne par jour"
    className="flex w-full animate-pulse gap-2"
    style={{ height }}
  >
    {/* Axe Y : 3 graduations fictives (marge élargie pour l'unité « s ») */}
    <div className="flex w-8 flex-col justify-between py-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-2 w-full rounded-sm" />
      ))}
    </div>

    {/* Zone du graphique */}
    <div className="flex flex-1 flex-col">
      <div className="relative flex-1 overflow-hidden border-b border-border">
        {/* Courbe monotone — vectorEffect pour garder 2px d'épaisseur
            quel que soit l'étirement du viewBox. */}
        <svg
          viewBox="0 0 700 200"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <polyline
            points={POINTS_COURBE.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke="var(--color-surface-container-high)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Points de la courbe — positionnés en %, diamètre 4px (r: 2) */}
        {POINTS_COURBE.map(([x, y], i) => (
          <Skeleton
            key={x}
            className="absolute size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface-container-high"
            style={{
              left: `${(x / 700) * 100}%`,
              top: `${(y / 200) * 100}%`,
              animationDelay: `${i * 90}ms`,
            }}
          />
        ))}
      </div>

      {/* Libellés de l'axe X (dates) */}
      <div className="mt-2 flex justify-between" aria-hidden="true">
        {POINTS_COURBE.map((_, i) => (
          <Skeleton key={i} className="h-2 w-8 rounded-sm" />
        ))}
      </div>
    </div>
  </div>
);


const ChartDureeMoyJobs = () => {
  const mouvementReduit = useReducedMotion()
  const { data: stats, isLoading, isError, refetch } = useStatsIaQuery(30)

  const etat = isError ? "erreur" : isLoading ? "chargement" : !stats?.jobs_par_jour?.length ? "vide" : "donnees"

  return (
    <SectionCardAdmin
      title="Durée moyenne des jobs par jour"      
      icon={Timer}
    >
      <TransitionEtat etat={etat}>
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger l'état du croisement." />
        ) : isLoading ? (
          <ChartDureeMoyenneSkeleton />
        ) : (
          <CadreChart
            vide={!stats?.duree_moyenne_par_jour?.length}
            videMessage="Aucun job terminé avec durée connue."
          >
            <LineChart data={stats?.duree_moyenne_par_jour ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis
                dataKey="jour"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(j) => new Date(j).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
              />
              <YAxis fontSize={10} tickLine={false} axisLine={false} unit=" s" />
              <Tooltip content={<TooltipChartIA suffixe=" s" />} />
              <Line
                type="monotone"
                dataKey="secondes"
                name="Durée moyenne"
                stroke="#F5A623"
                strokeWidth={2}
                dot={{ r: 2 }}
                isAnimationActive={!mouvementReduit}
                animationDuration={900}
                animationEasing="ease-out"
              />
            </LineChart>
          </CadreChart>
        )}
      </TransitionEtat>
    </SectionCardAdmin>
  )
}

export default ChartDureeMoyJobs