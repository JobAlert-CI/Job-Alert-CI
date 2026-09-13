import { useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { Scale } from "lucide-react"
import {
  useAdminFilieresQuery,
  useStatsOffresParFiliere,
  useStatsAbonnesParFiliere,
} from "@/features/admin-filieres.tools"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"


/* Couleurs de marque : navy = offre, orange = demande (aplats OK). */
const COULEUR_OFFRE = "#0F2D4D"
const COULEUR_DEMANDE = "#F5A623"

const formatNombre = (v) => (v ?? 0).toLocaleString("fr-FR")

/* Tooltip stylé, cohérent avec les autres charts admin. */
const TooltipCroisement = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-1.5 text-muted-foreground">
          <span
            className="size-2 shrink-0 rounded-sm"
            style={{ backgroundColor: p.fill ?? p.color }}
            aria-hidden="true"
          />
          {p.name} : <span className="font-medium tabular-nums">{formatNombre(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

/* Skeleton en fausses barres duales — évite le saut visuel. */
const SkeletonCroisement = () => (
  <div className="flex h-70 items-end justify-around gap-2 px-4 pb-8" aria-hidden="true">
    {[72, 96, 48, 84, 58, 90, 40, 66].map((h, i) => (
      <div key={i} className="flex h-full flex-1 items-end justify-center gap-1">
        <Skeleton className="w-2/5 self-end rounded-t-sm" style={{ height: `${h}%` }} />
        <Skeleton className="w-2/5 self-end rounded-t-sm" style={{ height: `${Math.max(22, h - 28)}%` }} />
      </div>
    ))}
  </div>
)

const ChartCroisement = () => {
  const mouvementReduit = useReducedMotion()
  const { data: filieres, isLoading: filieresChargement } = useAdminFilieresQuery()
  const { data: statsOffres, isLoading: offresChargement } = useStatsOffresParFiliere()
  const { data: statsAbonnes, isLoading: abonnesChargement } = useStatsAbonnesParFiliere()

  /* Croisement local + tri par volume total décroissant (plus parlant). */
  const donnees = useMemo(() => {
    const offresParCode = new Map((statsOffres ?? []).map((f) => [f.code, f.total_offers ?? 0]))
    const abonnesParCode = new Map((statsAbonnes ?? []).map((f) => [f.code, f.subscribers_count ?? 0]))
    return (filieres ?? [])
      .map((f) => ({
        nom: f.label,
        offres: offresParCode.get(f.code) ?? 0,
        abonnes: abonnesParCode.get(f.code) ?? 0,
      }))
      .sort((a, b) => (b.offres + b.abonnes) - (a.offres + a.abonnes))
  }, [filieres, statsOffres, statsAbonnes])

  const chargement = filieresChargement || offresChargement || abonnesChargement
  const aDesDonnees = donnees.some((d) => d.offres > 0 || d.abonnes > 0)

  const totalOffres = donnees.reduce((acc, d) => acc + d.offres, 0)
  const totalAbonnes = donnees.reduce((acc, d) => acc + d.abonnes, 0)

  return (
    <SectionCardAdmin
      title="Offre vs demande par filière"
      description="Offres actives rattachées face aux abonnés inscrits — un déséquilibre marque une attente insatisfaite ou un gisement d'offres non exploité."
      icon={Scale}
      badge={
        !chargement &&
        aDesDonnees && (
          <Badge variant="secondary" className="tabular-nums">
            {formatNombre(totalOffres)} offres · {formatNombre(totalAbonnes)} abonnements
          </Badge>
        )
      }
    >
      {chargement ? (
        <SkeletonCroisement />
      ) : !aDesDonnees ? (
        <Empty className="py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon" />
            <EmptyTitle>Pas encore de données</EmptyTitle>
            <EmptyDescription>
              Aucune offre ni abonné rattaché à une filière — le croisement apparaîtra dès les
              premières données de matching.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={donnees} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis
                dataKey="nom"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={70}
              />
              <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip
                content={<TooltipCroisement />}
                cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="offres"
                name="Offres actives"
                fill={COULEUR_OFFRE}
                radius={[3, 3, 0, 0]}
                maxBarSize={28}
                isAnimationActive={!mouvementReduit}
                animationDuration={700}
                animationEasing="ease-out"
              />
              <Bar
                dataKey="abonnes"
                name="Abonnés inscrits"
                fill={COULEUR_DEMANDE}
                radius={[3, 3, 0, 0]}
                maxBarSize={28}
                isAnimationActive={!mouvementReduit}
                animationDuration={700}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCardAdmin>
  )
}

export default ChartCroisement