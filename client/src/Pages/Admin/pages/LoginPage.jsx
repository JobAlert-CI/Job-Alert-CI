import { useState } from "react"
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react"
import { toast } from "sonner"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { extractErrorMessage } from "@/api/admin/adminAxios"

/**
 * Page 1 — /admin/connexion (public).
 * POST /auth/login → stocke les 2 tokens → redirection /admin.
 * 401 = identifiants invalides · 403 = compte inactif (message dédié).
 */
export const LoginPage = () => {
  const { login, isAuthenticated } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const sessionExpired = searchParams.get("expired") === "1"
  const from = location.state?.from || "/admin"

  if (isAuthenticated && !submitting) {
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login({ email: email.trim(), password })
      toast.success("Connexion réussie", "Bienvenue sur la console JobAlert CI.")
      navigate(from === "/admin/connexion" ? "/admin" : from, { replace: true })
    } catch (err) {
      if (err?.isInactiveAccount) {
        setError("Ce compte est inactif. Contactez un super administrateur pour le réactiver.")
      } else if (err?.isInvalidCredentials) {
        setError("Email ou mot de passe incorrect.")
      } else {
        setError(extractErrorMessage(err, "Connexion impossible pour le moment."))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-container-low px-4 py-10">
      <div className="w-full max-w-md">
        {/* En-tête de marque */}
        <div className="mb-8 text-center">
          <span className="font-heading text-2xl font-extrabold tracking-tight text-brand-navy dark:text-white">
            Job<span className="text-primary">Alert</span> CI
          </span>
          <p className="mt-2 text-sm text-muted-foreground">Console d'administration</p>
        </div>

        <div className="adm-card p-6 sm:p-8">
          <h1 className="font-heading text-lg font-bold">Connexion administrateur</h1>
          <p className="mt-1 text-sm text-muted-foreground">Accès réservé aux comptes autorisés.</p>

          {sessionExpired && (
            <p className="mt-4 rounded-lg bg-[var(--adm-st-pending-bg)] px-3 py-2 text-xs font-medium text-[var(--adm-st-pending)]">
              Votre session a expiré. Reconnectez-vous pour continuer.
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
            <div>
              <label htmlFor="login-email" className="adm-label">
                Adresse email
              </label>
              <div className="relative">
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder=" admin@jobalert.ci"
                  className="adm-input pl-9"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="adm-label">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="  ••••••••"
                  className="adm-input pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Masquer" : "Afficher"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-xs font-semibold text-on-error-container">
                {error}
              </p>
            )}

            <button type="submit" className="adm-btn-primary w-full" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Se connecter
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
          Toutes les connexions sont journalisées dans le journal d'activité.
        </p>
      </div>
    </div>
  )
}
