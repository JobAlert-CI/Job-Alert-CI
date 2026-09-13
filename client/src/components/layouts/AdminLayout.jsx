import { useCallback, useEffect, useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { Suspense } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { SESSION_REVOQUEE_MESSAGE } from "@/features/admin-auth.tools"
import { useNotify } from "@/contexts/Notify.context"
import { Spinner } from "@/components/ui/spinner"
import AdminSidebar from "@/components/layouts/AdminSidebar"
import AdminHeader from "@/components/layouts/AdminHeader"

/* ─────────────────────────────────────────────────────────────────────
Layout back-office : AdminSidebar (desktop) + AdminHeader + zone de
contenu. Trois fichiers distincts, zéro navigation publique ici.
- Transition de page : <AnimatePresence mode="wait"> autour de l'Outlet
  (capturé via useOutlet pour figer la page sortante pendant l'exit).
- Barrières conservées : must_change_password → /admin/premiere-connexion,
  session révoquée → message dédié, déconnexion → /admin/connexion.
───────────────────────────────────────────────────────────────────── */

const EASE_OUT = [0.22, 1, 0.36, 1]

const AdminLayout = () => {
  const { profile, logout } = useAdminAuth()
  const notify = useNotify()
  const navigate = useNavigate()
  const location = useLocation()
  const [sessionRevoquee, setSessionRevoquee] = useState(false)

  useEffect(() => {
    if (profile?.must_change_password) {
      navigate("/admin/premiere-connexion", { replace: true })
    }
  }, [profile?.must_change_password, navigate])

  useEffect(() => {
    const onRevoke = () => setSessionRevoquee(true)
    window.addEventListener("jobalert:admin-session-revoquee", onRevoke)
    return () => window.removeEventListener("jobalert:admin-session-revoquee", onRevoke)
  }, [])

  useEffect(() => {
    if (sessionRevoquee) {
      notify(SESSION_REVOQUEE_MESSAGE, "warning", 0)
    }
  }, [sessionRevoquee, notify])

  // Changement de page : retour en haut + fermeture du menu mobile.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  const handleLogout = useCallback(async () => {
    try {
      await logout()
    } catch {
      // Serveur injoignable : tokens déjà purgés par la mutation (onMutate),
      // la déconnexion locale reste valide.
    } finally {
      notify("Déconnexion réussie", "success")
      navigate("/admin/connexion", { replace: true })
    }
  }, [logout, navigate, notify])

  return (
    <div className="flex min-h-svh w-full">
      {/* Lien d'évitement clavier */}
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-navy focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Aller au contenu principal
      </a>

      <AdminSidebar />

      {/* Colonne principale */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader onLogout={handleLogout} />
        <main id="contenu" className="min-w-0 flex-1 p-4 sm:p-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: EASE_OUT }}
            >
              <Suspense
                fallback={
                  <div className="grid h-64 place-items-center">
                    <Spinner className="size-5 text-muted-foreground" />
                  </div>
                }
              >
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

export default AdminLayout