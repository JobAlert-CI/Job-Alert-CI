import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  BadgeCheck, Bell, Check, ChevronRight, Clock, Mail, Radar,
} from "lucide-react"
import { SiFacebook, SiInstagram, SiX } from "@icons-pack/react-simple-icons"
import { FaLinkedin } from "react-icons/fa6"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { useNavigationData } from "@/lib/navigation-data"
import { HUES } from "@/lib/hues"
import { SourceLogo } from "../shared"

/* ------------------------------------------------------------------ */
/*  Données                                                            */
/* ------------------------------------------------------------------ */

const NAV_FOOTER = [
  { label: "Accueil", to: "/" },
  { label: "Comment ça marche", to: "/comment-ca-marche" },
  { label: "Offres d'emploi", to: "/offres" },
  { label: "Tous les filieres", to: "/filieres" },
  { label: "Conseils carrière", to: "/conseils" },
  { label: "Sources partenaires", to: "/sources" },
  { label: "Actualités", to: "/actualites" },
]

const SUPPORT_FOOTER = [
  { label: "FAQ", to: "/faq" },
  { label: "Contact", to: "/contact" },
  { label: "Mentions légales", to: "/mentions-legales" },
]

const socialsLinks = [
  { label: "LinkedIn", icon: FaLinkedin, color: "hover:bg-blue-600/20 hover:text-blue-500 hover:border-blue-500/50", link: "https://linkedin.com" },
  { label: "Facebook", icon: SiFacebook, color: "hover:bg-blue-600/20 hover:text-blue-500 hover:border-blue-500/50", link: "https://facebook.com" },
  { label: "Instagram", icon: SiInstagram, color: "hover:bg-pink-600/20 hover:text-pink-500 hover:border-pink-500/50", link: "https://instagram.com" },
  { label: "X", icon: SiX, color: "hover:bg-slate-900 hover:text-white hover:border-white/30", link: "https://x.com" },
];

/* ------------------------------------------------------------------ */
/*  Sous-composants                                                    */
/* ------------------------------------------------------------------ */

const SocialLink = ({ social }) => {
  const Icon = social.icon;
  return (
    <motion.a
      href={social.link}
      aria-label={`Suivre JobAlert CI sur ${social.label}`}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ y: -4, scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`w-10 h-10 rounded-xl bg-white/5 border border-slate-800 flex items-center justify-center transition-colors duration-300 shadow-md text-slate-400 ${social.color}`}
    >
      <Icon className="w-4 h-4 transition-colors" />
    </motion.a>
  );
};

const FooterHeading = ({ children }) => (
  <h4 className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">
    {children}
  </h4>
)

const FooterLink = ({ to, children }) => (
  <li>
    <Link
      to={to}
      className="group inline-flex items-center text-sm font-medium text-white/65 transition-colors duration-200 hover:text-brand-orange"
    >
      <ChevronRight className="w-0 shrink-0 -translate-x-1 text-brand-orange opacity-0 transition-all duration-200 group-hover:w-3.5 group-hover:translate-x-0 group-hover:opacity-100" />
      {children}
    </Link>
  </li>
)

/* ------------------------------------------------------------------ */
/*  Footer                                                             */
/* ------------------------------------------------------------------ */

