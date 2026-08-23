
import { Fragment, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowLeft, ArrowRight, Bell, BookOpen, Briefcase, Check, CheckCircle2, ChevronRight, Clock,
  Fingerprint, Loader2, Mail, MapPin, Radar, Send, ShieldCheck,
  SlidersHorizontal, Sparkles, User, Zap,
} from "lucide-react"
import { FaLinkedin } from "react-icons/fa6"
import { cn } from "@/lib/utils"
import Seo from "@/components/seo/Seo"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CountdownEnvoi, CtaLink } from "@/components/shared"
import { HUES } from "@/lib/hues"
import { FILIERES_META, CONTRATS, EXPERIENCES, SOURCES } from "@/lib/referentiels"
import { ALL_OFFRES } from "@/data/offres"
import { getImgSource } from "@/utils/utilsSource"
import { registeredSeo } from "@/lib/seo"

/* ════════════════════════════════════════════════════════════════════
   DONNÉES & OUTILS
   ════════════════════════════════════════════════════════════════════ */

const ETAPES = [
  { id: "identite", label: "Identité", icon: User },
  { id: "preferences", label: "Préférences", icon: SlidersHorizontal },
  { id: "profil", label: "Profil", icon: Briefcase, optionnel: true },
  { id: "validation", label: "Validation", icon: CheckCircle2 },
]

const VILLES = ["Abidjan", "Bouaké", "San Pédro", "Yamoussoukro", "Korhogo", "Autre / Télétravail"]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const stepVariants = {
  enter: (dir) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
}

/* ════════════════════════════════════════════════════════════════════
  PRÉ-REMPLISSAGE DEPUIS L'URL
  /inscription?email=x@y.com
  /inscription?filieres=ressources-humaines
  /inscription?filieres=tech-dev,ressources-humaines&experience=3-5 ans&ville=Abidjan
════════════════════════════════════════════════════════════════════ */

