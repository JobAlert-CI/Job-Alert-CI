import { useMemo } from "react"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts"
import { Database } from "lucide-react"
import { useAdminRunsQuery } from "@/features/admin-dashboard.tools"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Section — Volume d'ingestion par run (barres groupées).

   Réutilise la même requête que RunsRecents (queryKey identique →
   zéro appel réseau supplémentaire) avec limit=10 : insérées /
   mises à jour / doublons par run, les erreurs en sur-impression.
   Router dashboard : accessible à tous les rôles admin.
   ───────────────────────────────────────────────────────────────────── */

const SERIES = [
  { key: "total_inserted", libelle: "Insérées", couleur: "#0f766e" },
  { key: "total_updated", libelle: "Mises à jour", couleur: "#0891b2" },
  { key: "total_duplicates", libelle: "Doublons", couleur: "#d97706" },
]

const TooltipPerso = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-muted-foreground">
          {p.name} : {p.value}
        </p>
      ))}
    </div>
  )
}

const VolumeIngestion = () => {
  const { data, isLoading, isError, refetch } = useAdminRunsQuery({ limit: 10 })

  const parRun = useMemo(
    () =>
      (data ?? [])
        .slice()
        .reverse() // chronologique gauche → droite
        .map((run, i) => ({
          nom: `#${data.length - i}`,
          date: new Date(run.started_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
          ...SERIES.reduce((acc, s) => ({ ...acc, [s.key]: run[s.key] ?? 0 }), {}),
        })),
    [data]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="size-4 text-primary" aria-hidden />
          Volume d'ingestion — 10 derniers runs
        </CardTitle>
        <CardDescription>
          Offres insérées, mises à jour et doublons détectés à chaque passage de scraping.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger le volume d'ingestion." />
        ) : isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !parRun.length ? (
          <SectionVide message="Aucun run de scraping enregistré." />
        ) : (
          <div className="h-48 w-full" role="img" aria-label="Volume d'offres insérées, mises à jour et en doublons par run de scraping">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={parRun} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e9eb)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<TooltipPerso />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {SERIES.map((s) => (
                  <Bar key={s.key} dataKey={s.key} name={s.libelle} fill={s.couleur} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default VolumeIngestion