const Footer = () => {
  const [email, setEmail] = useState("")
  const navigate = useNavigate()

  /* ═══ Données réelles depuis le backend ═══ */
  const {
    filieres,
    filieresPopulaires,
    nouveauxCeMatin,
    sourcesList
  } = useNavigationData()

  const dateFr = (() => {
    const d = new Date().toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    })
    return d.charAt(0).toUpperCase() + d.slice(1)
  })()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!email.trim()) return
    navigate(`/inscription?email=${encodeURIComponent(email.trim())}`)
  }

  return (
    <footer className="relative overflow-hidden border-t-2 border-brand-orange bg-brand-navy text-white">
      {/* ═══ Bandeau d'alerte — le cœur du service ═══════════════════ */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-pattern opacity-[0.25]" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,166,35,0.14),transparent_55%)]"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -right-6 top-2 hidden select-none font-heading text-[10rem] font-black leading-none text-white/4 xl:block"
          aria-hidden
        >
          8H00
        </span>

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 py-14 md:px-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          {/* Colonne gauche : promesse + capture d'email */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-orange/30 bg-brand-orange/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-orange">
              <Clock className="size-3" />
              Récapitulatif quotidien · 8h00
            </span>

            <h2 className="mt-5 font-heading text-3xl font-extrabold leading-[1.12] text-white sm:text-4xl xl:text-[2.6rem]">
              Demain à 8h00, les offres de votre filière seront{" "}
              <span className="relative whitespace-nowrap text-brand-orange">
                dans votre boîte mail
                <motion.span
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                  className="absolute -bottom-1 left-0 h-1 w-full origin-left rounded-full bg-brand-orange/80"
                />
              </span>
              .
            </h2>

            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/65">
              Choisissez jusqu'à 3 filières, on s'occupe du reste : 4 sources scannées chaque matin,
              un seul email par jour, zéro doublon.
            </p>

            {/* Capture d'email */}
            <form onSubmit={handleSubmit} className="mt-7 flex  max-w-lg flex-col gap-2.5 sm:flex-row">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  aria-label="Votre adresse email"
                  className="h-12 w-full rounded-md border border-white/15 bg-white/10 pl-10 pr-4 text-sm text-white outline-none transition-all duration-300 placeholder:text-white/40 focus:border-brand-orange focus:bg-white/[0.14] focus:ring-2 focus:ring-brand-orange/30"
                />
              </div>
              <button
                type="submit"
                className="group inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-brand-orange px-5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(245,166,35,0.25)] transition-all duration-300 hover:brightness-110 hover:shadow-[0_10px_28px_rgba(245,166,35,0.4)] active:scale-[0.98]"
              >
                <Bell className="size-4 transition-transform duration-300 group-hover:rotate-12" />
                Créer mon alerte
              </button>
            </form>

            <p className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/50">
              {["Gratuit pour toujours", "1 email par jour à 8h00", "Désinscription en 1 clic", "0 doublon, 0 spam"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-400" />
                  {t}
                </span>
              ))}
            </p>
          </motion.div>

          {/* Colonne droite : aperçu animé du récapitulatif */}
          <motion.div
            initial={{ opacity: 0, y: 40, rotate: 2 }}
            whileInView={{ opacity: 1, y: 0, rotate: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative hidden lg:block"
          >
            <div className="absolute -inset-8 rounded-full bg-brand-orange/10 blur-3xl" aria-hidden />
            <div className="absolute inset-0 translate-x-4 translate-y-4 rotate-2 rounded-xl border border-white/10 bg-white/4" aria-hidden />
            <span className="absolute -left-4 -top-3 z-10 inline-flex -rotate-3 items-center gap-1.5 rounded-full bg-brand-orange px-3 py-1.5 text-[11px] font-bold text-white shadow-lg">
              <Clock className="size-3" />
              Envoyé à 8h00
            </span>
            <motion.div
              initial={{ y: 0 }}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="relative rounded-xl border border-white/10 bg-[#123252]/90 p-5 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.4)] backdrop-blur-sm will-change-transform"
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-md bg-brand-orange/15 text-brand-orange">
                    <Mail className="size-4" />
                  </span>
                  <div>
                    <p className="text-[13px] font-bold text-white">Votre récapitulatif du jour</p>
                    <p className="text-[11px] text-white/50">{dateFr} · 8h00</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                  {nouveauxCeMatin} offre{nouveauxCeMatin > 1 ? "s" : ""}
                </span>
              </div>
              <ul className="divide-y divide-white/[0.07]">
                {filieresPopulaires.length > 0 ? (
                  filieresPopulaires.slice(0, 4).map((f, i) => (
                    <motion.li
                      key={f.code}
                      initial={{ opacity: 0, x: -14 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: 0.35 + i * 0.12, ease: "easeOut" }}
                      className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors duration-200 hover:bg-white/5"
                    >
                      <span className="size-1.5 shrink-0 rounded-full bg-brand-orange" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-white">{f.label}</p>
                        <p className="truncate text-[11px] text-white/50">
                          {f.count} offre{f.count > 1 ? "s" : ""} active{f.count > 1 ? "s" : ""}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="shrink-0 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/60"
                      >
                        {f.nouveaux > 0 ? `+${f.nouveaux}` : "—"}
                      </Badge>
                    </motion.li>
                  ))
                ) : (
                  <li className="px-2 py-3 text-[11px] text-white/50">
                    Chargement des filières…
                  </li>
                )}
              </ul>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/45">
                <BadgeCheck className="size-3.5 text-emerald-400" />
                Dédoublonné automatiquement — 0 doublon envoyé
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══ Colonnes de liens ═══════════════════════════════════════ */}
      <div className="relative border-t border-white/10">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-6 pb-10 pt-14 sm:grid-cols-2 md:px-12 lg:grid-cols-12">
          {/* Marque */}
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-4 sm:col-span-2 lg:col-span-4"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-8 md:h-9 bg-white rounded-lg">
                <img src="/logo2.svg" alt="JobAlert CI" className="h-full w-auto object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="font-heading text-xl font-black leading-tight text-white">JobAlert CI</span>
                <small className="text-[10px] font-medium text-white/60">Trouvez votre prochain emploi</small>
              </div>
            </div>

            <p className="max-w-sm text-sm leading-relaxed text-white/65">
              Votre boussole vers l'emploi en Côte d'Ivoire. Chaque matin à 8h00, les offres de vos
              filières arrivent directement dans votre boîte mail sans rien à faire.
            </p>

            {/* Statut de la collecte */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex w-fit justify-center cursor-default items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Collecte du jour terminée · 6h02
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-57.5 text-center">
                Nos 4 sources sont scannées chaque matin à 6h00 — prochain envoi à 8h00.
              </TooltipContent>
            </Tooltip>

            {/* Réseaux sociaux */}
            <div className="flex gap-3">
              {socialsLinks.map((social, i) => (
                <SocialLink key={i} social={social} />
              ))}
            </div>
          </motion.div>

          {/* Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-3.5 lg:col-span-2"
          >
            <FooterHeading>Navigation</FooterHeading>
            <ul className="flex flex-col gap-2">
              {NAV_FOOTER.map((l) => (
                <FooterLink key={l.to} to={l.to}>
                  {l.label}
                </FooterLink>
              ))}
            </ul>
          </motion.div>

          {/* Filières populaires */}
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-3.5 lg:col-span-3"
          >
            <FooterHeading>Filières populaires</FooterHeading>
            <ul className="flex flex-col gap-2">
              {filieresPopulaires.map((f) => {
                const hue = HUES[f.hue] ?? HUES.sky
                return (
                  <li key={f.code}>
                    <Link
                      to={f.to}
                      className="group inline-flex items-center gap-2.5 text-sm font-medium text-white/65 transition-colors duration-200 hover:text-brand-orange"
                    >
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-[1.7]",
                          hue.dot
                        )}
                      />
                      {f.label}
                      <span className="ml-auto text-[10px] font-semibold text-white/40">
                        {f.count}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
            <Link
              to="/filieres"
              className="group mt-1 inline-flex w-fit items-center gap-1 text-sm font-semibold text-white/85 transition-colors duration-200 hover:text-brand-orange"
            >
              Voir les {filieres.length} filières
              <ChevronRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </motion.div>

          {/* Support & légal */}
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-3.5 lg:col-span-3"
          >
            <FooterHeading>Support & légal</FooterHeading>
            <ul className="flex flex-col gap-2">
              {SUPPORT_FOOTER.map((l) => (
                <FooterLink key={l.label} to={l.to}>
                  {l.label}
                </FooterLink>
              ))}
            </ul>
            <div className="mt-2 rounded-lg border border-white/10 bg-white/4 p-3.5">
              <p className="text-xs leading-relaxed text-white/55">
                Une question sur vos alertes ?{" "}
                <Link to="/faq" className="font-semibold text-brand-orange transition-colors hover:brightness-110">
                  Consultez la FAQ
                </Link>{" "}
                ou écrivez-nous via le formulaire de contact.
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═══ Barre basse ═════════════════════════════════════════════ */}
      <div className="relative border-t border-white/10 bg-[#0B2440]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 text-xs text-white/45 md:flex-row md:px-12">
          <p className="flex items-center gap-2">
            &copy; 2026 JobAlert CI
            <span className="size-1 rounded-full bg-outline-variant/20" />
            Tous droits réservés.
          </p>


          {/* APRÈS — liste des sources actives depuis l'API */}
          <p className="hidden items-center gap-2 lg:flex">
            <Radar className="size-3.5 text-brand-orange/70" />
            Offres collectées sur
            {sourcesList.length > 0 ? (
              sourcesList.map((s, i) => (
                <a
                  href={s.base_url}
                  key={s.code}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-semibold text-white/60 hover:text-brand-orange"
                >
                  <SourceLogo code={s.code} className="size-4 rounded-sm" />
                  {s.name}
                  {i < sourcesList.length - 1 && <span className="text-white/20">·</span>}
                </a>
              ))
            ) : (
              <span className="font-semibold text-white/60">nos sources partenaires</span>
            )}
          </p>

          <div className="flex items-center gap-4">
            <span className="hidden h-3 w-px bg-white/15 md:block" aria-hidden />
            <p className="flex items-center gap-2">
              Fait avec passion pour la Côte d'Ivoire
              <span className="flex items-end gap-0.75" aria-hidden>
                <span className="h-3 w-1 rounded-xs bg-[#FF8200]" />
                <span className="h-3 w-1 rounded-xs bg-white" />
                <span className="h-3 w-1 rounded-xs bg-[#009A44]" />
              </span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
