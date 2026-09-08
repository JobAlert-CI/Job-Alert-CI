import { useMemo } from "react"
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import {
  STATUTS_JOB, TRIGGERS_JOB, SEVERITES, useStatsIaQuery,
} from "@/features/admin-ia.tools"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { SectionErreur } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Statistiques (cycle 19 — décision utilisateur : stats dans
   un onglet à part).

   Compteurs IA1-IA6 + charts C1-C5 servis par UN SEUL appel
   GET /ai/stats?days=30 (fenêtre réglable). Recharts confiné au chunk
   lazy de la page, isAnimationActive={false} (MotionConfig global),
   légendes HTML recharts.

   Vocabulaires serveur (vérifiés live) :
   - jobs_par_statut : pending|running|completed|partial_failure|failed ;
   - jobs_par_trigger : manual|sweep|auto|delayed_check ;
   - jobs_par_jour[] : activees/rejetees/revue/retraiter (AIJob).
   ───────────────────────────────────────────────────────────────────── */

const COULEURS_VOLUMES = {
  activees: "#10b981",
  rejetees: "#ef4444",
  revue: "#f59e0b",
  retraiter: "#94a3b8",
}

const COULEURS_STATUT_JOB = {
  completed: "#10b981",
  partial_failure: "#f59e0b",
  failed: "#ef4444",
  running: "#2563eb",
  pending: "#94a3b8",
}

const COULEURS_SEVERITE = {
  info: "#0F2D4D",
  warning: "#f59e0b",
  error: "#ef4444",
  critical: "#7f1d1d",
}

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

