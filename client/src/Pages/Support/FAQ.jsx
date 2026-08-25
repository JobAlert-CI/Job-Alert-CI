
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowRight, Bell, ChevronRight, Clock, HelpCircle, Mail, MessageCircleQuestion,
  Radar, Search, SearchX, ShieldCheck, User, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import Seo from "@/components/seo/Seo"
import { CtaLink, StatusChip } from "@/components/shared"
import { HUES } from "@/lib/hues"
import { faqSeo } from "@/lib/seo"

/* ════════════════════════════════════════════════════════════════════
DONNÉES — v2.0 : table pages_contenu (type = faq)
════════════════════════════════════════════════════════════════════ */
const CATEGORIES_FAQ = [
  { code: "service", label: "Le service", icon: Bell, hue: "orange" },
  { code: "collecte", label: "Collecte & sources", icon: Radar, hue: "sky" },
  { code: "alerte", label: "Votre alerte 8h00", icon: Mail, hue: "emerald" },
  { code: "confidentialite", label: "Confidentialité", icon: ShieldCheck, hue: "violet" },
  { code: "compte", label: "Compte & inscription", icon: User, hue: "rose" },
]

const QUESTIONS_FAQ = [
  { cat: "service", id: "gratuit", q: "Est-ce vraiment gratuit ?",
    r: "Oui, à 100 % et pour toujours. Aucune carte bancaire, aucun frais caché : JobAlert CI ne vous demandera jamais de payer pour recevoir des offres." },
  { cat: "service", id: "questce", q: "C'est quoi exactement, JobAlert CI ?",
    r: "Une plateforme de veille automatisée pour le marché de l'emploi en Côte d'Ivoire. Chaque matin, nous collectons les offres de 4 grandes sources, les dédoublonnons, les filtrons selon vos filières, et vous envoyons le tout par email à 8h00. C'est l'information qui vient à vous, pas l'inverse." },
  { cat: "service", id: "email", q: "Pourquoi un email plutôt qu'un tableau de bord ?",
    r: "Parce que c'est plus rapide. Le mode « push » vous évite de penser à vérifier : l'information vient à vous chaque matin, au lieu d'ajouter un site de plus à consulter. C'est aussi le meilleur moyen de ne rien manquer." },
  { cat: "service", id: "secteurs", q: "Quels secteurs sont couverts ?",
    r: "13 filières métiers : Tech & Dev, Marketing & Com, Commercial & Vente, Comptabilité & Finance, RH, BTP & Génie Civil, Logistique & Transport, Santé & Médical, Administration, Éducation & Formation, Hôtellerie & Restauration, Agriculture & Agrobusiness, Sécurité & Gardiennage." },

  { cat: "collecte", id: "sources", q: "D'où viennent les offres ?",
    r: "De 4 sources majeures scannées chaque matin à 6h00 : EmploiDakar CI, GoAfrica, Novojob et LinkedIn. Chaque offre affiche sa source d'origine et un lien direct vers l'annonce." },
  { cat: "collecte", id: "panne", q: "Que se passe-t-il si une source est en panne ?",
    r: "Rien de visible pour vous : chaque scraper est isolé, l'erreur est journalisée avec horodatage, et les trois autres sources continuent d'alimenter votre récapitulatif normalement." },
  { cat: "collecte", id: "tag", q: "Comment une offre est-elle rattachée à une filière ?",
    r: "Par analyse de mots-clés dans l'intitulé du poste : « développeur » ou « ingénieur logiciel » → Tech & Dev, « conducteur de travaux » → BTP & Génie Civil… Les listes de mots-clés sont maintenues et affinées en continu." },
  { cat: "collecte", id: "doublons", q: "Pourquoi n'y a-t-il jamais de doublons ?",
    r: "Chaque offre reçoit une empreinte unique (hash) calculée depuis son lien. Si la même annonce est repérée sur deux sources, une seule version est conservée en base — contrainte UNIQUE oblige. Vous ne la recevez donc jamais deux fois." },

  { cat: "alerte", id: "heure", q: "À quelle heure arrive le récapitulatif ?",
    r: "À 8h00 précises, chaque jour. Le scraping se termine à 6h15 et le filtrage à 7h00 — votre email est prêt avant votre premier café." },
  { cat: "alerte", id: "modifier", q: "Comment modifier mes filières ou me désinscrire ?",
    r: "Chaque email contient deux liens en bas de page : l'un pour gérer vos filières, l'autre pour vous désinscrire en un clic — sans mot de passe ni formulaire." },
  { cat: "alerte", id: "vide", q: "Et si aucune offre ne correspond à mes filières aujourd'hui ?",
    r: "Vous ne recevez rien. Pas d'email vide, pas de remplissage : votre boîte mail reste propre, et la chaîne reprend le lendemain matin." },
  { cat: "alerte", id: "whatsapp", q: "Puis-je recevoir les alertes sur WhatsApp ?",
    r: "Pas encore. L'email est pour l'instant notre canal unique afin de garantir la fiabilité de la chaîne quotidienne. WhatsApp et SMS sont sur la feuille de route." },

  { cat: "confidentialite", id: "donnees", q: "Mes données sont-elles protégées ?",
    r: "Votre adresse email ne sert qu'à vous envoyer vos offres. Elle n'est jamais partagée, jamais revendue, et vous pouvez supprimer votre compte à tout moment. Les identifiants SMTP sont stockés dans des variables d'environnement, jamais en dur dans le code." },
  { cat: "confidentialite", id: "desinscription", q: "Comment me désinscrire ?",
    r: "Un clic, depuis le lien en bas de chaque email. Votre statut passe à « désinscrit » immédiatement et vous ne recevez plus rien. Aucune justification demandée." },
  { cat: "confidentialite", id: "revente", q: "Mon email est-il partagé ou revendu ?",
    r: "Jamais. JobAlert CI ne partage, ne revend ni n'exploite vos données à d'autres fins que l'envoi de votre récapitulatif. C'est un engagement fondateur du service." },

  { cat: "compte", id: "motdepasse", q: "Ai-je besoin d'un mot de passe ?",
    r: "Non. Votre email suffit. C'est un choix assumé : moins de friction, moins de données à protéger, et une désinscription tout aussi simple." },
  { cat: "compte", id: "inscription", q: "Comment m'inscrire ?",
    r: "En 2 minutes : renseignez votre email, choisissez 1 à 3 filières, et c'est tout. Votre premier récapitulatif arrive le lendemain à 8h00." },
  { cat: "compte", id: "pause", q: "Puis-je mettre mon alerte en pause ?",
    r: "Dans la version actuelle, vous pouvez vous désinscrire puis vous réinscrire à tout moment — vos filières sont alors reconfigurées en quelques secondes. La mise en pause temporaire arrive dans une prochaine version." },
]

