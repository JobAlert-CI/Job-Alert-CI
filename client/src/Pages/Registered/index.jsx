import { useEffect, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Link } from "react-router-dom"
import { ArrowLeft, ArrowRight, Bell, ChevronRight, Loader2, ShieldCheck } from "lucide-react"
import Seo from "@/components/seo/Seo"
import { registeredSeo } from "@/lib/seo"
import { RegisteredProvider, useRegistered } from "@/contexts/Registered.context"
import Stepper from "./components/Stepper"
import ApercuRecap from "./components/ApercuRecap"
import EtapeIdentite from "./components/EtapeIdentite"
import EtapePreferences from "./components/EtapePreferences"
import EtapeProfil from "./components/EtapeProfil"
import EtapeValidation from "./components/EtapeValidation"
import EcranSucces from "./components/EcranSucces"
import RegisteredAlert from "./components/RegisteredAlert"

const stepVariants = {
  enter: (dir) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
}

const RegisteredContent = () => {
  const {
    step,
    direction,
    submitted,
    sending,
    canNext,
    consent,
    goNext,
    goBack,
    submitForm,
  } = useRegistered()

  const formCardRef = useRef(null)
  const isFirstRender = useRef(true)

  // Scroll automatique et fluide vers le haut du formulaire lors du changement d'étape
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (formCardRef.current) {
      const yOffset = -90 // décalage pour laisser l'en-tête bien visible
      const elementPosition = formCardRef.current.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset + yOffset

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: "smooth",
      })
    }
  }, [step])

  return (
    <>
      <Seo {...registeredSeo()} />
      <main className="relative overflow-hidden min-h-[calc(100vh-140px)]">
        {/* Arrière-plan décoratif */}
        <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
        <div className="absolute -top-32 right-[-10%] size-140 rounded-full bg-brand-orange/8 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/5 blur-3xl" aria-hidden />

        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-8 md:px-12 md:pt-10">
          {/* Fil d'Ariane & lien haut de page */}
          <motion.nav
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="flex items-center justify-between gap-4"
            aria-label="Fil d'Ariane"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Link to="/" className="transition-colors hover:text-brand-navy">
                Accueil
              </Link>
              <ChevronRight className="size-3" />
              <span className="font-semibold text-brand-navy">Inscription</span>
            </div>
            <Link
              to="/offres"
              className="group hidden md:inline-flex items-center gap-1.5 text-xs font-bold text-brand-navy transition-colors hover:text-brand-orange"
            >
              Déjà abonné ? Voir les offres du jour
              <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </motion.nav>

          {submitted ? (
            <EcranSucces />
          ) : (
            <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-14 xl:gap-16">
              {/* ═══ Colonne principale : Formulaire ═══ */}
              <motion.div
                ref={formCardRef}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="scroll-mt-24 rounded-xl border border-outline-variant/40 bg-white p-6 shadow-soft sm:p-8"
              >
                <Stepper />

                <div className="mt-6">
                  <RegisteredAlert />
                </div>

                {/* Viewport des étapes avec animation fluide Framer Motion */}
                <div className="mt-4 overflow-hidden min-h-[380px]">
                  <AnimatePresence mode="wait" custom={direction} initial={false}>
                    <motion.div
                      key={step}
                      custom={direction}
                      variants={stepVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {step === 0 && <EtapeIdentite />}
                      {step === 1 && <EtapePreferences />}
                      {step === 2 && <EtapeProfil />}
                      {step === 3 && <EtapeValidation />}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Barre de navigation / actions */}
                <div className="mt-8 flex items-center justify-between gap-3 border-t border-outline-variant/40 pt-5">
                  {step > 0 ? (
                    <button
                      type="button"
                      onClick={goBack}
                      disabled={sending}
                      className="inline-flex h-11 items-center gap-2 rounded-lg border border-outline-variant/60 px-5 text-sm font-bold text-on-surface-variant transition-all hover:border-brand-navy/40 hover:text-brand-navy cursor-pointer disabled:opacity-50"
                    >
                      <ArrowLeft className="size-4" />
                      Retour
                    </button>
                  ) : (
                    <span />
                  )}

                  {step < 3 ? (
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={!canNext}
                      className="group inline-flex h-11 items-center gap-2 rounded-lg bg-brand-orange px-6 text-sm font-bold text-white shadow-[0_12px_28px_-8px_rgba(245,166,35,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none cursor-pointer"
                    >
                      Continuer
                      <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={submitForm}
                      disabled={!consent || sending}
                      className="group inline-flex h-11 items-center gap-2 rounded-lg bg-brand-orange px-6 text-sm font-bold text-white shadow-[0_12px_28px_-8px_rgba(245,166,35,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none cursor-pointer"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Création de votre alerte…
                        </>
                      ) : (
                        <>
                          <Bell className="size-4 transition-transform duration-300 group-hover:rotate-12" />
                          Créer mon alerte 8h00
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>

              {/* ═══ Colonne secondaire : Aperçu vivant Sticky Desktop ═══ */}
              <motion.div
                initial={{ opacity: 0, y: 32, rotate: 1.5 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="hidden lg:sticky lg:top-24 lg:block"
              >
                <ApercuRecap />
                <p className="mt-8 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  Aperçu réel, calculé depuis la collecte de ce matin.
                </p>
              </motion.div>
            </div>
          )}

          {/* Lien mobile vers les offres */}
          <Link
            to="/offres"
            className="group md:hidden mt-8 flex items-center justify-end gap-1.5 text-xs font-bold text-brand-navy transition-colors hover:text-brand-orange"
          >
            Déjà abonné ? Voir les offres du jour
            <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </main>
    </>
  )
}

const Registered = () => (
  <RegisteredProvider>
    <RegisteredContent />
  </RegisteredProvider>
)

export default Registered
