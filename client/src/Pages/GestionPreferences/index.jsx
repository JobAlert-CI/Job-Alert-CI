import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  Briefcase,
  Check,
  ChevronRight,
  Loader2,
  Save,
  SlidersHorizontal,
  Zap,
} from "lucide-react"
import subscriptionsApi from "@/api/public/subscriptions"
import { getContractTypes, getExperienceLevels } from "@/api/public/referentials"
import Seo from "@/components/seo/Seo"
import CtaLink from "@/components/shared/CtaLink"
import { cn } from "@/lib/utils"

/* ─── Helpers référentiels ──────────────────────────────────────────────── */

const labelDe = (item) =>
  typeof item === "string" ? item : item.label || item.code

const codeDe = (item) =>
  typeof item === "string" ? item : item.code || item.label

/* Le backend renvoie les filières liées via SubscriberFiliereRead
   (filiere_id + priority). On n'a PAS le code dans la réponse : on résout
   l'affichage via le référentiel chargé côté client. */

/* ─── Composant principal ──────────────────────────────────────────────── */

export const GestionPreferences = () => {
  const { token } = useParams()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedOnce, setSavedOnce] = useState(false)
  const [error, setError] = useState(null)
  const [saveError, setSaveError] = useState(null)

  /* Données actuelles de l'abonné */
  const [prefs, setPrefs] = useState(null)
  const [selectedFilieres, setSelectedFilieres] = useState([]) // codes
  const [selectedContrats, setSelectedContrats] = useState([]) // codes
  const [conseils, setConseils] = useState(true)

  /* Référentiels */
  const [filieres, setFilieres] = useState([])
  const [contrats, setContrats] = useState([])
  const [experiences, setExperiences] = useState([])
  const [experience, setExperience] = useState("")

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      if (!token) {
        if (isMounted) {
          setError({ title: "Lien invalide", detail: "Aucun jeton fourni." })
        }
        return
      }

      try {
        const [prefsData, filieresData, contratsData, expData] = await Promise.all([
          subscriptionsApi.getPreferences(token),
          import("@/api/public/filieres").then((m) => m.getFilieres()),
          getContractTypes(),
          getExperienceLevels(),
        ])

        if (!isMounted) return

        setFilieres(filieresData || [])
        setContrats(contratsData || [])
        setExperiences(expData || [])
        setPrefs(prefsData)

        /* Les filières liées sont des ids : on les traduit en codes via le
           référentiel. Si une filière liée ne matche aucun code connu, on
           garde son id brut pour ne pas perdre la donnée au save. */
        const linkedCodes = (prefsData?.filiere_links || []).map((link) => {
          const match = (filieresData || []).find((f) => f.id === link.filiere_id)
          return match?.code || link.filiere_id
        })
        setSelectedFilieres(linkedCodes)

        const contractCodes = (prefsData?.contract_preferences || []).map((pref) => {
          const match = (contratsData || []).find((c) => c.id === pref.contract_type_id)
          return match?.code || pref.contract_type_id
        })
        setSelectedContrats(contractCodes)

        setConseils(prefsData?.wants_career_tips ?? true)
      } catch (err) {
        if (!isMounted) return
        const status = err?.response?.status
        setError({
          title: status === 404 ? "Lien invalide ou expiré" : "Erreur de chargement",
          detail:
            err?.response?.data?.detail ||
            "Ce lien de gestion n'est plus valide. Utilisez le lien « Gérer mes préférences » du dernier email reçu.",
        })
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [token])

  /* ─── Sélection ────────────────────────────────────────────────────── */

  const plein = selectedFilieres.length >= 3

  const toggleFiliere = (code) => {
    setSelectedFilieres((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code)
      if (prev.length >= 3) return prev
      return [...prev, code]
    })
    setSavedOnce(false)
  }

  const toggleContrat = (code) => {
    setSelectedContrats((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    )
    setSavedOnce(false)
  }

  /* ─── Sauvegarde ───────────────────────────────────────────────────── */

  const handleSave = async () => {
    if (saving || selectedFilieres.length < 1) return
    setSaving(true)
    setSaveError(null)
    try {
      await subscriptionsApi.updatePreferences(token, {
        filieres: selectedFilieres,
        contract_types: selectedContrats,
        wants_career_tips: conseils,
      })
      setSavedOnce(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err) {
      setSaveError(
        err?.response?.data?.detail ||
          "Impossible d'enregistrer vos préférences. Veuillez réessayer.",
      )
    } finally {
      setSaving(false)
    }
  }

  /* ─── Rendu ────────────────────────────────────────────────────────── */

  return (
    <>
      <Seo
        title="Gérer mes préférences — JobAlert CI"
        description="Modifiez vos filières, contrats et préférences d'alerte sans mot de passe."
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

        <div className="relative z-10 mx-auto max-w-3xl px-6 pb-20 pt-8 md:pt-12">
          {/* Fil d'Ariane */}
          <nav
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-8"
            aria-label="Fil d'Ariane"
          >
            <Link to="/" className="transition-colors hover:text-brand-navy">
              Accueil
            </Link>
            <ChevronRight className="size-3" />
            <span className="font-semibold text-brand-navy">Mes préférences</span>
          </nav>

          {/* ══════ CHARGEMENT ══════ */}
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto max-w-md rounded-2xl border border-outline-variant/40 bg-card/80 p-10 text-center shadow-soft backdrop-blur-md"
            >
              <Loader2 className="mx-auto size-8 animate-spin text-brand-orange" />
              <h1 className="mt-4 font-heading text-xl font-bold text-brand-navy">
                Chargement de vos préférences…
              </h1>
            </motion.div>
          )}

          {/* ══════ ERREUR ══════ */}
          {!loading && error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto max-w-xl rounded-2xl border border-outline-variant/40 bg-card/80 p-8 shadow-soft backdrop-blur-md sm:p-10 text-center"
            >
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <AlertTriangle className="size-8" />
              </div>
              <h1 className="font-heading text-2xl font-black text-brand-navy sm:text-3xl">
                {error.title}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{error.detail}</p>
              <div className="mt-8 flex justify-center gap-3">
                <CtaLink to="/">Retour à l'accueil</CtaLink>
              </div>
            </motion.div>
          )}

          {/* ══════ FORMULAIRE ══════ */}
          {!loading && !error && prefs && (
            <div>
              {/* Bandeau succès après sauvegarde */}
              {savedOnce && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 flex items-center gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4"
                >
                  <Check className="size-5 shrink-0 text-emerald-600" strokeWidth={3} />
                  <p className="text-sm font-semibold text-emerald-800">
                    Préférences enregistrées ! Votre prochain récapitulatif quotidien en tiendra compte dès demain 08h00.
                  </p>
                </motion.div>
              )}

              {/* En-tête */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="font-heading text-2xl font-extrabold tracking-tight text-brand-navy sm:text-3xl">
                    Mes <span className="text-brand-orange">préférences</span>.
                  </h1>
                  <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">
                    Ajustez votre alerte quotidienne — aucun mot de passe requis.
                    {prefs.email && (
                      <>
                        {" "}
                        Connecté en tant que{" "}
                        <strong className="font-semibold text-brand-navy">{prefs.email}</strong>.
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* ─── Filières ─── */}
              <section className="mt-8" aria-labelledby="filieres-title">
                <div className="flex items-end justify-between gap-4">
                  <h2
                    id="filieres-title"
                    className="flex items-center gap-2 font-heading text-lg font-extrabold text-brand-navy"
                  >
                    <SlidersHorizontal className="size-4.5 text-brand-orange" />
                    Filières suivies
                  </h2>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1 font-heading text-xs font-extrabold transition-colors",
                      selectedFilieres.length > 0
                        ? "bg-brand-orange/15 text-[#B45309]"
                        : "bg-surface-container text-muted-foreground",
                    )}
                  >
                    {selectedFilieres.length}/3
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  1 à 3 filières. Vous ne recevrez que leurs offres.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {filieres.map((f) => {
                    const sel = selectedFilieres.includes(f.code)
                    const bloque = plein && !sel
                    return (
                      <button
                        key={f.code}
                        type="button"
                        onClick={() => toggleFiliere(f.code)}
                        aria-pressed={sel}
                        disabled={bloque}
                        className={cn(
                          "relative flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-all duration-200",
                          sel
                            ? "border-brand-navy bg-brand-navy/3 shadow-soft ring-1 ring-brand-navy/20"
                            : "border-outline-variant/60 bg-card hover:-translate-y-0.5 hover:border-brand-navy/35 hover:shadow-soft",
                          bloque && "cursor-not-allowed opacity-40",
                        )}
                      >
                        <span className="block line-clamp-2 text-[12px] font-bold leading-tight text-brand-navy">
                          {f.label}
                        </span>
                        {sel && (
                          <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-brand-orange text-on-primary">
                            <Check className="size-3" strokeWidth={3.5} />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* ─── Contrats ─── */}
              <section className="mt-8" aria-labelledby="contrats-title">
                <h2
                  id="contrats-title"
                  className="flex items-center gap-2 font-heading text-lg font-extrabold text-brand-navy"
                >
                  <Briefcase className="size-4.5 text-brand-orange" />
                  Contrats recherchés
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Optionnel : si rien n'est coché, vous recevez tous les contrats.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {contrats.map((c) => {
                    const code = codeDe(c)
                    const label = labelDe(c)
                    const isSelected = selectedContrats.includes(code)
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => toggleContrat(code)}
                        aria-pressed={isSelected}
                        className={cn(
                          "rounded-full border px-4 py-2 text-[13px] font-semibold transition-all duration-200 cursor-pointer",
                          isSelected
                            ? "border-brand-navy bg-brand-navy text-white shadow-soft"
                            : "border-outline-variant/60 bg-card text-on-surface-variant hover:-translate-y-0.5 hover:border-brand-navy/40 hover:text-brand-navy",
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* ─── Expérience ─── */}
              <section className="mt-8" aria-labelledby="exp-title">
                <h2
                  id="exp-title"
                  className="flex items-center gap-2 font-heading text-lg font-extrabold text-brand-navy"
                >
                  <Zap className="size-4.5 text-brand-orange" />
                  Niveau d'expérience
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Optionnel : affine le tri de vos offres.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {experiences.map((item) => {
                    const code = codeDe(item)
                    const label = labelDe(item)
                    const isSelected = experience === code
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          setExperience(isSelected ? "" : code)
                          setSavedOnce(false)
                        }}
                        aria-pressed={isSelected}
                        className={cn(
                          "rounded-full border px-4 py-2 text-[13px] font-semibold transition-all duration-200 cursor-pointer",
                          isSelected
                            ? "border-brand-navy bg-brand-navy text-white shadow-soft"
                            : "border-outline-variant/60 bg-card text-on-surface-variant hover:-translate-y-0.5 hover:border-brand-navy/40 hover:text-brand-navy",
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* ─── Conseils carrière ─── */}
              <label className="mt-8 flex cursor-pointer items-start gap-3 rounded-lg border border-outline-variant/40 bg-card/60 p-4">
                <input
                  type="checkbox"
                  checked={conseils}
                  onChange={(e) => {
                    setConseils(e.target.checked)
                    setSavedOnce(false)
                  }}
                  className="mt-0.5 size-4 accent-[#F5A623] cursor-pointer"
                />
                <span className="text-[13px] leading-relaxed text-on-surface-variant">
                  Inclure un conseil carrière dans chaque email.
                </span>
              </label>

              {/* Erreur de sauvegarde */}
              {saveError && (
                <div className="mt-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <AlertTriangle className="size-4 shrink-0" />
                  {saveError}
                </div>
              )}

              {/* Bouton de sauvegarde */}
              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || selectedFilieres.length < 1}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-navy px-7 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-brand-navy/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Enregistrement…
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Enregistrer mes préférences
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}

export default GestionPreferences
