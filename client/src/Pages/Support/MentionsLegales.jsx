
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  Check, ChevronRight, Fingerprint, Mail, Scale,
  ShieldCheck, Sparkles, UserX,
} from "lucide-react"
import Seo from "@/components/seo/Seo"
import { CtaLink, Sommaire } from "@/components/shared"
import { mentionsLegalesSeo } from "@/lib/seo"

/* ════════════════════════════════════════════════════════════════════
DONNÉES — v2.0 : table pages_contenu (type = page_statique)
════════════════════════════════════════════════════════════════════ */
const ENGAGEMENTS = [
  { icon: UserX, label: "Email jamais revendu" },
  { icon: ShieldCheck, label: "Aucun mot de passe stocké" },
  { icon: Check, label: "Désinscription en 1 clic" },
  { icon: Fingerprint, label: "Données minimales collectées" },
]

const SECTIONS_LEGALES = [
  {
    id: "editeur", num: "01", titre: "Éditeur du site",
    plain: "JobAlert CI est un service de veille emploi édité depuis la Côte d'Ivoire.",
    paragraphes: [
      "Le site jobalert.ci est édité par JobAlert CI, service de veille automatisée du marché de l'emploi ivoirien, dont le siège est situé à Abidjan, Côte d'Ivoire.",
      "Directeur de la publication : l'équipe fondatrice de JobAlert CI. Contact : bonjour@jobalert.ci.",
    ],
  },
  {
    id: "objet", num: "02", titre: "Objet du service",
    plain: "Nous agrégeons les offres de 4 sources pour vous les envoyer par email, chaque matin à 8h00.",
    paragraphes: [
      "JobAlert CI centralise automatiquement les offres d'emploi publiées sur des plateformes tierces (EmploiDakar CI, GoAfrica, Novojob, LinkedIn), les déduplique, les filtre selon les filières choisies par l'utilisateur, puis les transmet sous forme de récapitulatif quotidien par email.",
      "Le service est fourni « en l'état », à titre gratuit, sans garantie d'exhaustivité ni d'adéquation à un besoin particulier. Les offres restent la propriété de leurs sites d'origine.",
    ],
  },
  {
    id: "donnees", num: "03", titre: "Données personnelles",
    plain: "Nous ne collectons que votre email (et votre nom, facultatif). Rien d'autre.",
    paragraphes: [
      "Données collectées : adresse email (obligatoire, identifiant unique du compte), nom (facultatif), filières choisies (1 à 3), date d'inscription et statut (actif / désinscrit).",
      "Finalité unique : l'envoi du récapitulatif quotidien d'offres d'emploi. Vos données ne sont ni partagées, ni revendues, ni exploitées à d'autres fins.",
      "Durée de conservation : tant que votre compte est actif. En cas de désinscription, votre statut est marqué « désinscrit » et vos données sont conservées à des fins de traçabilité technique pendant une durée maximale de 12 mois, puis supprimées.",
      "Conformément à la réglementation applicable, vous disposez d'un droit d'accès, de rectification et de suppression de vos données, à exercer en écrivant à bonjour@jobalert.ci.",
    ],
  },
  {
    id: "securite", num: "04", titre: "Sécurité",
    plain: "Identifiants d'envoi en variables d'environnement, jamais dans le code.",
    paragraphes: [
      "Les identifiants du compte SMTP utilisé pour l'envoi des emails sont stockés exclusivement dans des variables d'environnement et ne figurent jamais dans le code source.",
      "Aucun mot de passe utilisateur n'est collecté ni stocké : l'inscription et la désinscription fonctionnent par lien unique, ce qui réduit d'autant les risques de fuite.",
    ],
  },
  {
    id: "cookies", num: "05", titre: "Cookies & traceurs",
    plain: "Aucun cookie publicitaire. Uniquement des traceurs techniques strictement nécessaires.",
    paragraphes: [
      "JobAlert CI n'utilise aucun cookie publicitaire ni traceur tiers à des fins de profilage. Seuls des traceurs techniques strictement nécessaires au fonctionnement du site peuvent être déposés.",
      "Les emails envoyés ne contiennent aucun pixel de suivi individuel au-delà des statistiques techniques d'envoi (succès / échec), journalisées de façon agrégée.",
    ],
  },
  {
    id: "propriete", num: "06", titre: "Propriété intellectuelle",
    plain: "Notre marque et notre code nous appartiennent ; les offres appartiennent à leurs sources.",
    paragraphes: [
      "La marque JobAlert CI, le design du site, les textes originaux et le code source sont la propriété exclusive de JobAlert CI. Toute reproduction non autorisée est interdite.",
      "Les offres d'emploi affichées proviennent de sources tierces et restent soumises aux conditions d'utilisation de leurs sites d'origine. JobAlert CI agit comme un agrégateur et ne revendique aucun droit sur leur contenu.",
    ],
  },
  {
    id: "responsabilite", num: "07", titre: "Responsabilité",
    plain: "Nous relayons des offres : nous ne sommes pas l'employeur et ne garantissons pas leur exactitude.",
    paragraphes: [
      "JobAlert CI est un intermédiaire technique : le service ne vérifie pas l'exactitude, la licéité ou la disponibilité des offres relayées, et ne saurait être tenu responsable de leur contenu.",
      "Toute candidature est conclue directement entre le candidat et le recruteur, sous leur seule responsabilité. En cas de doute sur une offre, contactez directement la source indiquée.",
      "Le service peut être interrompu temporairement pour maintenance ou en cas de défaillance d'une source, sans que cela n'ouvre droit à indemnisation.",
    ],
  },
  {
    id: "modifications", num: "08", titre: "Modifications & contact",
    plain: "Cette page peut évoluer ; la date de mise à jour fait foi.",
    paragraphes: [
      "JobAlert CI se réserve le droit de modifier les présentes mentions à tout moment. La date de dernière mise à jour, indiquée en tête de page, fait foi.",
      "Pour toute question relative à vos données ou aux présentes mentions : bonjour@jobalert.ci.",
    ],
  },
]

