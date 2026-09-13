import { useEffect, useRef, useState } from "react"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Eye, EyeOff,
  KeyRound, Lock, LogIn, Mail, ScrollText, ShieldAlert,
} from "lucide-react"
import { formatApiError, getApiErrorStatus } from "@/api/errors"
import { forgotPassword } from "@/api/admin/auth"
import { forgotSchema, loginSchema, useAdminLoginMutation } from "@/features/admin-auth.tools"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { useNotify } from "@/contexts/Notify.context"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"

/* ─────────────────────────────────────────────────────────────────────
  Page Connexion admin — /admin/connexion
  Porte d'entrée du back-office (public, avant session).
───────────────────────────────────────────────────────────────────── */

/* ─── Chorégraphie Framer Motion ─────────────────────────────────────── */
const EASE_OUT = [0.22, 1, 0.36, 1]

/* Durée totale de la séquence de sortie après connexion réussie :
   check de succès (~0,5 s) → fondu de la page (~0,5 s) → navigation. */
const DUREE_TRANSITION_SORTIE = 1150

const vueVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE_OUT } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.16, ease: "easeIn" } },
}

/* ─── Message d'erreur distinct par statut (verrouillage ≠ identifiants KO ≠ inactif) ─── */
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

/* ─── Erreur de champ animée (React Hook Form + Zod) ─────────────────── */
const ErreurChamp = ({ id, message }) => (
  <AnimatePresence initial={false}>
    {message && (
      <motion.p
        id={id}
        role="alert"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15 }}
        className="text-xs font-medium text-destructive"
      >
        {message}
      </motion.p>
    )}
  </AnimatePresence>
)

