import { useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Lock, Mail, ChevronRight, ArrowRight, ShieldCheck, AlertCircle, Sparkles } from "lucide-react"
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

  return (
    <section className="relative overflow-hidden hero-gradient py-14 sm:py-20 min-h-[80vh] flex items-center">
      <div className="absolute inset-0 bg-pattern opacity-40 pointer-events-none" aria-hidden />
      <div
        className="absolute -top-32 right-[-10%] size-140 rounded-full bg-brand-orange/8 blur-3xl pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/5 blur-3xl pointer-events-none"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6 sm:px-10 lg:px-12 w-full">
        {/* Fil d'Ariane */}
        <motion.nav
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-8"
          aria-label="Fil d'Ariane"
        >
          <Link to="/" className="transition-colors hover:text-brand-navy">
            Accueil
          </Link>
          <ChevronRight className="size-3" aria-hidden />
          <span className="font-semibold text-brand-navy" aria-current="page">
            Connexion Administration
          </span>
        </motion.nav>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          {/* Left: Presentation text & reassurances */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-navy/20 bg-brand-navy/5 px-3.5 py-1.5 text-[11px] font-bold text-brand-navy mb-4">
              <ShieldCheck className="size-3.5 text-brand-orange" />
              Accès Console Sécurisée
            </span>

            <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-navy leading-tight">
              Espace de gestion & pilotage JobAlert CI.
            </h1>

            <p className="mt-3 text-sm text-on-surface-variant leading-relaxed">
              Cet espace est réservé aux administrateurs et superviseurs de la plateforme pour piloter les flux de collecte, modérer les annonces et gérer les abonnés.
            </p>

            <div className="mt-6 space-y-2.5 text-xs text-on-surface-variant">
              <div className="flex items-center gap-2.5">
                <span className="size-1.5 rounded-full bg-brand-orange" />
                <span>Authentification chiffrée par JWT & contrôle d'accès strict</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="size-1.5 rounded-full bg-brand-orange" />
                <span>Journalisation et audit de toutes les actions d'administration</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="size-1.5 rounded-full bg-brand-orange" />
                <span>Pilotage en direct des connecteurs de scraping et des alertes</span>
              </div>
            </div>
          </div>

          {/* Right: Login Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest dark:bg-zinc-900 p-6 sm:p-8 shadow-xl backdrop-blur-md"
          >
            <h2 className="text-base font-bold text-on-surface dark:text-zinc-100">
              Connexion administrateur
            </h2>
            <p className="mt-0.5 text-xs text-on-surface-variant dark:text-zinc-400">
              Veuillez renseigner vos identifiants d'accès.
            </p>

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-700 dark:text-rose-400">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-on-surface dark:text-zinc-200 mb-1.5">
                  Adresse Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-on-surface-variant/60 pointer-events-none" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@jobalert.ci"
                    required
                    className="pl-9.5 h-10 text-xs rounded-xl bg-surface-container-low/40 border-outline-variant/40"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-on-surface dark:text-zinc-200 mb-1.5">
                  Mot de Passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-on-surface-variant/60 pointer-events-none" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="pl-9.5 h-10 text-xs rounded-xl bg-surface-container-low/40 border-outline-variant/40"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-brand-navy hover:bg-brand-navy/90 text-white font-semibold text-xs rounded-xl shadow-xs gap-1.5 mt-2"
              >
                {loading ? "Vérification..." : "Accéder à la console"}
                <ArrowRight className="size-3.5" />
              </Button>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
