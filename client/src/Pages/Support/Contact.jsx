
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowRight, BellOff, Check, ChevronRight, Clock, Handshake, HelpCircle,
  Loader2, Mail, MapPin, MessageSquareText, Radar, Send,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Seo from "@/components/seo/Seo"
import { CtaLink, StatusChip } from "@/components/shared"
import { contactSeo } from "@/lib/seo"

/* ════════════════════════════════════════════════════════════════════
DONNÉES
════════════════════════════════════════════════════════════════════ */
const SUJETS = [
  { id: "service", label: "Question sur le service", icon: HelpCircle, objet: "Question sur JobAlert CI" },
  { id: "alerte", label: "Problème avec mon alerte", icon: BellOff, objet: "Problème avec mon alerte 8h00" },
  { id: "source", label: "Proposer une source", icon: Radar, objet: "Proposition de source à scanner" },
  { id: "partenariat", label: "Partenariat / presse", icon: Handshake, objet: "Partenariat / presse" },
  { id: "autre", label: "Autre chose", icon: MessageSquareText, objet: "Autre demande" },
]

const ETAPES_REPONSE = [
  { t: "Votre message arrive", d: "Instantané : on est notifié tout de suite." },
  { t: "Un humain le lit", d: "Pas de bot, pas de réponse automatique." },
  { t: "Vous recevez une réponse", d: "Sous 24 h ouvrées, à l'adresse indiquée." },
]

