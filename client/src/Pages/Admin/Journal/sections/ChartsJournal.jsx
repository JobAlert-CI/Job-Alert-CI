import { useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { Activity, UserCheck } from "lucide-react"
import { useJournalStatsQuery } from "@/features/admin-journal.tools"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"

/* ─────────────────────────────────────────────────────────────────────
   Charts du Journal d'activité (cycle 16, sélection validée : H-I).
   H — Activité par jour (30 j) : barres du volume d'actions/jour.
   I — Top auteurs (30 j) : barres horizontales, admin le plus actif
        en tête. Les lignes orphelines (admin supprimé) sortent comme
        « Admin supprimé » (stats serveur).
   Données : GET /audit/stats?days=30 (même appel que les compteurs →
   zéro requête supplémentaire). Recharts confiné au chunk lazy de la
   page.
   Refonte :
   • Couleurs liées aux JETONS du thème — var(--chart-*) définis dans
     index.css (--chart-2 = navy #0f2d4d, --chart-3 = vert #2ecc71) —
     au lieu de hex en dur : transition prête pour un futur mode
     sombre, cohérence avec ChartCroisement.
   • Animations conditionnées par useReducedMotion (préférence OS) au
     lieu d'une désactivation globale qui pénalisait tout le monde.
   • Tooltip personnalisé stylé shadcn (popover, bordure, ombre).
   ───────────────────────────────────────────────────────────────────── */

const formatNombre = (v) => (v ?? 0).toLocaleString("fr-FR")

/* Tooltip personnalisé — fond popover + bordure + ombre, façon
   ChartCroisement (le formatter natif était trop basique). */
const TooltipJournal = ({ active, payload, label }) => {
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

const CadreChart = ({ chargement, vide, videMessage, children, minHeight = 220 }) => (
  <>
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
  </>
)

const ChartsJournal = () => {
  const mouvementReduit = useReducedMotion()
  const { data: stats, isLoading } = useJournalStatsQuery(30)

  // H : volume d'actions par jour (déjà chronologique côté serveur).
  const parJour = useMemo(
    () =>
      (stats?.par_jour ?? []).map((j) => ({
        jour: new Date(`${j.jour}T00:00:00`).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
        }),
        actions: j.total,
      })),
    [stats]
  )

  const topAuteurs = useMemo(
    () =>
      (stats?.top_auteurs ?? []).map((a) => ({
        nom: a.nom || "Admin supprimé",
        actions: a.total,
      })),
    [stats]
  )

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="xl:col-span-2">
        <SectionCardAdmin
          title="Actions par jour (30 derniers jours)"
          description="Volume d'actions journalisées par jour."
          icon={Activity}
          contentClassName="p-0 sm:p-0"
        >
          <CadreChart
            chargement={isLoading}
            vide={!parJour.length}
            videMessage="Aucune action enregistrée dans la fenêtre."
          >
            <BarChart data={parJour} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="jour" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip content={<TooltipJournal />} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
              <Bar
                dataKey="actions"
                name="Actions"
                fill="var(--chart-2)"
                isAnimationActive={!mouvementReduit}
                animationDuration={500}
                animationEasing="ease-out"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </CadreChart>
        </SectionCardAdmin>
      </div>
      <SectionCardAdmin
        title="Top auteurs (30 j)"
        description="Auteurs les plus actifs en première place."
        icon={UserCheck}
        contentClassName="p-0 sm:p-0"
      >
        <CadreChart
          chargement={isLoading}
          vide={!topAuteurs.length}
          videMessage="Aucun auteur actif dans la fenêtre."
        >
          <BarChart
            data={topAuteurs}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.5} />
            <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="nom" width={110} fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip content={<TooltipJournal />} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
            <Bar
              dataKey="actions"
              name="Actions"
              fill="var(--chart-3)"
              isAnimationActive={!mouvementReduit}
              animationDuration={500}
              animationEasing="ease-out"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </CadreChart>
      </SectionCardAdmin>
    </div>
  )
}

export default ChartsJournal