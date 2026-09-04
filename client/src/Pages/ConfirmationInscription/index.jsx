import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowRight,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Radar,
  RefreshCw,
  Send,
  SlidersHorizontal,
  CheckCircle2,
} from "lucide-react"
import subscriptionsApi from "@/api/public/subscriptions"
import Seo from "@/components/seo/Seo"
import { confirmationSeo } from "@/lib/seo"
import { CountdownEnvoi, CtaLink } from "@/components/shared"

const SUITE_PIPELINE = [
  { icon: CheckCircle2, t: "Confirmé", l: "Adresse validée avec succès" },
  { icon: Radar, t: "06h00", l: "Collecte des sources" },
  { icon: SlidersHorizontal, t: "07h15", l: "Filtrage selon vos filières" },
  { icon: Send, t: "08h00", l: "Votre récapitulatif par email" },
]

export const ConfirmationInscription = () => {
  const { token } = useParams()
  const [state, setState] = useState({
    loading: true,
    success: false,
    email: "",
    message: "",
    errorDetail: "",
    isExpired: false,
  })

  const [resendEmail, setResendEmail] = useState("")
  const [resendLoading, setResendLoading] = useState(false)
  const [resendStatus, setResendStatus] = useState(null)

  useEffect(() => {
    let isMounted = true
    const validate = async () => {
      if (!token) {
        if (isMounted) {
          setState({
            loading: false,
            success: false,
            email: "",
            message: "Lien invalide",
            errorDetail: "Aucun jeton de confirmation fourni.",
            isExpired: false,
          })
        }
        return
      }
      try {
        const response = await subscriptionsApi.confirmSubscribe(token)
        /* Le token validé ne doit pas rester dans l'historique du navigateur
           (URL partageable, extensions, écran "précédent") — Cf. Audit.md P0-3. */
        window.history.replaceState(null, "", "/inscription")
        if (isMounted) {
          setState({
            loading: false,
            success: true,
            email: response?.email || "",
            message: response?.message || "Inscription confirmée avec succès !",
            errorDetail: "",
            isExpired: false,
          })
        }
      } catch (err) {
        const statusCode = err?.response?.status
        const detail =
          err?.response?.data?.detail ||
          "Ce lien de confirmation est invalide ou a expiré."
        if (isMounted) {
          setState({
            loading: false,
            success: false,
            email: "",
            message:
              statusCode === 410
                ? "Lien de confirmation expiré"
                : "Lien invalide ou expiré",
            errorDetail: detail,
            isExpired: statusCode === 410 || statusCode === 400,
          })
        }
      }
    }
    validate()
    return () => {
      isMounted = false
    }
  }, [token])

  const handleResend = async (e) => {
    e.preventDefault()
    if (!resendEmail.trim()) return
    setResendLoading(true)
    setResendStatus(null)
    try {
      const res = await subscriptionsApi.resendConfirmation(resendEmail.trim())
      setResendStatus({
        type: "success",
        text:
          res?.message ||
          "Un nouvel email de confirmation vient d'être envoyé. Vérifiez votre boîte de réception.",
      })
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        "Impossible de renvoyer l'email pour le moment. Veuillez réessayer plus tard."
      setResendStatus({
        type: "error",
        text: msg,
      })
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <>
      <Seo {...confirmationSeo()} />
      <main className="relative overflow-hidden min-h-[calc(100vh-140px)] bg-linear-to-br from-surface-container-lowest via-background to-surface-container-low">
        {/* Arrière-plans décoratifs */}
        <div className="absolute inset-0 bg-pattern opacity-40" aria-hidden />
        <div
          className="absolute -top-32 right-[-10%] size-140 rounded-full bg-brand-orange/5 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/5 blur-3xl"
          aria-hidden
        />

        <div className="relative z-10 mx-auto px-6 pb-20 pt-8 md:px-24 md:pt-12">
          {/* Fil d'Ariane */}
          <nav
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-10"
            aria-label="Fil d'Ariane"
          >
            <Link to="/" className="transition-colors hover:text-brand-navy">
              Accueil
            </Link>
            <ChevronRight className="size-3" />
            <Link
              to="/inscription"
              className="transition-colors hover:text-brand-navy"
            >
              Inscription
            </Link>
            <ChevronRight className="size-3" />
            <span className="font-semibold text-brand-navy">Confirmation</span>
          </nav>

          <div className="relative z-10 mx-auto max-w-4xl">
            {/* ══════ 1. ÉTAT DE CHARGEMENT ══════ */}
            {state.loading && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto max-w-md rounded-2xl border border-outline-variant/40 bg-card/80 p-10 text-center shadow-soft backdrop-blur-md"
              >
                <div className="relative mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-brand-orange/10">
                  <Loader2 className="size-8 animate-spin text-brand-orange" />
                </div>
                <h1 className="font-heading text-xl font-bold text-brand-navy">
                  Validation de votre email...
                </h1>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Veuillez patienter quelques instants pendant que nous activons votre alerte.
                </p>
              </motion.div>
            )}

            {/* ══════ 2. ÉTAT DE SUCCÈS ══════ */}
            {!state.loading && state.success && (
              <div className="mx-auto max-w-2xl text-center py-6">
                {/* Animation Checkmark */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="relative mx-auto mb-8 flex size-24 items-center justify-center rounded-full bg-emerald-50"
                >
                  <motion.svg
                    viewBox="0 0 52 52"
                    className="size-16"
                    aria-hidden
                  >
                    <motion.circle
                      cx="26"
                      cy="26"
                      r="24"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                    />
                    <motion.path
                      d="M14 27l8 8 16-16"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
                    />
                  </motion.svg>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  className="font-heading text-3xl font-black tracking-tight text-brand-navy sm:text-4xl"
                >
                  {state.message}
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65, duration: 0.4 }}
                  className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-on-surface-variant"
                >
                  {state.email ? (
                    <>
                      Votre adresse{" "}
                      <strong className="font-semibold text-brand-navy">
                        {state.email}
                      </strong>{" "}
                      est désormais validée. Vos alertes quotidiennes sont prêtes !
                    </>
                  ) : (
                    "Vos alertes quotidiennes sont désormais actives."
                  )}
                </motion.p>

                {/* Compte à rebours */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.4 }}
                  className="mx-auto mt-8 max-w-sm"
                >
                  <CountdownEnvoi
                    variant="horloge"
                    label="Prochaine alerte dans"
                  />
                </motion.div>

                {/* Pipeline des étapes */}
                <div className="mt-10 grid gap-3 sm:grid-cols-4 text-left">
                  {SUITE_PIPELINE.map((s, i) => (
                    <motion.div
                      key={s.t}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.95 + i * 0.1, duration: 0.4 }}
                      className="rounded-xl border border-outline-variant/40 bg-card/80 p-4 shadow-soft backdrop-blur-sm"
                    >
                      <s.icon className="size-5 text-brand-orange" />
                      <p className="mt-2 font-heading text-sm font-extrabold text-brand-navy">
                        {s.t}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                        {s.l}
                      </p>
                    </motion.div>
                  ))}
                </div>

                {/* Boutons d'action */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.4, duration: 0.4 }}
                  className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
                >
                  <CtaLink to="/offres" iconRight={ArrowRight}>
                    Voir les offres du jour
                  </CtaLink>
                  <CtaLink to="/comment-ca-marche" variant="secondary">
                    Comment ça marche
                  </CtaLink>
                </motion.div>
              </div>
            )}

            {/* ══════ 3. ÉTAT D'ERREUR / EXPIRATION ══════ */}
            {!state.loading && !state.success && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto max-w-xl rounded-2xl border border-outline-variant/40 bg-card/80 p-8 shadow-soft backdrop-blur-md sm:p-10"
              >
                <div className="flex size-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-6 mx-auto">
                  <AlertTriangle className="size-8" />
                </div>

                <h1 className="font-heading text-2xl font-black text-brand-navy text-center sm:text-3xl">
                  {state.message}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-on-surface-variant text-center">
                  {state.errorDetail}
                </p>

                {/* Formulaire de renvoi */}
                <div className="mt-8 rounded-xl border border-outline-variant/40 bg-surface-container-low/50 p-6 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-xs font-bold text-brand-navy uppercase tracking-wider">
                    <RefreshCw className="size-4 text-brand-orange" />
                    Demander un nouvel email
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Entrez votre adresse email pour recevoir immédiatement un nouveau lien actif pendant 24 heures.
                  </p>
                  <form onSubmit={handleResend} className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      type="email"
                      required
                      placeholder="votre.email@exemple.ci"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      className="flex-1 rounded-lg border border-outline-variant bg-card px-4 py-2.5 text-sm text-brand-navy placeholder:text-muted-foreground/70 focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/20 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={resendLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-navy/90 disabled:opacity-50 shadow-soft"
                    >
                      {resendLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Envoi...
                        </>
                      ) : (
                        <>
                          <Send className="size-4" />
                          Renvoyer
                        </>
                      )}
                    </button>
                  </form>
                  {resendStatus && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mt-4 rounded-lg p-3 text-xs leading-relaxed flex items-center gap-2 ${resendStatus.type === "success"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-red-50 text-red-800 border border-red-200"
                        }`}
                    >
                      {resendStatus.type === "success" ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
                      {resendStatus.text}
                    </motion.div>
                  )}
                </div>

                {/* Navigation de secours */}
                <div className="mt-8 flex items-center justify-between border-t border-outline-variant/30 pt-6 text-xs text-muted-foreground">
                  <Link
                    to="/"
                    className="font-medium text-brand-navy hover:text-brand-orange transition-colors flex items-center gap-1"
                  >
                    <ChevronRight className="size-3 rotate-180" /> Retour à l'accueil
                  </Link>
                  <Link
                    to="/contact"
                    className="font-medium text-brand-navy hover:text-brand-orange transition-colors flex items-center gap-1"
                  >
                    Besoin d'aide ? <ChevronRight className="size-3" />
                  </Link>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}

export default ConfirmationInscription