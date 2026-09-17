import CadreChart from "@/components/admin/CadreChart"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { useReducedMotion } from "framer-motion"
import {
  Bar, BarChart, CartesianGrid, Legend,Tooltip, XAxis, YAxis,
} from "recharts"
import {useStatsIaQuery,} from "@/features/admin-ia.tools"
import { Skeleton } from "@/components/ui/skeleton"
import { BarChart3 } from "lucide-react"
import TooltipChartIA from "../components/TooltipChartIA"


const COULEURS_VOLUMES = {
  activees: "#0F2D4D",
  rejetees: "#ef4444",
  revue: "#F5A623",
  retraiter: "#94a3b8",
}

/**
 * Segments par barre, du BAS vers le HAUT (empilement stackId="v" :
 * activées → rejetées → en revue → à retraiter).
 * Profil fidèle aux jobs IA : « activées » domine largement,
 * « à retraiter » reste marginal.
 */
const SEGMENTS_BARRES = [
  [26, 20, 15, 10],
  [48, 18, 12, 5],
  [32, 16, 10, 5],
  [54, 14, 8, 4],
  [28, 12, 6, 3],
  [50, 10, 5, 2],
  [34, 14, 8, 4],
  [56, 12, 6, 3],
  [40, 16, 10, 5],
  [62, 14, 8, 4],
  [46, 18, 12, 5],
  [68, 16, 10, 5],
  [52, 20, 15, 10],
  [58, 22, 15, 10],
  [80, 20, 15, 10],
  [64, 24, 17, 10],
  [76, 28, 21, 10],
  [98, 26, 19, 10],
  [100, 36, 29, 10],
  [122, 34, 27, 10],
  [106, 38, 31, 10],
  [134, 38, 31, 10],
  [118, 42, 35, 10],
];

/**
 * État de chargement du BarChart empilé « Volumes IA par jour ».
 * Reprend la géométrie du chart réel :
 *  - 4 segments empilés par jour, sans arrondi (pas de radius sur les Bar) ;
 *  - axe Y à gauche, libellés de dates en dessous ;
 *  - légende 4 séries en bas (fontSize 10).
 * `height` doit correspondre à la hauteur du CadreChart / ResponsiveContainer
 * réel pour éviter tout layout shift.
 */
const ChartVolumesIaSkeleton = ({ height = 220 }) => (
  <div
    role="status"
    aria-label="Chargement du graphique des volumes IA par jour"
    className="flex w-full flex-col gap-3"
    style={{ height }}
  >
    <div className="flex flex-1 gap-2">
      {/* Axe Y : 3 graduations fictives */}
      <div className="flex w-6 flex-col justify-between py-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-2 w-full rounded-sm" />
        ))}
      </div>

      {/* Zone du graphique */}
      <div className="flex flex-1 flex-col">
        {/* Barres empilées, alignées en bas comme le BarChart */}
        <div className="flex flex-1 items-end gap-3 border-b border-border pb-px">
          {SEGMENTS_BARRES.map((segments, i) => (
            <div key={i} className="flex h-full flex-1 flex-col justify-end gap-px">
              {/* Rendu haut → bas : on inverse l'ordre des segments */}
              {[...segments].reverse().map((h, k) => (
                <Skeleton
                  key={k}
                  className="w-full"
                  style={{
                    height: `${h}%`,
                    animationDelay: `${i * 70 + k * 30}ms`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Libellés de l'axe X (jours) */}
        <div className="mt-2 flex gap-3" aria-hidden="true">
          {SEGMENTS_BARRES.map((_, i) => (
            <Skeleton key={i} className="h-2 flex-1 rounded-sm" />
          ))}
        </div>
      </div>
    </div>

    {/* Légende : équivalent du <Legend wrapperStyle={{ fontSize: 10 }}> — 4 séries */}
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Skeleton className="h-2.5 w-2.5 rounded-xs" />
          <Skeleton className="h-2 w-14 rounded-xs" />
        </div>
      ))}
    </div>
  </div>
);


const ChartVolumesTraites = () => {
  const mouvementReduit = useReducedMotion()
  const { data: stats, isLoading, isError, refetch } = useStatsIaQuery(30)

  const etat = isError ? "erreur" : isLoading ? "chargement" : !stats?.jobs_par_jour?.length ? "vide" : "donnees"
  
  return (
    <SectionCardAdmin
      title="Volumes traités par jour (30 jours)"
      description="Analyse des volumes traités par jour. Voir la documentation pour comprendre les statuts et les triggers."
      icon={BarChart3}
    >
      <TransitionEtat etat={etat}>
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger l'état du croisement." />
        ) : isLoading ? (
          <ChartVolumesIaSkeleton />
        ) : (
          <CadreChart
            vide={!stats?.jobs_par_jour?.length}
            videMessage="Aucun job de normalisation sur la fenêtre."
          >
            <BarChart data={stats?.jobs_par_jour ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis
                dataKey="jour"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(j) => new Date(j).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
              />
              <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip content={<TooltipChartIA />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {Object.entries(COULEURS_VOLUMES).map(([cle, couleur]) => (
                <Bar
                  key={cle}
                  dataKey={cle}
                  name={{ activees: "Activées", rejetees: "Rejetées", revue: "En revue", retraiter: "À retraiter" }[cle]}
                  stackId="v"
                  fill={couleur}
                  isAnimationActive={!mouvementReduit}
                  animationDuration={700}
                  animationEasing="ease-out"
                />
              ))}
            </BarChart>
          </CadreChart>
        )}
      </TransitionEtat>
    </SectionCardAdmin>
  )
}

export default ChartVolumesTraites