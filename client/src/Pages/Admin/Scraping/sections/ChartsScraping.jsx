import { useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { BarChart3 } from "lucide-react"
import { useAdminScrapingRunsQuery } from "@/features/admin-scraping.tools"
import { Skeleton } from "@/components/ui/skeleton"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { SectionVide } from "../components/EtatsSection"
import { LIBELLE_STATUT_RUN } from "../components/statuts-scraping"


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
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-semibold">{label}</p>
      <p className="text-muted-foreground">Durée : {p.value} s</p>
      <p className="text-muted-foreground">
        Statut : {LIBELLE_STATUT_RUN[p.payload.statut] ?? p.payload.statut}
      </p>
    </div>
  )
}

const TooltipStatut = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-semibold">{p.name}</p>
      <p className="text-muted-foreground">{p.value} run{p.value > 1 ? "s" : ""}</p>
    </div>
  )
}

/* Cadre interne : titre + skeleton / vide / chart (chaque chart garde
   son propre cycle d'états). */
const CadreChart = ({ titre, chargement, vide, videMessage, minHeight = 220, className = "", children }) => (
  <div className={`flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4 ${className}`}>
    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">{titre}</h3>
    {chargement ? (
      <Skeleton className="w-full rounded-lg" style={{ height: minHeight }} />
    ) : vide ? (
      <SectionVide message={videMessage} />
    ) : (
      <div style={{ height: minHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    )}
  </div>
)

const ChartsScraping = () => {
  const mouvementReduit = useReducedMotion()
  const { data: runs, isLoading } = useAdminScrapingRunsQuery({ limit: 30 })

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

  return (
    <SectionCardAdmin
      title="Analyse des runs"
      description="Durée d'exécution et répartition des statuts sur les 30 derniers runs."
      icon={BarChart3}
    >
      <div className="grid gap-4 xl:grid-cols-4">
        {/* 1. Durée par run — barres colorées par statut (2 colonnes) */}
        <CadreChart
          titre="Durée par run"
          chargement={isLoading}
          vide={!donneesDuree.length}
          videMessage="Aucun run terminé avec durée connue."
          className="xl:col-span-3"
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

        {/* 2. Donut statuts des derniers runs */}
        <CadreChart
          titre="Statut des runs"
          chargement={isLoading}
          vide={!donneesStatuts.length}
          videMessage="Aucun run enregistré."
        >
          <ResponsiveContainer width="100%" height={250}>
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
          </ResponsiveContainer>
        </CadreChart>
      </div>
    </SectionCardAdmin>
  )
}

export default ChartsScraping