import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"

/* ─────────────────────────────────────────────────────────────────────
   HeroAdmin — bannière d'en-tête des pages d'administration.

   Refonte :
   • Fond blanc + motif de points discret (bg-pattern masqué) + double
     halo navy/orange très léger — de la profondeur sans surcharge.
   • Badge navy avec icône orange : contraste ≈ 6.9:1 (AA), alors que
     l'ancien "texte blanc sur badge par défaut" plafonnait à ≈ 2:1.
   • Garde-fous : Icon / titleBdge / description / children optionnels
     sans crash ni balise vide.
   • Animation d'entrée douce (désactivée automatiquement par
     <MotionConfig reducedMotion="user"> pour prefers-reduced-motion).
───────────────────────────────────────────────────────────────────── */
const HeroAdmin = ({
  title,
  titleBdge,
  icon: Icon,
  description,
  badges,
  children,
}) => (
  <motion.section
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    className="relative overflow-hidden rounded-xl border border-border bg-card p-6 text-brand-navy shadow-lg sm:p-8"
  >
    {/* Décor : motif de points estompé vers le bas + halos de marque. */}
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute -right-16 -top-24 size-64 rounded-full bg-brand-orange/10 blur-3xl" />
      <div className="absolute -bottom-28 -left-12 size-56 rounded-full bg-brand-navy/5 blur-3xl" />
    </div>

    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        {(titleBdge || badges) && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {titleBdge && (
              <Badge className="gap-1.5 border-transparent bg-brand-navy px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-navy">
                {Icon && <Icon className="size-3.5 text-brand-orange stroke-3" aria-hidden="true" />}
                {titleBdge}
              </Badge>
            )}
            {badges}
          </div>
        )}

        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>

        {description && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {/* Zone d'actions à droite (boutons, sélecteurs, chips...) */}
      {children && <div className="shrink-0">{children}</div>}
    </div>
  </motion.section>
)

export default HeroAdmin