import { useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import {
  Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis,
} from "recharts"
import { useLogsStatsQuery } from "@/features/admin-logs.tools"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { CalendarDays } from "lucide-react"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import TooltipChart from "../components/TooltipChart"
import CadreChart from "@/components/admin/CadreChart"

const COULEURS_NIVEAU = { error: "#ef4444", warning: "#f59e0b", info: "#0F2D4D" }

/**
 * Segments par barre, du BAS vers le HAUT (ordre d'empilement Recharts
 * avec stackId="n" : Erreurs → Avertissements → Infos).
 * Profil réaliste d'un journal technique : infos largement dominantes,
 * avertissements moyens, erreurs marginales.
 */
const SEGMENTS_BARRES = [
  [68],
  [54],
  [72],
  [60],
  [58],
  [64],
  [70],
];

/**
 * État de chargement du BarChart empilé « Événements par jour et niveau ».
 * Reprend la géométrie du chart réel :
 *  - 3 segments empilés par jour (Erreurs en bas, Avertissements au
 *    milieu, Infos en haut), séparés par un gap de 1px ;
 *  - arrondi [4, 4, 0, 0] appliqué UNIQUEMENT au segment du haut
 *    (Infos), comme sur le <Bar radius={[4, 4, 0, 0]}> réel ;
 *  - axe Y à gauche, libellés de jours en dessous ;
 *  - légende 3 séries en bas (fontSize 11).
 * `height` doit correspondre à la hauteur du CadreChart / ResponsiveContainer
 * réel pour éviter tout layout shift.
 */
const ChartNiveauxJourSkeleton = ({ height = 220 }) => (
  <div
    role="status"
    aria-label="Chargement du graphique des événements par jour et niveau"
    className="flex w-full flex-col gap-3 p-2"
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
              {/* Rendu haut → bas : on inverse l'ordre des segments.
                  Le PREMIER rendu (Infos, segment du haut) porte l'arrondi
                  [4,4,0,0] comme le <Bar radius={[4, 4, 0, 0]}> réel. */}
              {[...segments].reverse().map((h, k) => (
                <Skeleton
                  key={k}
                  className={k === 0 ? "w-full rounded-t-sm" : "w-full"}
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

    {/* Légende : équivalent du <Legend wrapperStyle={{ fontSize: 11 }}> — 3 séries */}
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Skeleton className="h-2.5 w-2.5 rounded-xs" />
          <Skeleton className="h-2 w-16 rounded-xs" />
        </div>
      ))}
    </div>
  </div>
);

const ChartEvenements = () => {
  const mouvementReduit = useReducedMotion()
  const { data: stats, isLoading, isError, refetch } = useLogsStatsQuery(30)
  const parJourNiveau = useMemo(
    () =>
      (stats?.events_par_jour ?? []).map((j) => ({
        jour: new Date(`${j.jour}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        Erreurs: (j.par_action.failed ?? 0),
        Avertissements: (j.par_action.skipped ?? 0),
        Infos: (j.par_action.inserted ?? 0) + (j.par_action.updated ?? 0) + (j.par_action.duplicate ?? 0),
      })),
    [stats]
  )

  const etat = isError ? "erreur" : isLoading ? "chargement" : !stats?.jobs_par_jour?.length ? "vide" : "donnees"

  return (
    <SectionCardAdmin
      title="Événements par jour (30 j)"
      description="Statistiques des événements par jour, empilé par niveau."
      contentClassName="p-0 sm:p-0"
      icon={CalendarDays}
    >
      <TransitionEtat etat={etat}>
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger l'état du croisement." />
        ) : isLoading ? (
          <ChartNiveauxJourSkeleton />
        ) : (
          <CadreChart vide={!parJourNiveau.length} videMessage="Aucun événement dans la fenêtre.">
            <BarChart data={parJourNiveau} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="jour" fontSize={10} tickLine={false} />
              <YAxis allowDecimals={false} fontSize={10} tickLine={false} />
              <Tooltip content={<TooltipChart />} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Erreurs" stackId="n" fill={COULEURS_NIVEAU.error} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" />
              <Bar dataKey="Avertissements" stackId="n" fill={COULEURS_NIVEAU.warning} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" />
              <Bar dataKey="Infos" stackId="n" fill={COULEURS_NIVEAU.info} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" radius={[4, 4, 0, 0]} />
            </BarChart>
          </CadreChart>
        )}
      </TransitionEtat>
    </SectionCardAdmin>
  )
}

export default ChartEvenements