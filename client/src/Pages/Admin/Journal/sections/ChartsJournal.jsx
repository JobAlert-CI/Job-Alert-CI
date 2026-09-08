import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useJournalStatsQuery } from "@/features/admin-journal.tools"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"

/* ─────────────────────────────────────────────────────────────────────
   Charts du Journal d'activité (cycle 16, sélection validée : H-I).

   H — Activité par jour (30 j) : barres du volume d'actions/jour.
   I — Top auteurs (30 j) : barres horizontales, admin le plus actif
        en tête. Les lignes orphelines (admin supprimé) sortent comme
        « Admin supprimé » (stats serveur).

   Données : GET /audit/stats?days=30 (même appel que les compteurs →
   zéro requête supplémentaire). Recharts confiné au chunk lazy de la
   page, isAnimationActive={false} (MotionConfig reducedMotion global).
   ───────────────────────────────────────────────────────────────────── */

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

const ChartsJournal = () => {
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

  // I : top auteurs, les plus actifs en tête (serveur les renvoie triés).
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
      {/* H — Activité par jour (2 colonnes) */}
      <CadreChart
        titre="Actions par jour (30 derniers jours)"
        chargement={isLoading}
        vide={!parJour.length}
        videMessage="Aucune action enregistrée dans la fenêtre."
        className="xl:col-span-2"
      >
        <BarChart data={parJour} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis dataKey="jour" fontSize={10} tickLine={false} />
          <YAxis allowDecimals={false} fontSize={10} tickLine={false} />
          <Tooltip formatter={(v) => [v, "Actions"]} />
          <Bar dataKey="actions" name="Actions" fill="#0F2D4D" isAnimationActive={false} radius={[4, 4, 0, 0]} />
        </BarChart>
      </CadreChart>

      {/* I — Top auteurs (barres horizontales) */}
      <CadreChart
        titre="Top auteurs (30 j)"
        chargement={isLoading}
        vide={!topAuteurs.length}
        videMessage="Aucun auteur actif dans la fenêtre."
      >
        <BarChart
          data={topAuteurs}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
          <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} />
          <YAxis type="category" dataKey="nom" width={110} fontSize={10} tickLine={false} />
          <Tooltip formatter={(v) => [v, "Actions"]} />
          <Bar dataKey="actions" name="Actions" fill="#10b981" isAnimationActive={false} radius={[0, 4, 4, 0]} />
        </BarChart>
      </CadreChart>
    </div>
  )
}

export default ChartsJournal
