import { Menu, LogOut, Shield, ShieldCheck, User } from "lucide-react"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { AdminBadgeRole } from "./AdminBadgeRole"
import { SECTIONS } from "./AdminSidebar"

export const AdminHeader = ({ activeSection, onMobileOpen }) => {
  const { user, role, logout, switchRole } = useAdminAuth()

  const currentSectionMeta = SECTIONS.find((s) => s.id === activeSection)

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-outline-variant/20 bg-surface-container-lowest/80 dark:bg-zinc-900/80 px-4 sm:px-6 backdrop-blur-md">
      {/* Left: Mobile Toggle & Section Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMobileOpen}
          className="lg:hidden rounded-lg p-2 text-on-surface-variant hover:bg-surface-container transition-colors"
          aria-label="Ouvrir le menu"
        >
          <Menu className="size-5" />
        </button>

        <div>
          <h1 className="text-sm sm:text-base font-semibold text-on-surface dark:text-zinc-100 flex items-center gap-2">
            {currentSectionMeta?.label || "Administration"}
          </h1>
          <p className="text-[11px] text-on-surface-variant dark:text-zinc-400 hidden sm:block">
            Espace de pilotage et modération JobAlert CI
          </p>
        </div>
      </div>

      {/* Right: Quick actions, Role Switcher (DEV only) and Profile */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* DEV ONLY: Test Role Switcher (invisible en production) */}
        {import.meta.env.DEV && (
          <div className="hidden md:flex items-center gap-1.5 rounded-full border border-outline-variant/30 bg-surface-container-low/80 dark:bg-zinc-800/80 px-2 py-1">
            <span className="text-[10px] uppercase font-bold text-on-surface-variant/80 pl-1 tracking-wider">
              Test Rôle :
            </span>
            <button
              type="button"
              onClick={() => switchRole("super_admin")}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                role === "super_admin" || role === "admin"
                  ? "bg-brand-navy text-white"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Shield className="size-3" />
              Admin
            </button>
            <button
              type="button"
              onClick={() => switchRole("superviseur")}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                role === "superviseur"
                  ? "bg-amber-600 text-white"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <ShieldCheck className="size-3" />
              Superviseur
            </button>
          </div>
        )}

        {/* User profile & Role Badge */}
        <div className="flex items-center gap-2.5 pl-1 border-l border-outline-variant/20">
          <div className="grid size-8 place-items-center rounded-full bg-brand-navy text-white font-semibold text-xs shadow-xs">
            {user?.full_name?.charAt(0)?.toUpperCase() || <User className="size-4" />}
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-semibold text-on-surface dark:text-zinc-200 leading-tight">
              {user?.full_name || "Admin"}
            </span>
            <div className="mt-0.5">
              <AdminBadgeRole role={role} />
            </div>
          </div>
        </div>

        {/* Logout button */}
        <button
          type="button"
          onClick={logout}
          className="rounded-xl p-2 text-on-surface-variant hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
          title="Déconnexion"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  )
}
