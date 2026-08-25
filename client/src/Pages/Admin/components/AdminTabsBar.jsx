import {
  LayoutDashboard,
  FileText,
  Bot,
  Users,
  Briefcase,
  Layers,
  Sparkles,
} from "lucide-react"
import { useAdminAuth } from "@/contexts/AdminAuth.context"

export const ADMIN_TABS = [
  { id: "dashboard", label: "Vue d'ensemble", icon: LayoutDashboard, permission: null },
  { id: "logs", label: "Journaux & Audit", icon: FileText, permission: "manage_logs" },
  { id: "scrapers", label: "Scripts de Scrape", icon: Bot, permission: "trigger_scrape" },
  { id: "users", label: "Utilisateurs & Rôles", icon: Users, permission: "manage_users" },
  { id: "offers", label: "Gestion des Offres", icon: Briefcase, permission: "manage_offers" },
  { id: "sources", label: "Sources de Scraping", icon: Layers, permission: "manage_sources" },
  { id: "filieres", label: "Filières Métiers", icon: Sparkles, permission: "manage_filieres" },
]

export const AdminTabsBar = ({ activeTab, onSelectTab }) => {
  const { hasPermission } = useAdminAuth()

  const visibleTabs = ADMIN_TABS.filter(
    (t) => t.permission === null || hasPermission(t.permission)
  )

  return (
    <div className="sticky top-16 z-20 w-full border-b border-outline-variant/20 bg-surface-container-lowest/90 dark:bg-zinc-900/90 backdrop-blur-md shadow-xs">
      <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-12">
        <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 no-scrollbar">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0 ${
                  isActive
                    ? "bg-brand-navy text-white shadow-xs font-bold ring-1 ring-brand-navy"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                <Icon
                  className={`size-3.5 shrink-0 ${
                    isActive ? "text-brand-orange" : "text-on-surface-variant"
                  }`}
                />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
