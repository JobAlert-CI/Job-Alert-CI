import { useMemo } from "react"
import { Activity } from "lucide-react"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts"
import { useAdminTierStatsQuery, TIER_LABELS, etatQualiteMatching, usePeutVoirEnvois } from "@/features/admin-matching.tools"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionErreur, SectionVide } from "../components/EtatsSection"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"

/* ─────────────────────────────────────────────────────────────────────
  Section — Qualité du matching cette semaine (T0 à T5).
  Code couleur = signal d'alerte visuel immédiat : vert si T0/T1
  dominant (≥70 %), orange (≥40 %), rouge en dessous.
  Refonte : animation de dessin des barres réactivée (700 ms).
───────────────────────────────────────────────────────────────────── */

const COULEURS_TIER = {
  T0: "#16a34a", // vert — matching exact filière
  T1: "#65a30d", // vert olive — filière élargie
  T2: "#d97706", // ambre — fallback contrat
  T3: "#ea580c", // orange foncé — fallback fraîcheur
  T4: "#dc2626", // rouge — fallback expérience
  T5: "#b91c1c", // rouge foncé — fallback ville
}

const ETATS_WIDGET = {
  ok: { libelle: "Saine", variante: "secondary", classe: "text-emerald-600" },
  attention: { libelle: "À surveiller", variante: "outline", classe: "text-amber-600" },
  critique: { libelle: "Alerte", variante: "destructive", classe: "text-red-600" },
  vide: { libelle: "Aucune donnée", variante: "outline", classe: "text-muted-foreground" },
}

const formatNombre = (v) => (Number(v) || 0).toLocaleString("fr-FR")

const TooltipPerso = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-muted-foreground">
          {TIER_LABELS[p.dataKey] ?? p.dataKey} : {formatNombre(p.value)}
        </p>
      ))}
    </div>
  )
}

const QualiteMatching = () => {
  const autorise = usePeutVoirEnvois()
  const { data, isLoading, isError, refetch } = useAdminTierStatsQuery(7)

  const parJour = useMemo(() => {
    const byDay = data?.tier_distribution?.by_day ?? {}
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, journee]) => {
        const compte = Object.fromEntries((journee.tiers ?? []).map((t) => [t.tier, t.count]))
        return { date, ...compte }
      })
  }, [data])

  const etat = etatQualiteMatching(data?.tier_distribution)
  const metaEtat = ETATS_WIDGET[etat]
  const totalSemaine = data?.tier_distribution?.global?.total ?? 0

  return (
    <SectionCardAdmin
      title="Qualité du matching (7 derniers jours)"
      description="Distribution des paliers sur les digests envoyés."
      icon={Activity}
      badge={totalSemaine > 0 && (
        <Badge variant={metaEtat.variante} className={`font-bold ${metaEtat.classe}`}>
          {metaEtat.libelle}
        </Badge>
      )}
    >
      {!autorise ? (
        <SectionVide message="Statistiques d'envoi réservées aux super admins et gestionnaires utilisateurs." />
      ) : isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger la qualité du matching." />
      ) : isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !parJour.length ? (
        <SectionVide message="Aucun digest envoyé sur les 7 derniers jours." />
      ) : (
        <>
          <div className="h-48 w-full" role="img" aria-label="Répartition quotidienne des paliers de matching T0 à T5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={parJour} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e9eb)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<TooltipPerso />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
                {Object.keys(TIER_LABELS).map((tier) => (
                  <Bar
                    key={tier}
                    dataKey={tier}
                    stackId="tiers"
                    fill={COULEURS_TIER[tier]}
                    animationDuration={700}
                    animationEasing="ease-out"
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Légende accessible hors du graphique (lecteurs d'écran) */}
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {Object.entries(TIER_LABELS).map(([tier, libelle]) => (
              <li key={tier} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="size-2 rounded-sm" style={{ backgroundColor: COULEURS_TIER[tier] }} aria-hidden="true" />
                {tier} — {libelle}
              </li>
            ))}
          </ul>
        </>
      )}
    </SectionCardAdmin>
  )
}

export default QualiteMatching