const OngletStats = () => {
  const { data: stats, isLoading, isError, refetch } = useStatsIaQuery(30)

  // C2 : donut statuts — ordre du vocabulaire, zéros filtrés.
  const parStatut = useMemo(
    () =>
      Object.entries(STATUTS_JOB)
        .map(([valeur, conf]) => ({
          statut: conf.libelle,
          total: stats?.jobs_par_statut?.[valeur] ?? 0,
          couleur: COULEURS_STATUT_JOB[valeur],
        }))
        .filter((e) => e.total > 0),
    [stats]
  )

  // C4 : barres horizontales par trigger.
  const parTrigger = useMemo(
    () =>
      Object.entries(stats?.jobs_par_trigger ?? {}).map(([valeur, total]) => ({
        trigger: TRIGGERS_JOB[valeur] ?? valeur,
        jobs: total,
      })),
    [stats]
  )

  // C5 : alertes non acquittées par sévérité (ordre du vocabulaire).
  const parSeverite = useMemo(
    () =>
      Object.entries(SEVERITES)
        .map(([valeur, conf]) => ({
          severite: conf.libelle,
          alertes: stats?.alertes_non_acquittees?.[valeur] ?? 0,
          couleur: COULEURS_SEVERITE[valeur],
        }))
        .filter((e) => e.alertes > 0),
    [stats]
  )

  if (isError) {
    return <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques du pipeline." />
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Compteurs IA1-IA6 ─── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6 md:grid-cols-3">
        <CarteCompteur label="Backlog brut" valeur={stats?.backlog_brut ?? 0} chargement={isLoading} />
        <CarteCompteur label="Jobs (30 j)" valeur={stats?.jobs_fenetre ?? 0} chargement={isLoading} />
        <CarteCompteur
          label="Taux d'activation"
          texte={isLoading ? undefined : (stats?.taux_activation == null ? "—" : `${stats.taux_activation} %`)}
          valeur={stats?.taux_activation ?? 0}
          chargement={isLoading}
        />
        <CarteCompteur label="Suggestions en attente" valeur={stats?.suggestions_par_statut?.pending ?? 0} chargement={isLoading} />
        <CarteCompteur
          label="Alertes non acquittées"
          valeur={Object.values(stats?.alertes_non_acquittees ?? {}).reduce((a, b) => a + b, 0)}
          chargement={isLoading}
        />
        <CarteCompteur
          label="Clés actives"
          texte={isLoading ? undefined : `${stats?.cles_actives ?? 0} / ${stats?.cles_total ?? 0}`}
          valeur={stats?.cles_actives ?? 0}
          chargement={isLoading}
        />
      </div>

      {/* ─── C1 : volumes/jour barres empilées ─── */}
      <CadreChart
        titre="Volumes traités par jour (30 jours)"
        chargement={isLoading}
        vide={!stats?.jobs_par_jour?.length}
        videMessage="Aucun job de normalisation sur la fenêtre."
      >
        <BarChart data={stats?.jobs_par_jour ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis dataKey="jour" fontSize={10} tickLine={false}
            tickFormatter={(j) => new Date(j).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} />
          <YAxis allowDecimals={false} fontSize={10} tickLine={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="activees" name="Activées" stackId="v" fill={COULEURS_VOLUMES.activees} isAnimationActive={false} />
          <Bar dataKey="rejetees" name="Rejetées" stackId="v" fill={COULEURS_VOLUMES.rejetees} isAnimationActive={false} />
          <Bar dataKey="revue" name="En revue" stackId="v" fill={COULEURS_VOLUMES.revue} isAnimationActive={false} />
          <Bar dataKey="retraiter" name="À retraiter" stackId="v" fill={COULEURS_VOLUMES.retraiter} isAnimationActive={false} />
        </BarChart>
      </CadreChart>

      {/* ─── C2 + C3 ─── */}
      <div className="grid gap-4 xl:grid-cols-3">
        <CadreChart
          titre="Statut des jobs (30 jours)"
          chargement={isLoading}
          vide={!parStatut.length}
          videMessage="Aucun job sur la fenêtre."
        >
          <PieChart>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Pie data={parStatut} dataKey="total" nameKey="statut" innerRadius={55} outerRadius={80}
              paddingAngle={2} isAnimationActive={false}>
              {parStatut.map((e) => <Cell key={e.statut} fill={e.couleur} />)}
            </Pie>
          </PieChart>
        </CadreChart>

        <CadreChart
          titre="Durée moyenne des jobs par jour"
          chargement={isLoading}
          vide={!stats?.duree_moyenne_par_jour?.length}
          videMessage="Aucun job terminé avec durée connue."
          className="xl:col-span-2"
        >
          <LineChart data={stats?.duree_moyenne_par_jour ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="jour" fontSize={10} tickLine={false}
              tickFormatter={(j) => new Date(j).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} />
            <YAxis fontSize={10} tickLine={false} unit=" s" />
            <Tooltip formatter={(v) => [`${v} s`, "Durée moyenne"]} />
            <Line type="monotone" dataKey="secondes" name="Durée moyenne" stroke="#2563eb"
              strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
          </LineChart>
        </CadreChart>
      </div>

      {/* ─── C4 + C5 : barres horizontales ─── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <CadreChart
          titre="Jobs par déclencheur (30 jours)"
          chargement={isLoading}
          vide={!parTrigger.length}
          videMessage="Aucun job sur la fenêtre."
        >
          <BarChart data={parTrigger} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
            <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} />
            <YAxis type="category" dataKey="trigger" fontSize={10} tickLine={false} width={120} />
            <Tooltip />
            <Bar dataKey="jobs" name="Jobs" isAnimationActive={false} radius={[0, 4, 4, 0]}>
              {parTrigger.map((e) => <Cell key={e.trigger} fill="#2563eb" />)}
            </Bar>
          </BarChart>
        </CadreChart>

        <CadreChart
          titre="Alertes non acquittées par sévérité"
          chargement={isLoading}
          vide={!parSeverite.length}
          videMessage="Aucune alerte en attente."
        >
          <BarChart data={parSeverite} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
            <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} />
            <YAxis type="category" dataKey="severite" fontSize={10} tickLine={false} width={120} />
            <Tooltip />
            <Bar dataKey="alertes" name="Alertes" isAnimationActive={false} radius={[0, 4, 4, 0]}>
              {parSeverite.map((e) => <Cell key={e.severite} fill={e.couleur} />)}
            </Bar>
          </BarChart>
        </CadreChart>
      </div>
    </div>
  )
}

export default OngletStats
