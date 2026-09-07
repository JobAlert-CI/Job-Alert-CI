import { useMemo } from "react"
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import {
  useStatsAbonnesOverview, useStatsInscriptionsParJour, useStatsTopFilieres,
  useStatsCroissance, useStatsParVille, useStatsTopContrats, useStatsEnvoisParJour,
} from "@/features/admin-abonnes.tools"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"

/* ─────────────────────────────────────────────────────────────────────
   Charts de la page Abonnés (cycle 7). Toutes les données viennent du
   router /subscribers/stats (vérifié live) — recharts reste confiné au
   chunk lazy de la page (règle du dashboard), isAnimationActive={false}
   (MotionConfig reducedMotion global).

   Layout : grille 2 colonnes xl.
   1. Inscriptions par jour (barres)
   2. Croissance cumulée (line — part du total historique)
   3. Répartition par statut (donut)
   4. Envois par jour ventilés (barres empilées)
   5. Filières les plus choisies (barres horizontales)
   6. Sources d'inscription (donut)
   7. Top villes (barres horizontales)
   8. Contrats préférés (barres horizontales)
   ───────────────────────────────────────────────────────────────────── */

const COULEURS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"]

const LIBELLES_STATUT = {
  active: "Actifs",
  unsubscribed: "Désinscrits",
  bouncing: "Rebonds",
  paused: "En pause",
  pending: "En attente",
  deleted: "Anonymisés",
}

