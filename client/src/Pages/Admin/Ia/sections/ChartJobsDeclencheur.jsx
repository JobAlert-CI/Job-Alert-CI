import { useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis, } from "recharts"
import { TRIGGERS_JOB, useStatsIaQuery, } from "@/features/admin-ia.tools"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { Zap } from "lucide-react"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import CadreChart from "@/components/admin/CadreChart"
import TooltipChartIA from "../components/TooltipChartIA"
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Largeurs fictives (%) : sweep largement dominant, manuel marginal —
 * profil conforme aux déclencheurs réels (beat:schedule vs admin).
 */
const LARGEURS_BARRES = [84, 36];

/**
 * État de chargement du BarChart horizontal « Jobs IA par déclencheur ».
 * Reprend la géométrie du chart réel (layout="vertical") :
 *  - axe catégoriel à gauche, largeur 120px (width={120}) ;
 *  - barres horizontales alignées à gauche, bout droit arrondi
 *    (radius [0, 4, 4, 0]) ;
 *  - axe numérique en dessous.
 * `height` doit correspondre à la hauteur du ResponsiveContainer réel.
 */
const ChartJobsTriggerSkeleton = ({ height = 220 }) => (
  <div
    role="status"
    aria-label="Chargement du graphique des jobs IA par déclencheur"
    className="flex w-full flex-col gap-2"
    style={{ height }}
  >
    {/* Zone du graphique : axe catégoriel + barres horizontales */}
    <div className="flex flex-1 gap-2">
      {/* Axe Y catégoriel : libellés des déclencheurs (width={120}) */}
      <div className="flex w-30 shrink-0 flex-col justify-around py-1" aria-hidden="true">
        {LARGEURS_BARRES.map((_, i) => (
          <Skeleton
            key={i}
            className="h-2.5 w-full rounded-sm"
            style={{ animationDelay: `${i * 90}ms` }}
          />
        ))}
      </div>

      {/* Barres, alignées à gauche comme le BarChart horizontal */}
      <div className="flex flex-1 flex-col justify-around border-b border-border pb-px">
        {LARGEURS_BARRES.map((l, i) => (
          <Skeleton
            key={i}
            className="h-4 rounded-r-sm"
            style={{ width: `${l}%`, animationDelay: `${i * 90 + 40}ms` }}
          />
        ))}
      </div>
    </div>

    {/* Axe X numérique : graduations sous la zone des barres,
        décalées de la largeur de l'axe catégoriel */}
    <div className="flex gap-2" aria-hidden="true">
      <div className="w-30 shrink-0" />
      <div className="flex flex-1 justify-between">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-2 w-6 rounded-sm" />
        ))}
      </div>
    </div>
  </div>
);


const ChartJobsDeclencheur = () => {
  const mouvementReduit = useReducedMotion()
  const { data: stats, isLoading, isError, refetch } = useStatsIaQuery(30)

  const parTrigger = useMemo(
    () =>
      Object.entries(stats?.jobs_par_trigger ?? {}).map(([valeur, total]) => ({
        trigger: TRIGGERS_JOB[valeur] ?? valeur,
        jobs: total,
      })),
    [stats]
  )

  const etat = isError ? "erreur" : isLoading ? "chargement" : !stats?.jobs_par_jour?.length ? "vide" : "donnees"

  return (
    <SectionCardAdmin
      title="Jobs par déclencheur (30 jours)"
      icon={Zap}
    >
      <TransitionEtat etat={etat}>
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger l'état du croisement." />
        ) : isLoading ? (
          <ChartJobsTriggerSkeleton />
        ) : (
          <CadreChart
            vide={!parTrigger.length}
            videMessage="Aucun job sur la fenêtre."
          >
            <BarChart data={parTrigger} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: -40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
              <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="trigger" fontSize={10} tickLine={false} axisLine={false} width={120} />
              <Tooltip content={<TooltipChartIA />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
              <Bar
                dataKey="jobs"
                name="Jobs"
                radius={[0, 4, 4, 0]}
                isAnimationActive={!mouvementReduit}
                animationDuration={700}
                animationEasing="ease-out"
              >
                {parTrigger.map((e) => <Cell key={e.trigger} fill="#0F2D4D" />)}
              </Bar>
            </BarChart>
          </CadreChart>
        )}
      </TransitionEtat>
    </SectionCardAdmin>
  )
}

export default ChartJobsDeclencheur