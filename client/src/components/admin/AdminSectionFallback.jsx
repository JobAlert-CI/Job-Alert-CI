import { motion } from "framer-motion"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

/* ─────────────────────────────────────────────────────────────────────
   Fallback d'ErrorBoundary par section admin (pattern SectionFallback
   des pages publiques, cf. src/Pages/Offres/index.jsx) : une section
   qui plante n'emporte jamais toute la page.
   Refonte complète — état « premium » :
   • Médaillon d'icône en dégradé rouge + halo diffus + anneau
     pointillé en rotation lente + éclats pulsés décalés.
   • Apparition en CASCADE (fondu + glissement, stagger) via framer-motion.
   • Décor de fond : halo coloré + motif de points masqué (vignette).
   • Bouton « Réessayer » avec icône qui pivote au survol.
   • Respect prefers-reduced-motion (MotionConfig global + motion-safe).
   Props inchangées : { error, resetErrorBoundary } (react-error-boundary).
   ───────────────────────────────────────────────────────────────────── */

const VARIANTS_CADRE = {
  cache: { opacity: 0, y: 14, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.07, delayChildren: 0.05 },
  },
}

const VARIANTS_ENFANT = {
  cache: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
}

/* ─── Médaillon d'erreur : halo + anneau rotatif + éclats + cœur ─── */
const MedaillonErreur = () => (
  <div className="relative mx-auto flex size-16 items-center justify-center">
    {/* Halo diffus */}
    <span aria-hidden className="absolute -inset-4 rounded-full bg-destructive/15 blur-2xl" />
    {/* Anneau pointillé en rotation lente */}
    <motion.span
      aria-hidden
      className="absolute -inset-1.5 rounded-full border border-dashed border-destructive/30"
      animate={{ rotate: 360 }}
      transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
    />
    {/* Éclats pulsés, décalés dans le temps */}
    <span aria-hidden className="absolute -top-0.5 right-0.5 size-1.5 rounded-full bg-destructive/50 motion-safe:animate-pulse" />
    <span aria-hidden className="absolute -left-1.5 bottom-1.5 size-1 rounded-full bg-destructive/50 motion-safe:animate-pulse [animation-delay:700ms]" />
    <span aria-hidden className="absolute -bottom-1 right-2 size-1 rounded-full bg-destructive/50 motion-safe:animate-pulse [animation-delay:1400ms]" />
    {/* Cœur en dégradé */}
    <span className="relative flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-destructive text-white shadow-soft">
      <AlertTriangle className="size-5" strokeWidth={2.2} aria-hidden />
    </span>
  </div>
)

const AdminSectionFallback = ({ error, resetErrorBoundary }) => (
  <motion.div
    role="alert"
    variants={VARIANTS_CADRE}
    initial="cache"
    animate="visible"
    className="relative m-4 overflow-hidden rounded-xl border border-destructive/20 bg-destructive/[0.03] p-8 text-center"
  >
    {/* Décor de fond : halo rouge + motif de points en vignette */}
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute left-1/2 top-0 h-44 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive/10 blur-3xl" />
      <div className="bg-pattern absolute inset-0 opacity-50 mask-[radial-gradient(ellipse_60%_60%_at_50%_35%,black,transparent)]" />
    </div>

    <motion.div variants={VARIANTS_ENFANT} className="relative">
      <MedaillonErreur />
    </motion.div>

    <motion.div variants={VARIANTS_ENFANT} className="relative mt-4 space-y-1">
      <h3 className="font-heading text-base font-bold tracking-tight text-brand-navy">
        Une erreur est survenue dans cette section
      </h3>
      <p className="mx-auto max-w-md text-sm font-medium text-destructive/90">
        {error?.message || "Erreur inattendue."}
      </p>
      <p className="mx-auto max-w-md text-xs text-muted-foreground">
        Le reste de la page fonctionne normalement. Réessayez, ou contactez le support si le problème persiste.
      </p>
    </motion.div>

    {resetErrorBoundary && (
      <motion.div variants={VARIANTS_ENFANT} className="relative mt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={resetErrorBoundary}
          className="group gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <RefreshCw className="size-3.5 transition-transform group-hover:rotate-180 motion-reduce:transition-none" aria-hidden />
          Réessayer
        </Button>
      </motion.div>
    )}
  </motion.div>
)

export default AdminSectionFallback