const formDepuisUrl = (searchParams) => {
  const p = Object.fromEntries(searchParams.entries())
  const liste = (v) => (v || "").split(",").map((x) => x.trim()).filter(Boolean)

  // Filières : codes séparés par des virgules, validés, 3 max
  const filieres = liste(p.filieres ?? p.filiere)
    .filter((code) => FILIERES_META.some((f) => f.code === code))
    .slice(0, 3)

  // Contrats : validés contre la liste de référence
  const contrats = liste(p.contrats ?? p.contrat).filter((c) => CONTRATS.includes(c))

  // Scalaires : acceptés seulement s'ils existent dans les référentiels
  const experience = EXPERIENCES.includes(p.experience) ? p.experience : ""
  const ville = VILLES.includes(p.ville) ? p.ville : ""

  // Conseils du mardi : actif par défaut, sauf mention explicite
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

const LogoSrc = ({ code, className = "size-4" }) => {
  const s = SOURCES.find((x) => x.code === code)
  if (!s) return null
  return s.linkedin
    ? <FaLinkedin className={cn(className, "text-[#0A66C2]")} />
    : <img src={getImgSource(code)} alt={code} className={cn(className, "object-contain")} />
}

/* ════════════════════════════════════════════════════════════════════
   STEPPER — progression vivante
   ════════════════════════════════════════════════════════════════════ */

const Stepper = ({ step }) => (
  <div className="relative px-1">
    <div className="absolute left-5.5 right-5.5 top-5.5 h-0.5 rounded bg-outline-variant/40" aria-hidden />
    <motion.div
      className="absolute left-5.5 top-4.5 h-0.5 rounded bg-brand-orange"
      initial={false}
      animate={{ width: `calc((100% - 44px) * ${step / (ETAPES.length - 1)})` }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden
    />
    <div className="relative flex justify-between">
      {ETAPES.map((e, i) => {
        const done = i < step
        const active = i === step
        return (
          <div key={e.id} className="flex flex-col items-center gap-1.5">
            <motion.span
              initial={false}
              animate={active ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={{ duration: 0.35 }}
              className={cn(
                "grid size-9 place-items-center rounded-full border-2 font-heading text-sm font-bold transition-all duration-300",
                done && "border-brand-navy bg-brand-navy text-white",
                active && "border-brand-orange bg-brand-orange/10 text-brand-orange ring-4 ring-brand-orange/15",
                !done && !active && "border-outline-variant/60 bg-white text-muted-foreground"
              )}
            >
              {done ? <Check className="size-4" strokeWidth={3} /> : <e.icon className="size-4" />}
            </motion.span>
            <span className={cn(
              "whitespace-nowrap text-[8px] md:text-[10px] font-bold uppercase tracking-wider",
              active ? "text-brand-orange" : done ? "text-brand-navy" : "text-muted-foreground"
            )}>
              {e.label}
              {e.optionnel && <span className="ml-1 font-medium normal-case text-muted-foreground/70">(opt.)</span>}
            </span>
          </div>
        )
      })}
    </div>
  </div>
)

/* ════════════════════════════════════════════════════════════════════
  APERÇU VIVANT — le récap de demain se remplit en temps réel
════════════════════════════════════════════════════════════════════ */

const ApercuRecap = ({ form, offres, total }) => (
  <div className="relative mx-auto w-full max-w-md lg:max-w-none">
    <div className="absolute -inset-8 rounded-full bg-brand-orange/10 blur-3xl" aria-hidden />
    <div className="absolute inset-0 translate-x-4 translate-y-5 rotate-2 overflow-hidden rounded-2xl bg-brand-navy" aria-hidden>
      <div className="absolute inset-0 bg-pattern opacity-20" />
    </div>

    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1, y: [0, -7, 0] }}
      transition={{ delay: 0.6, opacity: { duration: 0.4 }, scale: { duration: 0.4 }, y: { duration: 4.6, repeat: Infinity, ease: "easeInOut" } }}
      className="absolute -top-4 left-4 z-20 inline-flex -rotate-3 items-center gap-1.5 rounded-full bg-brand-orange px-3.5 py-1.5 text-[11px] font-bold text-white shadow-lg"
    >
      <Clock className="size-3" />
      Demain, 8h00 pile
    </motion.span>

    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.8, duration: 0.4 }}
      className="absolute -bottom-4 right-8 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3.5 py-1.5 text-[11px] font-bold text-emerald-600 shadow-hover"
    >
      <Fingerprint className="size-3" />
      0 doublon
    </motion.span>

    <div className="relative overflow-hidden rounded-2xl border border-outline-variant/40 bg-white shadow-[0_24px_48px_-16px_rgba(15,45,77,0.22)]">
      {/* Chrome de l'email */}
      <div className="flex items-center gap-3 border-b border-outline-variant/40 bg-surface-container-low/60 px-5 py-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-navy font-heading text-[11px] font-black text-white">JA</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-on-surface">
            JobAlert CI <span className="font-medium text-muted-foreground">&lt;bonjour@jobalert.ci&gt;</span>
          </p>
          <p className="truncate text-[11px] text-muted-foreground">Objet : Votre récapitulatif quotidien</p>
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">08:00</span>
      </div>

      {/* Corps — réactif aux choix */}
      <div className="px-5 py-4">
        <p className="text-sm text-on-surface-variant">
          Bonjour {form.nom.trim() ? <strong className="font-semibold text-on-surface">{form.nom.trim().split(" ")[0]}</strong> : "👋"}
        </p>
        <p className="mt-1 text-sm text-on-surface-variant">
          <AnimatePresence mode="wait" initial={false}>
            <motion.strong
              key={total}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="inline-block font-semibold text-on-surface"
            >
              {total} offre{total > 1 ? "s" : ""}
            </motion.strong>
          </AnimatePresence>{" "}
          correspondent à vos filières :
        </p>

        {offres.length === 0 ? (
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex h-11 animate-pulse items-center gap-2.5 rounded-lg border border-outline-variant/40 px-3" style={{ animationDelay: `${i * 0.18}s` }}>
                <span className="size-1.5 rounded-full bg-muted-foreground/20" />
                <span className="h-2 rounded-full bg-muted-foreground/15" style={{ width: `${64 - i * 14}%` }} />
              </div>
            ))}
            <p className="pt-1 text-center text-[11px] text-muted-foreground">
              Vos offres apparaîtront ici dès la 2ᵉ étape.
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            <AnimatePresence initial={false}>
              {offres.map((o) => {
                const hue = HUES[FILIERES_META.find((f) => f.code === o.filiere)?.hue ?? "blue"]
                return (
                  <motion.li
                    key={o.uid}
                    layout
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 14 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="flex items-center gap-2.5 rounded-lg border border-outline-variant/40 bg-white px-3 py-2.5"
                  >
                    <span className={cn("size-1.5 shrink-0 rounded-full", hue.dot)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-on-surface">{o.titre}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{o.entreprise}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 rounded-full border border-outline-variant/50 bg-surface-container-low/60 px-2 py-0.5 text-[9px] font-semibold text-on-surface-variant">
                      <LogoSrc code={o.source} className="size-2.5" />
                      {o.source}
                    </span>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-surface-container-low px-3.5 py-2.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            + {Math.max(total - offres.length, 0)} autres offres dans votre email
          </span>
          <span className="shrink-0 rounded-md bg-brand-navy px-3 py-1.5 text-[11px] font-bold text-white">
            Ouvrir le récap'
          </span>
        </div>

        {(form.experience || form.contrats.length > 0) && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700"
          >
            <Sparkles className="size-3.5" />
            Tri affiné selon votre profil{form.experience ? ` · ${form.experience}` : ""}
          </motion.p>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-outline-variant/40 bg-surface-container-low/40 px-5 py-2.5 text-[10px] font-medium text-muted-foreground">
        <span>Gérer mes filières</span>
        <span aria-hidden>·</span>
        <span>Me désinscrire en 1 clic</span>
      </div>
    </div>
  </div>
)

/* ════════════════════════════════════════════════════════════════════
  LES 4 ÉTAPES
════════════════════════════════════════════════════════════════════ */

const EtapeIdentite = ({ form, setField, emailOk }) => (
  <div>
    <h2 className="font-heading text-2xl font-extrabold tracking-tight text-brand-navy sm:text-3xl">
      On vous envoie les offres, <span className="text-brand-orange">vous postulez</span>.
    </h2>
    <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">
      Pas de mot de passe, pas de formulaire à rallonge. Votre email suffit.
    </p>

    <div className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Votre email <span className="text-brand-orange">*</span>
        </label>
        <div className="relative mt-1.5">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" />
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            placeholder="prenom.nom@email.com"
            className={cn(
              "h-12 w-full rounded-lg border bg-white pl-11 pr-11 text-sm outline-none transition-all placeholder:text-muted-foreground/60",
              form.email && !emailOk
                ? "border-red-400 focus:ring-2 focus:ring-red-200"
                : "border-outline-variant/60 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
            )}
          />
          <AnimatePresence>
            {emailOk && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <CheckCircle2 className="size-5 text-emerald-500" />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {form.email && !emailOk && (
          <p className="mt-1.5 text-xs font-medium text-red-500">Ce format d'email semble invalide.</p>
        )}
      </div>

      <div>
        <label htmlFor="nom" className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Votre nom <span className="font-medium normal-case text-muted-foreground">(optionnel)</span>
        </label>
        <div className="relative mt-1.5">
          <User className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" />
          <input
            id="nom"
            type="text"
            autoComplete="name"
            value={form.nom}
            onChange={(e) => setField("nom", e.target.value)}
            placeholder="Awa Diabaté"
            className="h-12 w-full rounded-lg border border-outline-variant/60 bg-white pl-11 pr-4 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
          />
        </div>
      </div>
    </div>

    <div className="mt-6 flex flex-wrap gap-2">
      {["Sans mot de passe", "100 % gratuit", "Désinscription en 1 clic"].map((r) => (
        <span key={r} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
          <Check className="size-3" strokeWidth={3} />
          {r}
        </span>
      ))}
    </div>
  </div>
)

const EtapePreferences = ({ form, toggleFiliere }) => {
  const [q, setQ] = useState("")
  const query = q.trim().toLowerCase()
  const liste = FILIERES_META.filter(
    (f) => !query || f.label.toLowerCase().includes(query) || f.keywords.some((k) => k.includes(query))
  )
  const plein = form.filieres.length >= 3

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-extrabold tracking-tight text-brand-navy sm:text-3xl">
            Choisissez vos <span className="text-brand-orange">filières</span>.
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">
            1 à 3 filières. Vous ne recevrez que leurs offres, jamais le reste.
          </p>
        </div>
        <span className={cn(
          "shrink-0 rounded-full px-3.5 py-1.5 font-heading text-sm font-extrabold transition-colors",
          form.filieres.length > 0 ? "bg-brand-orange/15 text-[#B45309]" : "bg-surface-container text-muted-foreground"
        )}>
          {form.filieres.length}/3
        </span>
      </div>

      <div className="mt-3.5 flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            initial={false}
            animate={{ opacity: i < form.filieres.length ? 1 : 0.35 }}
            className={cn("h-1.5 flex-1 rounded-full", i < form.filieres.length ? "bg-brand-orange" : "bg-outline-variant/50")}
          />
        ))}
      </div>

      <div className="relative mt-5">
        <SlidersHorizontal className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un métier, un mot-clé…"
          aria-label="Rechercher une filière"
          className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white pl-10 pr-4 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {liste.map((f) => {
          const sel = form.filieres.includes(f.code)
          const bloque = plein && !sel
          const hue = HUES[f.hue]
          const btn = (
            <button
              type="button"
              onClick={() => toggleFiliere(f.code)}
              aria-pressed={sel}
              className={cn(
                "group relative flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all duration-200",
                sel
                  ? "border-brand-navy bg-brand-navy/3 shadow-soft"
                  : "border-outline-variant/60 bg-white hover:-translate-y-0.5 hover:border-brand-navy/35 hover:shadow-soft",
                bloque && "cursor-not-allowed opacity-40 hover:translate-y-0 hover:border-outline-variant/60 hover:shadow-none"
              )}
            >
              <span className={cn("flex size-9 items-center justify-center rounded-md transition-colors duration-200", hue.tile, !bloque && "group-hover:bg-opacity-20")}>
                <f.icon className="size-4.5" strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block truncate-2 md:truncate text-[12px] font-bold leading-tight text-brand-navy">{f.label}</span>
                <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">{f.actives} offres actives</span>
              </span>
              <AnimatePresence>
                {sel && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-brand-orange text-white shadow-soft"
                  >
                    <Check className="size-3" strokeWidth={3.5} />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          )
          return bloque ? (
            <Tooltip key={f.code}>
              <TooltipTrigger ><span>{btn}</span></TooltipTrigger>
              <TooltipContent side="top">3 filières maximum — désélectionnez-en une d'abord.</TooltipContent>
            </Tooltip>
          ) : (
            <Fragment key={f.code}>{btn}</Fragment>
          )
        })}
      </div>

      {liste.length === 0 && (
        <p className="mt-4 text-center text-sm text-muted-foreground">Aucune filière ne correspond à « {q} ».</p>
      )}
    </div>
  )
}

const EtapeProfil = ({ form, setField, toggleContrat, passer }) => (
  <div>
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="font-heading text-2xl font-extrabold tracking-tight text-brand-navy sm:text-3xl">
          Affinez votre <span className="text-brand-orange">profil</span>.
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">
          Optionnel, mais ça nous aide à mieux trier vos offres dès demain.
        </p>
      </div>
      <button
        type="button"
        onClick={passer}
        className="shrink-0 text-xs font-bold text-muted-foreground underline-offset-2 transition-colors hover:text-brand-orange hover:underline"
      >
        Passer cette étape →
      </button>
    </div>

    <div className="mt-6 space-y-5">
      <div>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          <Zap className="size-3.5 text-brand-orange" />
          Votre expérience
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {EXPERIENCES.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setField("experience", form.experience === x ? "" : x)}
              aria-pressed={form.experience === x}
              className={cn(
                "rounded-full border px-4 py-2 text-[13px] font-semibold transition-all duration-200",
                form.experience === x
                  ? "border-brand-navy bg-brand-navy text-white shadow-soft"
                  : "border-outline-variant/60 bg-white text-on-surface-variant hover:-translate-y-0.5 hover:border-brand-navy/40 hover:text-brand-navy"
              )}
            >
              {x}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          <Briefcase className="size-3.5 text-brand-orange" />
          Contrats recherchés
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CONTRATS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleContrat(c)}
              aria-pressed={form.contrats.includes(c)}
              className={cn(
                "rounded-full border px-4 py-2 text-[13px] font-semibold transition-all duration-200",
                form.contrats.includes(c)
                  ? "border-brand-orange bg-brand-orange/15 text-[#B45309]"
                  : "border-outline-variant/60 bg-white text-on-surface-variant hover:-translate-y-0.5 hover:border-brand-orange/50 hover:text-[#B45309]"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          <MapPin className="size-3.5 text-brand-orange" />
          Votre ville
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {VILLES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setField("ville", form.ville === v ? "" : v)}
              aria-pressed={form.ville === v}
              className={cn(
                "rounded-full border px-4 py-2 text-[13px] font-semibold transition-all duration-200",
                form.ville === v
                  ? "border-brand-navy bg-brand-navy text-white shadow-soft"
                  : "border-outline-variant/60 bg-white text-on-surface-variant hover:-translate-y-0.5 hover:border-brand-navy/40 hover:text-brand-navy"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-low/50 p-3.5 transition-colors hover:border-brand-orange/40">
        <input
          type="checkbox"
          checked={form.conseils}
          onChange={(e) => setField("conseils", e.target.checked)}
          className="size-4 accent-[#F5A623]"
        />
        <span className="flex items-center gap-2 text-[13px] font-medium text-on-surface-variant">
          <BookOpen className="size-4 text-brand-orange" />
          Recevoir aussi le conseil carrière du mardi
        </span>
      </label>
    </div>
  </div>
)

const EtapeValidation = ({ form, total, consent, setConsent }) => {
  const heures = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).toLowerCase()
  const isAutreDay = heures > "08:00:00"

  return (
    <div>
      <h2 className="font-heading text-2xl font-extrabold tracking-tight text-brand-navy sm:text-3xl">
        Un dernier coup d'<span className="text-brand-orange">œil</span>.
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">
        Voici votre alerte. Tout est modifiable plus tard, en un clic depuis chaque email.
      </p>

      <div className="mt-6 divide-y divide-outline-variant/40 overflow-hidden rounded-lg border border-outline-variant/50 bg-white shadow-soft">
        {[
          { icon: Mail, label: "Email", value: form.email },
          { icon: User, label: "Nom", value: form.nom.trim() || "—" },
          { icon: MapPin, label: "Ville", value: form.ville || "—" },
        ].map((r) => (
          <div key={r.label} className="flex items-center gap-3 px-4 py-3">
            <r.icon className="size-4 shrink-0 text-brand-orange" />
            <span className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{r.label}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-navy">{r.value}</span>
          </div>
        ))}

        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="size-4 shrink-0 text-brand-orange" />
            <span className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Filières</span>
            <span className="text-[11px] font-bold text-muted-foreground">{form.filieres.length}/3</span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {form.filieres.map((code) => {
              const f = FILIERES_META.find((x) => x.code === code)
              if (!f) return null
              const hue = HUES[f.hue]
              return (
                <span key={code} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold", hue.tile)}>
                  <f.icon className="size-3.5" />
                  {f.label}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-5 flex items-center gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4"
      >
        <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
        <p className="text-[13px] font-semibold text-emerald-800">
          {total} offre{total > 1 ? "s" : ""} correspondent déjà à vos filières. Votre premier récap part {isAutreDay ? "demain" : "aujourd'hui"} à 8h00.
        </p>
      </motion.div>

      <label className="mt-5 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 size-4 accent-[#F5A623]"
        />
        <span className="text-[13px] leading-relaxed text-on-surface-variant">
          J'accepte de recevoir le récapitulatif quotidien à 8h00. Mon email ne sera jamais partagé
          et je peux me désinscrire en 1 clic. <Link to="/mentions-legales" className="font-semibold text-brand-navy underline underline-offset-2 hover:text-brand-orange">En savoir plus</Link>.
        </span>
      </label>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
  ÉCRAN DE SUCCÈS
════════════════════════════════════════════════════════════════════ */

const SUITE = [
  { icon: Mail, t: "Maintenant", l: "Email de confirmation envoyé" },
  { icon: Radar, t: "06h02", l: "Collecte des 4 sources" },
  { icon: SlidersHorizontal, t: "07h15", l: "Filtrage sur vos filières" },
  { icon: Send, t: "08h00", l: "Votre premier récap arrive" },
]

const EcranSucces = ({ form, total }) => {
  const heures = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).toLowerCase()
  const isAutreDay = heures > "08:00:00"

  return (
    <div className="mx-auto max-w-2xl py-10 text-center md:py-16">
      <motion.svg viewBox="0 0 52 52" className="mx-auto size-20" aria-hidden>
        <motion.circle
          cx="26" cy="26" r="24" fill="none" stroke="#10b981" strokeWidth="2"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease: "easeOut" }}
        />
        <motion.path
          d="M14 27l8 8 16-16" fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
        />
      </motion.svg>

      <motion.h1
        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.5 }}
        className="mt-6 font-heading text-3xl font-black tracking-tight text-brand-navy sm:text-4xl"
      >
        Bienvenue à bord{form.nom.trim() ? `, ${form.nom.trim().split(" ")[0]}` : ""} !
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.5 }}
        className="mx-auto mt-3 max-w-md text-base leading-relaxed text-on-surface-variant"
      >
        Votre alerte est active sur <strong className="font-semibold text-brand-navy">{form.filieres.length} filière{form.filieres.length > 1 ? "s" : ""}</strong>.
        {total} offre{total > 1 ? "s" : ""} vous attendent déjà, les prochaines arrivent {isAutreDay ? "demain" : "aujourd'hui"} à 8h00.
      </motion.p>

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.5 }} className="mx-auto mt-8 max-w-sm">
        <CountdownEnvoi variant="horloge" label="Votre premier récap dans" />
      </motion.div>

      <div className="mt-10 grid gap-3 sm:grid-cols-4">
        {SUITE.map((s, i) => (
          <motion.div
            key={s.t}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.15 + i * 0.12, duration: 0.4 }}
            className="rounded-lg border border-outline-variant/50 bg-white p-4 shadow-soft"
          >
            <s.icon className="mx-auto size-5 text-brand-orange" />
            <p className="mt-2 font-heading text-sm font-extrabold text-brand-navy">{s.t}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{s.l}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.7, duration: 0.4 }}
        className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
      >
        <CtaLink to="/offres" iconRight={ArrowRight}>Voir les offres du jour</CtaLink>
        <CtaLink to="/comment-ca-marche" variant="secondary">Comment ça marche</CtaLink>
      </motion.div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════════════════════════════ */

const Registered = () => {
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [form, setForm] = useState(() => formDepuisUrl(searchParams))
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const emailOk = EMAIL_RE.test(form.email.trim())

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const toggleFiliere = (code) =>
    setForm((p) => {
      const has = p.filieres.includes(code)
      if (has) return { ...p, filieres: p.filieres.filter((c) => c !== code) }
      if (p.filieres.length >= 3) return p
      return { ...p, filieres: [...p.filieres, code] }
    })

  const toggleContrat = (c) =>
    setForm((p) => ({
      ...p,
      contrats: p.contrats.includes(c) ? p.contrats.filter((x) => x !== c) : [...p.contrats, c],
    }))

  const total = useMemo(
    () => ALL_OFFRES.filter((o) => form.filieres.includes(o.filiere)).length,
    [form.filieres]
  )

  const offresApercu = useMemo(
    () =>
      ALL_OFFRES
        .filter((o) => form.filieres.includes(o.filiere))
        .sort((a, b) => a.jours - b.jours)
        .slice(0, 3),
    [form.filieres]
  )

  const canNext = step === 0 ? emailOk : step === 1 ? form.filieres.length >= 1 : true

  const goNext = () => { setDirection(1); setStep((s) => Math.min(s + 1, 3)) }
  const goBack = () => { setDirection(-1); setStep((s) => Math.max(s - 1, 0)) }
  const passer = () => { setDirection(1); setStep(3) }

  const submit = () => {
    if (!consent || sending) return
    setSending(true)
    setTimeout(() => {
      setSending(false)
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }, 1400)
  }

  return (
    <>
      <Seo {...registeredSeo()} />
      <main className="relative overflow-hidden">
        <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
        <div className="absolute -top-32 right-[-10%] size-140 rounded-full bg-brand-orange/8 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/5 blur-3xl" aria-hidden />

        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-8 md:px-12 md:pt-10">
          {/* Fil d'Ariane */}
          <motion.nav
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
            className="flex items-center justify-between gap-4"
            aria-label="Fil d'Ariane"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Link to="/" className="transition-colors hover:text-brand-navy">Accueil</Link>
              <ChevronRight className="size-3" />
              <span className="font-semibold text-brand-navy">Inscription</span>
            </div>
            <Link to="/offres" className="group hidden md:inline-flex items-center gap-1.5 text-xs font-bold text-brand-navy transition-colors hover:text-brand-orange">
              Déjà abonné ? Voir les offres du jour
              <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </motion.nav>

          {submitted ? (
            <EcranSucces form={form} total={total} />
          ) : (
            <div className="mt-8 grid items-start gap-14 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16">
              {/* ═══ Colonne formulaire ═══ */}
              <motion.div
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-xl border border-outline-variant/40 bg-white p-6 shadow-soft sm:p-8"
              >
                <Stepper step={step} />

                {/* Viewport des étapes — overflow-hidden : le glissement
                    d'entrée/sortie ne déborde jamais de la carte ni de la page */}
                <div className="mt-8 overflow-hidden">
                  <AnimatePresence mode="wait" custom={direction} initial={false}>
                    <motion.div
                      key={step}
                      custom={direction}
                      variants={stepVariants}
                      initial="enter" animate="center" exit="exit"
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {step === 0 && <EtapeIdentite form={form} setField={setField} emailOk={emailOk} />}
                      {step === 1 && <EtapePreferences form={form} toggleFiliere={toggleFiliere} />}
                      {step === 2 && <EtapeProfil form={form} setField={setField} toggleContrat={toggleContrat} passer={passer} />}
                      {step === 3 && <EtapeValidation form={form} total={total} consent={consent} setConsent={setConsent} />}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Navigation */}
                <div className="mt-6 flex items-center justify-between gap-3 border-t border-outline-variant/40 pt-5">
                  {step > 0 ? (
                    <button
                      type="button"
                      onClick={goBack}
                      className="inline-flex h-11 items-center gap-2 rounded-lg border border-outline-variant/60 px-5 text-sm font-bold text-on-surface-variant transition-all hover:border-brand-navy/40 hover:text-brand-navy"
                    >
                      <ArrowLeft className="size-4" />
                      Retour
                    </button>
                  ) : <span />}

                  {step < 3 ? (
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={!canNext}
                      className="group inline-flex h-11 items-center gap-2 rounded-lg bg-brand-orange px-6 text-sm font-bold text-white shadow-[0_12px_28px_-8px_rgba(245,166,35,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none"
                    >
                      Continuer
                      <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={submit}
                      disabled={!consent || sending}
                      className="group inline-flex h-11 items-center gap-2 rounded-lg bg-brand-orange px-6 text-sm font-bold text-white shadow-[0_12px_28px_-8px_rgba(245,166,35,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none"
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

              {/* ═══ Aperçu vivant ═══ */}
              <motion.div
                initial={{ opacity: 0, y: 32, rotate: 1.5 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="hidden lg:sticky lg:top-24 lg:block"
              >
                <ApercuRecap form={form} offres={offresApercu} total={total} />
                <p className="mt-8 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  Aperçu réel, calculé depuis la collecte de ce matin.
                </p>
              </motion.div>
            </div>
          )}

          <Link to="/offres" className="group md:hidden mt-8 flex items-center justify-end gap-1.5 text-xs font-bold text-brand-navy transition-colors hover:text-brand-orange">
            Déjà abonné ? Voir les offres du jour
            <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </main>
    </>
  )
}

export default Registered