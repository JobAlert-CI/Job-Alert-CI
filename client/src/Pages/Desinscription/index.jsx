import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  BellOff,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MailCheck,
} from "lucide-react"
import subscriptionsApi from "@/api/public/subscriptions"
import Seo from "@/components/seo/Seo"
import CtaLink from "@/components/shared/CtaLink"

/* Motifs de désinscription proposés (optionnels, envoyés en query param). */
const MOTIFS = [
  "Je ne cherche plus d'emploi",
  "Trop d'emails",
  "Les offres ne correspondent pas à mon profil",
  "Autre raison",
]

export const Desinscription = () => {
  const { token } = useParams()

  const [state, setState] = useState({
    loading: false,
    done: false,
    alreadyDone: false,
    message: "",
    error: null,
  })
  const [motif, setMotif] = useState("")

  /* La désinscription n'est PAS déclenchée au montage : on montre d'abord
     un écran de confirmation explicite (bonne pratique anti-clic accidentel).
     Le lien de l'email reste donc sans danger s'il est ouvert par erreur. */
  const confirmUnsubscribe = async () => {
    if (!token || state.loading) return
    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const response = await subscriptionsApi.unsubscribe(token, motif ? { reason: motif } : {})
      setState({
        loading: false,
        done: true,
        alreadyDone: response?.message?.includes("déjà") || false,
        message:
          response?.message ||
          "Votre désinscription est enregistrée. Vous ne recevrez plus nos emails.",
        error: null,
      })
    } catch (err) {
      const status = err?.response?.status
      const detail =
        err?.response?.data?.detail ||
        "Ce lien de désinscription n'est plus valide. Si vous continuez à recevoir des emails, contactez-nous."
      setState({
        loading: false,
        done: false,
        alreadyDone: false,
        message: "",
        error: {
          title: status === 404 ? "Lien invalide" : status === 410 ? "Lien déjà utilisé ou expiré" : "Erreur",
          detail,
        },
      })
    }
  }

  return (
    <>
      <Seo
        title="Désinscription — JobAlert CI"
        description="Arrêtez les alertes quotidiennes en un clic, sans mot de passe."
      />
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

        <div className="relative z-10 mx-auto max-w-xl px-6 pb-20 pt-8 md:pt-12">
          {/* Fil d'Ariane */}
          <nav
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-8"
            aria-label="Fil d'Ariane"
          >
            <Link to="/" className="transition-colors hover:text-brand-navy">
              Accueil
            </Link>
            <ChevronRight className="size-3" />
            <span className="font-semibold text-brand-navy">Désinscription</span>
          </nav>

          {/* ══════ ÉTAPE 1 : confirmation explicite ══════ */}
          {!state.done && !state.error && !state.loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-outline-variant/40 bg-card/80 p-8 shadow-soft backdrop-blur-md sm:p-10"
            >
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-brand-navy/5">
                <BellOff className="size-8 text-brand-navy" />
              </div>

              <h1 className="text-center font-heading text-2xl font-black tracking-tight text-brand-navy sm:text-3xl">
                Quitter les alertes quotidiennes ?
              </h1>
              <p className="mt-3 text-center text-sm leading-relaxed text-on-surface-variant">
                Vous ne recevrez plus aucun récapitulatif d'offres. Cette action est
                immédiate — et vous pourrez toujours vous réinscrire depuis le site.
              </p>

              {/* Motif (facultatif) */}
              <fieldset className="mt-8">
                <legend className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Pourquoi partez-vous ? <span className="font-normal normal-case">(facultatif)</span>
                </legend>
                <div className="mt-3 space-y-2">
                  {MOTIFS.map((m) => (
                    <label
                      key={m}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-outline-variant/40 bg-card px-4 py-2.5 text-[13px] transition-colors hover:border-brand-navy/35 has-checked:border-brand-orange has-checked:bg-brand-orange/5"
                    >
                      <input
                        type="radio"
                        name="motif"
                        value={m}
                        checked={motif === m}
                        onChange={() => setMotif(m)}
                        className="size-4 accent-[#F5A623] cursor-pointer"
                      />
                      <span className="text-on-surface-variant">{m}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <button
                type="button"
                onClick={confirmUnsubscribe}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-6 py-3 text-sm font-bold text-red-700 shadow-soft transition hover:bg-red-100 active:scale-[0.98]"
              >
                <BellOff className="size-4" />
                Confirmer ma désinscription
              </button>
              <CtaLink to="/" variant="secondary" size="md" className="mt-3 w-full">
                Annuler, je garde mes alertes
              </CtaLink>
            </motion.div>
          )}

          {/* ══════ CHARGEMENT ══════ */}
          {state.loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-outline-variant/40 bg-card/80 p-10 text-center shadow-soft backdrop-blur-md"
            >
              <Loader2 className="mx-auto size-8 animate-spin text-brand-orange" />
              <h1 className="mt-4 font-heading text-lg font-bold text-brand-navy">
                Traitement de votre demande…
              </h1>
            </motion.div>
          )}

          {/* ══════ SUCCÈS ══════ */}
          {state.done && !state.loading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-outline-variant/40 bg-card/80 p-8 text-center shadow-soft backdrop-blur-md sm:p-10"
            >
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-emerald-50"
              >
                {state.alreadyDone ? (
                  <MailCheck className="size-9 text-emerald-600" />
                ) : (
                  <CheckCircle2 className="size-9 text-emerald-600" />
                )}
              </motion.div>

              <h1 className="font-heading text-2xl font-black text-brand-navy sm:text-3xl">
                {state.alreadyDone ? "Déjà désinscrit" : "Désinscription confirmée"}
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-on-surface-variant">
                {state.message}
              </p>

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <CtaLink to="/offres">Parcourir les offres</CtaLink>
                <CtaLink to="/inscription" variant="secondary">
                  Se réinscrire plus tard
                </CtaLink>
              </div>
            </motion.div>
          )}

          {/* ══════ ERREUR ══════ */}
          {state.error && !state.loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-outline-variant/40 bg-card/80 p-8 text-center shadow-soft backdrop-blur-md sm:p-10"
            >
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <AlertTriangle className="size-8" />
              </div>
              <h1 className="font-heading text-2xl font-black text-brand-navy sm:text-3xl">
                {state.error.title}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                {state.error.detail}
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <CtaLink to="/">Retour à l'accueil</CtaLink>
                <CtaLink to="/contact" variant="secondary">
                  Contacter le support
                </CtaLink>
              </div>
            </motion.div>
          )}

          {/* Rappel RGPD commun */}
          {!state.done && !state.error && !state.loading && (
            <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
              Conformément à la loi 2013-450 relative à la protection des données
              personnelles en Côte d'Ivoire, votre email sera supprimé de notre liste
              de diffusion immédiatement après validation.
            </p>
          )}
        </div>
      </main>
    </>
  )
}

export default Desinscription
