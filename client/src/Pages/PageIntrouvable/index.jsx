import { Link } from "react-router-dom"
import { Compass, FileQuestion, Home, Briefcase, Newspaper } from "lucide-react"
import Seo from "@/components/seo/Seo"
import CtaLink from "@/components/shared/CtaLink"

/* Liens de reprise : les destinations les plus probables depuis une URL cassée. */
const PISTES = [
  { to: "/offres", label: "Offres d'emploi", desc: "Les offres collectées ce matin", icon: Briefcase },
  { to: "/filieres", label: "Filières métiers", desc: "13 filières couvertes en CI", icon: Compass },
  { to: "/conseils", label: "Conseils emploi", desc: "CV, entretiens, salaires", icon: Newspaper },
]

/**
 * Page 404 du site public.
 * Rendue pour toute URL inconnue (route "*") — noindex pour éviter
 * l'indexation de soft-404 par les moteurs (cf. Audit.md P0-1).
 */
const PageIntrouvable = () => (
  <>
    <Seo
      title="Page introuvable | JobAlert CI"
      description="Cette page n'existe pas ou plus. Retrouvez les offres d'emploi en Côte d'Ivoire sur JobAlert CI."
      path="/404"
      noindex
    />
    <main className="relative overflow-hidden">
      {/* Arrière-plan décoratif, même vocabulaire visuel que /inscription */}
      <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
      <div className="absolute -top-32 right-[-10%] size-140 rounded-full bg-brand-orange/8 blur-3xl" aria-hidden />
      <div className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/5 blur-3xl" aria-hidden />

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-20 text-center md:py-28">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl border border-outline-variant/50 bg-card shadow-soft">
          <FileQuestion className="size-8 text-brand-orange" aria-hidden />
        </span>

        <p className="mt-8 font-heading text-sm font-bold uppercase tracking-widest text-brand-orange">
          Erreur 404
        </p>
        <h1 className="mt-3 font-heading text-4xl font-extrabold leading-tight text-brand-navy sm:text-5xl">
          Cette page est introuvable
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
          Le lien est peut-être erroné, ou la page a été déplacée. Les offres,
          elles, sont bien là — mises à jour chaque matin à 08h00.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <CtaLink to="/" variant="primary" size="lg" icon={Home}>
            Retour à l'accueil
          </CtaLink>
          <CtaLink to="/offres" variant="outline" size="lg">
            Voir les offres du jour
          </CtaLink>
        </div>

        {/* Reprise rapide par thématique */}
        <ul className="mt-14 grid gap-3 text-left sm:grid-cols-3">
          {PISTES.map(({ to, label, desc, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="group flex h-full flex-col gap-2 rounded-xl border border-outline-variant/40 bg-card p-4 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-navy/30 hover:shadow-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="size-5 text-brand-navy transition-colors group-hover:text-brand-orange" aria-hidden />
                <span className="font-heading text-sm font-bold text-brand-navy group-hover:text-brand-orange">
                  {label}
                </span>
                <span className="text-xs text-muted-foreground">{desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  </>
)

export default PageIntrouvable
