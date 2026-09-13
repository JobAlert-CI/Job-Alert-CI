import { useMemo } from "react"
import { motion, useReducedMotion } from "framer-motion"
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { cn } from "cn"
import {
  STATUTS_JOB, TRIGGERS_JOB, SEVERITES, useStatsIaQuery,
} from "@/features/admin-ia.tools"
import { Skeleton } from "@/components/ui/skeleton"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { SectionErreur, SectionVide } from "../components/EtatsSection"
import { BarChart3, BellRing, Gauge, KeyRound, Layers, Lightbulb, TrendingUp } from "lucide-react"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"


const COULEURS_VOLUMES = {
  activees: "#0F2D4D",
  rejetees: "#ef4444",
  revue: "#F5A623",
  retraiter: "#94a3b8",
}

const COULEURS_STATUT_JOB = {
  completed: "#0F2D4D",
  partial_failure: "#f59e0b",
  failed: "#ef4444",
  running: "#F5A623",
  pending: "#94a3b8",
}

const COULEURS_SEVERITE = {
  info: "#0F2D4D",
  warning: "#F5A623",
  error: "#ef4444",
  critical: "#7f1d1d",
}

const VARIANTS_CONTENEUR = {
  cache: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.03 } },
}

const VARIANTS_BLOC = {
  cache: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
}

const formatNombre = (v) => (v ?? 0).toLocaleString("fr-FR")

/* Label d'axe ISO → date courte fr-FR. */
const formaterLabel = (label) => {
  if (typeof label !== "string") return label
  if (/^\d{4}-\d{2}-\d{2}/.test(label)) {
    const d = new Date(label)
    if (!Number.isNaN(d.getTime()))
      return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
  }
  return label
}

/* Tooltip unique et stylé pour les 5 charts. */
const TooltipChart = ({ active, payload, label, suffixe = "" }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      {label != null && label !== "" && <p className="font-semibold">{formaterLabel(label)}</p>}
      {payload.map((p) => (
        <p key={p.dataKey ?? p.name} className="text-muted-foreground">
          {p.name} : {formatNombre(p.value)}{suffixe}
        </p>
      ))}
    </div>
  )
}

