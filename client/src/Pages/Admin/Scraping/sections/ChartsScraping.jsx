import { useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, Tooltip, XAxis, YAxis,
} from "recharts"
import { PieChartIcon, Timer } from "lucide-react"
import { useAdminScrapingRunsQuery } from "@/features/admin-scraping.tools"
import { Skeleton } from "@/components/ui/skeleton"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { LIBELLE_STATUT_RUN } from "../components/statuts-scraping"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import CadreChart from "@/components/admin/CadreChart"


const COULEURS_STATUT = {
  success: "#0F2D4D",
  partial_failure: "#f59e0b",
  failed: "#ef4444",
  running: "#F5A623",
  pending: "#94a3b8",
}

const TooltipDuree = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const p = payload[0]
  
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-popover p-3 text-sm shadow-md">
      <p className="font-semibold text-foreground">{label}</p>
      
      <div className="flex flex-col gap-1">
        {/* Ligne Durée */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div 
              className="h-2 w-2 rounded-full" 
              style={{ backgroundColor: p.fill || p.color || "currentColor" }} 
            />
            <span className="text-muted-foreground">Durée</span>
          </div>
          <span className="font-medium tabular-nums">{p.value} s</span>
        </div>

        {/* Ligne Statut */}
        <div className="flex items-center justify-between gap-4">
          <span className="ml-3.5 text-muted-foreground">Statut</span>
          <span className="font-medium">
            {LIBELLE_STATUT_RUN[p.payload.statut] ?? p.payload.statut}
          </span>
        </div>
      </div>
    </div>
  )
}

const TooltipStatut = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const p = payload[0]
  
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-popover p-3 text-sm shadow-md">
      {/* En-tête avec pastille de couleur */}
      <div className="flex items-center gap-1.5">
        <div 
          className="h-2 w-2 rounded-full" 
          style={{ backgroundColor: p.fill || p.color || "currentColor" }} 
        />
        <p className="font-semibold text-foreground">{p.name}</p>
      </div>
      
      {/* Valeur */}
      <div className="flex items-center justify-between gap-4 mt-0.5">
        <span className="ml-3.5 text-muted-foreground">Total</span>
        <span className="font-medium tabular-nums">
          {p.value} run{p.value > 1 ? "s" : ""}
        </span>
      </div>
    </div>
  )
}


/** Hauteurs fictives (%) qui imitent le profil réel du BarChart. */
const HAUTEURS_BARRES = [58, 42, 76, 30, 88, 50, 68];

