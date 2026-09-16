import { useMemo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts"
import { Database } from "lucide-react"
import { useAdminRunsQuery } from "@/features/admin-dashboard.tools"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionErreur, SectionVide } from "../../../../components/admin/EtatsSection"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { usePeutVoirEnvois } from "@/features/admin-matching.tools"
import CadreChart from "@/components/admin/CadreChart"


const SERIES = [
  { key: "total_inserted", libelle: "Insérées", couleur: "#0F2D4D" },
  { key: "total_updated", libelle: "Mises à jour", couleur: "#0891b2" },
  { key: "total_duplicates", libelle: "Doublons", couleur: "#F5A623" },
]

const formatNombre = (v) => (Number(v) || 0).toLocaleString("fr-FR")

const TooltipIngestion = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null

  // Optionnel : Calculer le total pour l'afficher en bas du tooltip
  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0)

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-popover p-3.5 text-sm shadow-lg min-w-55">
      {/* En-tête : Période ou libellé */}
      <div className="font-semibold text-foreground border-b border-border/40 pb-2">
        {label}
      </div>

      {/* Détail par série */}
      <div className="flex flex-col gap-1.5">
        {payload.map((p) => (
          <div
            key={p.dataKey || p.name}
            className="flex items-center justify-between gap-6"
          >
            {/* Gauche : Pastille + Nom */}
            <div className="flex items-center gap-2.5">
              <div
                className="h-2 w-2 rounded-full shrink-0 shadow-sm"
                style={{
                  backgroundColor: p.color || p.fill || p.stroke || "currentColor"
                }}
              />
              <span className="text-muted-foreground truncate max-w-30" title={p.name}>
                {p.name}
              </span>
            </div>

            {/* Droite : Valeur (alignée avec police à chasse fixe pour les nombres) */}
            <span className="font-medium text-foreground tabular-nums">
              {formatNombre(p.value)}
            </span>
          </div>
        ))}
      </div>

      {/* Optionnel : Ligne de Total (très utile pour l'ingestion) */}
      {payload.length > 1 && (
        <div className="flex items-center justify-between border-t border-border/40 pt-2.5">
          <span className="text-foreground font-semibold">Total</span>
          <span className="font-bold text-foreground tabular-nums">
            {formatNombre(total)}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Un groupe par run (axe X), 4 séries par groupe — hauteurs en %.
 * Profil fidèle à l'ingestion : séries d'ampleur inégale
 * (ex. brutes > insérées > mises à jour > erreurs).
 * ⚠️ 4 barres par groupe à caler sur SERIES.length.
 */
const GROUPES_BARRES = [
  [46, 22, 30, 8],
  [62, 30, 24, 5],
  [38, 18, 26, 10],
  [70, 34, 20, 4],
  [52, 26, 32, 7],
  [44, 20, 28, 6],
  [66, 32, 22, 9],
];

/**
 * État de chargement du BarChart groupé d'ingestion par run.
 * `height` doit correspondre à la hauteur du CadreChart / ResponsiveContainer
 * réel (légende incluse) pour éviter tout layout shift.
 */
const ChartIngestionSkeleton = ({ height = 220 }) => (
  <div
    role="status"
    aria-label="Chargement du graphique d'ingestion par run"
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
        {/* Groupes de barres juxtaposées, alignées en bas */}
        <div className="flex flex-1 items-end gap-4 border-b border-border pb-px">
          {GROUPES_BARRES.map((groupe, i) => (
            <div key={i} className="flex h-full flex-1 items-end gap-0.5">
              {groupe.map((h, k) => (
                <Skeleton
                  key={k}
                  className="w-full"
                  style={{
                    height: `${h}%`,
                    animationDelay: `${i * 70 + k * 25}ms`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Libellés de l'axe X (dates des runs) */}
        <div className="mt-2 flex gap-4" aria-hidden="true">
          {GROUPES_BARRES.map((_, i) => (
            <Skeleton key={i} className="h-2 flex-1 rounded-sm" />
          ))}
        </div>
      </div>
    </div>

    {/* Légende : équivalent du <Legend wrapperStyle={{ fontSize: 10 }}> */}
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


const VolumeIngestion = () => {
  const autorise = usePeutVoirEnvois()
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
    <SectionCardAdmin
      title="Volume d'ingestion (10 derniers runs)"
      description="Offres insérées, mises à jour et doublons détectés à chaque passage de scraping."
      icon={Database}
    >
      {!autorise ? (
        <SectionVide message="Statistiques d'envoi réservées aux super admins et gestionnaires utilisateurs." />
      ) : isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger le volume d'ingestion." />
      ) : isLoading ? (
        <ChartIngestionSkeleton />
      ) : (
        <CadreChart vide={!parRun.length} videMessage="Aucun run de scraping enregistré.">
          <BarChart data={parRun} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e9eb)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<TooltipIngestion />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {SERIES.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.libelle}
                fill={s.couleur}
                animationDuration={700}
                animationEasing="ease-out"
              />
            ))}
          </BarChart>
        </CadreChart>
      )}
    </SectionCardAdmin>
  )
}

export default VolumeIngestion