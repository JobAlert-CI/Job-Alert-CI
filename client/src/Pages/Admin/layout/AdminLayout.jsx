import { useState } from "react"
import { Outlet } from "react-router-dom"
import { Sparkles, X } from "lucide-react"
import { AdminSidebar } from "./AdminSidebar"
import { AdminHeader } from "./AdminHeader"

/**
 * Layout admin (S4) — Sidebar fixe immersive, en-tête flouté moderne,
 * zone de contenu spacieuse et centrée.
 */
export const AdminLayout = () => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const closeDrawer = () => setDrawerOpen(false)

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-slate-800/60 bg-[#0A1628] text-white shadow-xl lg:flex">
        {/* Logo / Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 shadow-md shadow-orange-500/25">
              <Sparkles className="size-4 text-white" />
            </div>
            <span className="font-heading text-lg font-extrabold tracking-tight text-white">
              Job<span className="text-amber-400">Alert</span>
            </span>
          </div>
          <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
            Admin
          </span>
        </div>

        {/* Sidebar Navigation */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AdminSidebar />
        </div>
      </aside>

      {/* Drawer mobile */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity" onClick={closeDrawer} />
          <div className="fixed left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-[#0A1628] text-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-orange-500">
                  <Sparkles className="size-3.5 text-white" />
                </div>
                <span className="font-heading text-base font-extrabold text-white">
                  Job<span className="text-amber-400">Alert</span>
                </span>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                onClick={closeDrawer}
                aria-label="Fermer le menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AdminSidebar onNavigate={closeDrawer} />
            </div>
          </div>
        </div>
      )}

      {/* Zone de contenu principale */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader onToggleSidebar={() => setDrawerOpen(true)} />
        <main className="flex-1 my-8 px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12 space-y-8">
          <Outlet />
        </main>
        <footer className="border-t border-slate-200/80 bg-white/50 px-6 py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
          JobAlert CI &copy; {new Date().getFullYear()} &mdash; Console d'administration sécurisée
        </footer>
      </div>
    </div>
  )
}