const CadreChart = ({ titre, chargement, vide, videMessage, children, minHeight = 220, className = "" }) => (
  <div className={cn("flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-soft", className)}>
    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">{titre}</h3>
    {chargement ? (
      <Skeleton className="w-full rounded-lg" style={{ height: minHeight }} />
    ) : vide ? (
      <div className="py-4">
        <SectionVide message={videMessage} />
      </div>
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
  const mouvementReduit = useReducedMotion()
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
    <motion.div variants={VARIANTS_CONTENEUR} initial="cache" animate="visible" className="flex flex-col gap-4">
      {/* ─── Compteurs IA1-IA6 ─── */}
      <motion.div variants={VARIANTS_BLOC} className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <CarteCompteur label="Backlog brut" valeur={stats?.backlog_brut ?? 0} icone={Layers} />
        <CarteCompteur label="Jobs (30 j)" valeur={stats?.jobs_fenetre ?? 0} icone={TrendingUp} />
        <CarteCompteur label="Taux d'activation" valeur={stats?.taux_activation ?? 0} suffixe="%" icone={Gauge} />
        <CarteCompteur label="Suggestions en attente" valeur={stats?.suggestions_par_statut?.pending ?? 0} icone={Lightbulb} />
        <CarteCompteur
          label="Alertes non acquittées"
          valeur={Object.values(stats?.alertes_non_acquittees ?? {}).reduce((a, b) => a + b, 0)}
          icone={BellRing}
        />
        <CarteCompteur
          label="Clés actives"
          valeur={stats?.cles_actives ?? 0}
          suffixe={`/ ${formatNombre(stats?.cles_total ?? 0)}`}
          icone={KeyRound}
        />
      </motion.div>

      <SectionCardAdmin
        title="Analyse des jobs IA"
        description="Statistiques sur les jobs traités par IA. Voir la documentation pour comprendre les statuts et les triggers."
        icon={BarChart3}
        contentClassName="flex flex-col gap-6"
      >
        {/* ─── C1 : volumes/jour barres empilées ─── */}
        <motion.div variants={VARIANTS_BLOC}>
          <CadreChart
            titre="Volumes traités par jour (30 jours)"
            chargement={isLoading}
            vide={!stats?.jobs_par_jour?.length}
            videMessage="Aucun job de normalisation sur la fenêtre."
          >
            <BarChart data={stats?.jobs_par_jour ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis
                dataKey="jour"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(j) => new Date(j).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
              />
              <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip content={<TooltipChart />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {Object.entries(COULEURS_VOLUMES).map(([cle, couleur]) => (
                <Bar
                  key={cle}
                  dataKey={cle}
                  name={{ activees: "Activées", rejetees: "Rejetées", revue: "En revue", retraiter: "À retraiter" }[cle]}
                  stackId="v"
                  fill={couleur}
                  isAnimationActive={!mouvementReduit}
                  animationDuration={700}
                  animationEasing="ease-out"
                />
              ))}
            </BarChart>
          </CadreChart>
        </motion.div>

        {/* ─── C2 + C3 ─── */}
        <motion.div variants={VARIANTS_BLOC} className="grid gap-4 xl:grid-cols-4">
          <CadreChart
            titre="Statut des jobs (30 jours)"
            chargement={isLoading}
            vide={!parStatut.length}
            videMessage="Aucun job sur la fenêtre."
          >
            <PieChart>
              <Tooltip content={<TooltipChart suffixe=" job(s)" />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Pie
                data={parStatut}
                dataKey="total"
                nameKey="statut"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={2}
                strokeWidth={0}
                isAnimationActive={!mouvementReduit}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {parStatut.map((e) => <Cell key={e.statut} fill={e.couleur} />)}
              </Pie>
            </PieChart>
          </CadreChart>

          <CadreChart
            titre="Durée moyenne des jobs par jour"
            chargement={isLoading}
            vide={!stats?.duree_moyenne_par_jour?.length}
            videMessage="Aucun job terminé avec durée connue."
            className="xl:col-span-3"
          >
            <LineChart data={stats?.duree_moyenne_par_jour ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis
                dataKey="jour"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(j) => new Date(j).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
              />
              <YAxis fontSize={10} tickLine={false} axisLine={false} unit=" s" />
              <Tooltip content={<TooltipChart suffixe=" s" />} />
              <Line
                type="monotone"
                dataKey="secondes"
                name="Durée moyenne"
                stroke="#F5A623"
                strokeWidth={2}
                dot={{ r: 2 }}
                isAnimationActive={!mouvementReduit}
                animationDuration={900}
                animationEasing="ease-out"
              />
            </LineChart>
          </CadreChart>
        </motion.div>

        {/* ─── C4 + C5 : barres horizontales ─── */}
        <motion.div variants={VARIANTS_BLOC} className="grid gap-4 xl:grid-cols-2">
          <CadreChart
            titre="Jobs par déclencheur (30 jours)"
            chargement={isLoading}
            vide={!parTrigger.length}
            videMessage="Aucun job sur la fenêtre."
          >
            <BarChart data={parTrigger} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
              <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="trigger" fontSize={10} tickLine={false} axisLine={false} width={120} />
              <Tooltip content={<TooltipChart />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
              <Bar
                dataKey="jobs"
                name="Jobs"
                radius={[0, 4, 4, 0]}
                isAnimationActive={!mouvementReduit}
                animationDuration={700}
                animationEasing="ease-out"
              >
                {parTrigger.map((e) => <Cell key={e.trigger} fill="#0F2D4D" />)}
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
              <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="severite" fontSize={10} tickLine={false} axisLine={false} width={120} />
              <Tooltip content={<TooltipChart suffixe=" alerte(s)" />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
              <Bar
                dataKey="alertes"
                name="Alertes"
                radius={[0, 4, 4, 0]}
                isAnimationActive={!mouvementReduit}
                animationDuration={700}
                animationEasing="ease-out"
              >
                {parSeverite.map((e) => <Cell key={e.severite} fill={e.couleur} />)}
              </Bar>
            </BarChart>
          </CadreChart>
        </motion.div>
      </SectionCardAdmin>
    </motion.div>
  )
}

export default OngletStats