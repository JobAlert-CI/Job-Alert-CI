import { useMemo } from "react"
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { useAdminScrapingRunsQuery } from "@/features/admin-scraping.tools"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { LIBELLE_STATUT_RUN } from "../components/statuts-scraping"

/* ─────────────────────────────────────────────────────────────────────
   Charts de la page Scraping (cycle 10, sélection validée) :
   1. Durée par run (barres) — fenêtre 30 derniers runs ;
   2. Donut statut des derniers runs (réussi / échec partiel /
      échoué / en cours) — même fenêtre.

   Données : GET /runs?limit=30 (même queryKey que l'historique →
   zéro appel réseau en plus). Recharts confiné au chunk lazy de la
   page, isAnimationActive={false} (MotionConfig reducedMotion global),
   légende HTML recharts (lisible lecteurs d'écran).
   ───────────────────────────────────────────────────────────────────── */

const COULEURS_STATUT = {
  success: "#10b981",
  partial_failure: "#f59e0b",
  failed: "#ef4444",
  running: "#2563eb",
  pending: "#94a3b8",
}

const CadreChart = ({ titre, chargement, vide, videMessage, children, minHeight = 220, className = "" }) => (
  <div className={`flex flex-col gap-2 rounded-xl border border-border bg-card p-4 ${className}`}>
    <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{titre}</h3>
    {chargement ? (
      <Skeleton className="w-full rounded-lg" style={{ height: minHeight }} />
    ) : vide ? (
      <Empty className="py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon" />
          <EmptyTitle>Pas encore de données</EmptyTitle>
          <EmptyDescription>{videMessage}</EmptyDescription>
        </EmptyHeader>
      </Empty>
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
  const { data: runs, isLoading } = useAdminScrapingRunsQuery({ limit: 30 })

  // Durée par run (plus ancien → plus récent pour la lecture gauche→droite).
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

  // Donut statuts : répartition des 30 derniers runs.
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
    <div className="grid gap-4 xl:grid-cols-3">
      {/* 1. Durée par run — barres colorées par statut (2 colonnes) */}
      <CadreChart
        titre="Durée par run (30 derniers)"
        chargement={isLoading}
        vide={!donneesDuree.length}
        videMessage="Aucun run terminé avec durée connue."
        className="xl:col-span-2"
      >
        <BarChart data={donneesDuree} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="run" fontSize={10} tickLine={false} />
            <YAxis allowDecimals={false} fontSize={10} tickLine={false} unit=" s" />
            <Tooltip formatter={(v) => [`${v} s`, "Durée"]} />
            <Bar dataKey="secondes" name="Durée" isAnimationActive={false} radius={[4, 4, 0, 0]}>
              {donneesDuree.map((d, i) => (
                <Cell key={i} fill={COULEURS_STATUT[d.statut] ?? "#2563eb"} />
              ))}
            </Bar>
        </BarChart>
      </CadreChart>

      {/* 2. Donut statuts des derniers runs */}
      <CadreChart
        titre="Statut des 30 derniers runs"
        chargement={isLoading}
        vide={!donneesStatuts.length}
        videMessage="Aucun run enregistré."
      >
        <PieChart>
          <Tooltip />
          <Legend />
          <Pie
            data={donneesStatuts}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            isAnimationActive={false}
          >
            {donneesStatuts.map((d) => (
              <Cell key={d.name} fill={d.couleur} />
            ))}
          </Pie>
        </PieChart>
      </CadreChart>
    </div>
  )
}

export default ChartsScraping