/* ─── Sous-composant : demande de réinitialisation ───────────────────── */
const DemandeReinitialisation = ({ emailInitial = "", onRetour }) => {
  const notify = useNotify()
  const [enCours, setEnCours] = useState(false)
  const [envoye, setEnvoye] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotSchema),
    // Pré-rempli avec l'email déjà saisi sur l'écran de connexion.
    defaultValues: { email: emailInitial },
    mode: "onTouched",
  })

  const soumettre = handleSubmit(async ({ email }) => {
    if (enCours) return
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
  })

  return (
    <AnimatePresence mode="wait" initial={false}>
      {envoye ? (
        /* ── Feedback de succès : panneau teinté vert + icône cerclée ── */
        <motion.div
          key="succes"
          variants={vueVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          aria-live="polite"
          className="flex flex-col gap-4"
        >
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-600/10">
                <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-heading text-sm font-semibold text-emerald-900">
                  Email envoyé
                </p>
                <p className="text-xs/relaxed text-emerald-800">
                  Si ce compte existe, un code à usage unique (valable 60
                  minutes) vient de lui être envoyé. Saisissez-le sur la{" "}
                  <Link
                    to="/admin/reinitialisation"
                    className="font-semibold underline decoration-emerald-400 underline-offset-4 transition-colors hover:decoration-emerald-600"
                  >
                    page de réinitialisation
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onRetour}
            className="mx-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Retour à la connexion
          </button>
        </motion.div>
      ) : (
        <motion.div
          key="formulaire"
          variants={vueVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {/* Verrouillage visuel pendant l'envoi */}
          <motion.div
            animate={{ opacity: enCours ? 0.6 : 1 }}
            transition={{ duration: 0.2 }}
            aria-busy={enCours}
          >
            <form onSubmit={soumettre} noValidate className="flex flex-col gap-4">
              <p className="text-xs leading-relaxed text-center text-on-surface-variant mb-3">
                Saisissez l'email du compte administrateur : si ce compte existe, un code de réinitialisation valable 60 minutes lui sera envoyé.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="forgot-email" className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Email administrateur</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    autoFocus /* curseur immédiat à l'arrivée sur la vue */
                    placeholder="admin@jobalert.ci"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "forgot-email-erreur" : undefined}
                    disabled={enCours}
                    className="disabled:opacity-100 h-9 w-full rounded-md border-none pl-11 pr-11 text-sm! outline-none transition-all placeholder:text-muted-foreground/60"
                    {...register("email")}
                  />
                </div>
                <ErreurChamp id="forgot-email-erreur" message={errors.email?.message} />
              </div>
              {/* Hiérarchie : action secondaire (ghost) à gauche, CTA à droite */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onRetour}
                  disabled={enCours}
                  className="group inline-flex items-center gap-1 px-2 text-sm font-semibold text-muted-foreground transition-all duration-300 hover:brightness-110 cursor-pointer"
                >
                  <ArrowLeft className="size-3.5 group-hover:-translate-x-0.5" aria-hidden />
                  Retour
                </Button>
                <Button
                  type="submit"
                  disabled={enCours}
                  className="group inline-flex h-9 items-center gap-2 rounded-md bg-brand-orange px-6 text-sm font-bold text-on-primary transition-all duration-300 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none cursor-pointer"
                >
                  {enCours ? <Spinner /> : <Mail aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-1" />}
                  {enCours ? "Envoi en cours…" : "Envoyer le code"}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ─── Page ──────────────────────────────────────────────────────────── */
const ConnexionAdmin = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { status } = useAdminAuth()
  const loginMutation = useAdminLoginMutation()
  const [motDePasseVisible, setMotDePasseVisible] = useState(false)
  const [majuscules, setMajuscules] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [modeOublie, setModeOublie] = useState(false)
  /* Séquence de connexion réussie : null tant que non connecté,
     puis { url, premiereConnexion } pendant l'animation de sortie. */
  const [redirection, setRedirection] = useState(null)
  const timerRedirection = useRef(null)
  const enRedirection = redirection !== null

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  })

  // Permet de pré-remplir le formulaire « mot de passe oublié ».
  // eslint-disable-next-line react-hooks/incompatible-library
  const emailSaisi = watch("email")
  const champMotDePasse = register("password")

  // Nettoyage du timer si le compos est démonté avant la navigation.
  useEffect(() => {
    return () => {
      if (timerRedirection.current) window.clearTimeout(timerRedirection.current)
    }
  }, [])

  // Session déjà active → destination d'origine ou tableau de bord.
  // Exception pendant la séquence de succès : on laisse l'animation de
  // sortie aller au bout (le navigate() du timer prend la main).
  if (status === "authenticated" && !enRedirection) {
    return <Navigate to={location.state?.from || "/admin"} replace />
  }

  const soumettre = handleSubmit(async ({ email, password }) => {
    if (loginMutation.isPending || enRedirection) return
    setErreur(null)
    try {
      const reponse = await loginMutation.mutateAsync({
        email: email.trim(),
        password,
      })

      const premiereConnexion = !!reponse?.must_change_password
      const destination = premiereConnexion
        ? "/admin/premiere-connexion"
        : location.state?.from || "/admin"
      // Transition de page : feedback succès → sortie animée → navigation.
      setRedirection({ url: destination, premiereConnexion })
      timerRedirection.current = window.setTimeout(() => {
        navigate(destination, { replace: true })
      }, DUREE_TRANSITION_SORTIE)
    } catch (err) {
      setErreur(messageErreurLogin(err))
    }
  })

  const suivreMajuscules = (e) =>
    setMajuscules(e.getModifierState?.("CapsLock") ?? false)
  const verrouille = loginMutation.isPending || enRedirection

  return (
    <div className="relative grid min-h-svh place-items-center overflow-hidden bg-background px-4 py-10">
      {/* ── Décor d'arrière-plan : motif pointillé + halos de marque ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-pattern" />

      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-44 left-1/2 size-120 translate-x-[15%] rounded-full bg-brand-navy/10 blur-3xl"
      />
      {/* Voile émeraude discret pendant la séquence de succès */}
      <AnimatePresence>
        {enRedirection && (
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="pointer-events-none absolute inset-0 bg-emerald-100/40"
          />
        )}
      </AnimatePresence>

      {/* Sortie de page : la colonne entière s'efface après le succès */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={
          enRedirection
            ? { opacity: 0, y: -24, scale: 0.97, filter: "blur(2px)" }
            : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
        }
        transition={{
          duration: enRedirection ? 0.5 : 0.45,
          ease: EASE_OUT,
          delay: enRedirection ? 0.65 : 0,
        }}
        className={`relative w-full max-w-md ${enRedirection ? "pointer-events-none" : ""}`}
      >
        {/* ── En-tête ── */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="grid size-13 place-items-center rounded-2xl bg-transparent text-white shadow-hover">
            <img src="/logo2.svg" alt="JobAlert CI" className="h-full w-full" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Link
              to="/"
              className="font-heading text-lg font-black tracking-tight text-brand-navy"
            >
              JobAlert CI
            </Link>
            <Badge
              variant="outline"
              className="gap-1.5 text-muted-foreground"
            >
              <Lock className="size-3" aria-hidden />
              Back-office — accès restreint
            </Badge>
          </div>
        </div>

        {/* ── Carte : le layout anime la hauteur lors des bascules de vue ── */}
        <motion.div
          layout
          transition={{ layout: { duration: 0.28, ease: EASE_OUT } }}
          className="overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-soft"
        >
          <AnimatePresence mode="wait" initial={false}>
            {enRedirection ? (
              /* ── Étape 1 : feedback de connexion réussie ── */
              <motion.div
                key="succes-connexion"
                variants={vueVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                aria-live="polite"
                className="flex flex-col items-center gap-5 py-8 text-center"
              >
                <motion.span
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 340,
                    damping: 16,
                    delay: 0.05,
                  }}
                  className="grid size-14 place-items-center rounded-full bg-emerald-600/10"
                >
                  <CheckCircle2 className="size-7 text-emerald-600" aria-hidden />
                </motion.span>
                <div className="flex flex-col gap-1">
                  <p className="font-heading text-base font-extrabold tracking-tight text-brand-navy">
                    Connexion réussie
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {redirection.premiereConnexion
                      ? "Première connexion : choisissez votre nouveau mot de passe…"
                      : "Redirection vers votre espace…"}
                  </p>
                </div>
                {/* Barre de progression calée sur la navigation (~1,1 s) */}
                <div className="h-1 w-40 overflow-hidden rounded-full bg-surface-container-high">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.9, ease: "linear", delay: 0.1 }}
                    className="h-full w-full origin-left rounded-full bg-emerald-500"
                  />
                </div>
              </motion.div>
            ) : modeOublie ? (
              <motion.div
                key="forgot"
                variants={vueVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <div className="mb-2 flex items-center justify-center gap-2">
                  <KeyRound className="size-5 text-brand-navy font-extrabold" aria-hidden />
                  <h1 className="font-heading text-md font-extrabold tracking-tight text-brand-navy sm:text-lg">
                    Mot de passe oublié
                  </h1>
                </div>
                <DemandeReinitialisation
                  emailInitial={emailSaisi || ""}
                  onRetour={() => setModeOublie(false)}
                />
              </motion.div>
            ) : (
              <motion.div
                key="login"
                variants={vueVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <div className="mb-7 flex flex-col text-center gap-1">
                  <h1 className="font-heading text-2xl font-extrabold tracking-tight text-brand-orange sm:text-3xl">
                    Connexion
                  </h1>
                  <p className="text-xs leading-relaxed text-on-surface-variant">
                    Accès réservé aux comptes autorisés du back-office JobAlert CI.
                  </p>
                </div>

                {/* Alerte d'erreur : glisse en douceur (hauteur + fondu) */}
                <AnimatePresence initial={false}>
                  {erreur && (
                    <motion.div
                      key="erreur-login"
                      initial={{ opacity: 0, y: -12, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -8, height: 0 }}
                      transition={{ duration: 0.24, ease: EASE_OUT }}
                      className="overflow-hidden"
                    >
                      <div role="alert" className="mb-4">
                        <Alert variant="destructive">
                          <ShieldAlert />
                          <AlertTitle>Connexion refusée</AlertTitle>
                          <AlertDescription>{erreur}</AlertDescription>
                        </Alert>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Verrouillage visuel pendant la connexion */}
                <motion.div
                  animate={{ opacity: verrouille ? 0.6 : 1 }}
                  transition={{ duration: 0.2 }}
                  aria-busy={verrouille}
                >
                  <form
                    onSubmit={soumettre}
                    noValidate
                    className="flex flex-col gap-4"
                  >
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="login-email" className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Email</Label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="login-email"
                          type="email"
                          autoComplete="username"
                          autoFocus /* curseur immédiat au montage de la vue */
                          placeholder="admin@jobalert.ci"
                          aria-invalid={!!errors.email || !!erreur}
                          aria-describedby={
                            errors.email ? "login-email-erreur" : undefined
                          }
                          disabled={verrouille}
                          className="disabled:opacity-100 h-9 w-full rounded-md border-none pl-11 pr-11 text-sm! outline-none transition-all placeholder:text-muted-foreground/60"
                          {...register("email")}
                        />
                      </div>
                      <ErreurChamp
                        id="login-email-erreur"
                        message={errors.email?.message}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="login-password" className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Mot de passe</Label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="login-password"
                          type={motDePasseVisible ? "text" : "password"}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          className="disabled:opacity-100 h-9 w-full rounded-md border-none pl-11 pr-11 text-sm! outline-none transition-all placeholder:text-muted-foreground/60"
                          aria-invalid={!!errors.password || !!erreur}
                          aria-describedby={
                            errors.password
                              ? "login-password-erreur"
                              : undefined
                          }
                          disabled={verrouille}
                          onKeyDown={suivreMajuscules}
                          onKeyUp={suivreMajuscules}
                          {...champMotDePasse}
                          onBlur={(e) => {
                            champMotDePasse.onBlur(e)
                            setMajuscules(false)
                          }}
                        />
                        {/* Micro-interaction : rebond ressort au clic */}
                        <motion.button
                          type="button"
                          style={{ y: "-50%" }}
                          whileHover={{ scale: 1.12 }}
                          whileTap={{ scale: 0.8 }}
                          transition={{
                            type: "spring",
                            stiffness: 520,
                            damping: 22,
                          }}
                          onClick={() => setMotDePasseVisible((v) => !v)}
                          aria-label={
                            motDePasseVisible
                              ? "Masquer le mot de passe"
                              : "Afficher le mot de passe"
                          }
                          aria-pressed={motDePasseVisible}
                          disabled={verrouille}
                          className="absolute top-1/2 right-2 size-4.5 rounded-sm p-0.5 text-muted-foreground cursor-pointer transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                          {motDePasseVisible ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </motion.button>
                      </div>
                      <ErreurChamp
                        id="login-password-erreur"
                        message={errors.password?.message}
                      />
                      {/* Garde-fou clavier : Verr. Maj activée */}
                      <AnimatePresence initial={false}>
                        {majuscules && !verrouille && (
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center gap-1 text-xs font-medium text-[#B45309]"
                          >
                            <AlertTriangle className="size-3" aria-hidden />
                            Verr. Maj activée
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      disabled={verrouille}
                      className="w-full group inline-flex h-9 items-center gap-2 rounded-md bg-brand-orange px-6 text-sm font-bold text-on-primary transition-all duration-300 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none cursor-pointer"
                    >
                      {verrouille ? <Spinner /> : <LogIn aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-1" />}
                      {verrouille ? "Connexion…" : "Se connecter"}
                    </Button>
                  </form>
                </motion.div>

                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setModeOublie(true)
                      setErreur(null)
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-navy underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <KeyRound className="size-3" aria-hidden />
                    Mot de passe oublié ?
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[10px] text-muted-foreground">
          <ScrollText className="size-3" aria-hidden />
          Toutes les actions réalisées depuis le back-office sont
          journalisées.
        </p>
      </motion.div>
    </div>
  )
}

export default ConnexionAdmin