import { Fragment, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowRight, ArrowUpRight, Bell, Bookmark, BookmarkCheck, Briefcase, Building2,
  CalendarDays, Check, ChevronRight, Clock, Fingerprint, GraduationCap, Link2,
  Mail, MapPin, Radar, SearchX, Send, ShieldCheck, Sparkles, Tag, Zap, Loader2
} from "lucide-react"
import { FaLinkedin } from "react-icons/fa6"
import { cn } from "@/lib/utils"
import Seo from "@/components/seo/Seo"
import { offreSeo as buildOffreSeo } from "@/lib/seo"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  BadgeNouveau, ChipSource, CompanyHover, CtaLink, OfferCard,
  ReassuranceList, SectionHeading, SourceLogo,
} from "@/components/shared"
import { HUES } from "@/lib/hues"
import { addDays, publieLabel } from "@/lib/dates"
import { getOfferById, getSimilarOffers, incrementeView, saveOffer } from "@/api/public/offers"
import { getOfferSats, getOfferSatsBySource } from "@/api/public/stats"
import { adaptOffer, adaptOffers } from "@/lib/offers-adapter"
import { useFetchData } from "@/hooks/use-fetch-data"
import getFiliereTheme from "@/lib/filiere-theme"

/* ════════════════════════════════════════════════════════════════════
OUTILS
════════════════════════════════════════════════════════════════════ */
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

/* Empreinte stable supportant les UUIDs (chaînes de caractères) */
const fakeHash = (id) => {
  if (!id) return "0000000"
  const str = String(id)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(7, "0").slice(0, 7)
}

const offreSeo = (o, meta, detail, relatedOffers = []) => buildOffreSeo({ offre: o, meta, detail, relatedOffers })

