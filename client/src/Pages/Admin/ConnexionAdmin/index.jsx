import { useState } from "react"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { Eye, EyeOff, KeyRound, LogIn, ShieldAlert, Mail } from "lucide-react"
import { formatApiError, getApiErrorStatus } from "@/api/errors"
import { forgotPassword } from "@/api/admin/auth"
import { useAdminLoginMutation } from "@/features/admin-auth.tools"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { useNotify } from "@/contexts/Notify.context"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"

/* ─────────────────────────────────────────────────────────────────────
   Page Connexion admin — /admin/connexion

   Objectif : porte d'entrée du back-office (public, avant session).
   Données :
   - POST /api/admin/auth/login { email, password } → TokenRead
     (fixture adminAuth.login). Rate-limit serveur : 10 essais/min par IP,
     verrouillage progressif 10 échecs/15 min par email (429), compte
     inactif → 403.
   - POST /api/admin/auth/forgot-password { email } → réponse neutre
     (anti-énumération, fixture adminAuth.forgotPassword).

   Le mot de passe oublié envoie un CODE par email (pas un lien — le
   serveur met le token en clair dans le corps du message, cf.
   services/admin_password_reset.py) : la saisie du code se fait sur
   /admin/reinitialisation.

   A11y : labels associés (htmlFor/id), aria-invalid sur erreur,
   aria-label sur le toggle visibilité, form natif (navigation clavier).
   ───────────────────────────────────────────────────────────────────── */

/** Message d'erreur distinct par statut (verrouillage ≠ identifiants KO ≠ inactif). */
const messageErreurLogin = (err) => {
  const status = getApiErrorStatus(err)
  if (status === 429) {
    return "Trop de tentatives. Ce compte est temporairement verrouillé — patientez quelques minutes."
  }
  if (status === 403) {
    return "Ce compte administrateur est inactif. Contactez un super admin."
  }
  return formatApiError(err) || "Email ou mot de passe incorrect."
}

/* ─── Sous-composant : demande de réinitialisation ───────────────────── */

const DemandeReinitialisation = ({ onRetour }) => {
  const notify = useNotify()
  const [email, setEmail] = useState("")
  const [enCours, setEnCours] = useState(false)
  const [envoye, setEnvoye] = useState(false)

  const soumettre = async (e) => {
    e.preventDefault()
    if (!email.trim() || enCours) return
    setEnCours(true)
    try {
      // Réponse toujours neutre (anti-énumération serveur) : ce message
      // est identique que l'email existe ou non.
      await forgotPassword(email.trim())
      setEnvoye(true)
    } catch (err) {
      notify(formatApiError(err), "error")
    } finally {
      setEnCours(false)
    }
  }

  if (envoye) {
    return (
      <Alert>
        <Mail />
        <AlertTitle>Email envoyé</AlertTitle>
        <AlertDescription>
          Si ce compte existe, un email contenant un code à usage unique (valable
          60 minutes) vous a été envoyé. Saisissez-le sur la{" "}
          <Link
            to="/admin/reinitialisation"
            className="font-semibold underline underline-offset-4"
          >
            page de réinitialisation
          </Link>
          .
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={soumettre} className="flex flex-col gap-3">
      <p className="text-xs/relaxed text-muted-foreground">
        Saisissez l'email du compte administrateur : si ce compte existe, un
        code de réinitialisation valable 60 minutes lui sera envoyé.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="forgot-email">Email administrateur</Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@jobalert.ci"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onRetour}>
          Retour à la connexion
        </Button>
        <Button type="submit" size="sm" disabled={enCours || !email.trim()}>
          {enCours ? <Spinner /> : <Mail aria-hidden />}
          Envoyer le code
        </Button>
      </div>
    </form>
  )
}

/* ─── Page ──────────────────────────────────────────────────────────── */

const ConnexionAdmin = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { status } = useAdminAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [motDePasseVisible, setMotDePasseVisible] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [modeOublie, setModeOublie] = useState(false)

  const loginMutation = useAdminLoginMutation()

  // Session déjà active → destination d'origine ou tableau de bord.
  if (status === "authenticated") {
    return <Navigate to={location.state?.from || "/admin"} replace />
  }

  const soumettre = async (e) => {
    e.preventDefault()
    if (loginMutation.isPending) return
    setErreur(null)
    try {
      const destination = location.state?.from || "/admin"
      await loginMutation.mutateAsync({ email: email.trim(), password })
      navigate(destination, { replace: true })
    } catch (err) {
      setErreur(messageErreurLogin(err))
    }
  }

  return (
    <div className="grid min-h-svh place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* En-tête */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Link to="/" className="text-lg font-black text-primary">
            JobAlert CI
          </Link>
          <Badge variant="outline">Back-office — accès restreint</Badge>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {modeOublie ? (
            <>
              <div className="mb-4 flex items-center gap-2">
                <KeyRound className="size-4 text-primary" aria-hidden />
                <h1 className="font-heading text-sm font-semibold">Mot de passe oublié</h1>
              </div>
              <DemandeReinitialisation onRetour={() => setModeOublie(false)} />
            </>
          ) : (
            <>
              <div className="mb-5 flex flex-col gap-1">
                <h1 className="font-heading text-base font-semibold">
                  Connexion administrateur
                </h1>
                <p className="text-xs text-muted-foreground">
                  Accès réservé aux comptes autorisés du back-office JobAlert CI.
                </p>
              </div>

              {erreur && (
                <div role="alert" className="mb-4">
                  <Alert variant="destructive">
                    <ShieldAlert />
                    <AlertTitle>Connexion refusée</AlertTitle>
                    <AlertDescription>{erreur}</AlertDescription>
                  </Alert>
                </div>
              )}

              <form onSubmit={soumettre} className="flex flex-col gap-4" noValidate>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@jobalert.ci"
                    aria-invalid={!!erreur}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="login-password">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={motDePasseVisible ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pr-9"
                      aria-invalid={!!erreur}
                    />
                    <button
                      type="button"
                      onClick={() => setMotDePasseVisible((v) => !v)}
                      aria-label={
                        motDePasseVisible
                          ? "Masquer le mot de passe"
                          : "Afficher le mot de passe"
                      }
                      className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      {motDePasseVisible ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={loginMutation.isPending || !email.trim() || !password}
                  className="w-full"
                >
                  {loginMutation.isPending ? <Spinner /> : <LogIn aria-hidden />}
                  {loginMutation.isPending ? "Connexion…" : "Se connecter"}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setModeOublie(true)
                    setErreur(null)
                  }}
                  className="text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] text-muted-foreground">
          Toutes les actions réalisées depuis le back-office sont journalisées.
        </p>
      </div>
    </div>
  )
}

export default ConnexionAdmin