/* ════════════════════════════════════════════════════════════════════
HERO — la recherche d'abord
════════════════════════════════════════════════════════════════════ */
const HeroFaq = ({ query, setQuery, nbResultats }) => (
  <section className="relative overflow-hidden hero-gradient">
    <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
    <div className="absolute -top-32 right-[-10%] size-140 rounded-full bg-brand-orange/8 blur-3xl" aria-hidden />
    <div className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/5 blur-3xl" aria-hidden />

    <div className="relative z-10 mx-auto max-w-7xl px-6 pb-14 pt-8 md:px-12 md:pb-16 md:pt-10">
      <motion.nav
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
        aria-label="Fil d'Ariane"
      >
        <Link to="/" className="transition-colors hover:text-brand-navy">Accueil</Link>
        <ChevronRight className="size-3" />
        <span className="font-semibold text-brand-navy">FAQ</span>
      </motion.nav>

      <div className="mt-8 grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <motion.div
          initial="hidden" animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } } }}
          className="flex flex-col items-start gap-5"
        >
          <motion.div variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}>
            <StatusChip tooltip="Les réponses sont mises à jour à chaque évolution du service.">
              {QUESTIONS_FAQ.length} réponses · 5 thèmes
            </StatusChip>
          </motion.div>

          <motion.h1
            variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
            className="font-heading text-4xl font-black leading-[1.06] tracking-tight text-brand-navy sm:text-5xl xl:text-6xl"
          >
            Les réponses,{" "}
            <span className="relative whitespace-nowrap text-brand-orange">
              avant la question
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
            Gratuité, collecte, alerte de 8h00, confidentialité : tout ce qu'il faut savoir sur
            JobAlert CI, expliqué sans jargon.
          </motion.p>

          {/* La recherche — cœur de la FAQ */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
            className="w-full max-w-xl"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tapez votre question : « gratuit », « 8h00 », « désinscrire »…"
                aria-label="Rechercher dans la FAQ"
                className="h-14 w-full rounded-xl border border-outline-variant/60 bg-card pl-12 pr-12 text-[15px] shadow-soft outline-none transition-all placeholder:text-muted-foreground/60 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/25"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Effacer la recherche"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-brand-navy"
                >
                  <X className="size-4.5" />
                </button>
              )}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={query ? "r" : "t"}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="mt-2.5 text-xs font-semibold text-muted-foreground"
              >
                {query
                  ? `${nbResultats} réponse${nbResultats > 1 ? "s" : ""} pour « ${query.trim()} »`
                  : `${QUESTIONS_FAQ.length} réponses disponibles · mises à jour en continu`}
              </motion.p>
            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* Colonne droite — le contact humain */}
        <motion.div
          initial={{ opacity: 0, y: 32, rotate: 1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-md md:max-w-none"
        >
          <div className="absolute -inset-8 rounded-full bg-brand-orange/10 blur-3xl" aria-hidden />
          <div className="absolute inset-0 translate-x-4 translate-y-5 rotate-2 overflow-hidden rounded-2xl bg-brand-navy" aria-hidden>
            <div className="absolute inset-0 bg-pattern opacity-20" />
          </div>
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1, y: [0, -7, 0] }}
            transition={{ delay: 0.9, opacity: { duration: 0.4 }, scale: { duration: 0.4 }, y: { duration: 4.6, repeat: Infinity, ease: "easeInOut" } }}
            className="absolute -top-4 left-5 z-20 inline-flex -rotate-3 items-center gap-1.5 rounded-full bg-brand-orange px-3.5 py-1.5 text-[11px] font-bold text-on-primary shadow-lg sm:-left-4"
          >
            <Clock className="size-3" />
            Réponse en moins de 24 h
          </motion.span>

          <div className="relative overflow-hidden rounded-2xl bg-brand-navy p-7 text-white shadow-[0_24px_48px_-16px_rgba(15,45,77,0.35)]">
            <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />
            <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-brand-orange/15 blur-3xl" aria-hidden />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full bg-card/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/90">
                <MessageCircleQuestion className="size-3 text-brand-orange" />
                Question précise ?
              </span>
              <h2 className="mt-5 font-heading text-2xl font-extrabold leading-snug">
                Vous ne trouvez pas votre réponse ?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                Écrivez-nous : un humain — pas un bot — vous répond en moins de 24 h ouvrées.
                Les questions les plus utiles rejoignent cette page.
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                <CtaLink to="/contact" size="md" iconRight={ArrowRight} className="w-full">
                  Poser ma question
                </CtaLink>
                <CtaLink to="/comment-ca-marche" size="md" className="w-full border border-white/20 bg-card/10 shadow-none hover:bg-card/20 hover:brightness-100">
                  Voir le fonctionnement
                </CtaLink>
              </div>
              <p className="mt-4 border-t border-white/10 pt-3.5 text-center text-[10px] text-white/50">
                bonjour@jobalert.ci · 7 j/7
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
)