const QUESTIONS_RAPIDES = [
  "Est-ce vraiment gratuit ?",
  "À quelle heure arrive le récapitulatif ?",
  "Comment me désinscrire ?",
  "D'où viennent les offres ?",
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/* ════════════════════════════════════════════════════════════════════
HORLOGE D'ABIDJAN — l'équipe est là-bas, il est quelle heure ?
════════════════════════════════════════════════════════════════════ */
const HorlogeAbidjan = () => {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  // Abidjan est à GMT+0 toute l'année
  const hh = String(now.getUTCHours()).padStart(2, "0")
  const mm = String(now.getUTCMinutes()).padStart(2, "0")
  const ss = String(now.getUTCSeconds()).padStart(2, "0")
  const estActif = now.getUTCHours() >= 8 && now.getUTCHours() < 18
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-3.5 rounded-xl border border-outline-variant/50 bg-card/80 px-4 py-3.5 backdrop-blur-sm"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-navy text-brand-orange">
        <Clock className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="font-heading text-lg font-extrabold tabular-nums leading-none text-brand-navy">
          {hh}:{mm}<span className="text-brand-orange">:{ss}</span>
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <span className={cn("relative flex size-1.5", estActif && "")}>
            {estActif && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-70" />}
            <span className={cn("relative inline-flex size-1.5 rounded-full", estActif ? "bg-emerald-500" : "bg-outline-variant")} />
          </span>
          À Abidjan, {estActif ? "l'équipe est probablement en ligne" : "l'équipe dort, le scraper veille"}
        </p>
      </div>
    </motion.div>
  )
}

/* ════════════════════════════════════════════════════════════════════
FORMULAIRE — composé comme un email vers l'équipe
════════════════════════════════════════════════════════════════════ */
const FormulaireContact = () => {
  const [form, setForm] = useState({ nom: "", email: "", sujet: "", message: "" })
  const [tentative, setTentative] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))
  const sujetObj = SUJETS.find((s) => s.id === form.sujet)

  const erreurs = useMemo(() => {
    const e = {}
    if (!form.nom.trim()) e.nom = "Votre nom est requis."
    if (!EMAIL_RE.test(form.email.trim())) e.email = "Cette adresse semble invalide."
    if (!form.sujet) e.sujet = "Choisissez un sujet."
    if (form.message.trim().length < 20) e.message = "Encore un peu de détail (20 caractères min)."
    return e
  }, [form])

  const canSend = Object.keys(erreurs).length === 0

  const submit = (ev) => {
    ev.preventDefault()
    setTentative(true)
    if (!canSend || sending) return
    setSending(true)
    setTimeout(() => {
      setSending(false)
      setSent(true)
    }, 1400)
  }

  const champ = (k) =>
    cn(
      "w-full rounded-lg border bg-card px-4 text-sm outline-none transition-all placeholder:text-muted-foreground/60",
      tentative && erreurs[k]
        ? "border-red-400 focus:ring-2 focus:ring-red-200"
        : "border-outline-variant/60 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
    )

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, rotate: 1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-md md:max-w-none"
    >
      <div className="absolute -inset-8 rounded-full bg-brand-orange/10 blur-3xl" aria-hidden />
      <div className="absolute inset-0 translate-x-4 translate-y-5 rotate-2 overflow-hidden rounded-2xl bg-brand-navy" aria-hidden>
        <div className="absolute inset-0 bg-pattern opacity-20" />
      </div>

      {/* Chips flottants */}
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, y: [0, -7, 0] }}
        transition={{ delay: 0.9, opacity: { duration: 0.4 }, scale: { duration: 0.4 }, y: { duration: 4.6, repeat: Infinity, ease: "easeInOut" } }}
        className="absolute -top-4 left-5 z-20 inline-flex -rotate-3 items-center gap-1.5 rounded-full bg-brand-orange px-3.5 py-1.5 text-[11px] font-bold text-on-primary shadow-lg sm:-left-4"
      >
        <Clock className="size-3" />
        Réponse en 24 h
      </motion.span>
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.05, duration: 0.4 }}
        className="absolute -bottom-4 right-8 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-card px-3.5 py-1.5 text-[11px] font-bold text-emerald-600 shadow-hover"
      >
        <Check className="size-3" strokeWidth={3} />
        Lu par un humain
      </motion.span>

      <div className="relative overflow-hidden rounded-2xl border border-outline-variant/40 bg-card shadow-[0_24px_48px_-16px_rgba(15,45,77,0.22)]">
        {/* Chrome « email » — l'objet se met à jour en direct */}
        <div className="flex items-center gap-3 border-b border-outline-variant/40 bg-surface-container-low/60 px-5 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-navy font-heading text-[11px] font-black text-white">JA</span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-on-surface">
              À : <span className="font-medium text-muted-foreground">bonjour@jobalert.ci</span>
            </p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={sujetObj?.objet ?? "vide"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="truncate text-[11px] text-muted-foreground"
              >
                Objet : {sujetObj ? sujetObj.objet : "Votre message"}
              </motion.p>
            </AnimatePresence>
          </div>
          <Send className="size-4 shrink-0 text-brand-orange" />
        </div>

        <div className="px-5 py-5 sm:px-6">
          <AnimatePresence mode="wait" initial={false}>
            {sent ? (
              /* ── Écran de succès ── */
              <motion.div
                key="ok"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="py-8 text-center"
              >
                <motion.svg viewBox="0 0 52 52" className="mx-auto size-20" aria-hidden>
                  <motion.circle
                    cx="26" cy="26" r="24" fill="none" stroke="#10b981" strokeWidth="2"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                  <motion.path
                    d="M14 27l8 8 16-16" fill="none" stroke="#10b981" strokeWidth="3.5"
                    strokeLinecap="round" strokeLinejoin="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
                  />
                </motion.svg>
                <h3 className="mt-5 font-heading text-2xl font-extrabold text-brand-navy">Message bien reçu !</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-on-surface-variant">
                  On vous répond à <strong className="font-semibold text-brand-navy">{form.email}</strong> sous
                  24 h ouvrées. En attendant, les offres du jour n'attendent que vous.
                </p>
                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <CtaLink to="/offres" size="md" iconRight={ArrowRight}>Voir les offres du jour</CtaLink>
                  <CtaLink to="/" size="md" variant="outline">Retour à l'accueil</CtaLink>
                </div>
              </motion.div>
            ) : (
              /* ── Le formulaire ── */
              <motion.form
                key="form"
                onSubmit={submit}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.35 }}
                className="space-y-4"
                noValidate
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="nom" className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Nom <span className="text-brand-orange">*</span>
                    </label>
                    <input
                      id="nom" type="text" autoComplete="name"
                      value={form.nom} onChange={(e) => set("nom", e.target.value)}
                      placeholder="Awa Diabaté"
                      className={cn(champ("nom"), "mt-1.5 h-12")}
                    />
                    {tentative && erreurs.nom && <p className="mt-1 text-[11px] font-medium text-red-500">{erreurs.nom}</p>}
                  </div>
                  <div>
                    <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Email <span className="text-brand-orange">*</span>
                    </label>
                    <input
                      id="email" type="email" autoComplete="email"
                      value={form.email} onChange={(e) => set("email", e.target.value)}
                      placeholder="vous@email.com"
                      className={cn(champ("email"), "mt-1.5 h-12")}
                    />
                    {tentative && erreurs.email && <p className="mt-1 text-[11px] font-medium text-red-500">{erreurs.email}</p>}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Sujet <span className="text-brand-orange">*</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SUJETS.map((s) => (
                      <button
                        key={s.id} type="button"
                        onClick={() => set("sujet", s.id)}
                        aria-pressed={form.sujet === s.id}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all duration-200",
                          form.sujet === s.id
                            ? "border-brand-navy bg-brand-navy text-white shadow-soft"
                            : "border-outline-variant/60 bg-card text-on-surface-variant hover:-translate-y-0.5 hover:border-brand-navy/40 hover:text-brand-navy"
                        )}
                      >
                        <s.icon className="size-4" />
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {tentative && erreurs.sujet && <p className="mt-1.5 text-[11px] font-medium text-red-500">{erreurs.sujet}</p>}
                </div>

                <div>
                  <label htmlFor="message" className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Message <span className="text-brand-orange">*</span>
                  </label>
                  <textarea
                    id="message" rows={5} maxLength={1000}
                    value={form.message} onChange={(e) => set("message", e.target.value)}
                    placeholder="Dites-nous tout : votre question, votre filière, le souci rencontré…"
                    className={cn(champ("message"), "mt-1.5 resize-none py-3 leading-relaxed")}
                  />
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className={cn("font-medium", tentative && erreurs.message ? "text-red-500" : "text-muted-foreground")}>
                      {tentative && erreurs.message ? erreurs.message : "20 caractères minimum"}
                    </span>
                    <span className={cn("font-semibold tabular-nums", form.message.length > 900 ? "text-brand-orange" : "text-muted-foreground")}>
                      {form.message.length}/1000
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="group inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-brand-orange text-sm font-bold text-on-primary shadow-[0_12px_28px_-8px_rgba(245,166,35,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
                >
                  {sending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Envoi en cours…
                    </>
                  ) : (
                    <>
                      <Send className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      Envoyer le message
                    </>
                  )}
                </button>
                <p className="text-center text-[11px] text-muted-foreground">
                  Votre email ne sert qu'à vous répondre. Jamais partagé, jamais revendu.
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

