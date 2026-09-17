import { useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import {Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis,} from "recharts"
import { SEVERITES, useStatsIaQuery,} from "@/features/admin-ia.tools"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { ShieldAlert } from "lucide-react"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import CadreChart from "@/components/admin/CadreChart"
import TooltipChartIA from "../components/TooltipChartIA"

const COULEURS_SEVERITE = {
  info: "#0F2D4D",
  warning: "#F5A623",
  error: "#ef4444",
  critical: "#7f1d1d",
}

/**
 * Largeurs fictives (%) : profil décroissant par sévérité
 * (warning dominant, puis critical, puis info) — à caler sur le
 * nombre réel de niveaux affichés par `parSeverite`.
 */
const LARGEURS_BARRES = [68, 44, 22];

/**
 * État de chargement du BarChart horizontal « Alertes IA par sévérité ».
 * Reprend la géométrie du chart réel (layout="vertical") :
 *  - axe catégoriel à gauche, largeur 120px (width={120}) ;
 *  - barres horizontales alignées à gauche, bout droit arrondi
 *    (radius [0, 4, 4, 0]) ;
 *  - axe numérique en dessous.
 * `height` doit correspondre à la hauteur du ResponsiveContainer réel.
 */
const ChartAlertesSeveriteSkeleton = ({ height = 220 }) => (
  <div
    role="status"
    aria-label="Chargement du graphique des alertes IA par sévérité"
    className="flex w-full flex-col gap-2"
    style={{ height }}
  >
    {/* Zone du graphique : axe catégoriel + barres horizontales */}
    <div className="flex flex-1 gap-2">
      {/* Axe Y catégoriel : libellés des sévérités (width={120}) */}
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

const ChartAlertesSeverite = () => {
  const mouvementReduit = useReducedMotion()
    const { data: stats, isLoading, isError, refetch } = useStatsIaQuery(30)
  
    // C5 : alertes non acquittées par sévérité (ordre du vocabulaire).
    const parSeverite = useMemo(
      () =>
        Object.entries(SEVERITES)
          .map(([valeur, conf]) => ({
            severite: conf.libelle,
            alertes: stats?.alertes_non_acquittees?.[valeur] ?? 0,
            couleur: COULEURS_SEVERITE[valeur],
          }))
          .filter((e) => e.alertes > 0),
      [stats]
    )

  const etat = isError ? "erreur" : isLoading ? "chargement" : !stats?.jobs_par_jour?.length ? "vide" : "donnees"

  return (
    <SectionCardAdmin
      title="Alertes non acquittées par sévérité"
      icon={ShieldAlert}
    >
      <TransitionEtat etat={etat}>
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger l'état du croisement." />
        ) : isLoading ? (
          <ChartAlertesSeveriteSkeleton />
        ) : (
          <CadreChart                      
            vide={!parSeverite.length}
            videMessage="Aucune alerte en attente."
          >
            <BarChart data={parSeverite} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: -50 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
              <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="severite" fontSize={10} tickLine={false} axisLine={false} width={120} />
              <Tooltip content={<TooltipChartIA suffixe=" alerte(s)" />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
              <Bar
                dataKey="alertes"
                name="Alertes"
                radius={[0, 4, 4, 0]}
                isAnimationActive={!mouvementReduit}
                animationDuration={700}
                animationEasing="ease-out"
              >
                {parSeverite.map((e) => <Cell key={e.severite} fill={e.couleur} />)}
              </Bar>
            </BarChart>
          </CadreChart>
        )}
      </TransitionEtat>
    </SectionCardAdmin>
  )
}

export default ChartAlertesSeverite