/* ════════════════════════════════════════════════════════════════════
CORPS — navigation par thème (scroll-spy) + accordéons groupés
════════════════════════════════════════════════════════════════════ */
const CorpsFaq = ({ groupes, query, activeCat, setActiveCat }) => {
  const aller = (code) => {
    setActiveCat(code)
    document.getElementById(`faq-${code}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <section className="border-t border-outline-variant/30 bg-background py-16 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 md:px-12 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Navigation des thèmes */}
        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              <HelpCircle className="size-3.5 text-brand-orange" />
              Par thème
            </p>
            <nav className="relative mt-4 space-y-1 border-l border-outline-variant/40 pl-0" aria-label="Thèmes de la FAQ">
              {groupes.map((g) => {
                const hue = HUES[g.hue]
                const actif = activeCat === g.code && !query.trim()
                return (
                  <button
                    key={g.code}
                    onClick={() => aller(g.code)}
                    className={cn(
                      "relative flex w-full items-center group gap-2.5 rounded-r-lg py-2.5 pl-4 pr-3 text-left text-[13px] font-semibold transition-colors duration-200",
                      actif ? hue.tile : "text-muted-foreground hover:bg-surface-container-low hover:text-brand-navy"
                    )}
                  >
                    {actif && (
                      <motion.span
                        layoutId="faq-rail"
                        className={cn("absolute -left-px bottom-1 top-1 w-0.5 rounded-full bg-brand-orange", hue.dot)}
                        transition={{ duration: 0.25 }}
                      />
                    )}
                    <g.icon className={cn("size-4 shrink-0", actif ? hue.tile : "text-muted-foreground/60")} />
                    <span className="flex-1">{g.label}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", actif ? hue.tile : "bg-surface-container text-muted-foreground")}>
                      {g.questions.length}
                    </span>
                  </button>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* Les questions */}
        <div className="space-y-12">
          {groupes.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-dashed border-outline-variant/60 bg-card p-12 text-center"
            >
              <SearchX className="mx-auto size-10 text-muted-foreground/50" />
              <h3 className="mt-4 font-heading text-lg font-bold text-brand-navy">Aucune réponse trouvée</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Essayez « gratuit », « 8h00 », « doublon »… ou posez directement votre question.
              </p>
              <CtaLink to="/contact" size="md" className="mt-5">Poser ma question</CtaLink>
            </motion.div>
          )}

          {groupes.map((g) => {
            const hue = HUES[g.hue]
            return (
              <div key={g.code} id={`faq-${g.code}`} className="scroll-mt-28">
                <motion.div
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-3"
                >
                  <span className={cn("flex size-10 items-center justify-center rounded-lg", hue.tile)}>
                    <g.icon className="size-5" strokeWidth={2} />
                  </span>
                  <div>
                    <h2 className="font-heading text-xl font-extrabold tracking-tight text-brand-navy">{g.label}</h2>
                    <p className="text-xs text-muted-foreground">{g.questions.length} question{g.questions.length > 1 ? "s" : ""}</p>
                  </div>
                </motion.div>

                <Accordion type="single" collapsible className="mt-4 w-full border-0">
                  {g.questions.map((item) => (
                    <AccordionItem
                      key={item.id}
                      value={item.id}
                      className="group mb-2.5 overflow-hidden rounded-xl border border-outline-variant/40 bg-card px-5 shadow-soft transition-all duration-300 hover:border-brand-navy/25 hover:shadow-hover group-data-open:border-brand-orange/40"
                    >
                      <AccordionTrigger className="py-4 text-left font-heading text-[15px] font-bold text-brand-navy transition-colors duration-200 hover:no-underline group-data-open:text-brand-orange [&>svg]:text-brand-orange">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="pb-5 text-sm leading-relaxed text-on-surface-variant">
                        {item.r}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
CTA FINAL
════════════════════════════════════════════════════════════════════ */
const CtaFaq = () => (
  <section className="bg-surface-container-lowest pb-16 md:pb-20 mt-8 md:mt-12">
    <div className="mx-auto max-w-7xl px-6 md:px-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-start justify-between gap-5 rounded-xl border border-outline-variant/50 bg-card px-7 py-6 shadow-soft sm:flex-row sm:items-center"
      >
        <div>
          <p className="font-heading text-lg font-extrabold text-brand-navy">
            Convaincu ? <span className="text-brand-orange">Votre premier récap arrive demain à 8h00.</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Gratuit, sans mot de passe, désinscription en 1 clic.</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
          <CtaLink to="/inscription" size="md" icon={Bell} animateIcon>Créer mon alerte</CtaLink>
          <CtaLink to="/contact" size="md" variant="outline" iconRight={ArrowRight}>Nous contacter</CtaLink>
        </div>
      </motion.div>
    </div>
  </section>
)

/* ════════════════════════════════════════════════════════════════════
PAGE
════════════════════════════════════════════════════════════════════ */
const Faq = () => {
  const [query, setQuery] = useState("")
  const [activeCat, setActiveCat] = useState(CATEGORIES_FAQ[0].code)

  const groupes = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CATEGORIES_FAQ
      .map((c) => ({
        ...c,
        questions: QUESTIONS_FAQ.filter(
          (x) => x.cat === c.code && (!q || x.q.toLowerCase().includes(q) || x.r.toLowerCase().includes(q))
        ),
      }))
      .filter((g) => g.questions.length > 0)
  }, [query])

  const nbResultats = groupes.reduce((s, g) => s + g.questions.length, 0)

  /* Scroll-spy sur les groupes de questions */
  useEffect(() => {
    if (query.trim()) return
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActiveCat(e.target.id.replace("faq-", "")) }),
      { rootMargin: "-30% 0px -60% 0px" }
    )
    CATEGORIES_FAQ.forEach((c) => {
      const el = document.getElementById(`faq-${c.code}`)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [query, groupes])

  return (
    <>
      <Seo {...faqSeo()} />
      <main>
        <HeroFaq query={query} setQuery={setQuery} nbResultats={nbResultats} />
        <CorpsFaq groupes={groupes} query={query} activeCat={activeCat} setActiveCat={setActiveCat} />
        <CtaFaq />
      </main>
    </>
  )
}

export default Faq