const jourCourt = (iso) => {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

const TitreChart = ({ children }) => (
  <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{children}</h3>
)

const CadreChart = ({ titre, chargement, vide, videMessage, children, minHeight = 220 }) => (
  <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
    <TitreChart>{titre}</TitreChart>
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

const ChartsAbonnes = () => {
  const { data: stats, isLoading: statsChargement } = useStatsAbonnesOverview()
  const { data: inscriptions, isLoading: inscriptionsChargement } = useStatsInscriptionsParJour({ days: 30 })
  const { data: croissance, isLoading: croissanceChargement } = useStatsCroissance({ days: 90 })
  const { data: topFilieres, isLoading: filieresChargement } = useStatsTopFilieres({ limit: 8 })
  const { data: parVille, isLoading: villesChargement } = useStatsParVille({ limit: 8 })
  const { data: topContrats, isLoading: contratsChargement } = useStatsTopContrats({ limit: 8 })
  const { data: envois, isLoading: envoisChargement } = useStatsEnvoisParJour({ days: 30 })

  // Donut statuts : from overview by_status (vocabulaire API).
  const donneesStatuts = useMemo(() => {
    const byStatus = stats?.by_status ?? {}
    return Object.entries(byStatus)
      .filter(([, v]) => v > 0)
      .map(([statut, valeur]) => ({
        name: LIBELLES_STATUT[statut] ?? statut,
        value: valeur,
      }))
  }, [stats])

  // Donut sources.
  const donneesSources = useMemo(() => {
    const bySource = stats?.by_source ?? {}
    return Object.entries(bySource)
      .filter(([, v]) => v > 0)
      .map(([source, valeur]) => ({ name: source, value: valeur }))
  }, [stats])

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {/* 1. Inscriptions par jour (barres) */}
      <CadreChart
        titre="Inscriptions par jour (30 j)"
        chargement={inscriptionsChargement}
        vide={!inscriptions?.length}
        videMessage="Aucune inscription sur la période."
      >
        <BarChart data={inscriptions ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis dataKey="day" tickFormatter={jourCourt} fontSize={10} tickLine={false} />
          <YAxis allowDecimals={false} fontSize={10} tickLine={false} />
          <Tooltip labelFormatter={(d) => jourCourt(d)} />
          <Bar dataKey="count" name="Inscriptions" fill={COULEURS[0]} isAnimationActive={false} radius={[4, 4, 0, 0]} />
        </BarChart>
      </CadreChart>

      {/* 2. Croissance cumulée (line) */}
      <CadreChart
        titre="Croissance de la base (90 j)"
        chargement={croissanceChargement}
        vide={!croissance?.length}
        videMessage="La courbe apparaîtra dès la première inscription."
      >
        <LineChart data={croissance ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis dataKey="day" tickFormatter={jourCourt} fontSize={10} tickLine={false} />
          <YAxis allowDecimals={false} fontSize={10} tickLine={false} />
          <Tooltip labelFormatter={(d) => jourCourt(d)} />
          <Line
            type="monotone" dataKey="cumulative_count" name="Abonnés cumulés"
            stroke={COULEURS[1]} strokeWidth={2} dot={false} isAnimationActive={false}
          />
        </LineChart>
      </CadreChart>

      {/* 3. Répartition par statut (donut) */}
      <CadreChart
        titre="Répartition par statut"
        chargement={statsChargement}
        vide={!donneesStatuts.length}
        videMessage="Aucun abonné en base."
      >
        <PieChart>
          <Pie
            data={donneesStatuts} dataKey="value" nameKey="name"
            innerRadius="55%" outerRadius="80%" paddingAngle={2} isAnimationActive={false}
          >
            {donneesStatuts.map((_, i) => (
              <Cell key={i} fill={COULEURS[i % COULEURS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </CadreChart>

      {/* 4. Envois par jour ventilés (barres empilées) */}
      <CadreChart
        titre="Digests par jour (30 j)"
        chargement={envoisChargement}
        vide={!envois?.length}
        videMessage="Aucun digest programmé sur la période."
      >
        <BarChart data={envois ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis dataKey="day" tickFormatter={jourCourt} fontSize={10} tickLine={false} />
          <YAxis allowDecimals={false} fontSize={10} tickLine={false} />
          <Tooltip labelFormatter={(d) => jourCourt(d)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="sent" name="Envoyés" stackId="s" fill={COULEURS[1]} isAnimationActive={false} />
          <Bar dataKey="skipped_empty" name="Sans offre" stackId="s" fill={COULEURS[2]} isAnimationActive={false} />
          <Bar dataKey="failed" name="Échoués" stackId="s" fill={COULEURS[3]} isAnimationActive={false} />
          <Bar dataKey="queued" name="En file" stackId="s" fill={COULEURS[4]} isAnimationActive={false} />
        </BarChart>
      </CadreChart>

      {/* 5. Filières les plus choisies (barres horizontales) */}
      <CadreChart
        titre="Filières les plus choisies"
        chargement={filieresChargement}
        vide={!topFilieres?.length}
        videMessage="Aucune filière choisie par les abonnés."
      >
        <BarChart data={topFilieres ?? []} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
          <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} />
          <YAxis type="category" dataKey="label" width={110} fontSize={10} tickLine={false} />
          <Tooltip />
          <Bar dataKey="subscribers_count" name="Abonnés" fill={COULEURS[0]} isAnimationActive={false} radius={[0, 4, 4, 0]} />
        </BarChart>
      </CadreChart>

      {/* 6. Sources d'inscription (donut) */}
      <CadreChart
        titre="Sources d'inscription"
        chargement={statsChargement}
        vide={!donneesSources.length}
        videMessage="Aucune source enregistrée."
      >
        <PieChart>
          <Pie
            data={donneesSources} dataKey="value" nameKey="name"
            innerRadius="55%" outerRadius="80%" paddingAngle={2} isAnimationActive={false}
          >
            {donneesSources.map((_, i) => (
              <Cell key={i} fill={COULEURS[(i + 2) % COULEURS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </CadreChart>

      {/* 7. Top villes */}
      <CadreChart
        titre="Répartition par ville"
        chargement={villesChargement}
        vide={!parVille?.length}
        videMessage="Aucune ville renseignée."
      >
        <BarChart data={parVille ?? []} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
          <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} />
          <YAxis type="category" dataKey="city" width={110} fontSize={10} tickLine={false} />
          <Tooltip />
          <Bar dataKey="count" name="Abonnés" fill={COULEURS[5]} isAnimationActive={false} radius={[0, 4, 4, 0]} />
        </BarChart>
      </CadreChart>

      {/* 8. Contrats préférés */}
      <CadreChart
        titre="Types de contrat préférés"
        chargement={contratsChargement}
        vide={!topContrats?.length}
        videMessage="Aucune préférence de contrat."
      >
        <BarChart data={topContrats ?? []} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
          <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} />
          <YAxis type="category" dataKey="label" width={110} fontSize={10} tickLine={false} />
          <Tooltip />
          <Bar dataKey="subscribers_count" name="Abonnés" fill={COULEURS[2]} isAnimationActive={false} radius={[0, 4, 4, 0]} />
        </BarChart>
      </CadreChart>
    </div>
  )
}

export default ChartsAbonnes
