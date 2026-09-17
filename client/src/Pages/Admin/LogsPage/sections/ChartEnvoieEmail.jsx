import { useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import {
  Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis,
} from "recharts"
import { useEmailsTxStatsQuery } from "@/features/admin-logs.tools"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { CalendarDays } from "lucide-react"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import TooltipChart from "../components/TooltipChart"
import CadreChart from "@/components/admin/CadreChart"
import { cn } from "cn"

const COULEURS_STATUT = { sent: "#0F2D4D", failed: "#ef4444", queued: "#F5A623" }

/* ─────────────────────────────────────────────────────────────────────
   Profil réaliste d'emails transactionnels sur 30 j : envoyés très
   largement dominants, échecs marginaux, file d'attente réduite.
   Segments par barre, du BAS vers le HAUT (ordre d'empilement Recharts
   avec stackId="s" : Envoyés → Échecs → En file).
───────────────────────────────────────────────────────────────────── */
const SEGMENTS_BARRES_EMAILS = [
  [62],
  [55],
  [68],
  [58],
  [64],
  [70],
  [60],
]

/* Nuances neutres par segment (bas → haut) pour rendre l'empilement
   lisible sans préjuger des couleurs réelles des séries. */
const TONS_SEGMENTS = [
  "bg-surface-container-high",    // Envoyés (bas)
  "bg-surface-container-highest", // Échecs (milieu)
  "bg-muted",                     // En file (haut)
]

/**
 * État de chargement du BarChart empilé « Envois par jour (30 j) ».
 * Reprend la géométrie du chart réel :
 *  - 3 segments empilés par jour (Envoyés en bas, Échecs au milieu,
 *    En file en haut), séparés par un gap de 1px ;
 *  - arrondi [4, 4, 0, 0] appliqué UNIQUEMENT au segment du haut
 *    (En file), comme sur le <Bar radius={[4, 4, 0, 0]}> réel ;
 *  - axe Y à gauche (marge left:-20 du chart), libellés de jours en
 *    dessous, grille horizontale en pointillé (border-b) ;
 *  - légende 3 séries en bas (fontSize 11).
 * `height` doit correspondre à la hauteur du CadreChart réel pour
 * éviter tout layout shift.
 */
const ChartEmailsParJourSkeleton = ({ height = 220 }) => (
  <div
    role="status"
    aria-label="Chargement du graphique des envois par jour"
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
          {SEGMENTS_BARRES_EMAILS.map((segments, i) => (
            <div key={i} className="flex h-full flex-1 flex-col justify-end gap-px">
              {/* Rendu haut → bas : on inverse l'ordre des segments.
                  Le PREMIER rendu (En file, segment du haut) porte
                  l'arrondi [4,4,0,0] comme le <Bar radius> réel. */}
              {[...segments].reverse().map((h, k) => (
                <Skeleton
                  key={k}
                  className={cn(
                    "w-full",
                    k === 0 && "rounded-t-sm",
                    TONS_SEGMENTS[segments.length - 1 - k]
                  )}
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
          {SEGMENTS_BARRES_EMAILS.map((_, i) => (
            <Skeleton key={i} className="h-2 flex-1 rounded-sm" />
          ))}
        </div>
      </div>
    </div>
    {/* Légende : équivalent du <Legend wrapperStyle={{ fontSize: 11 }}>
        — 3 séries (Envoyés, Échecs, En file). */}
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Skeleton className="h-2.5 w-2.5 rounded-xs" />
          <Skeleton className="h-2 w-16 rounded-xs" />
        </div>
      ))}
    </div>
  </div>
)

const ChartEnvoieEmail = () => {
  const mouvementReduit = useReducedMotion()
  const { data: stats, isLoading, isError, refetch } = useEmailsTxStatsQuery(30)

  // M5 : par jour empilé par statut.
  const parJour = useMemo(
    () =>
      (stats?.par_jour ?? []).map((j) => ({
        jour: new Date(`${j.jour}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        Envoyés: j.par_statut?.sent ?? 0,
        Échecs: j.par_statut?.failed ?? 0,
        "En file": j.par_statut?.queued ?? 0,
      })),
    [stats]
  )

  const etat = isError ? "erreur" : isLoading ? "chargement" : !stats?.jobs_par_jour?.length ? "vide" : "donnees"

  return (
    <SectionCardAdmin
      title="Envois par jour (30 j)"
      description="Comparaison des envois par jour sur les derniers 30 jours."
      icon={CalendarDays}
    >
      <TransitionEtat etat={etat}>
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger l'état du croisement." />
        ) : isLoading ? (
          <ChartEmailsParJourSkeleton />
        ) : (
          <CadreChart vide={!parJour.length} videMessage="Aucun envoi dans la fenêtre.">
            <BarChart data={parJour} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="jour" fontSize={10} tickLine={false} />
              <YAxis allowDecimals={false} fontSize={10} tickLine={false} />
              <Tooltip content={<TooltipChart />} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Envoyés" stackId="s" fill={COULEURS_STATUT.sent} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" />
              <Bar dataKey="Échecs" stackId="s" fill={COULEURS_STATUT.failed} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" />
              <Bar dataKey="En file" stackId="s" fill={COULEURS_STATUT.queued} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" radius={[4, 4, 0, 0]} />
            </BarChart>
          </CadreChart>
        )}
      </TransitionEtat>
    </SectionCardAdmin>
  )
}

export default ChartEnvoieEmail