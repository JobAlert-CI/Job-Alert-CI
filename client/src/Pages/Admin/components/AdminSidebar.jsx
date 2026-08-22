import {
  LayoutDashboard,
  FileText,
  Bot,
  Users,
  Briefcase,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react"
import { Link } from "react-router-dom"
import Logo from "@/components/ui/logo"
import { useAdminAuth } from "@/contexts/AdminAuth.context"

export const SECTIONS = [
  {
    id: "dashboard",
    label: "Vue d'ensemble",
    icon: LayoutDashboard,
    permission: null, // toujours accessible
  },
  {
    id: "logs",
    label: "Journaux & Audit",
    icon: FileText,
    permission: "manage_logs",
  },
  {
    id: "scrapers",
    label: "Scripts de Scrape",
    icon: Bot,
    permission: "trigger_scrape",
  },
  {
    id: "users",
    label: "Utilisateurs & Rôles",
    icon: Users,
    permission: "manage_users",
  },
  {
    id: "offers",
    label: "Gestion des Offres",
    icon: Briefcase,
    permission: "manage_offers",
  },
  {
    id: "sources",
    label: "Sources de Scraping",
    icon: Layers,
    permission: "manage_sources",
  },
  {
    id: "filieres",
    label: "Filières Métiers",
    icon: Sparkles,
    permission: "manage_filieres",
  },
]

export const AdminSidebar = ({
  activeSection,
  onSelectSection,
  isCollapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}) => {
  const { hasPermission } = useAdminAuth()

  // Filtrage des sections selon les permissions réelles
  const visibleSections = SECTIONS.filter(
    (sec) => sec.permission === null || hasPermission(sec.permission)
  )

  const content = (
    <div className="flex h-full flex-col justify-between p-3.5 bg-surface-container-lowest dark:bg-zinc-900 border-r border-outline-variant/25">
      {/* Brand & Header */}
      <div>
        <div className="flex items-center justify-between px-2 py-3 border-b border-outline-variant/15">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <Link to="/" target="_blank" className="shrink-0 flex items-center">
              <Logo className="h-6 w-auto" />
            </Link>
            {!isCollapsed && (
              <span className="rounded-md bg-brand-navy dark:bg-sky-500/20 text-white dark:text-sky-300 px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                Admin
              </span>
            )}
          </div>
          {mobileOpen && (
            <button
              onClick={onMobileClose}
              className="lg:hidden rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav className="mt-4 flex flex-col gap-1">
          {visibleSections.map((sec) => {
            const Icon = sec.icon
            const isActive = activeSection === sec.id

            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => {
                  onSelectSection(sec.id)
                  if (onMobileClose) onMobileClose()
                }}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-brand-navy text-white shadow-xs font-semibold"
                    : "text-on-surface-variant dark:text-zinc-400 hover:bg-surface-container-high/60 dark:hover:bg-zinc-800 hover:text-on-surface dark:hover:text-zinc-100"
                } ${isCollapsed ? "justify-center px-0" : ""}`}
                title={isCollapsed ? sec.label : undefined}
              >
                <Icon
                  className={`size-4 shrink-0 transition-transform ${
                    isActive ? "text-brand-orange" : "text-on-surface-variant group-hover:scale-105"
                  }`}
                />
                {!isCollapsed && <span className="truncate">{sec.label}</span>}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Footer / Toggle & Public link */}
      <div className="border-t border-outline-variant/15 pt-3 flex flex-col gap-1.5">
        <Link
          to="/"
          target="_blank"
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high/60 hover:text-on-surface transition-colors ${
            isCollapsed ? "justify-center px-0" : ""
          }`}
          title="Voir le site public"
        >
          <ExternalLink className="size-3.5 shrink-0" />
          {!isCollapsed && <span className="truncate">Retour au site public</span>}
        </Link>

        {/* Desktop Collapse Button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden lg:flex items-center justify-center rounded-xl p-2 text-on-surface-variant hover:bg-surface-container-high/60 transition-colors"
          title={isCollapsed ? "Agrandir le menu" : "Réduire le menu"}
        >
          {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="sticky top-0 h-screen">{content}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={onMobileClose}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  )
}
