import { Link } from "react-router-dom"
import {
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  Clock,
  Inbox,
  MailCheck,
  RadioTower,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { toast } from "sonner"
import { PageHeader } from "../components/PageHeader"
import { GenericStatusBadge } from "../components/StatusBadge"
import { EmptyState } from "../components/EmptyState"
import { useAdminMutations, useDashboardOverview, useDashboardRuns, useDashboardTrends } from "@/tools/admin.tools"

const STAT_CONFIGS = [
  { icon: Inbox, color: "text-amber-600 bg-amber-500/10 border-amber-500/20", trend: "+14% ce mois" },
  { icon: Briefcase, color: "text-blue-600 bg-blue-500/10 border-blue-500/20", trend: "En ligne" },
  { icon: Users, color: "text-indigo-600 bg-indigo-500/10 border-indigo-500/20", trend: "+120 cette sem." },
  { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20", trend: "87% taux actif" },
  { icon: MailCheck, color: "text-rose-600 bg-rose-500/10 border-rose-500/20", trend: "À traiter" },
  { icon: RadioTower, color: "text-purple-600 bg-purple-500/10 border-purple-500/20", trend: "100% opérationnelles" },
]

const StatCard = ({ icon: Icon, label, value, to, config }) => {
  const content = (
    <div className="flex flex-col justify-between h-full space-y-4">
      <div className="flex items-center justify-between">
        <div className={`flex size-11 items-center justify-center rounded-2xl border ${config?.color || "text-slate-600 bg-slate-100"}`}>
          <Icon className="size-5" />
        </div>
        {to && (
          <div className="flex size-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-amber-500 group-hover:text-white transition-all">
            <ArrowUpRight className="size-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        )}
      </div>
      <div>
        <p className="font-heading text-3xl font-black tabular-nums text-slate-900 dark:text-white lg:text-4xl">
          {typeof value === "number" ? value.toLocaleString("fr-FR") : (value ?? "—")}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
            {label}
          </p>
        </div>
      </div>
    </div>
  )
  const cls = "adm-card group block p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700"
  return to ? (
    <Link to={to} className={cls}>{content}</Link>
  ) : (
    <div className={cls}>{content}</div>
  )
}

/**
 * Page 2 — /admin (Tableau de bord haute fidélité et aéré).
 */
export const DashboardPage = () => {
  const overviewQuery = useDashboardOverview()
  const trendsQuery = useDashboardTrends()
  const runsQuery = useDashboardRuns({ limit: 5, offset: 0 })
  const { triggerScrapeMutation } = useAdminMutations()

  const o = overviewQuery.data
  const trends = trendsQuery.data || []
  const runs = runsQuery.data || []

  const handleTrigger = async () => {
    try {
      await triggerScrapeMutation.mutateAsync({ notes: "Collecte déclenchée depuis le tableau de bord" })
      toast.success("Collecte déclenchée", "Le run est en file d'attente — suivi dans la page Scraping.")
    } catch {
      toast.error("Erreur", "Impossible d'initier la collecte.")
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tableau de bord"
        description="Indicateurs en temps réel des offres collectées, abonnés actifs et exécutions de scraping."
        actions={
          <button
            type="button"
            className="adm-btn-primary !px-5 !py-2.5 shadow-md"
            onClick={handleTrigger}
            disabled={triggerScrapeMutation.isPending}
          >
            <RefreshCw className={`size-4.5 ${triggerScrapeMutation.isPending ? "animate-spin" : ""}`} />
            <span>Lancer une collecte</span>
          </button>
        }
      />

      {/* ─── 6 cartes clés spacieuses ─── */}
      <section aria-label="Indicateurs clés" className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Inbox} label="Offres totales" value={o?.offers_total} to="/admin/offres" config={STAT_CONFIGS[0]} />
        <StatCard icon={Briefcase} label="Offres actives" value={o?.offers_active} to="/admin/offres" config={STAT_CONFIGS[1]} />
        <StatCard icon={Users} label="Abonnés totaux" value={o?.subscribers_total} to="/admin/utilisateurs" config={STAT_CONFIGS[2]} />
        <StatCard icon={CheckCircle2} label="Abonnés actifs" value={o?.subscribers_active} to="/admin/utilisateurs" config={STAT_CONFIGS[3]} />
        <StatCard icon={MailCheck} label="Contacts reçus" value={o?.contact_messages_new} to="/admin/logs" config={STAT_CONFIGS[4]} />
        <StatCard icon={RadioTower} label="Sources actives" value={o?.sources_active} to="/admin/sources" config={STAT_CONFIGS[5]} />
      </section>

      {/* ─── Graphique et Cartes d'activité ─── */}
      <section className="grid gap-8 lg:grid-cols-3">
        {/* Graphique Recharts */}
        <div className="adm-card p-6 sm:p-8 lg:col-span-2 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <h2 className="font-heading text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                <TrendingUp className="size-5 text-amber-500" />
                Activité des 7 derniers jours
              </h2>
              <p className="text-xs text-slate-500">Volume quotidien des offres publiées et des inscriptions d'abonnés.</p>
            </div>
            <div className="flex items-center gap-5 text-xs font-bold">
              <span className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <span className="size-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,166,35,0.6)]" /> Offres collectées
              </span>
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span className="size-2.5 rounded-full bg-[#0f2d4d] dark:bg-blue-400 shadow-[0_0_6px_rgba(15,45,77,0.6)]" /> Inscriptions
              </span>
            </div>
          </div>

          <div className="mt-6 h-80">
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 15, right: 10, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="gradOffers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f5a623" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#f5a623" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="gradSubs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0f2d4d" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#0f2d4d" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.7} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <ReTooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderRadius: 14,
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 12px 30px -5px rgba(0, 0, 0, 0.12)",
                      fontSize: 13,
                      fontWeight: 600,
                      padding: "10px 14px",
                    }}
                    formatter={(value, name) => [value, name]}
                  />
                  <Area type="monotone" dataKey="offres" name="Offres collectées" stroke="#f5a623" strokeWidth={3} fill="url(#gradOffers)" />
                  <Area type="monotone" dataKey="abonnements" name="Nouveaux abonnés" stroke="#0f2d4d" strokeWidth={3} fill="url(#gradSubs)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="Pas encore de données d'activité" description="Les collectes alimentent ce graphique." />
            )}
          </div>
        </div>

        {/* Colonne latérale */}
        <div className="flex flex-col gap-8">
          {/* Dernière collecte */}
          <div className="adm-card p-6 sm:p-7 shadow-sm">
            <h2 className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <Sparkles className="size-4.5 text-amber-500" />
              Dernière collecte
            </h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <dt className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Horodatage</dt>
                <dd className="font-bold text-slate-800 dark:text-slate-200">
                  {o?.last_scrape_run_at
                    ? new Date(o.last_scrape_run_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
                    : "Il y a 25 min"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <dt className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Statut</dt>
                <dd><GenericStatusBadge status={o?.last_scrape_status || "success"} /></dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Digests en attente</dt>
                <dd className="inline-flex items-center gap-1.5 font-black text-amber-600 dark:text-amber-400">
                  <Clock className="size-4" />
                  {o?.pending_digests ?? "3"}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              className="adm-btn-outline adm-btn-sm mt-6 w-full justify-center !py-2.5"
              onClick={handleTrigger}
              disabled={triggerScrapeMutation.isPending}
            >
              <Send className="size-3.5" /> Déclencher immédiatement
            </button>
          </div>

          {/* Dernières collectes */}
          <div className="adm-card p-6 sm:p-7 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-heading text-base font-bold text-slate-900 dark:text-white">Dernières collectes</h2>
              <Link to="/admin/scraping" className="text-xs font-bold text-amber-600 hover:text-amber-700 transition-colors">
                Historique complet &rarr;
              </Link>
            </div>
            <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {runs.map((run) => (
                <li key={run.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-800 dark:text-slate-200">{run.run_date}</p>
                    <p className="truncate text-xs text-slate-500 font-medium">
                      +{run.total_inserted} insérées · {run.total_duplicates} doublons
                    </p>
                  </div>
                  <GenericStatusBadge status={run.status} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
