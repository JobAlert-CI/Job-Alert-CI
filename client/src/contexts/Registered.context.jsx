import {
  createContext, useCallback, useContext, useMemo, useState,
} from "react"
import { useSearchParams } from "react-router-dom"
import subscriptionApi from "@/api/public/subscriptions"
import { formatApiError, isCanceledError } from "@/api/errors"
import {
  DEFAULT_VILLES,
  useRegisteredOffers,
  useRegisteredReferentials,
} from "@/tools/registered.tools"

/* Non exportée : utilisée uniquement dans ce contexte (react-refresh
   exige un fichier à exports 100 % composants/hooks). Les étapes
   affichées du stepper vivent dans Pages/Registered/components/Stepper.jsx. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Initialise le formulaire depuis les query params de l'URL
 */
const formDepuisUrl = (searchParams) => {
  const p = Object.fromEntries(searchParams.entries())
  const liste = (v) => (v || "").split(",").map((x) => x.trim()).filter(Boolean)

  const filieres = liste(p.filieres ?? p.filiere).slice(0, 3)
  const contrats = liste(p.contrats ?? p.contrat)
  const experience = (p.experience || "").trim()
  const ville = (p.ville || "").trim()
  const conseils = p.conseils === undefined
    ? true
    : !["false", "0", "non", "no"].includes(p.conseils.trim().toLowerCase())

  return {
    email: (p.email || "").trim(),
    nom: (p.nom || "").trim(),
    filieres,
    experience,
    contrats,
    ville,
    conseils,
  }
}

const RegisteredContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useRegistered = () => {
  const ctx = useContext(RegisteredContext)
  if (!ctx) {
    throw new Error("useRegistered doit être utilisé sous un <RegisteredProvider>")
  }
  return ctx
}

export const RegisteredProvider = ({ children }) => {
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [form, setForm] = useState(() => formDepuisUrl(searchParams))
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [subscriberData, setSubscriberData] = useState(null)

  // Chargement et mise en cache TanStack Query des référentiels et offres du backend
  const { data: refData, isLoading: isLoadingReferentials } = useRegisteredReferentials()
  const { data: offersData } = useRegisteredOffers()

  const filieres = useMemo(() => refData?.filieres || [], [refData])
  const contrats = useMemo(() => refData?.contrats || [], [refData])
  const experiences = useMemo(() => refData?.experiences || [], [refData])
  const villes = useMemo(() => refData?.villes || DEFAULT_VILLES, [refData])
  const offersList = useMemo(() => offersData || [], [offersData])

  // Validation
  const emailOk = useMemo(() => EMAIL_RE.test(form.email.trim()), [form.email])

  const canNext = useMemo(() => {
    if (step === 0) return emailOk
    if (step === 1) return form.filieres.length >= 1
    if (step === 2) return true
    if (step === 3) return consent && !sending
    return true
  }, [step, emailOk, form.filieres.length, consent, sending])

  // Mutations du formulaire
  const setField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (apiError) setApiError(null)
  }, [apiError])

  const toggleFiliere = useCallback((code) => {
    setForm((prev) => {
      const has = prev.filieres.includes(code)
      if (has) return { ...prev, filieres: prev.filieres.filter((c) => c !== code) }
      if (prev.filieres.length >= 3) return prev
      return { ...prev, filieres: [...prev.filieres, code] }
    })
    if (apiError) setApiError(null)
  }, [apiError])

  const toggleContrat = useCallback((c) => {
    setForm((prev) => ({
      ...prev,
      contrats: prev.contrats.includes(c)
        ? prev.contrats.filter((x) => x !== c)
        : [...prev.contrats, c],
    }))
  }, [])

  // Navigation par étape
  const goNext = useCallback(() => {
    if (!canNext) return
    setDirection(1)
    setStep((s) => Math.min(s + 1, 3))
  }, [canNext])

  const goBack = useCallback(() => {
    setDirection(-1)
    setStep((s) => Math.max(s - 1, 0))
  }, [])

  const goToStep = useCallback((targetStep) => {
    if (targetStep < 0 || targetStep > 3) return
    if (targetStep < step) {
      setDirection(-1)
      setStep(targetStep)
    }
  }, [step])

  const passer = useCallback(() => {
    setDirection(1)
    setStep(3)
  }, [])

  // Calculs mémoïsés pour l'aperçu et le récapitulatif basés sur les offres backend
  const total = useMemo(
    () => offersList.filter((o) => form.filieres.includes(o.filiere || o.filiere_code || o.primary_filiere?.code)).length,
    [offersList, form.filieres]
  )

  const offresApercu = useMemo(
    () =>
      offersList
        .filter((o) => form.filieres.includes(o.filiere || o.filiere_code || o.primary_filiere?.code))
        .sort((a, b) => (a.jours ?? 0) - (b.jours ?? 0))
        .slice(0, 3),
    [offersList, form.filieres]
  )

  // Soumission vers l'API FastAPI backend
  const submitForm = useCallback(async () => {
    if (!consent || sending || !emailOk || form.filieres.length === 0) return

    setSending(true)
    setApiError(null)

    const payload = {
      email: form.email.trim(),
      full_name: form.nom.trim() || undefined,
      city: form.ville || undefined,
      filieres: form.filieres,
      experience: form.experience || undefined,
      contract_types: form.contrats,
      wants_career_tips: form.conseils,
      source: "site",
    }

    try {
      const result = await subscriptionApi.subscribe(payload)
      setSubscriberData(result)
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err) {
      /* Une requête annulée n'est pas une erreur à montrer à l'utilisateur. */
      if (isCanceledError(err)) return

      /* formatApiError renvoie une string : le status HTTP se lit sur la réponse. */
      if (err?.response?.status === 409) {
        setApiError("Cet email est déjà inscrit à nos alertes quotidiennes.")
      } else {
        setApiError(formatApiError(err) || "Une erreur est survenue lors de la création de l'alerte. Veuillez réessayer.")
      }
    } finally {
      setSending(false)
    }
  }, [consent, sending, emailOk, form])

  const clearError = useCallback(() => setApiError(null), [])

  const value = useMemo(
    () => ({
      step,
      direction,
      form,
      consent,
      sending,
      submitted,
      apiError,
      subscriberData,
      emailOk,
      canNext,
      filieres,
      contrats,
      experiences,
      villes,
      total,
      offresApercu,
      isLoadingReferentials,
      setField,
      toggleFiliere,
      toggleContrat,
      setConsent,
      goNext,
      goBack,
      goToStep,
      passer,
      submitForm,
      clearError,
    }),
    [
      step,
      direction,
      form,
      consent,
      sending,
      submitted,
      apiError,
      subscriberData,
      emailOk,
      canNext,
      filieres,
      contrats,
      experiences,
      villes,
      total,
      offresApercu,
      isLoadingReferentials,
      setField,
      toggleFiliere,
      toggleContrat,
      setConsent,
      goNext,
      goBack,
      goToStep,
      passer,
      submitForm,
      clearError,
    ]
  )

  return (
    <RegisteredContext.Provider value={value}>
      {children}
    </RegisteredContext.Provider>
  )
}
