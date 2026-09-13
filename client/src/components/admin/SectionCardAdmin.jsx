import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/* ─────────────────────────────────────────────────────────────────────
   SectionCardAdmin — carte de section standard de l'espace admin.

   Refonte :
   • Apparition en fade + glissement vertical (au lieu de scale) :
     plus doux, et déclenchée une seule fois à l'entrée dans le viewport.
   • Ombre navy subtile du design system (shadow-soft). Suppression du
     hover:shadow-lg : une section n'est pas cliquable, l'ancien effet
     créait une fausse affordance.
   • Pastille icône navy + icône orange (contraste ≈ 6.9:1, AA).
   • Garde-fous : icon / description / action optionnels.
   • contentClassName : échappement pour les contenus pleine largeur
     (ex. table sans padding → contentClassName="p-0").
───────────────────────────────────────────────────────────────────── */
const VARIANTS_APPARITION = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
}

const SectionCardAdmin = ({
  title,
  description,
  icon: Icon,
  badge,
  action,
  children,
  className = "",
  contentClassName,
}) => (
  <motion.div
    variants={VARIANTS_APPARITION}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, amount: 0.1 }}
    className="min-w-0"
  >
    <Card className={cn("overflow-hidden border-border bg-card text-brand-navy shadow-soft pb-0", className)}>
      <CardHeader className="border-b border-border px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-navy text-brand-orange shadow-soft md:size-11"
              >
                <Icon className="size-7 stroke-3" />
              </span>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle
                  title={title}
                  className="font-heading text-base font-bold tracking-tight sm:text-lg"
                >
                  {title}
                </CardTitle>
                {badge}
              </div>
              {description && (
                <CardDescription className="mt-0.5 text-xs sm:text-[13px]">
                  {description}
                </CardDescription>
              )}
            </div>
          </div>

          {action && (
            <div className="shrink-0 self-start sm:self-center">{action}</div>
          )}
        </div>
      </CardHeader>

      <CardContent className={cn("py-4 sm:py-6", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  </motion.div>
)

export default SectionCardAdmin