const ChartDureeSkeleton = ({ height = 220 }) => {
  return (
    <div
      role="status"
      aria-label="Chargement du graphique des durées"
      className="flex w-full gap-2"
      style={{ height }}
    >
      {/* Axe Y : 3 graduations fictives */}
      <div className="flex w-6 flex-col justify-between py-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-2 w-full rounded-sm" />
        ))}
      </div>

      {/* Zone du graphique */}
      <div className="flex flex-1 flex-col">
        {/* Barres, alignées en bas comme le BarChart */}
        <div className="flex flex-1 items-end gap-3 border-b border-border pb-px">
          {HAUTEURS_BARRES.map((h, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t-sm"
              style={{ height: `${h}%`, animationDelay: `${i * 90}ms` }}
            />
          ))}
        </div>

        {/* Libellés de l'axe X */}
        <div className="mt-2 flex gap-3" aria-hidden="true">
          {HAUTEURS_BARRES.map((_, i) => (
            <Skeleton key={i} className="h-2 flex-1 rounded-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}

const ChartStatutsSkeleton = ({ height = 220 }) => {
  return (
    <div
      role="status"
      aria-label="Chargement du graphique de répartition par statut"
      className="flex h-full w-full animate-pulse flex-col items-center justify-center gap-3"
      style={{ height }}
    >
      {/* Donut : 4 segments neutres séparés par des gaps de 2° */}
      <div className="relative aspect-square w-full max-w-37.5">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(
              var(--color-muted) 0deg 138deg,
              transparent 138deg 140deg,
              var(--color-surface-container-high) 140deg 228deg,
              transparent 228deg 230deg,
              var(--color-muted) 230deg 288deg,
              transparent 288deg 290deg,
              var(--color-surface-container-high) 290deg 358deg,
              transparent 358deg 360deg
            )`,
          }}
        />
        {/* Trou central (innerRadius 55% / outerRadius 80%) */}
        <div className="absolute rounded-full bg-card" style={{ inset: "15.6%" }} />
      </div>

      {/* Légende : pastilles + libellés, équivalent fontSize 10 */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Skeleton className="h-2.5 w-2.5 rounded-xs" />
            <Skeleton className="h-2 w-12 rounded-xs" />
          </div>
        ))}
      </div>
    </div>
  );
}

const ChartsScraping = () => {
  const mouvementReduit = useReducedMotion()
  const { data: runs, isLoading, isError, refetch } = useAdminScrapingRunsQuery({ limit: 30 })  

  /* Durée par run (plus ancien → plus récent, lecture gauche → droite). */
  const donneesDuree = useMemo(
    () =>
      [...(runs ?? [])]
        .reverse()
        .map((r) => ({
          run: r.started_at ? new Date(r.started_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : r.run_date,
          secondes:
            r.started_at && r.finished_at
              ? Math.round((new Date(r.finished_at) - new Date(r.started_at)) / 1000)
              : null,
          statut: r.status,
        }))
        .filter((d) => d.secondes !== null),
    [runs]
  )

  /* Donut statuts : répartition des 30 derniers runs. */
  const donneesStatuts = useMemo(() => {
    const compte = {}
    for (const r of runs ?? []) compte[r.status] = (compte[r.status] ?? 0) + 1
    return Object.entries(compte).map(([statut, valeur]) => ({
      name: LIBELLE_STATUT_RUN[statut] ?? statut,
      value: valeur,
      couleur: COULEURS_STATUT[statut] ?? "#64748b",
    }))
  }, [runs])

  /* Clé d'état propre à chaque chart : chargement / erreur / vide / données. */
  const etatDuree = isError ? "erreur" : isLoading ? "chargement" : !donneesDuree.length ? "vide" : "donnees";
  const etatStatuts = isError ? "erreur" : isLoading ? "chargement" : !donneesStatuts.length ? "vide" : "donnees";


  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {/* 1. Durée par run — barres colorées par statut (2 colonnes) */}
      <div className="xl:col-span-2">
        <SectionCardAdmin
          title="Durée par run"
          description="Durée d'exécution des 30 derniers runs, par statut."
          icon={Timer}
        >
          <TransitionEtat etat={etatDuree}>
            {isError ? (
              <SectionErreur onRetry={refetch} message="Impossible de charger les durées des runs." />
            ) : isLoading ? (
              <ChartDureeSkeleton />
            ) : (
              <CadreChart
                vide={!donneesDuree.length}
                videMessage="Aucun run terminé avec durée connue."
              >
                <BarChart data={donneesDuree} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="run" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} unit=" s" />
                  <Tooltip content={<TooltipDuree />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
                  <Bar
                    dataKey="secondes"
                    name="Durée"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={!mouvementReduit}
                    animationDuration={700}
                    animationEasing="ease-out"
                  >
                    {donneesDuree.map((d, i) => (
                      <Cell key={i} fill={COULEURS_STATUT[d.statut] ?? "#2563eb"} />
                    ))}
                  </Bar>
                </BarChart>
              </CadreChart>
            )}
          </TransitionEtat>
        </SectionCardAdmin>
      </div>

      {/* 2. Donut statuts des derniers runs */}
      <SectionCardAdmin
        title="Statut des runs"
        description="Statut des 30 derniers runs."
        icon={PieChartIcon}
      >
        <TransitionEtat etat={etatStatuts}>
          {isError ? (
            <SectionErreur onRetry={refetch} message="Impossible de charger les statuts des runs." />
          ) : isLoading ? (
            <ChartStatutsSkeleton />
          ) : (
            <CadreChart
              vide={!donneesStatuts.length}
              videMessage="Aucun run enregistré."
            >
              <PieChart>
                <Tooltip content={<TooltipStatut />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Pie
                  data={donneesStatuts}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {donneesStatuts.map((d) => (
                    <Cell key={d.name} fill={d.couleur} />
                  ))}
                </Pie>
              </PieChart>
            </CadreChart>
          )}
        </TransitionEtat>
      </SectionCardAdmin>
    </div>
  )
}

export default ChartsScraping