/* ════════════════════════════════════════════════════════════════════
CHAÎNE DE PROVENANCE — l'ADN veille, dès l'ouverture
════════════════════════════════════════════════════════════════════ */
const ProvenanceStrip = ({ offre, meta }) => {
  const steps = [
    { icon: Radar, t: "06:02", l: `Collectée via ${offre.sourceLabel || offre.source}`, done: true },
    { icon: Fingerprint, t: "06:04", l: "0 doublon · hash unique", done: true },
    { icon: Tag, t: "07:15", l: `Taggée ${meta.label}`, done: true },
    { icon: Send, t: "08:00", l: "Au récap du matin", done: false },
  ]
  return (
    <div className="rounded-xl border border-outline-variant/40 bg-white/70 px-4 py-3.5 backdrop-blur-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {steps.map((s, i) => (
          <Fragment key={s.t}>
            {i > 0 && (
              <span className="relative mx-1 hidden h-px flex-1 overflow-hidden bg-outline-variant/60 sm:block" aria-hidden>
                <motion.span
                  className="absolute inset-y-0 w-3 rounded-full bg-brand-orange/80"
                  animate={{ left: ["-15%", "110%"] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
                />
              </span>
            )}
            <span className="flex items-center gap-2.5">
              <span className={cn(
                "relative grid size-8 shrink-0 place-items-center rounded-full border bg-white",
                s.done ? "border-emerald-500/40 text-emerald-600" : "border-brand-orange/50 text-brand-orange"
              )}>
                <s.icon className="size-3.5" />
                {s.done && (
                  <span className="absolute -right-0.5 -top-0.5 grid size-3 place-items-center rounded-full bg-emerald-500 text-white">
                    <Check className="size-2" strokeWidth={4.5} />
                  </span>
                )}
              </span>
              <span className="leading-tight">
                <span className="block text-[10px] font-black text-brand-navy">{s.t}</span>
                <span className="block text-[10px] font-semibold text-muted-foreground">{s.l}</span>
              </span>
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
PANNEAU POSTULER — carte blanche sur décalé navy (signature du site)
════════════════════════════════════════════════════════════════════ */
const CartePostuler = ({ offre, hue, hash, saved, onToggleSave, copied, onCopy }) => (
  <motion.div
    initial={{ opacity: 0, y: 32, rotate: 1.5 }}
    animate={{ opacity: 1, y: 0, rotate: 0 }}
    transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
    className="relative mx-auto w-full max-w-md min-w-0 md:max-w-none"
  >
    <div className={cn("absolute -inset-8 rounded-full blur-3xl", hue.glow)} aria-hidden />
    <div className="absolute inset-0 translate-x-4 translate-y-5 rotate-2 overflow-hidden rounded-2xl bg-brand-navy" aria-hidden>
      <div className="absolute inset-0 bg-pattern opacity-20" />
    </div>
    {/* Badges flottants */}
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1, y: [0, -7, 0] }}
      transition={{ delay: 0.9, opacity: { duration: 0.4 }, scale: { duration: 0.4 }, y: { duration: 4.6, repeat: Infinity, ease: "easeInOut" } }}
      className={cn("absolute -top-4 left-5 z-20 inline-flex -rotate-3 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold text-white shadow-lg sm:-left-4", hue.solid)}
    >
      <Clock className="size-3" />
      {publieLabel(offre.jours)}
    </motion.span>
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1.05, duration: 0.4 }}
      className="absolute -top-3 right-6 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-600 shadow-soft"
    >
      <ShieldCheck className="size-3" />
      0 doublon
    </motion.span>
    {/* Carte */}
    <div className="relative overflow-hidden rounded-2xl border border-outline-variant/40 bg-white shadow-[0_24px_48px_-16px_rgba(15,45,77,0.22)]">
      <div className="flex items-center gap-3 border-b border-outline-variant/40 bg-surface-container-low/60 px-5 py-4">
        <SourceLogo code={offre.source} className="size-9 rounded-md" />
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-bold text-brand-navy">Annonce d'origine</p>
          <p className="text-[11px] text-muted-foreground">Collectée à 6h02 · lien direct</p>
        </div>
        <ChipSource source={offre.source} />
      </div>
      <div className="px-5 py-5">
        <a
          href={offre.lien || "#offre"}
          onClick={(e) => offre.lien ? undefined : e.preventDefault()}
          className="group flex h-12 items-center justify-center gap-2.5 rounded-lg bg-brand-orange text-[15px] font-bold text-white shadow-[0_12px_28px_-8px_rgba(245,166,35,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]"
        >
          Postuler sur {offre.sourceLabel || offre.source}
          {offre.source === "linkedin"
            ? <FaLinkedin className="size-4.5 transition-transform duration-300 group-hover:scale-110" />
            : <ArrowUpRight className="size-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />}
        </a>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onToggleSave}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-lg border text-xs font-bold transition-all duration-200",
              saved
                ? "border-brand-orange/50 bg-brand-orange/10 text-brand-orange"
                : "border-outline-variant/60 bg-white text-on-surface-variant hover:border-brand-navy/40 hover:text-brand-navy"
            )}
          >
            {saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
            {saved ? "Enregistrée" : "Enregistrer"}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onCopy}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-lg border text-xs font-bold transition-all duration-200",
              copied
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700"
                : "border-outline-variant/60 bg-white text-on-surface-variant hover:border-brand-navy/40 hover:text-brand-navy"
            )}
          >
            {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
            {copied ? "Lien copié" : "Copier le lien"}
          </motion.button>
        </div>
        <dl className="mt-5 space-y-3 border-t border-outline-variant/40 pt-4">
          {[
            { I: CalendarDays, k: "Publication", v: addDays(new Date(), -offre.jours).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) },
            { I: Briefcase, k: "Contrat", v: offre.contrat },
            { I: GraduationCap, k: "Niveau", v: offre.niveau },
            { I: Zap, k: "Expérience", v: offre.experience },
          ].map(({ I, k, v }) => (
            <div key={k} className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-container-low text-on-surface-variant">
                <I className="size-3.5" />
              </span>
              <dt className="w-24 shrink-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{k}</dt>
              <dd className="min-w-0 flex-1 truncate text-[13px] font-semibold capitalize text-brand-navy">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-surface-container-low px-3.5 py-2.5">
          <span className="text-[11px] font-medium text-muted-foreground">Empreinte de dédoublonnage</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <code className="cursor-help font-mono text-[11px] font-bold text-brand-navy">
                {hash.slice(0, 4)}…{hash.slice(-3)}
              </code>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-56 text-center">
              Calculée depuis le lien de l'annonce — garantit qu'elle n'est envoyée qu'une seule fois.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  </motion.div>
)

/* ════════════════════════════════════════════════════════════════════
HERO — identité de l'offre + provenance + panneau postuler
════════════════════════════════════════════════════════════════════ */
const HeroOffre = ({ offre, meta, title, hue, hash, totalEntreprise, saved, onToggleSave, copied, onCopy }) => (
  <section className="relative overflow-hidden hero-gradient">
    <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
    <div className={cn("absolute -top-32 right-[-10%] size-140 rounded-full blur-3xl", hue.glow)} aria-hidden />
    <div className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/5 blur-3xl" aria-hidden />
    <div className="relative z-10 mx-auto max-w-7xl px-6 pb-14 pt-8 md:px-12 md:pb-16 md:pt-10">
      {/* Fil d'Ariane */}
      <motion.nav
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
        aria-label="Fil d'Ariane"
      >
        <Link to="/" className="transition-colors hover:text-brand-navy">Accueil</Link>
        <ChevronRight className="size-3" />
        <Link to="/offres" className="transition-colors hover:text-brand-navy">Offres d'emploi</Link>
        <ChevronRight className="size-3" />
        <span className="max-w-55 truncate font-semibold text-brand-navy sm:max-w-none">{offre.titre}</span>
      </motion.nav>
      <div className="mt-8 grid items-start gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        {/* Colonne gauche — l'offre */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="flex flex-col items-start gap-5">
          <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2.5">
            <Link
              to={`/filieres/${meta.code}`}
              className={cn("inline-flex items-center gap-2 rounded-full border border-transparent px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-all duration-200 hover:-translate-y-0.5", hue.tile)}
            >
              <meta.icon className="size-3.5" />
              {title}
            </Link>
            {offre.isNouveau && <BadgeNouveau />}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white/80 px-3.5 py-1.5 text-[11px] font-bold text-on-surface-variant">
              <CalendarDays className="size-3 text-brand-orange" />
              {publieLabel(offre.jours)}
            </span>
          </motion.div>
          <motion.h1
            variants={fadeUp}
            className="font-heading text-4xl font-black leading-[1.06] tracking-tight text-brand-navy sm:text-5xl"
          >
            {offre.titre}
          </motion.h1>
          <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <CompanyHover offre={offre} totalOffres={totalEntreprise} />
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5" />{offre.ville}
            </span>
            <span className="rounded-md border border-outline-variant/60 bg-white/80 px-2.5 py-0.5 text-xs font-bold text-on-surface-variant">{offre.contrat}</span>
            <span className="inline-flex items-center gap-1 rounded-md border border-outline-variant/60 bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">
              <GraduationCap className="size-3" />{offre.niveau}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-outline-variant/60 bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">
              <Zap className="size-3" />{offre.experience}
            </span>
          </motion.div>
          <motion.div variants={fadeUp} className="w-full">
            <ProvenanceStrip offre={offre} meta={meta} />
          </motion.div>
          <motion.div variants={fadeUp} className="mt-1 flex flex-col gap-3 sm:flex-row">
            <a
              href={offre.lien || "#offre"}
              onClick={(e) => offre.lien ? undefined : e.preventDefault()}
              className="group inline-flex items-center justify-center gap-2.5 rounded-lg bg-brand-orange px-7 py-3.5 text-base font-bold text-white shadow-[0_12px_28px_-8px_rgba(245,166,35,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]"
            >
              Postuler sur {offre.sourceLabel || offre.source}
              {offre.source === "linkedin"
                ? <FaLinkedin className="size-4.5 transition-transform duration-300 group-hover:scale-110" />
                : <ArrowUpRight className="size-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />}
            </a>
            <CtaLink to={`/inscription?filieres=${meta.code}`} variant="secondary" icon={Bell}>
              Recevoir cette filière à 8h00
            </CtaLink>
          </motion.div>
        </motion.div>
        {/* Colonne droite — le panneau d'action */}
        <CartePostuler
          offre={offre} hue={hue} hash={hash}
          saved={saved} onToggleSave={onToggleSave}
          copied={copied} onCopy={onCopy}
        />
      </div>
    </div>
  </section>
)

/* ════════════════════════════════════════════════════════════════════
CORPS — description + entreprise | sidebar alerte 8h00 (sticky)
════════════════════════════════════════════════════════════════════ */
const SectionDescription = ({ meta, hue, detail }) => (
  <motion.article
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    className="overflow-hidden rounded-xl border border-outline-variant/40 bg-white shadow-soft"
    style={{ borderTop: `3px solid ${hue.hex}` }}
  >
    <div className="p-6 sm:p-8">
      <h2 className="flex items-center gap-2.5 font-heading text-xl font-extrabold text-brand-navy">
        <Briefcase className="size-5 text-brand-orange" />
        Description du poste
      </h2>
      <p className="mt-4 leading-relaxed text-on-surface-variant">{detail.intro}</p>

      <h3 className="mt-7 font-heading text-sm font-extrabold uppercase tracking-[0.14em] text-brand-navy">Vos missions</h3>
      <ul className="mt-3.5 space-y-2.5">
        {(detail.missions || []).map((m) => (
          <li key={m} className="flex items-start gap-2.5 text-sm leading-relaxed text-on-surface-variant">
            <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-brand-orange/10">
              <Check className="size-2.5 text-brand-orange" strokeWidth={3.5} />
            </span>
            {m}
          </li>
        ))}
      </ul>

      <h3 className="mt-7 font-heading text-sm font-extrabold uppercase tracking-[0.14em] text-brand-navy">Profil recherché</h3>
      <ul className="mt-3.5 space-y-2.5">
        {(detail.profile_requirements || detail.profil || []).map((p) => (
          <li key={p} className="flex items-start gap-2.5 text-sm leading-relaxed text-on-surface-variant">
            <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-brand-navy/8">
              <Check className="size-2.5 text-brand-navy" strokeWidth={3.5} />
            </span>
            {p}
          </li>
        ))}
      </ul>

      {(detail.benefits || detail.avantages) && (
        <>
          <h3 className="mt-7 font-heading text-sm font-extrabold uppercase tracking-[0.14em] text-brand-navy">Avantages</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {(detail.benefits || detail.avantages).map((a) => (
              <span key={a} className="rounded-full border border-outline-variant/60 bg-surface-container-low/60 px-3 py-1.5 text-xs font-semibold text-on-surface-variant">
                {a}
              </span>
            ))}
          </div>
        </>
      )}

      <div className="mt-7 border-t border-outline-variant/40 pt-5">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          <Sparkles className="size-3.5 text-brand-orange" />
          Mots-clés de matching automatique
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {(detail.tags || []).map((kw) => (
            <Tooltip key={kw}>
              <TooltipTrigger asChild>
                <span className="cursor-help rounded-full border border-outline-variant/60 bg-white px-3 py-1 text-xs font-medium text-on-surface-variant transition-colors hover:border-brand-navy/40 hover:text-brand-navy">
                  {kw}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">Les offres contenant « {kw} » sont tagguées {meta.label}.</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  </motion.article>
)

const CarteEntreprise = ({ offre }) => {
  // L'API ne renvoyant pas le total global d'offres par entreprise, on fallback sur 1
  const total = 1
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="mt-6 rounded-xl border border-outline-variant/40 bg-white p-6 shadow-soft sm:p-7"
    >
      <h2 className="flex items-center gap-2.5 font-heading text-xl font-extrabold text-brand-navy">
        <Building2 className="size-5 text-brand-orange" />
        L'entreprise
      </h2>
      <div className="mt-4 flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-brand-navy font-heading text-lg font-extrabold text-white">
          {offre.entreprise.split(" ").map((w) => w[0]).slice(0, 2).join("")}
        </span>
        <div className="min-w-0">
          <p className="font-heading text-base font-bold text-brand-navy">{offre.entreprise}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5" />{offre.ville}
          </p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-surface-container-low/70 px-4 py-3">
          <p className="font-heading text-2xl font-black text-brand-navy">{total} </p>
          <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">offre(s) active(s) sur JobAlert CI </p>
        </div>
        <div className="rounded-lg bg-surface-container-low/70 px-4 py-3">
          <p className="font-heading md:text-2xl font-black text-brand-navy">{offre.jours === 0 ? "Aujourd'hui" : `Il y a ${offre.jours} j`} </p>
          <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">publication sur {offre.sourceLabel || offre.source} </p>
        </div>
      </div>
    </motion.div>
  )
}

const CarteAlerte = ({ meta, hue }) => {
  const [email, setEmail] = useState("")
  const navigate = useNavigate()
  const submit = (e) => {
    e.preventDefault()
    if (!email.trim()) return
    navigate(`/inscription?filieres=${meta.code}&email=${encodeURIComponent(email.trim())}`)
  }
  return (
    <div className="relative overflow-hidden rounded-xl bg-brand-navy text-white">
      <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />
      <div className={cn("pointer-events-none absolute -right-20 -top-20 size-80 rounded-full blur-3xl", hue.glow)} aria-hidden />
      <div className="relative p-6">
        <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em]", hue.solid)}>
          <Bell className="size-3" />
          Alerte {meta.label}
        </span>
        <h3 className="mt-3.5 font-heading text-xl font-extrabold leading-snug">
          Ces offres, demain à <span className="text-brand-orange">8h00</span> dans votre boîte mail.
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-white/70">
          1 à 3 filières, zéro mot de passe. Votre premier récapitulatif arrive demain matin.
        </p>
        <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              aria-label="Votre adresse email"
              className="h-11 w-full rounded-md border border-white/15 bg-white/10 pl-10 pr-3.5 text-sm text-white outline-none transition-all duration-300 placeholder:text-white/40 focus:border-brand-orange focus:bg-white/[0.14] focus:ring-2 focus:ring-brand-orange/30"
            />
          </div>
          <button
            type="submit"
            className={cn("group inline-flex h-11 items-center justify-center gap-2 rounded-md text-sm font-bold text-white transition-all duration-300 hover:brightness-110 active:scale-[0.98]", hue.solid)}
          >
            Créer mon alerte
            <Bell className="size-4 transition-transform duration-300 group-hover:rotate-12" />
          </button>
        </form>
        <div className="mt-3.5 border-t border-white/10 pt-3.5">
          <ReassuranceList
            items={["Gratuit pour toujours", "1 email par jour", "Désinscription en 1 clic"]}
            tone="dark"
            className="gap-x-4 gap-y-1.5"
          />
        </div>
      </div>
    </div>
  )
}

const MiniCollecte = () => {
  const { data: stats } = useFetchData(getOfferSats)
  const { data: sources } = useFetchData(getOfferSatsBySource)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-outline-variant/40 bg-white p-5 shadow-soft"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Collecte du jour</p>
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
      </div>
      <p className="mt-2 font-heading text-3xl font-black text-brand-navy">
        {stats?.total_offers ?? 0} <span className="text-sm font-bold text-muted-foreground">offres · 0 doublon</span>
      </p>
      <div className="mt-3 flex items-center gap-2 border-t border-outline-variant/40 pt-3">
        {sources?.map((s) => <SourceLogo key={s.id} code={s.label} className="size-6 rounded" />)}
        <span className="ml-auto text-[11px] font-semibold text-muted-foreground">scannées à 6h02</span>
      </div>
    </motion.div>
  )
}

const CorpsOffre = ({ offre, meta, hue, detail }) => (
  <section className="border-b border-outline-variant/30 bg-background py-14 md:py-18">
    <div className="mx-auto grid max-w-7xl gap-10 px-6 md:px-12 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <SectionDescription meta={meta} hue={hue} detail={detail} />
        <CarteEntreprise offre={offre} />
      </div>
      <aside className="flex flex-col gap-6 self-start lg:sticky lg:top-24">
        <CarteAlerte meta={meta} hue={hue} />
        <MiniCollecte />
      </aside>
    </div>
  </section>
)

/* ════════════════════════════════════════════════════════════════════
OFFRES SIMILAIRES — même filière (OfferCard partagée)
════════════════════════════════════════════════════════════════════ */
const OffresSimilaires = ({ offre, meta, hue, similarOffers }) => {
  const similaires = similarOffers || []
  return (
    <section className="bg-surface-container-lowest py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Même filière"
            title={<>D'autres offres <span className="text-brand-orange">{meta.label}</span> vous attendent.</>}
            sub={`Découvrez d'autres opportunités dans la même filière.`}
          />
          <CtaLink to={`/filieres/${meta.code}`} variant="outline" size="md" iconRight={ArrowRight} className="hidden md:inline-flex">
            Toute la filière
          </CtaLink>
        </div>
        {similaires.length > 0 ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {similaires.map((o, i) => (
              <OfferCard key={o.uid} offre={o} index={i} view="grid" hue={hue} showFiliereChip={false} />
            ))}
          </div>
        ) : (
          <p className="mt-10 text-center text-sm text-muted-foreground">Aucune offre similaire trouvée pour le moment.</p>
        )}
        <div className="mt-8 text-center md:hidden">
          <CtaLink to={`/filieres/${meta.code}`} variant="outline" size="md" iconRight={ArrowRight}>
            Toute la filière {meta.label}
          </CtaLink>
        </div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
CHUTE — dernier appel à l'alerte
════════════════════════════════════════════════════════════════════ */
const BandeCloture = () => (
  <section className="bg-surface-container-lowest pb-16">
    <div className="mx-auto max-w-7xl px-6 md:px-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-start justify-between gap-5 rounded-xl border border-outline-variant/50 bg-white px-7 py-6 shadow-soft sm:flex-row sm:items-center"
      >
        <div>
          <p className="font-heading text-lg font-extrabold text-brand-navy">
            Ne revenez pas demain. <span className="text-brand-orange">Faites venir les offres.</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Récapitulatif quotidien à 8h00 · 13 filières · 4 sources scannées à 6h02.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
          <CtaLink to="/inscription" size="md" icon={Bell} animateIcon>Créer mon alerte</CtaLink>
          <CtaLink to="/comment-ca-marche" variant="outline" size="md" iconRight={ArrowRight}>Comment ça marche</CtaLink>
        </div>
      </motion.div>
    </div>
  </section>
)

/* ════════════════════════════════════════════════════════════════════
OFFRE INTROUVABLE
════════════════════════════════════════════════════════════════════ */
const OffreIntrouvable = ({ id }) => (
  <section className="hero-gradient flex min-h-[60vh] items-center justify-center px-6 py-20">
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-md text-center"
    >
      <span className="mx-auto flex size-16 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange">
        <SearchX className="size-8" strokeWidth={1.8} />
      </span>
      <h1 className="mt-5 font-heading text-3xl font-black tracking-tight text-brand-navy">
        Offre n° {id} introuvable
      </h1>
      <p className="mt-3 text-on-surface-variant">
        Elle a peut-être été retirée par le recruteur, ou son lien a expiré.
        Les offres du jour, elles, sont bien là.
      </p>
      <div className="mt-6 flex justify-center">
        <CtaLink to="/offres" iconRight={ArrowRight}>Voir les offres du jour</CtaLink>
      </div>
    </motion.div>
  </section>
)

/* ════════════════════════════════════════════════════════════════════
PAGE
════════════════════════════════════════════════════════════════════ */
const DetailsOffre = () => {
  const { id } = useParams()

  const [offre, setOffre] = useState(null)
  const [similarOffers, setSimilarOffers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const rawOffre = await getOfferById(id)
        if (!isMounted) return

        const adaptedOffre = adaptOffer(rawOffre)
        adaptedOffre.detail = rawOffre.detail

        setOffre(adaptedOffre)

        const rawSimilar = await getSimilarOffers(id)
        if (!isMounted) return
        setSimilarOffers(adaptOffers(rawSimilar))

        // Incrémentation de la vue (fire and forget)
        incrementeView(id).catch(() => { })
      } catch (err) {
        if (!isMounted) return
        setError(err.message || "Erreur lors du chargement de l'offre.")
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    if (id) {
      fetchData()
    }

    return () => { isMounted = false }
  }, [id])

  const meta = getFiliereTheme(offre?.filiere)
  const hue = meta ? HUES[meta.hue] : HUES.sky
  const hash = offre ? fakeHash(offre.id) : ""
  const detail = offre?.detail || {}

  const toggleSave = async () => {
    if (!offre) return
    try {
      await saveOffer(offre.id)
      setSaved(prev => !prev)
    } catch (err) {
      console.error("Erreur sauvegarde:", err)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
    } catch { /* contexte non sécurisé */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-brand-orange" />
      </main>
    )
  }

  if (error || !offre || !meta) {
    return (
      <>
        <Seo
          title="Offre introuvable | JobAlert CI"
          description="L'offre demandee est introuvable. Retournez a la liste des offres d'emploi sur JobAlert CI."
          path="/offres"
          noindex
        />
        <OffreIntrouvable id={id} />
      </>
    )
  }

  const totalEntreprise = 1
  const relatedOffers = similarOffers

  return (
    <>
      <Seo {...offreSeo(offre, meta, detail, relatedOffers)} />
      <main>
        <HeroOffre
          offre={offre} meta={meta} title={offre?.filiereLabel} hue={hue} hash={hash}
          totalEntreprise={totalEntreprise}
          saved={saved}
          onToggleSave={toggleSave}
          copied={copied}
          onCopy={copyLink}
        />
        <CorpsOffre offre={offre} meta={meta} hue={hue} detail={detail} />
        <OffresSimilaires offre={offre} meta={meta} hue={hue} similarOffers={similarOffers} />
        <BandeCloture />
      </main>
    </>
  )
}

export default DetailsOffre