/* ════════════════════════════════════════════════════════════════════
EN-TÊTE — les engagements d'abord
════════════════════════════════════════════════════════════════════ */
const EnTeteMentions = () => (
  <section className="relative overflow-hidden hero-gradient">
    <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
    <div className="absolute -top-32 right-[-10%] size-140 rounded-full bg-brand-orange/8 blur-3xl" aria-hidden />

    <div className="relative z-10 mx-auto max-w-4xl px-6 pb-14 pt-8 md:px-12 md:pb-16 md:pt-10">
      <motion.nav
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
        aria-label="Fil d'Ariane"
      >
        <Link to="/" className="transition-colors hover:text-brand-navy">Accueil</Link>
        <ChevronRight className="size-3" />
        <span className="font-semibold text-brand-navy">Mentions légales</span>
      </motion.nav>

      <motion.div
        initial="hidden" animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } } }}
        className="mt-8 flex flex-col items-start gap-5"
      >
        <motion.span
          variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
          className="inline-flex items-center gap-2 rounded-full border border-outline-variant/50 bg-card/80 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant"
        >
          <Scale className="size-3 text-brand-orange" />
          Dernière mise à jour : 28 juillet 2026
        </motion.span>

        <motion.h1
          variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
          className="font-heading text-4xl font-black leading-[1.06] tracking-tight text-brand-navy sm:text-5xl"
        >
          Vos données,{" "}
          <span className="relative whitespace-nowrap text-brand-orange">
            nos engagements
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
          className="max-w-2xl text-lg leading-relaxed text-on-surface-variant"
        >
          Le droit, en clair. Chaque section ci-dessous commence par un résumé en une phrase,
          suivi du texte complet. Parce que la confiance se lit avant de se signer.
        </motion.p>

        <motion.div
          variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
          className="flex flex-wrap gap-2"
        >
          {ENGAGEMENTS.map((e) => (
            <span key={e.label} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
              <e.icon className="size-3" />
              {e.label}
            </span>
          ))}
        </motion.div>
      </motion.div>
    </div>
  </section>
)

/* ════════════════════════════════════════════════════════════════════
CORPS — sommaire + sections « en clair » puis texte complet
════════════════════════════════════════════════════════════════════ */
const CorpsMentions = () => (
  <section className="border-t border-outline-variant/30 bg-background py-16 md:py-20">
    <div className="mx-auto grid max-w-7xl gap-10 px-6 md:px-12 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-28">
          <Sommaire sections={SECTIONS_LEGALES.map((s) => ({ id: s.id, titre: s.titre }))} />
        </div>
      </aside>

      <div className="space-y-14">
        {SECTIONS_LEGALES.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-28">
            <motion.div
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="flex items-baseline gap-3 font-heading text-2xl font-extrabold tracking-tight text-brand-navy">
                <span className="text-sm font-black text-brand-orange">{s.num}</span>
                {s.titre}
              </h2>

              {/* Résumé en clair */}
              <div className="mt-4 rounded-xl border-l-4 border-brand-orange bg-brand-orange/5 p-5">
                <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-orange">
                  <Sparkles className="size-3.5" />
                  En clair
                </p>
                <p className="mt-2 text-[15px] font-semibold leading-relaxed text-brand-navy">{s.plain}</p>
              </div>

              {/* Texte complet */}
              <div className="mt-5 space-y-4">
                {s.paragraphes.map((p) => (
                  <p key={p} className="text-[15px] leading-relaxed text-on-surface-variant">{p}</p>
                ))}
              </div>
            </motion.div>
          </section>
        ))}

        {/* Contact */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-xl bg-brand-navy p-7 text-white"
        >
          <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />
          <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-brand-orange/15 blur-3xl" aria-hidden />
          <div className="relative flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-orange">
                <Mail className="size-3.5" />
                Une question sur vos données ?
              </p>
              <h3 className="mt-2 font-heading text-xl font-extrabold">
                Écrivez-nous, on répond en moins de 24 h.
              </h3>
              <p className="mt-1.5 text-sm text-white/70">bonjour@jobalert.ci · exercice de vos droits, désinscription, toute demande.</p>
            </div>
            <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
              <CtaLink to="/contact" size="md" iconRight={ChevronRight}>Nous contacter</CtaLink>
              <CtaLink to="/faq" size="md" className="border border-white/20 bg-card/10 shadow-none hover:bg-card/20 hover:brightness-100">
                Voir la FAQ
              </CtaLink>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
)

/* ════════════════════════════════════════════════════════════════════
PAGE
════════════════════════════════════════════════════════════════════ */
const MentionsLegales = () => (
  <>
    <Seo {...mentionsLegalesSeo()} />
    <main>
      <EnTeteMentions />
      <CorpsMentions />
    </main>
  </>
)

export default MentionsLegales
