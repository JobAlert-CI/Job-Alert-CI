import { useState } from "react"
import { Lock, Mail, Shield, ShieldCheck, ArrowRight, AlertCircle, Sparkles } from "lucide-react"
import Logo from "@/components/ui/logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAdminAuth } from "@/contexts/AdminAuth.context"

export const AdminLogin = ({ onLoginSuccess }) => {
  const { login } = useAdminAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await login({ email, password })
      if (onLoginSuccess) onLoginSuccess()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Identifiants incorrects ou compte inactif. Veuillez réessayer."
      )
    } finally {
      setLoading(false)
    }
  }

  // Quick login helper pour les tests locaux (DEV UNIQUEMENT)
  const handleQuickLogin = (testEmail, testRole) => {
    if (!import.meta.env.DEV) return
    setEmail(testEmail)
    setPassword("TempPassword123!")
    login({ email: testEmail, password: "TempPassword123!" }).then(() => {
      if (onLoginSuccess) onLoginSuccess()
    })
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-b from-surface via-surface-container-lowest to-surface-container-low dark:from-zinc-950 dark:to-zinc-900">
      <div className="w-full max-w-md space-y-6">
        {/* Logo & Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-surface-container-lowest dark:bg-zinc-900 border border-outline-variant/30 shadow-xs mb-3">
            <Logo className="h-8 w-auto" />
          </div>
          <h1 className="text-xl font-bold text-on-surface dark:text-zinc-100 tracking-tight">
            Espace d'Administration
          </h1>
          <p className="mt-1 text-xs text-on-surface-variant dark:text-zinc-400">
            Connectez-vous pour piloter les flux, scrapers et utilisateurs de JobAlert CI.
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest dark:bg-zinc-900 p-6 sm:p-8 shadow-xl">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-700 dark:text-rose-400">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-on-surface dark:text-zinc-200 mb-1.5">
                Adresse Email Administrateur
              </label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-on-surface-variant/60 pointer-events-none" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@jobalert.ci"
                  required
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-on-surface dark:text-zinc-200 mb-1.5">
                Mot de Passe
              </label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-on-surface-variant/60 pointer-events-none" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-9 bg-brand-navy hover:bg-brand-navy/90 text-white font-semibold text-xs shadow-xs gap-1.5 mt-2"
            >
              {loading ? "Vérification..." : "Se connecter"}
              <ArrowRight className="size-3.5" />
            </Button>
          </form>

          {/* DEV ONLY: Raccourcis de connexion rapide pour test (conditionnés à import.meta.env.DEV) */}
          {import.meta.env.DEV && (
            <div className="mt-6 pt-5 border-t border-outline-variant/15">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 mb-2">
                <Sparkles className="size-3 text-brand-orange" />
                Connexion Rapide Démo (Mode DEV) :
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin("admin@jobalert.ci", "super_admin")}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-outline-variant/30 bg-surface-container-low p-2 text-left text-xs font-semibold text-on-surface hover:border-brand-navy hover:bg-surface-container transition-colors"
                >
                  <Shield className="size-3.5 text-brand-navy" />
                  Super Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("awa.superviseur@jobalert.ci", "superviseur")}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-outline-variant/30 bg-surface-container-low p-2 text-left text-xs font-semibold text-on-surface hover:border-amber-500 hover:bg-surface-container transition-colors"
                >
                  <ShieldCheck className="size-3.5 text-amber-600" />
                  Superviseur
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-on-surface-variant/70">
          JobAlert CI • Accès sécurisé réservé aux administrateurs autorisés
        </p>
      </div>
    </div>
  )
}
