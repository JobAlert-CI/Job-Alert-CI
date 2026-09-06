import { useMemo } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { Tags } from "lucide-react"
import { useAdminTierStatsQuery } from "@/features/admin-matching.tools"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionErreur, SectionVide } from "../components/EtatsSection"
import { usePeutVoirEnvois } from "@/features/admin-matching.tools"

/* ─────────────────────────────────────────────────────────────────────
   Section — Types de match par offre (donut).

   Même réponse que QualiteMatching : match_kind_distribution est
   incluse dans GET /sending/tier-stats — zéro appel supplémentaire
   (TanStack déduplique via la queryKey identique).

   Kinds réels (vérifiés API live) : primary, secondary,
   fallback_contract, fallback_freshness, fallback_experience,
   fallback_city. Le type exact renvoyé par le backend n'est pas
   garanti exhaustif : toute clé inconnue est affichée telle quelle.
   ───────────────────────────────────────────────────────────────────── */

const COULEURS_KIND = {
  primary: "#0f766e",            // teal foncé — filière directe
  secondary: "#0891b2",          // cyan — filière secondaire
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

/** Palette de secours pour un kind non répertorié. */
const COULEURS_SECOURS = ["#7c3aed", "#4f46e5", "#0284c7", "#059669", "#ca8a04", "#be185d"]

const couleurKind = (kind, i) =>
  COULEURS_KIND[kind] ?? COULEURS_SECOURS[i % COULEURS_SECOURS.length]

const TooltipPerso = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-semibold">{LIBELLES_KIND[p.name] ?? p.name}</p>
      <p className="text-muted-foreground">{p.value} offre{p.value > 1 ? "s" : ""}</p>
    </div>
  )
}

const TypesMatch = () => {
  const autorise = usePeutVoirEnvois()
  const { data, isLoading, isError, refetch } = useAdminTierStatsQuery(7)

  const parts = useMemo(() => {
    const kinds = data?.match_kind_distribution?.global?.kinds ?? {}
    return Object.entries(kinds)
      .map(([kind, count]) => ({ name: kind, value: count }))
      .sort((a, b) => b.value - a.value)
  }, [data])

  const total = parts.reduce((acc, p) => acc + p.value, 0)

  // Rôle sans accès au router sending : message explicite, pas de
  // requête déclenchée (le hook est enabled: false).
  if (!autorise) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="size-4 text-primary" aria-hidden />
            Types de match — 7 jours
          </CardTitle>
          <CardDescription>Répartition par type de rattachement offre.</CardDescription>
        </CardHeader>
        <CardContent>
          <SectionVide message="Statistiques d'envoi réservées aux super admins et gestionnaires utilisateurs." />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Tags className="size-4 text-primary" aria-hidden />
            Types de match — 7 jours
          </span>
          {total > 0 && <Badge variant="secondary">{total} offre{total > 1 ? "s" : ""} rattachée{total > 1 ? "s" : ""}</Badge>}
        </CardTitle>
        <CardDescription>
          Comment les offres des digests ont été rattachées aux filières. Beaucoup de fallbacks = matching à assouplir.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger les types de match." />
        ) : isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !parts.length ? (
          <SectionVide message="Aucune offre rattachée sur les 7 derniers jours." />
        ) : (
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
            <div className="h-48 w-48 shrink-0" role="img" aria-label={`Répartition des types de match : ${parts.map((p) => `${LIBELLES_KIND[p.name] ?? p.name} ${p.value}`).join(", ")}`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={parts}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                    strokeWidth={0}
                    isAnimationActive={false}
                  >
                    {parts.map((p, i) => (
                      <Cell key={p.name} fill={couleurKind(p.name, i)} />
                    ))}
                  </Pie>
                  <Tooltip content={<TooltipPerso />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Légende textuelle (lecteurs d'écran + lecture chiffrée) */}
            <ul className="flex w-full flex-col gap-1.5 text-xs">
              {parts.map((p, i) => {
                const part = total ? Math.round((p.value / total) * 100) : 0
                return (
                  <li key={p.name} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: couleurKind(p.name, i) }} aria-hidden />
                      <span className="truncate">{LIBELLES_KIND[p.name] ?? p.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {p.value} ({part} %)
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default TypesMatch
