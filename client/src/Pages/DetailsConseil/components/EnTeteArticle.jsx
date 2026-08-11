// src/pages/conseils/detail/components/EnTeteArticle.jsx
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  BadgeCheck, Bell, Check, ChevronRight, Clock, Eye, Lightbulb, Link2, Sparkles,
} from "lucide-react"
import { FaLinkedin } from "react-icons/fa6"
import { cn } from "@/lib/utils"
import { BadgeNouveau, CtaLink } from "@/components/shared"
import { dateLabel } from "@/lib/dates"
import { fmtVus } from "@/lib/query-helpers"
import { useConseilDetail } from "@/contexts/DetailsConseil.context"

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
}

/* ─────────────── Brief « à retenir » — autonome via contexte ─────────────── */
const CarteBrief = () => {
  const { article: a, cat, hue, contenu } = useConseilDetail()
  const Icon = cat.icon ?? Lightbulb

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, rotate: 1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full min-w-0 max-md:mx-auto max-md:max-w-md"
    >
      <div className={cn("absolute -inset-8 rounded-full blur-3xl", hue.glow)} aria-hidden />

      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, y: [0, -7, 0] }}
        transition={{ delay: 0.9, opacity: { duration: 0.4 }, scale: { duration: 0.4 }, y: { duration: 4.6, repeat: Infinity, ease: "easeInOut" } }}
        className="absolute -top-4 left-5 z-20 inline-flex -rotate-3 items-center gap-1.5 rounded-full bg-brand-orange px-3.5 py-1.5 text-[11px] font-bold text-white shadow-lg sm:-left-4"
      >
        <Clock className="size-3" aria-hidden />
        {a.lecture} min de lecture
      </motion.span>
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.05, duration: 0.4 }}
        className="absolute -top-3 right-6 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3 py-1.5 text-[11px] font-bold text-brand-navy shadow-soft"
      >
        <Eye className="size-3 text-brand-orange" aria-hidden />
        {fmtVus(a.vus)} lectures
      </motion.span>
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
        transition={{ delay: 1.2, opacity: { duration: 0.4 }, scale: { duration: 0.4 }, y: { duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 } }}
        className="absolute -bottom-4 right-8 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3.5 py-1.5 text-[11px] font-bold text-emerald-600 shadow-hover"
      >
        <Sparkles className="size-3" aria-hidden />
        Nourri par la collecte
      </motion.span>

      <div className="relative flex flex-col overflow-hidden rounded-2xl bg-brand-navy text-white shadow-[0_24px_48px_-16px_rgba(15,45,77,0.35)]">
        <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />
        <div className={cn("pointer-events-none absolute -right-24 -top-24 size-80 rounded-full blur-3xl", hue.glow)} aria-hidden />
        <Icon className="pointer-events-none absolute -bottom-8 -right-4 size-48 rotate-12 text-white/5" strokeWidth={1} aria-hidden />

        <div className="relative flex items-center gap-3 border-b border-white/10 px-6 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-orange font-heading text-[11px] font-black text-white">
            JA
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold">Le brief JobAlert CI</p>
            <p className="truncate text-[11px] text-white/60">
              {cat.label} · {dateLabel(a.jours)}
            </p>
          </div>
          <Icon className="size-4 shrink-0 text-white/40" aria-hidden />
        </div>

        <div className="relative flex flex-1 flex-col px-6 py-6">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-orange">
            <Lightbulb className="size-3.5" aria-hidden />
            À retenir en 30 secondes
          </p>
          <ul className="mt-3.5 space-y-2.5">
            {contenu.aRetenir.length > 0 ? (
              contenu.aRetenir.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-white/80">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-orange/20">
                    <Check className="size-2.5 text-brand-orange" strokeWidth={3.5} aria-hidden />
                  </span>
                  {point}
                </li>
              ))
            ) : (
              <li className="text-[13px] leading-relaxed text-white/70">
                Les points clés seront bientôt disponibles.
              </li>
            )}
          </ul>
          <div className="mt-auto pt-6">
            <CtaLink to="/inscription" size="md" icon={Bell} animateIcon className="w-full">
              Recevoir ce thème à 8h00
            </CtaLink>
            <p className="mt-3 text-center text-[10px] text-white/50">
              Gratuit · 1 email par jour · désinscription en 1 clic
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ─────────────── En-tête — l'état « copié » vit ICI (plus de prop) ─────────────── */
const EnTeteArticle = () => {
  const { slug, article: a, cat, hue } = useConseilDetail()
  const Icon = cat.icon ?? Lightbulb

  const [copied, setCopied] = useState(false)
  const copyTimer = useRef(null)
  useEffect(() => () => clearTimeout(copyTimer.current), [])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCopied(false) }, [slug])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
    } catch { /* contexte non sécurisé */ }
    setCopied(true)
    clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="relative overflow-hidden hero-gradient">
      <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
      <div className={cn("absolute -top-32 right-[-10%] size-140 rounded-full blur-3xl", hue.glow)} aria-hidden />
      <div className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/5 blur-3xl" aria-hidden />

      {/* Desktop-first : paddings desktop en base, repli via max-md */}
      <div className="relative z-10 mx-auto max-w-7xl px-12 pb-16 pt-10 max-md:px-6 max-md:pb-14 max-md:pt-8">
        <motion.nav
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground"
          aria-label="Fil d'Ariane"
        >
          <Link to="/" className="rounded-sm transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Accueil
          </Link>
          <ChevronRight className="size-3" aria-hidden />
          <Link to="/conseils" className="rounded-sm transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Conseils
          </Link>
          <ChevronRight className="size-3" aria-hidden />
          <Link to={`/conseils?cat=${cat.code}`} className={cn("rounded-full px-2 text-white", hue.solid)}>
            {cat.label}
          </Link>
          <ChevronRight className="size-3" aria-hidden />
          <span className="truncate font-semibold text-brand-navy" aria-current="page">{a.titre}</span>
        </motion.nav>

        {/* Desktop-first : 2 colonnes en base, empilé en repli */}
        <div className="mt-8 grid grid-cols-[1.05fr_0.95fr] items-start gap-16 max-lg:grid-cols-1 max-lg:gap-14">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-start gap-5"
          >
            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2.5">
              <Link
                to="/conseils"
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  hue.tile
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {cat.label}
              </Link>
              {a.jours === 0 && <BadgeNouveau />}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white/80 px-3.5 py-1.5 text-[11px] font-bold text-on-surface-variant">
                <Clock className="size-3 text-brand-orange" aria-hidden />
                {a.lecture} min de lecture
              </span>
            </motion.div>

            {/* Desktop-first : 5xl en base, repli 4xl puis 3xl */}
            <motion.h1
              variants={fadeUp}
              className="font-heading text-5xl font-black leading-[1.12] tracking-tight text-brand-navy max-xl:text-4xl max-sm:text-3xl"
            >
              {a.titre}
            </motion.h1>

            <motion.p variants={fadeUp} className="max-w-2xl leading-relaxed text-on-surface-variant md:text-lg">
              {a.extrait}
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-10 items-center justify-center rounded-full bg-brand-navy font-heading text-[11px] font-black text-white">
                  RC
                </span>
                <div>
                  <p className="flex items-center gap-1.5 text-[13px] font-bold text-brand-navy">
                    La rédaction
                    <BadgeCheck className="size-3.5 text-brand-orange" aria-hidden />
                  </p>
                  <p className="text-[11px] text-muted-foreground">Analystes marché · JobAlert CI</p>
                </div>
              </div>
              <span className="hidden h-8 w-px bg-outline-variant/50 sm:block" aria-hidden />
              <span className="text-xs font-semibold text-muted-foreground">{dateLabel(a.jours)}</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Clock className="size-3.5 text-brand-orange" aria-hidden />
                {a.lecture} min
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Eye className="size-3.5 text-brand-orange" aria-hidden />
                {fmtVus(a.vus)} lectures
              </span>
            </motion.div>

            {/* Actions — rangée en base, repli mobile */}
            <motion.div variants={fadeUp} className="mt-1 flex flex-row flex-wrap items-center gap-2.5 max-sm:flex-col max-sm:items-stretch">
              <button
                type="button"
                onClick={copyLink}
                aria-live="polite"
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-xs font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  copied
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700"
                    : "border-outline-variant/60 bg-white text-on-surface-variant hover:border-brand-navy/40 hover:text-brand-navy"
                )}
              >
                {copied ? <Check className="size-3.5" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />}
                {copied ? "Lien copié" : "Copier le lien"}
              </button>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                  typeof window !== "undefined" ? window.location.href : ""
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#0A66C2]/30 bg-[#0A66C2]/5 px-4 text-xs font-bold text-[#0A66C2] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0A66C2] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <FaLinkedin className="size-3.5" aria-hidden />
                Partager
              </a>
              <CtaLink to="/inscription" size="md" icon={Bell} animateIcon className="h-10">
                Recevoir ce thème à 8h00
              </CtaLink>
            </motion.div>
          </motion.div>

          <CarteBrief />
        </div>
      </div>
    </section>
  )
}

export default EnTeteArticle