import { useEffect, useMemo, useState } from "react"
import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from "recharts"
import { Tags } from "lucide-react"
import { cn } from "cn"
import { useAdminTierStatsQuery, usePeutVoirEnvois } from "@/features/admin-matching.tools"
import { Badge } from "@/components/ui/badge"
import { SectionErreur, SectionVide } from "@/components/admin/EtatsSection"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"


const COULEURS_KIND = {
  primary: "#0f766e",
  secondary: "#0891b2",
  fallback_contract: "#d97706",
  fallback_freshness: "#ea580c",
  fallback_experience: "#dc2626",
  fallback_city: "#b91c1c",
}

const LIBELLES_KIND = {
  primary: "Filière directe",
  secondary: "Filière secondaire",
  fallback_contract: "Fallback contrat",
  fallback_freshness: "Fallback fraîcheur",
  fallback_experience: "Fallback expérience",
  fallback_city: "Fallback ville",
}

const COULEURS_SECOURS = ["#7c3aed", "#4f46e5", "#0284c7", "#059669", "#ca8a04", "#be185d"]

const couleurKind = (kind, i) =>
  COULEURS_KIND[kind] ?? COULEURS_SECOURS[i % COULEURS_SECOURS.length]

/** Segment actif : léger écart du centre (rayon +5). */
const SecteurActif = ({ cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill }) => (
  <Sector
    cx={cx}
    cy={cy}
    innerRadius={innerRadius}
    outerRadius={outerRadius + 5}
    startAngle={startAngle}
    endAngle={endAngle}
    fill={fill}
  />
)


/**
 * État de chargement du PieChart de répartition des types de matching (donut).
 * Reproduit la géométrie réelle :
 *  - anneau entre 60% et 85% du rayon → trou central de (1 - 60/85)/2 ≈ 14,7% d'inset ;
 *  - gaps de 2° entre segments (paddingAngle) ;
 *  - 3 segments proportionnels à la fixture
 *    (filiere_keyword ≈ 72%, city_match ≈ 24%, fallback_tier ≈ 4%).
 */
const ChartTypesMatchSkeleton = ({ height = 220 }) => (
  <div
    role="status"
    aria-label="Chargement du graphique de répartition des types de matching"
    className="flex h-full w-full animate-pulse items-center justify-center"
    style={{ height }}
  >
    <div className="relative aspect-square w-full max-w-37.5">
      {/* Donut : 3 segments neutres séparés par des gaps de 2° */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(
            var(--color-muted) 0deg 257deg,
            transparent 257deg 259deg,
            var(--color-surface-container-high) 259deg 342deg,
            transparent 342deg 344deg,
            var(--color-muted) 344deg 358deg,
            transparent 358deg 360deg
          )`,
        }}
      />
      {/* Trou central (innerRadius 60% / outerRadius 85%) */}
      <div className="absolute rounded-full bg-card" style={{ inset: "14.7%" }} />
    </div>
  </div>
);

const TypesMatch = () => {
  const autorise = usePeutVoirEnvois()
  const { data, isLoading, isError, refetch } = useAdminTierStatsQuery(7)
  const [survol, setSurvol] = useState(null)

  const parts = useMemo(() => {
    const kinds = data?.match_kind_distribution?.global?.kinds ?? {}
    return Object.entries(kinds)
      .map(([kind, count]) => ({ name: kind, value: count }))
      .sort((a, b) => b.value - a.value)
  }, [data])

  /* Le survol pointe vers un indice : on le réinitialise à chaque
     nouveau jeu de données pour éviter un indice hors bornes. */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSurvol(null), [data])

  const total = parts.reduce((acc, p) => acc + p.value, 0)
  const indexActif = survol !== null && survol < parts.length ? survol : null
  const segmentActif = indexActif !== null ? parts[indexActif] : null


  return (
    <SectionCardAdmin
      title="Types de match (7j)"
      icon={Tags}
      badge={total > 0 && (
        <Badge variant="secondary">
          {total.toLocaleString("fr-FR")} rattachée{total > 1 ? "s" : ""}
        </Badge>
      )}
    >
      {!autorise ? (
        <SectionVide message="Statistiques d'envoi réservées aux super admins et gestionnaires utilisateurs." />
      ) : isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les types de match." />
      ) : isLoading ? (
        <ChartTypesMatchSkeleton />
      ) : !parts.length ? (
        <SectionVide message="Aucune offre rattachée sur les 7 derniers jours." />
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
          {/* Donut + centre dynamique */}
          <div className="relative h-44 w-44 shrink-0">
            <div
              className="h-full w-full"
              role="img"
              aria-label={`Répartition des types de match : ${parts
                .map((p) => `${LIBELLES_KIND[p.name] ?? p.name} ${p.value}`)
                .join(", ")}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={parts}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="60%"
                    outerRadius="85%"
                    paddingAngle={2}
                    strokeWidth={0}
                    animationDuration={800}
                    animationEasing="ease-out"
                    activeIndex={indexActif}
                    activeShape={SecteurActif}
                    onMouseEnter={(_, i) => setSurvol(i)}
                    onMouseLeave={() => setSurvol(null)}
                  >
                    {parts.map((p, i) => (
                      <Cell
                        key={p.name}
                        fill={couleurKind(p.name, i)}
                        opacity={indexActif === null || indexActif === i ? 1 : 0.35}
                        className="cursor-pointer outline-none transition-opacity duration-200"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Centre : total par défaut, valeur du segment au survol */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-heading text-2xl font-bold tabular-nums">
                {(segmentActif ? segmentActif.value : total).toLocaleString("fr-FR")}
              </span>
              <span className="mt-0.5 max-w-24 truncate text-[10px] font-medium text-muted-foreground">
                {segmentActif
                  ? LIBELLES_KIND[segmentActif.name] ?? segmentActif.name
                  : "offres rattachées"}
              </span>
            </div>
          </div>

          {/* Légende interactive (souris + clavier), synchronisée */}
          <ul className="flex w-full flex-col gap-0.5 text-xs">
            {parts.map((p, i) => {
              const part = total ? Math.round((p.value / total) * 100) : 0
              const actif = indexActif === i
              return (
                <li key={p.name}>
                  <button
                    type="button"
                    onMouseEnter={() => setSurvol(i)}
                    onMouseLeave={() => setSurvol(null)}
                    onFocus={() => setSurvol(i)}
                    onBlur={() => setSurvol(null)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left outline-none transition-colors duration-150",
                      "focus-visible:ring-2 focus-visible:ring-ring",
                      actif ? "bg-muted" : "hover:bg-muted/60"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="size-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: couleurKind(p.name, i) }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{LIBELLES_KIND[p.name] ?? p.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {p.value.toLocaleString("fr-FR")} ({part} %)
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </SectionCardAdmin>
  )
}

export default TypesMatch