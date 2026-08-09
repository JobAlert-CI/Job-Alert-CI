import { useCallback, useRef } from "react"
import { Link } from "react-router-dom"
import { motion, useScroll, useSpring } from "framer-motion"
import {
  ArrowRight, BadgeCheck, Bell, Check, Clock, Fingerprint,
  Radar, Send, SlidersHorizontal, MessageCircleQuestion,
  ArrowUpRight, Calculator, Code2, Handshake, HardHat, Stethoscope, Users, Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Seo from "@/components/seo/Seo"
import { Badge } from "@/components/ui/badge"
import { homeSeo } from "@/lib/seo"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { FaLinkedin } from "react-icons/fa6"
import { getImgSource } from "@/utils/utilsSource"
import { CountUp, SectionHeading, CtaLink, FeedOffreCard, TemoignageCard, FaqSection } from "@/components/shared"
import { getOfferSats, getOfferSatsByFiliere } from "@/api/public/stats"
import { getOffers } from "@/api/public/offers"
import { useFetchData } from "@/hooks/use-fetch-data"
import { Skeleton } from "@/components/ui/skeleton"
import { HUES } from "@/lib/hues"

/* ------------------------------------------------------------------ */
/*  Données                                                            */
/* ------------------------------------------------------------------ */

const REASSURANCES = [
  "100 % gratuit, sans mot de passe",
  "1 seul email par jour, pas plus",
  "Désinscription en 1 clic",
]

const JOBS_APERCU = [
  {
    id: "mock-1",
    title: "Développeur Full-Stack",
    company: { name: "Groupe SIFCA · Abidjan" },
    source: { name: "Novojob", code: "novojob" },
    primary_filiere: { hue: "sky" },
  },
  {
    id: "mock-2",
    title: "Responsable RH",
    company: { name: "Orange Côte d'Ivoire · Abidjan" },
    source: { name: "LinkedIn", code: "linkedin" },
    primary_filiere: { hue: "violet" },
    linkedin: true,
  },
  {
    id: "mock-3",
    title: "Conducteur de travaux",
    company: { name: "Bouygues CI · Yamoussoukro" },
    source: { name: "GoAfrica", code: "goafrica" },
    primary_filiere: { hue: "amber" },
  },
  {
    id: "mock-4",
    title: "Infirmier(ère) diplômé(e)",
    company: { name: "Clinique Farah · Abidjan" },
    source: { name: "EmploiDakar CI", code: "emploidakar" },
    primary_filiere: { hue: "rose" },
  },
];


const OFFRES = [
  {
    id: 1, titre: "Développeur Full-Stack", entreprise: "Tech Solutions CI", ville: "Abidjan · Plateau",
    contrat: "CDI", source: "Novojob", fresh: true, icon: Code2, tile: "bg-sky-500/10 text-sky-600 group-hover:bg-sky-500 group-hover:text-white", hover: "hover:border-sky-600 group-hover:text-white"
  },
  {
    id: 2, titre: "Responsable RH", entreprise: "Orange Côte d'Ivoire", ville: "Abidjan · Cocody",
    contrat: "CDI", source: "LinkedIn", linkedin: true, fresh: true, icon: Users, tile: "bg-violet-500/10 text-violet-600 group-hover:bg-violet-500 group-hover:text-white", hover: "hover:border-violet-600 group-hover:text-white"
  },
  {
    id: 3, titre: "Comptable senior", entreprise: "Groupe SIFCA", ville: "Abidjan · Treichville",
    contrat: "CDI", source: "Novojob", fresh: true, icon: Calculator, tile: "bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white", hover: "hover:border-emerald-600 group-hover:text-white"
  },
  {
    id: 4, titre: "Conducteur de travaux", entreprise: "Bouygues CI", ville: "Yamoussoukro",
    contrat: "CDD", source: "GoAfrica", icon: HardHat, tile: "bg-amber-500/10 text-amber-600 group-hover:bg-amber-500 group-hover:text-white", hover: "hover:border-amber-600 group-hover:text-white"
  },
  {
    id: 5, titre: "Infirmier(ère) diplômé(e)", entreprise: "Clinique Farah", ville: "Abidjan · Marcory",
    contrat: "CDI", source: "EmploiDakar CI", icon: Stethoscope, tile: "bg-rose-500/10 text-rose-600 group-hover:bg-rose-500 group-hover:text-white", hover: "hover:border-rose-600 group-hover:text-white"
  },
  {
    id: 6, titre: "Commercial terrain", entreprise: "Agro Distribution", ville: "San Pédro",
    contrat: "Mission", source: "GoAfrica", icon: Handshake, tile: "bg-orange-500/10 text-orange-600 group-hover:bg-orange-500 group-hover:text-white", hover: "hover:border-orange-600 group-hover:text-white"
  },
]

const REPARTITION = [
  { label: "Tech & Dev", count: 12, pct: 100, color: "bg-sky-400" },
  { label: "Autres filières", count: 9, pct: 75, color: "bg-white/40" },
  { label: "Ressources Humaines", count: 8, pct: 67, color: "bg-violet-400" },
  { label: "BTP & Génie Civil", count: 7, pct: 58, color: "bg-amber-400" },
  { label: "Comptabilité & Finance", count: 6, pct: 50, color: "bg-emerald-400" },
  { label: "Santé & Médical", count: 5, pct: 42, color: "bg-rose-400" },
]

const QUESTIONS = [
  {
    id: "q1",
    question: "Est-ce vraiment gratuit ?",
    reponse:
      "Oui, à 100 % et pour toujours. Aucune carte bancaire, aucun frais caché : JobAlert CI ne vous demandera jamais de payer pour recevoir des offres.",
  },
  {
    id: "q2",
    question: "À quelle heure arrive le récapitulatif ?",
    reponse:
      "À 8h00 précises, chaque jour. Le scraping se termine à 6h15 et le filtrage à 7h00 — votre email est prêt avant votre premier café.",
  },
  {
    id: "q3",
    question: "D'où viennent les offres ?",
    reponse:
      "De 4 sources majeures scannées chaque matin : EmploiDakar CI, GoAfrica, Novojob et LinkedIn. Chaque offre affiche sa source d'origine et un lien direct vers l'annonce.",
  },
  {
    id: "q4",
    question: "Quels secteurs sont couverts ?",
    reponse:
      "13 filières métiers : Tech & Dev, Marketing & Com, Commercial & Vente, Comptabilité & Finance, RH, BTP & Génie Civil, Logistique & Transport, Santé & Médical, Administration, Éducation & Formation, Hôtellerie & Restauration, Agriculture & Agrobusiness, Sécurité & Gardiennage.",
  },
  {
    id: "q5",
    question: "Comment modifier mes filières ou me désinscrire ?",
    reponse:
      "Chaque email contient deux liens en bas de page : l'un pour gérer vos filières, l'autre pour vous désinscrire en un clic — sans mot de passe ni formulaire.",
  },
  {
    id: "q6",
    question: "Puis-je recevoir les alertes sur WhatsApp ?",
    reponse:
      "Pas encore. L'email est pour l'instant notre canal unique afin de garantir la fiabilité de la chaîne quotidienne. WhatsApp et SMS sont sur la feuille de route.",
  },
  {
    id: "q7",
    question: "Mes données sont-elles protégées ?",
    reponse:
      "Votre adresse email ne sert qu'à vous envoyer vos offres. Elle n'est jamais partagée, jamais revendue, et vous pouvez supprimer votre compte à tout moment.",
  },
]

const TEMOIGNAGES = [
  {
    vedette: true,
    initiales: "AD",
    nom: "Awa D.",
    ville: "Bouaké",
    secteur: "Ressources Humaines",
    avatar: "bg-violet-500",
    texte:
      "Je passais mes matinées à ouvrir dix sites un par un. Maintenant, tout arrive à 8h00 dans un seul email — et c'est dans mon tout premier récap que j'ai trouvé l'offre de Responsable RH que j'occupe aujourd'hui.",
    resultat: "Embauchée 3 semaines après son inscription",
  },
  {
    initiales: "JK",
    nom: "Jean-Paul K.",
    ville: "San Pédro",
    secteur: "Tech & Dev",
    avatar: "bg-sky-600",
    texte:
      "Alerte reçue à 8h00 pile, candidature envoyée à 8h20. Entretien la semaine suivante, CDI signé dans la foulée.",
    resultat: "CDI signé en 12 jours",
  },
  {
    initiales: "MK",
    nom: "Moussa K.",
    ville: "Abidjan",
    secteur: "Comptabilité & Finance",
    avatar: "bg-emerald-600",
    texte:
      "Dès la première semaine, une offre d'Expert-Comptable qui cochait toutes mes cases. Le filtrage par filière est d'une précision redoutable.",
    resultat: "3 entretiens décrochés en 1 mois",
  },
  {
    initiales: "SK",
    nom: "Salimata K.",
    ville: "Korhogo",
    secteur: "Santé & Médical",
    avatar: "bg-rose-600",
    texte:
      "Infirmière de nuit, je n'avais jamais le temps d'ouvrir les sites d'emploi. Le récap m'a apporté l'offre de la Clinique Farah sur un plateau — j'ai postulé entre deux gardes.",
    resultat: "Nouveau poste en 3 semaines",
  },
  {
    initiales: "YB",
    nom: "Yao B.",
    ville: "Yamoussoukro",
    secteur: "BTP & Génie Civil",
    avatar: "bg-amber-600",
    texte:
      "Une offre de conducteur de travaux arrivée un mardi, un chantier qui démarrait le lundi suivant. Sans l'alerte de 8h00, je passais complètement à côté.",
    resultat: "CDD transformé en CDI",
  },
  {
    initiales: "FC",
    nom: "Fatou C.",
    ville: "Abidjan",
    secteur: "Marketing & Com",
    avatar: "bg-fuchsia-600",
    texte:
      "J'ai fait le compte : en un mois, le récap m'a remonté plus d'offres pertinentes que trois mois de recherche manuelle, site par site.",
    resultat: "12 candidatures ciblées en 1 mois",
  },
]

/* ------------------------------------------------------------------ */
/*  Animations                                                         */
/* ------------------------------------------------------------------ */

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

const chipFloat = (delay, duration = 4.5) => ({
  initial: { opacity: 0, scale: 0.8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: [0, -7, 0],
    transition: {
      opacity: { duration: 0.4, delay },
      scale: { duration: 0.4, delay },
      y: { duration, repeat: Infinity, ease: "easeInOut", delay: delay + 0.4 }
    }
  }
})

/* ------------------------------------------------------------------ */
/*  La page principales                                               */
/* ------------------------------------------------------------------ */

const Home = () => {
  const fetchStats = useCallback(async () => { return await getOfferSats(); }, []);
  const fetchFiliereStats = useCallback(async () => {
    return await getOfferSatsByFiliere({ limit: 28 });
  }, []);
  const fetchOffers = useCallback(async () => { return getOffers({ limit: 6 }) }, [])

  const statsQuery = useFetchData(fetchStats);
  const statsFilQuery = useFetchData(fetchFiliereStats);
  const offersQuery = useFetchData(fetchOffers)

  console.log("offers :", offersQuery.data)
  return (
    <>
      <Seo {...homeSeo} />
      <main>
        <Hero
          stats={statsQuery.data} loadingStats={statsQuery.isLoading} errorStats={statsQuery.error}
          statsFil={statsFilQuery.data} loadingStatsFil={statsFilQuery.isLoading} errorStatsFill={statsFilQuery.error}
          offers={offersQuery.data?.slice(0, 4)} loadingOffers={offersQuery.isLoading} errorOffers={offersQuery.error}
        />
        <HowItWorks
          sourcesAct={statsFilQuery.data?.filter(f => f.new_offers > 0).length ?? 0}
        />
        <RecentOffers
          stats={statsQuery.data} loadingStats={statsQuery.isLoading} errorStats={statsQuery.error}
          statsFil={statsFilQuery.data} loadingStatsFil={statsFilQuery.isLoading} errorStatsFill={statsFilQuery.error}
          offers={offersQuery.data?.slice(0, 4)} loadingOffers={offersQuery.isLoading} errorOffers={offersQuery.error}
        />
        <FaqSection
          eyebrow="FAQ"
          title="Vos questions, nos réponses."
          sub="Le fonctionnement de JobAlert CI, expliqué sans jargon. Et si quelque chose manque, on vous répond."
          questions={QUESTIONS}
          separated={false}
          aside={{
            icon: MessageCircleQuestion,
            title: "Vous ne trouvez pas votre réponse ?",
            text: "Écrivez-nous via le formulaire de contact — réponse en moins de 24 h ouvrées.",
            to: "/contact",
            cta: "Poser ma question",
          }}
        />
        <Testimonials />
      </main>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Les Componsants principales                                       */
/* ------------------------------------------------------------------ */

// Constantes extraites pour lisibilité
const SCRAPE_TIME = "6h02"
const EMAIL_DELIVERY_TIME = "8h00"
const MAX_PREVIEW_OFFERS = 4

const Hero = ({
  stats, loadingStats, errorStats,
  statsFil, loadingStatsFil, errorStatsFill,
  offers, loadingOffers, errorOffers
}) => {
  // ═══ Calculs dérivés ═══════════════════════════════════════════════
  const hasValidOffers = !errorOffers && offers?.length > 0
  const displayOffers = hasValidOffers ? offers.slice(0, MAX_PREVIEW_OFFERS) : JOBS_APERCU.slice(0, MAX_PREVIEW_OFFERS)

  const newOffersCount = stats?.new_offers ?? 0
  const filieresCount = statsFil?.length ?? 0
  const activeSourcesCount = statsFil?.filter(f => f.new_offers > 0).length ?? 0

  const remainingOffers = Math.max(0, newOffersCount - MAX_PREVIEW_OFFERS)
  const showRemainingBadge = remainingOffers > 0

  // ═══ Bandeau statistiques dynamique ═════════════════════════════════
  const statsLoading = loadingStats || loadingStatsFil
  const statsError = errorStats || errorStatsFill

  const STATS = [
    {
      value: statsLoading || statsError ? 0 : newOffersCount,
      suffix: "",
      label: "offres collectées ce matin"
    },
    {
      value: statsLoading || statsError ? 0 : activeSourcesCount,
      suffix: "",
      label: "sources scannées à 6h00"
    },
    {
      value: statsLoading || statsError ? 0 : filieresCount,
      suffix: "",
      label: "filières métiers couvertes"
    },
    {
      value: 8,
      suffix: "h00",
      label: "envoi quotidien garanti"
    },
  ]

  return (
    <section className="relative overflow-hidden hero-gradient">
      {/* Fonds décoratifs */}
      <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,166,35,0.10),transparent_50%)]"
        aria-hidden
      />
      <div className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/4 blur-3xl" aria-hidden />

      <div className="relative z-10 mx-auto md:max-w-7xl px-4 pb-16 pt-8 md:px-12 md:pb-20 lg:pt-10">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
          {/* ═══ Colonne gauche ═══════════════════════════════════════════ */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-start gap-5"
          >
            {/* Badge statut collecte */}
            {!loadingStats && (
              <motion.div variants={fadeUp}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-default items-center gap-2.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 py-1.5 pl-2.5 pr-4 text-xs font-semibold text-emerald-700">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                      </span>
                      Collecte terminée · {newOffersCount} offre{newOffersCount !== 1 && "s"} à {SCRAPE_TIME}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-62.5 text-center">
                    Nos scrapers analysent les sources chaque matin. Votre récapitulatif part à {EMAIL_DELIVERY_TIME}.
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            )}

            {/* Titre principal */}
            <motion.h1
              variants={fadeUp}
              className="font-heading text-4xl font-black leading-[1.06] tracking-tight text-brand-navy sm:text-5xl xl:text-6xl"
            >
              Ne cherchez plus votre emploi.{" "}
              <span className="relative whitespace-nowrap text-brand-orange">
                Il vient à vous
                <svg
                  className="absolute -bottom-1.5 left-0 w-full"
                  viewBox="0 0 200 9"
                  fill="none"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <motion.path
                    d="M2 6.5C60 2.5 140 2.5 198 6.5"
                    stroke="#F5A623"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    whileInView={{ pathLength: 1, opacity: 0.85 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.94, ease: "easeOut", delay: 0.5 }}
                  />
                </svg>
              </span>
              .
            </motion.h1>

            {/* Sous-titre */}
            <motion.p variants={fadeUp} className="max-w-xl md:text-lg leading-relaxed text-on-surface-variant">
              Chaque matin à <strong className="font-semibold text-brand-navy">{EMAIL_DELIVERY_TIME}</strong>,
              recevez par email les meilleures offres d'emploi de Côte d'Ivoire, filtrées selon votre métier.{" "}
              <strong className="font-semibold text-brand-navy">
                {loadingStatsFil ? "Plusieurs" : filieresCount} filière{filieresCount !== 1 && "s"}
              </strong>{" "}
              scannée{filieresCount !== 1 && "s"}, un seul email, zéro doublon.
            </motion.p>

            {/* Appels à l'action */}
            <motion.div variants={fadeUp} className="mt-1 flex flex-col gap-3 sm:flex-row">
              <CtaLink to="/inscription" icon={Bell} animateIcon>
                Créer mon alerte gratuite
              </CtaLink>
              <CtaLink to="/offres" variant="secondary" iconRight={ArrowRight}>
                Voir les offres du jour
              </CtaLink>
            </motion.div>

            {/* Réassurances */}
            <motion.ul variants={fadeUp} className="flex flex-wrap gap-x-5 gap-y-2" role="list">
              {REASSURANCES.map((item) => (
                <li key={item} className="flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
                  <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500/10">
                    <Check className="size-2.5 text-emerald-600" strokeWidth={3} aria-hidden />
                  </span>
                  {item}
                </li>
              ))}
            </motion.ul>
          </motion.div>

          {/* ═══ Colonne droite — Carte email ═══════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: 36, rotate: 1.5 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-md min-w-0 md:max-w-none"
          >
            {/* Halo décoratif */}
            <div className="absolute -inset-8 rounded-full bg-brand-orange/10 blur-3xl" aria-hidden />
            <div className="absolute inset-0 translate-x-4 translate-y-5 rotate-2 overflow-hidden rounded-2xl bg-brand-navy" aria-hidden>
              <div className="absolute inset-0 bg-pattern opacity-20" />
            </div>

            {/* Chip "8h00" */}
            <motion.span
              {...chipFloat(0.9, 4.5)}
              className="absolute -top-4 left-4 z-20 inline-flex -rotate-3 items-center gap-1.5 rounded-full bg-brand-orange px-3.5 py-1.5 text-[11px] font-bold text-white shadow-lg sm:-left-5"
            >
              <Clock className="size-3" aria-hidden />
              Envoyé à {EMAIL_DELIVERY_TIME} pile
            </motion.span>

            {/* Chip "sources actives" */}
            <motion.span
              {...chipFloat(1.1, 5.2)}
              className="absolute -right-2 top-1/4 z-20 inline-flex rotate-3 items-center gap-1.5 rounded-full bg-brand-navy px-3.5 py-1.5 text-[11px] font-bold text-white shadow-lg sm:-right-5"
            >
              <Radar className="size-3 text-brand-orange" aria-hidden />
              {loadingStatsFil ? "Sources" : `${activeSourcesCount} source${activeSourcesCount !== 1 && "s"}`} · {SCRAPE_TIME}
            </motion.span>

            {/* Chip "0 doublon" */}
            <motion.span
              {...chipFloat(1.3, 4.8)}
              className="absolute -bottom-4 right-8 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3.5 py-1.5 text-[11px] font-bold text-on-surface shadow-hover"
            >
              <BadgeCheck className="size-3.5 text-emerald-500" aria-hidden />
              0 doublon envoyé
            </motion.span>

            {/* Carte email */}
            <div className="relative overflow-hidden rounded-2xl border border-outline-variant/40 bg-white shadow-[0_24px_48px_-16px_rgba(15,45,77,0.22)]">
              {/* En-tête email */}
              <div className="flex items-center gap-3 border-b border-outline-variant/40 bg-surface-container-low/60 px-5 py-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-transparent font-heading text-[11px] font-black text-white">
                  <img src="/logo2.svg" alt="JobAlert CI" className="size-6" loading="lazy" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-on-surface">
                    JobAlert CI{" "}
                    <span className="font-medium text-muted-foreground">&lt;bonjour@jobalert.ci&gt;</span>
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Objet : Votre récapitulatif du jour
                    {!loadingStats && newOffersCount > 0 && ` (${newOffersCount} offre${newOffersCount !== 1 && "s"})`}
                  </p>
                </div>
                <time className="shrink-0 text-[11px] font-semibold text-muted-foreground" dateTime="08:00">
                  08:00
                </time>
              </div>

              {/* Corps email */}
              <div className="px-5 py-4">
                <p className="text-sm text-on-surface-variant">Bonjour 👋</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  <strong className="font-semibold text-on-surface">
                    {loadingStats ? "Plusieurs" : newOffersCount} {newOffersCount !== 1 ? "nouvelles offres" : "nouvelle offre"}
                  </strong>{" "}
                  correspondent à vos filières :
                </p>

                <ul className="mt-3 space-y-2" role="list">
                  {loadingOffers ? (
                    Array.from({ length: MAX_PREVIEW_OFFERS }).map((_, i) => (
                      <li key={i} className="rounded-lg border border-outline-variant/40 bg-white px-3.5 py-2.5">
                        <div className="flex items-center gap-3">
                          <Skeleton className="size-2 shrink-0 rounded-full" />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <Skeleton className="h-3.5 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                        </div>
                      </li>
                    ))
                  ) : (
                    displayOffers.map((offer, index) => (
                      <motion.li
                        key={offer.id ?? index}
                        initial={{ opacity: 0, x: -14 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.75 + index * 0.14, duration: 0.4, ease: "easeOut" }}
                        className="group flex items-center gap-3 rounded-lg border border-outline-variant/40 bg-white px-3.5 py-2.5 transition-all duration-200 hover:border-brand-orange/60 hover:shadow-soft"
                      >
                        <span
                          className={cn("size-2 shrink-0 rounded-full", HUES[offer.primary_filiere?.hue ?? "sky"]?.dot)} aria-hidden
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-on-surface">
                            {offer.title}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {offer.company?.name || "Entreprise"}
                          </p>
                        </div>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="shrink-0 gap-1 rounded-full border-outline-variant/60 bg-surface-container-low/60 px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant"
                            >
                              <img
                                src={getImgSource(offer.source?.code || offer.source?.name)}
                                alt={offer.source?.name || "Source"}
                                className="size-8 object-contain"
                                loading="lazy"
                              />
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Collectée sur {offer.source?.name || "source partenaire"} à {SCRAPE_TIME}
                          </TooltipContent>
                        </Tooltip>
                      </motion.li>
                    ))
                  )}
                </ul>

                {/* Pied de liste */}
                <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-surface-container-low px-3.5 py-2.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {showRemainingBadge && `+ ${remainingOffers} autre${remainingOffers !== 1 && "s"} offre${remainingOffers !== 1 && "s"} dans votre email`}
                  </span>
                  <Link
                    to="inscription"
                    type="button"
                    className="shrink-0 rounded-md bg-brand-navy px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-brand-navy/90"
                  >
                    Ouvrir le récap'
                  </Link>
                </div>
              </div>

              {/* Pied email */}
              <footer className="flex items-center gap-2 border-t border-outline-variant/40 bg-surface-container-low/40 px-5 py-2.5 text-[10px] font-medium text-muted-foreground">
                <button
                  type="button"
                  className="transition-colors hover:text-on-surface-variant hover:underline"
                >
                  Gérer mes filières
                </button>
                <span className="text-outline-variant" aria-hidden>·</span>
                <button
                  type="button"
                  className="transition-colors hover:text-on-surface-variant hover:underline"
                >
                  Me désinscrire en 1 clic
                </button>
              </footer>
            </div>
          </motion.div>
        </div>

        {/* ═══ Bandeau statistiques ════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-outline-variant/50 pt-8 md:grid-cols-4"
          role="list"
        >
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1.5" role="listitem">
              <span className="h-1 w-8 rounded-full bg-brand-orange/70" aria-hidden />
              <p className="font-heading text-3xl font-black text-brand-navy md:text-4xl">
                <CountUp to={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

const HowItWorks = ({ sourcesAct }) => {
  const timelineRef = useRef(null)

  /* Progression du rail mobile : liée au scroll à travers la timeline */
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start 0.85", "end 0.6"],
  })
  const railMobile = useSpring(scrollYProgress, { stiffness: 110, damping: 28, restDelta: 0.001 })

  const STEPS = [
    {
      time: "06h00",
      icon: Radar,
      title: "Collecte",
      text: `Nos ${sourcesAct > 0 ? sourcesAct : "differents"} scrapers parcourent les sites partenaires à la recherche des dernières publications.`,
      chip: "4 sources scannées",
    },
    {
      time: "06h15",
      icon: Fingerprint,
      title: "Dédoublonnage",
      text: "Chaque offre reçoit une empreinte unique calculée depuis son lien. Une offre déjà vue est ignorée, pour toujours.",
      chip: "0 doublon envoyé",
    },
    {
      time: "07h00",
      icon: SlidersHorizontal,
      title: "Filtrage",
      text: "Les nouvelles offres sont croisées avec les 1 à 3 filières métiers que vous avez choisies à l'inscription.",
      chip: "100 % pertinent",
    },
    {
      time: "08h00",
      icon: Send,
      title: "Votre récapitulatif",
      text: "Un seul email, vos offres, vos liens. Vous postulez pendant que les autres commencent à peine à chercher.",
      chip: "1 email par jour",
      highlight: true,
    },
  ]

  return (
    <section className="relative overflow-hidden bg-surface-container-lowest py-20 md:py-24">
      <div className="pointer-events-none absolute inset-0 bg-pattern opacity-40" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-6 md:px-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="La chaîne quotidienne"
            title={
              <>
                Pendant que vous dormez, votre récap{" "}
                <span className="text-brand-orange">se prépare tout seul</span>.
              </>
            }
            sub="Chaque matin, la même chaîne s'exécute sans intervention humaine entre 6h00 et 8h00. Voici ce qui se passe pendant ce temps."
          />
          <span className="hidden items-center gap-2 rounded-full border border-outline-variant/50 bg-white px-4 py-2 text-xs font-semibold text-on-surface-variant md:inline-flex">
            <Clock className="size-3.5 text-brand-orange" />
            100 % automatique / 0 action de votre part
          </span>
        </div>

        {/* Timeline */}
        <div ref={timelineRef} className="relative mt-12 lg:mt-16">
          {/* Rail vertical fond (mobile) */}
          <div className="absolute bottom-8 left-6.75 top-8 w-0.5 bg-outline-variant/40 lg:hidden" aria-hidden />
          {/* Rail vertical remplissage (mobile) — suit le scroll */}
          <motion.div
            style={{ scaleY: railMobile }}
            className="absolute bottom-8 left-6.75 top-8 w-0.5 origin-top bg-brand-orange lg:hidden"
            aria-hidden
          />

          {/* Rail horizontal fond (desktop) */}
          <div className="absolute left-0 right-0 top-7 hidden h-0.5 bg-outline-variant/40 lg:block" aria-hidden />
          {/* Rail horizontal remplissage (desktop) — se dessine à l'arrivée */}
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            className="absolute left-0 right-0 top-7 hidden h-0.5 origin-left bg-brand-orange lg:block"
            aria-hidden
          />

          <div className="grid lg:grid-cols-4 lg:gap-8">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.time}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex gap-5 lg:flex-col lg:gap-0"
              >
                {/* Nœud */}
                <div className="relative z-10 shrink-0 lg:mb-6">
                  <span
                    className={cn(
                      "flex size-14 items-center justify-center rounded-full border-2 bg-white",
                      s.highlight
                        ? "border-brand-orange bg-brand-orange text-white shadow-[0_8px_20px_rgba(245,166,35,0.35)]"
                        : "border-outline-variant/60 text-brand-navy"
                    )}
                  >
                    <s.icon className="size-6" strokeWidth={2} />
                  </span>
                </div>

                {/* Contenu */}
                <div className={cn("flex-1 pb-10 lg:pb-0", i === STEPS.length - 1 && "pb-0")}>
                  <div className={cn(s.highlight && "rounded-xl bg-brand-navy p-5 lg:p-6")}>
                    <p
                      className={cn(
                        "font-heading text-2xl font-black tracking-tight",
                        s.highlight ? "text-brand-orange" : "text-brand-navy"
                      )}
                    >
                      {s.time}
                    </p>
                    <h3
                      className={cn(
                        "mt-1 font-heading text-lg font-bold",
                        s.highlight ? "text-white" : "text-brand-navy"
                      )}
                    >
                      {s.title}
                    </h3>
                    <p
                      className={cn(
                        "mt-2 text-sm leading-relaxed",
                        s.highlight ? "text-white/70" : "text-on-surface-variant"
                      )}
                    >
                      {s.text}
                    </p>
                    <span
                      className={cn(
                        "mt-3.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                        s.highlight
                          ? "border-white/20 bg-white/10 text-white"
                          : "border-outline-variant/50 bg-surface-container-low/60 text-on-surface-variant"
                      )}
                    >
                      <Check
                        className={cn("size-3", s.highlight ? "text-brand-orange" : "text-emerald-600")}
                        strokeWidth={3}
                      />
                      {s.chip}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Chute */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-14 flex flex-col items-start justify-between gap-4 rounded-xl border border-outline-variant/50 bg-surface-container-low/60 px-6 py-5 sm:flex-row sm:items-center"
        >
          <p className="text-sm text-on-surface-variant">
            <strong className="font-semibold text-brand-navy">Et vous, pendant ce temps ?</strong> Rien.
            C'est exactement le but, l'information vient à vous, jamais l'inverse.
          </p>
          <Link
            to="/comment-ca-marche"
            className="group inline-flex shrink-0 items-center gap-2 text-sm font-bold text-brand-navy transition-colors hover:text-brand-orange"
          >
            Voir le fonctionnement en détail
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

const RecentOffers = ({
  stats, loadingStats, errorStats,
  statsFil, loadingStatsFil, errorStatsFill,
  offers, loadingOffers, errorOffers
}) => {
  return (
    <section className="border-y border-outline-variant/30 bg-background py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Collecte du jour · 6h02"
            title={
              <>
                Ce matin, <span className="text-brand-orange">47 offres</span> sont arrivées.
              </>
            }
            sub="Un aperçu de la collecte. Les autres vous attendent dans le récapitulatif de 8h00."
          />
          <Link
            to="/offres"
            className="group hidden items-center gap-2 rounded-md border border-brand-navy/15 bg-white px-5 py-3 text-sm font-bold text-brand-navy transition-all duration-300 hover:border-brand-navy/40 hover:shadow-soft md:inline-flex"
          >
            Voir les 47 offres
            <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Feed d'offres */}
          <div>
            <ul className="flex flex-col gap-2.5">
              {OFFRES.map((o, i) => (
                <FeedOffreCard key={o.id} offre={o} index={i} />
              ))}
            </ul>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-5 text-center md:hidden"
            >
              <Link
                to="/offres"
                className="inline-flex items-center gap-2 text-sm font-bold text-brand-navy transition-colors hover:text-brand-orange"
              >
                Voir les 47 offres du jour
                <ArrowRight className="size-4" />
              </Link>
            </motion.div>
          </div>

          {/* Répartition du jour */}
          <motion.aside
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex flex-col overflow-hidden rounded-xl bg-brand-navy p-6 text-white"
          >
            <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,166,35,0.16),transparent_55%)]"
              aria-hidden
            />

            <div className="relative flex flex-1 flex-col">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/90">
                <Zap className="size-3 text-brand-orange" />
                Run du jour · terminé
              </span>

              <p className="mt-5 font-heading text-5xl font-black leading-none">47</p>
              <p className="mt-1.5 text-sm text-white/70">nouvelles offres ce matin, réparties ainsi :</p>

              <div className="mt-6 space-y-3.5">
                {REPARTITION.map((b, i) => (
                  <div key={b.label}>
                    <div className="flex items-baseline justify-between text-[11px] font-semibold">
                      <span className="text-white/80">{b.label}</span>
                      <span className="text-white/50">{b.count}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${b.pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.9, delay: 0.3 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                        className={cn("h-full rounded-full", b.color)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-6 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-white/50">
                Vous ne recevez que vos filières. Jamais le reste.
              </p>

              <CtaLink to="/inscription" size="md" icon={Bell} animateIcon className="mt-4 w-full">
                Recevoir ma sélection à 8h00
              </CtaLink>
            </div>
          </motion.aside>
        </div>
      </div>
    </section>
  )
}

/* ── Section ────────────────────────────────────────────────────────── */
const Testimonials = () => (
  <section className="overflow-hidden border-t border-outline-variant/30 bg-background py-20 md:py-24">
    <div className="mx-auto max-w-7xl px-6 md:px-12">
      <SectionHeading
        eyebrow="Témoignages"
        title={
          <>
            Ils ont arrêté de chercher. <span className="text-brand-orange">Ils ont été trouvés.</span>
          </>
        }
        sub="Le push, ça marche : voici ce que racontent ceux qui reçoivent leur récap chaque matin."
      />
    </div>

    {/* Carrousel infini — défilement de gauche à droite */}
    <div className="group relative mt-12" role="region" aria-label="Témoignages d'abonnés">
      {/* Voiles / ombres latérales */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-linear-to-r from-background via-background/80 to-transparent sm:w-28 lg:w-40"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-linear-to-l from-background via-background/80 to-transparent sm:w-28 lg:w-40"
        aria-hidden
      />

      <div className="overflow-hidden">
        {/* Piste dupliquée : le décalage de -50 % → 0 boucle sans couture */}
        <div className="flex w-max will-change-transform motion-safe:animate-marquee group-hover:paused">
          {[0, 1].map((copie) => (
            <div key={copie} className="flex shrink-0 gap-5 pr-5" aria-hidden={copie === 1}>
              {TEMOIGNAGES.map((t) => (
                <TemoignageCard key={`${copie}-${t.nom}`} t={t} variant={t.vedette ? "vedette" : "standard"} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Pied de section */}
    <div className="mx-auto mt-10 flex max-w-7xl flex-col items-center justify-center gap-2.5 px-6 text-center sm:flex-row sm:gap-4">
      <p className="text-xs text-muted-foreground">Qu'est ce que vous attendez ?</p>
      <span className="hidden size-1 rounded-full bg-outline-variant sm:block" aria-hidden />
      <Link
        to="/inscription"
        className="group inline-flex items-center gap-1.5 text-sm font-bold text-brand-navy transition-colors hover:text-brand-orange"
      >
        Rejoindre les abonnés du récap
        <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
      </Link>
    </div>
  </section>
)

export default Home
