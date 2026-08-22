import { Briefcase, Users, Bot, AlertTriangle } from "lucide-react"

export const AdminStatsGrid = ({
  offersCount = 0,
  subscribersCount = 0,
  scrapersActive = "4/4",
  errorsCount = 0,
  onNavigateSection,
}) => {
  const stats = [
    {
      title: "Offres en ligne",
      value: offersCount,
      sub: "Collectées et modérées",
      icon: <Briefcase className="size-5 text-brand-navy dark:text-sky-400" />,
      bg: "bg-brand-navy/10 border-brand-navy/20",
      section: "offers",
    },
    {
      title: "Abonnés aux alertes",
      value: subscribersCount,
      sub: "Digest quotidien 08:00",
      icon: <Users className="size-5 text-emerald-600 dark:text-emerald-400" />,
      bg: "bg-emerald-500/10 border-emerald-500/20",
      section: "users",
    },
    {
      title: "Scrapers opérationnels",
      value: scrapersActive,
      sub: "LinkedIn, Novojob, EmploiDakar, GoAfrica",
      icon: <Bot className="size-5 text-brand-orange dark:text-amber-400" />,
      bg: "bg-brand-orange/10 border-brand-orange/20",
      section: "scrapers",
    },
    {
      title: "Logs & Alertes récents",
      value: errorsCount,
      sub: errorsCount > 0 ? "Événements à inspecter" : "Système sain (0 incident)",
      icon: <AlertTriangle className={`size-5 ${errorsCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-500"}`} />,
      bg: errorsCount > 0 ? "bg-rose-500/10 border-rose-500/20" : "bg-zinc-500/10 border-zinc-500/20",
      section: "logs",
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => onNavigateSection && onNavigateSection(stat.section)}
          className="group flex flex-col justify-between text-left p-4.5 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest dark:bg-zinc-900 shadow-xs hover:border-brand-navy/30 dark:hover:border-sky-500/30 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-start justify-between w-full">
            <div>
              <span className="text-xs font-medium text-on-surface-variant dark:text-zinc-400">
                {stat.title}
              </span>
              <h3 className="mt-1 text-2xl font-bold text-on-surface dark:text-zinc-100 tracking-tight">
                {stat.value}
              </h3>
            </div>
            <div className={`grid size-10 place-items-center rounded-xl border ${stat.bg} group-hover:scale-105 transition-transform duration-200`}>
              {stat.icon}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-outline-variant/15 flex items-center justify-between w-full text-[11px] text-on-surface-variant/80 dark:text-zinc-400">
            <span className="truncate">{stat.sub}</span>
            <span className="text-brand-navy dark:text-sky-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
              Voir →
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
