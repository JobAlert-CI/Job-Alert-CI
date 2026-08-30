import { Outlet } from "react-router-dom"
import { Toaster } from "sonner"
import { AdminAuthProvider } from "@/contexts/AdminAuth.context"

/**
 * Racine du back-office admin — fournit :
 * - le store de session (S3) : tokens + profil /auth/me
 * - les toasts sonner (S6)
 * - un <Outlet /> pour les routes imbriquées définies dans App.jsx
 */
const AdminRoot = () => (
  <AdminAuthProvider>
    <Outlet />
    <Toaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{ style: { borderRadius: "12px", fontFamily: "var(--font-sans)" } }}
    />
  </AdminAuthProvider>
)

export default AdminRoot

