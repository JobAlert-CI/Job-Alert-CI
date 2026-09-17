import { useMemo } from "react"
import { Activity } from "lucide-react"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts"
import { useAdminTierStatsQuery, TIER_LABELS, etatQualiteMatching, usePeutVoirEnvois } from "@/features/admin-matching.tools"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionErreur, SectionVide } from "@/components/admin/EtatsSection"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { formatNombre } from "@/lib/utils"

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

const TooltipMatching = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-popover p-3.5 text-sm shadow-lg min-w-50">
      {/* En-tête (Titre du tooltip) séparé par une bordure discrète */}
      <div className="font-semibold text-foreground border-b border-border/40 pb-2">
        {label}
      </div>

      {/* Liste des données */}
      <div className="flex flex-col gap-2">
        {payload.map((p) => (
          <div 
            key={p.dataKey} 
            className="flex items-center justify-between gap-8"
          >
            {/* Gauche : Pastille de couleur + Libellé */}
            <div className="flex items-center gap-2">
              <div 
                className="h-2 w-2 rounded-full shrink-0 shadow-sm" 
                style={{ 
                  backgroundColor: p.color || p.fill || p.stroke || "currentColor" 
                }} 
              />
              <span className="text-muted-foreground">
                {TIER_LABELS[p.dataKey] ?? p.dataKey}
              </span>
            </div>

            {/* Droite : Valeur formatée */}
            <span className="font-medium text-foreground tabular-nums">
              {formatNombre(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}


const SEGMENTS_BARRES = [
  [62, 18, 6, 2],
  [48, 22, 8, 3],
  [70, 14, 4, 2],
  [40, 26, 10, 4],
  [58, 20, 7, 2],
  [34, 16, 5, 2],
  [66, 12, 5, 3],
];

/**
 * État de chargement du BarChart empilé de qualité du matching.
 * `height` doit correspondre à la hauteur du ResponsiveContainer réel
 * pour éviter tout layout shift.
 */
const ChartMatchingSkeleton = ({ height = 220 }) => (
  <div
    role="status"
    aria-label="Chargement du graphique de qualité du matching"
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
      {/* Barres empilées, alignées en bas comme le BarChart réel */}
      <div className="flex flex-1 items-end gap-3 border-b border-border pb-px">
        {SEGMENTS_BARRES.map((segments, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end gap-px">
            {/* Rendu haut → bas : on inverse l'ordre des segments */}
            {[...segments].reverse().map((h, k) => (
              <Skeleton
                key={k}
                className="w-full"
                style={{
                  height: `${h}%`,
                  animationDelay: `${i * 70 + k * 30}ms`,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Libellés de l'axe X (dates) */}
      <div className="mt-2 flex gap-3" aria-hidden="true">
        {SEGMENTS_BARRES.map((_, i) => (
          <Skeleton key={i} className="h-2 flex-1 rounded-sm" />
        ))}
      </div>
    </div>
  </div>
);


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
        <ChartMatchingSkeleton />
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
                <Tooltip content={<TooltipMatching />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
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