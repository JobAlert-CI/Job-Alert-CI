import { useState } from "react"
import { LogOut, Menu, ShieldCheck, User } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { ADMIN_ROLE_LABELS } from "@/api/admin/types"

const ROLE_STYLES = {
  super_admin: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  gestionnaire_offres: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  gestionnaire_utilisateurs: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  moderateur: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
}

/**
 * En-tête admin moderne avec fond semi-transparent flouté et puce de statut.
 */
export const AdminHeader = ({ onToggleSidebar }) => {
  const { user, role, logout } = useAdminAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const handleLogout = async () => {
    setBusy(true)
    try {
      await logout()
      toast.success("Déconnecté", "À bientôt sur JobAlert CI.")
      navigate("/admin/connexion", { replace: true })
    } catch {
      toast.error("Erreur", "La déconnexion a échoué.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <header className="sticky -top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/85 sm:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 lg:hidden"
          onClick={onToggleSidebar}
          aria-label="Ouvrir le menu de navigation"
        >
          <Menu className="size-5" />
        </button>

        <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 sm:inline-flex">
          <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <span>Console active</span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Badge profil utilisateur */}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-1.5 pr-3 shadow-xs dark:border-slate-800 dark:bg-slate-800/60">
          <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 font-heading text-xs font-bold text-white shadow-xs">
            {(user?.full_name ?? "A").slice(0, 1).toUpperCase()}
          </div>
          <div className="hidden min-w-0 text-left sm:block">
            <p className="truncate text-xs font-bold text-slate-800 dark:text-white">
              {user?.full_name ?? "Administrateur"}
            </p>
            <span
              className={`inline-block rounded-md border px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider ${
                ROLE_STYLES[role] || "bg-slate-100 text-slate-700"
              }`}
            >
              {ADMIN_ROLE_LABELS[role] ?? role}
            </span>
          </div>
        </div>

        {/* Bouton de déconnexion */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={busy}
          className="flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 shadow-2xs transition-all duration-150 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:border-slate-800 dark:text-slate-300 dark:hover:border-rose-900 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 sm:w-auto sm:px-3 sm:py-2"
          title="Se déconnecter"
        >
          <LogOut className="size-4" />
          <span className="hidden text-xs font-semibold sm:inline sm:ml-1.5">Quitter</span>
        </button>
      </div>
    </header>
  )
}
