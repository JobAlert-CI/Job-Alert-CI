import { NavLink } from "react-router-dom"
import {
  Bot,
  Briefcase,
  ClipboardList,
  Cpu,
  FileWarning,
  LayoutDashboard,
  MapPin,
  Newspaper,
  RadioTower,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react"
import { roleMatches } from "@/api/admin/types"
import { useAdminAuth } from "@/contexts/AdminAuth.context"

/**
 * Sidebar admin (S4) — Design haute fidélité avec contrastes dynamiques et micro-interactions.
 */
const NAV_GROUPS = [
  {
    label: "Pilotage & Activité",
    items: [
      { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, end: true, roles: "*" },
      { to: "/admin/offres", label: "Offres d'emploi", icon: Briefcase, roles: ["super_admin", "gestionnaire_offres"] },
      { to: "/admin/utilisateurs", label: "Abonnés alertes", icon: Users, roles: ["super_admin", "gestionnaire_utilisateurs"] },
      { to: "/admin/contenu", label: "Contenu éditorial", icon: Newspaper, roles: ["super_admin", "moderateur"] },
    ],
  },
  {
    label: "Données & Collecte",
    items: [
      { to: "/admin/filieres", label: "Filières métiers", icon: MapPin, roles: ["super_admin"] },
      { to: "/admin/sources", label: "Sources de collecte", icon: RadioTower, roles: ["super_admin"] },
      { to: "/admin/referentiels", label: "Référentiels", icon: ClipboardList, roles: ["super_admin"] },
      { to: "/admin/scraping", label: "Collecte (Scraping)", icon: Bot, roles: ["super_admin"] },
    ],
  },
  {
    label: "Supervision & Sécurité",
    items: [
      { to: "/admin/journal", label: "Journal d'audit", icon: ShieldCheck, roles: ["super_admin"] },
      { to: "/admin/logs", label: "Logs d'erreurs", icon: FileWarning, roles: ["super_admin"] },
      { to: "/admin/administrateurs", label: "Équipe Admin", icon: Users, roles: ["super_admin"] },
    ],
  },
  {
    label: "Configuration & IA",
    items: [
      { to: "/admin/parametres", label: "Paramètres système", icon: Settings, roles: ["super_admin"] },
      { to: "/admin/ia", label: "Normalisation IA", icon: Cpu, roles: ["super_admin"] },
    ],
  },
]

export const AdminSidebar = ({ onNavigate }) => {
  const { role } = useAdminAuth()

  return (
    <nav aria-label="Navigation admin" className="flex h-full flex-col gap-6 overflow-y-auto px-4 py-6">
      {NAV_GROUPS.map((group) => {
        const visibleItems = group.items.filter((item) => roleMatches(role, item.roles))
        if (!visibleItems.length) return null
        return (
          <div key={group.label} className="space-y-1.5">
            <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400/70">
              {group.label}
            </p>
            <ul className="flex flex-col gap-1">
              {visibleItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? "bg-gradient-to-r from-amber-500/20 to-amber-500/5 text-amber-300 font-semibold shadow-sm border border-amber-500/30"
                          : "text-slate-300 hover:bg-white/10 hover:text-white hover:translate-x-0.5"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={`size-4.5 shrink-0 transition-colors ${
                            isActive ? "text-amber-400" : "text-slate-400 group-hover:text-slate-200"
                          }`}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {isActive && (
                          <span className="size-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,166,35,0.8)]" />
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      <div className="mt-auto pt-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Sparkles className="size-3.5 text-amber-400" />
            <span>JobAlert Back-office</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Version 2.0 · Session sécurisée et auditée en temps réel.
          </p>
        </div>
      </div>
    </nav>
  )
}