/* ════════════════════════════════════════════════════════════════════
AIDE RAPIDE — la réponse est peut-être déjà dans la FAQ
════════════════════════════════════════════════════════════════════ */
const AideRapide = () => (
  <section className="border-t border-outline-variant/30 bg-surface-container-lowest py-14 md:py-16">
    <div className="mx-auto max-w-7xl px-6 md:px-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center"
      >
        <div className="max-w-md">
          <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-orange">
            <span className="h-px w-6 bg-brand-orange" aria-hidden />
            Avant d'écrire
          </p>
          <h2 className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-brand-navy">
            La réponse est peut-être <span className="text-brand-orange">déjà là</span>.
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUESTIONS_RAPIDES.map((q) => (
            <Link
              key={q}
              to="/faq"
              className="group inline-flex items-center gap-2 rounded-full border border-outline-variant/60 bg-card px-4 py-2 text-[13px] font-semibold text-on-surface-variant shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-orange/50 hover:text-brand-navy"
            >
              {q}
              <ArrowRight className="size-3.5 text-brand-orange transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          ))}
          <Link
            to="/faq"
            className="group inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-[13px] font-bold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
          >
            Toute la FAQ
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </motion.div>
    </div>
  </section>
)

/* ════════════════════════════════════════════════════════════════════
PAGE
════════════════════════════════════════════════════════════════════ */
const Contact = () => (
  <>
    <Seo {...contactSeo()} />
    <main>
      <section className="relative overflow-hidden hero-gradient">
        <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
        <div className="absolute -top-32 right-[-10%] size-140 rounded-full bg-brand-orange/8 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/5 blur-3xl" aria-hidden />

        <div className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-8 md:px-12 md:pb-20 md:pt-10">
          <motion.nav
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            aria-label="Fil d'Ariane"
          >
            <Link to="/" className="transition-colors hover:text-brand-navy">Accueil</Link>
            <ChevronRight className="size-3" />
            <span className="font-semibold text-brand-navy">Contact</span>
          </motion.nav>

          <div className="mt-8 grid items-start gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            {/* ═══ Colonne gauche — la promesse de réponse ═══ */}
            <motion.div
              initial="hidden" animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } } }}
              className="flex flex-col items-start gap-5"
            >
              <motion.div variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}>
                <StatusChip tooltip="Du lundi au dimanche. Les questions techniques sont traitées en priorité le matin, après la collecte.">
                  Équipe en ligne · réponse sous 24 h ouvrées
                </StatusChip>
              </motion.div>

              <motion.h1
                variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
                className="font-heading text-4xl font-black leading-[1.06] tracking-tight text-brand-navy sm:text-5xl xl:text-6xl"
              >
                Une question ?{" "}
                <span className="relative whitespace-nowrap text-brand-orange">
                  Un humain répond
                  <svg className="absolute -bottom-1.5 left-0 w-full" viewBox="0 0 200 9" fill="none" preserveAspectRatio="none" aria-hidden>
                    <motion.path
                      d="M2 6.5C60 2.5 140 2.5 198 6.5" stroke="#F5A623" strokeWidth="3.5" strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 0.85 }} viewport={{ once: true }}
                      transition={{ duration: 1.6, ease: "easeOut", delay: 0.5 }}
                    />
                  </svg>
                </span>
                .
              </motion.h1>

              <motion.p
                variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
                className="max-w-xl text-lg leading-relaxed text-on-surface-variant"
              >
                Question sur vos filières, souci avec le récap de 8h00, une source à proposer ou
                juste un bonjour, on lit tout, et on répond en moins de{" "}
                <strong className="font-semibold text-brand-navy">24 h ouvrées</strong>.
              </motion.p>

              {/* Canaux */}
              <motion.div
                variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
                className="mt-1 flex w-full max-w-md flex-col gap-2.5"
              >
                {[
                  { icon: Mail, t: "bonjour@jobalert.ci", d: "Pour tout type de question, réponse sous 24 h" },
                  { icon: MapPin, t: "Abidjan, Côte d'Ivoire", d: "L'équipe est sur le même fuseau que les offres" },
                ].map((c) => (
                  <div key={c.t} className="flex items-center gap-3.5 rounded-xl border border-outline-variant/50 bg-card/80 px-4 py-3.5 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-navy/30 hover:shadow-soft">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-orange/10 text-brand-orange">
                      <c.icon className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-heading text-sm font-bold text-brand-navy">{c.t}</p>
                      <p className="text-[11px] text-muted-foreground">{c.d}</p>
                    </div>
                  </div>
                ))}
                <HorlogeAbidjan />
              </motion.div>

              {/* Ce qui se passe ensuite */}
              <motion.div
                variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
                className="mt-2 w-full max-w-md"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Ce qui se passe ensuite</p>
                <ol className="relative mt-3 space-y-4 border-l border-outline-variant/50 pl-5">
                  {ETAPES_REPONSE.map((e, i) => (
                    <li key={e.t} className="relative">
                      <span className="absolute -left-6.75 top-0.5 grid size-4 place-items-center rounded-full border-2 border-white bg-brand-orange font-heading text-[9px] font-black text-on-primary shadow-soft">
                        {i + 1}
                      </span>
                      <p className="text-sm font-bold text-brand-navy">{e.t}</p>
                      <p className="text-[13px] text-muted-foreground">{e.d}</p>
                    </li>
                  ))}
                </ol>
              </motion.div>
            </motion.div>

            {/* ═══ Colonne droite — le formulaire ═══ */}
            <FormulaireContact />
          </div>
        </div>
      </section>

      <AideRapide />
    </main>
  </>
)

export default Contact
