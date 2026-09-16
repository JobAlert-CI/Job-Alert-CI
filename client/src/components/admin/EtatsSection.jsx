import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, Inbox, RefreshCw, RotateCcw, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "cn"

/* ─────────────────────────────────────────────────────────────────────
   États de section — espace admin (pattern partagé toutes pages).
   Refonte complète — états « premium » :
   • Médaillon d'icône en dégradé + halo diffus + anneau pointillé en
     rotation lente + éclats pulsés décalés.
   • Décor de fond : halo coloré + motif de points masqué (vignette).
   • Apparition en CASCADE (fondu + glissement, stagger) via framer-motion.
   • Typographie heading Montserrat ; contraste AA (navy sur orange).
   API RÉTRO-COMPATIBLE : mêmes exports et props minimales
   (message / onRetry / onReset). Props optionnelles ajoutées :
   titre, description, icone, action, libelleReset, className.
   Accessibilité : décor en aria-hidden, transforms coupés par
   MotionConfig reducedMotion="user", role="alert" sur l'erreur.
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

/* ─── Palettes par tonalité ─── */
const TONS = {
  erreur: {
    halo: "bg-destructive/15",
    anneau: "border-destructive/30",
    coeur: "bg-gradient-to-br from-red-500 to-destructive",
    texte: "text-white",
    eclat: "bg-destructive/50",
  },
  vide: {
    halo: "bg-brand-navy/10",
    anneau: "border-brand-navy/25",
    coeur: "bg-gradient-to-br from-brand-navy to-[#1c4a7c]",
    texte: "text-white",
    eclat: "bg-brand-orange/70",
  },
  recherche: {
    halo: "bg-brand-orange/20",
    anneau: "border-brand-orange/35",
    coeur: "bg-gradient-to-br from-brand-orange to-[#d97706]",
    texte: "text-brand-navy", /* navy sur orange : contraste AA (jamais blanc) */
    eclat: "bg-brand-navy/40",
  },
}

const FONDS = {
  erreur: "bg-destructive/10",
  vide: "bg-brand-navy/[0.08]",
  recherche: "bg-brand-orange/15",
}

const CADRES = {
  erreur: "border border-destructive/20 bg-destructive/[0.03]",
  vide: "border border-dashed border-border bg-card/60",
  recherche: "border border-dashed border-border bg-card/60",
}

/* ─── Médaillon d'icône : halo + anneau rotatif + éclats + cœur ─── */
const MedaillonIcone = ({ icone: Icone, ton = "vide" }) => {
  const t = TONS[ton] ?? TONS.vide
  return (
    <div className="relative mx-auto flex size-16 items-center justify-center">
      {/* Halo diffus */}
      <span aria-hidden className={cn("absolute -inset-4 rounded-full blur-2xl", t.halo)} />
      {/* Anneau pointillé en rotation lente */}
      <motion.span
        aria-hidden
        className={cn("absolute -inset-1.5 rounded-full border border-dashed", t.anneau)}
        animate={{ rotate: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      />
      {/* Éclats pulsés, décalés dans le temps */}
      <span aria-hidden className={cn("absolute -top-0.5 right-0.5 size-1.5 rounded-full motion-safe:animate-pulse", t.eclat)} />
      <span aria-hidden className={cn("absolute -left-1.5 bottom-1.5 size-1 rounded-full motion-safe:animate-pulse [animation-delay:700ms]", t.eclat)} />
      <span aria-hidden className={cn("absolute -bottom-1 right-2 size-1 rounded-full motion-safe:animate-pulse [animation-delay:1400ms]", t.eclat)} />
      {/* Cœur en dégradé */}
      <span className={cn("relative flex size-12 items-center justify-center rounded-full shadow-soft", t.coeur, t.texte)}>
        <Icone className="size-5" strokeWidth={2.2} aria-hidden />
      </span>
    </div>
  )
}

/* ─── Cadre commun : décor de fond + apparition en cascade ─── */
const CadreEtat = ({ variante, className, children, ...rest }) => (
  <motion.div
    variants={VARIANTS_CADRE}
    initial="cache"
    animate="visible"
    className={cn(
      "relative flex flex-col items-center gap-4 overflow-hidden rounded-xl p-6 text-center",
      CADRES[variante],
      className
    )}
    {...rest}
  >
    {/* Décor : halo coloré + motif de points en vignette */}
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className={cn("absolute left-1/2 top-0 h-44 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl", FONDS[variante])} />
      <div className="bg-pattern absolute inset-0 opacity-50 mask-[radial-gradient(ellipse_60%_60%_at_50%_35%,black,transparent)]" />
    </div>
    {children}
  </motion.div>
)

/** Erreur de chargement d'une section (action de retry incluse). */
export const SectionErreur = ({
  onRetry,
  message = "Chargement impossible.",
  titre = "Une erreur est survenue",
  description = "Vérifiez que l'API est joignable, puis réessayez.",
  className,
}) => (
  <CadreEtat variante="erreur" className={className} role="alert">
    <motion.div variants={VARIANTS_ENFANT} className="relative">
      <MedaillonIcone icone={AlertTriangle} ton="erreur" />
    </motion.div>
    <motion.div variants={VARIANTS_ENFANT} className="relative space-y-1">
      <h3 className="font-heading text-base font-bold tracking-tight text-brand-navy">{titre}</h3>
      <p className="mx-auto max-w-md text-sm font-medium text-destructive/90">{message}</p>
      <p className="mx-auto max-w-md text-xs text-muted-foreground">{description}</p>
    </motion.div>
    {onRetry && (
      <motion.div variants={VARIANTS_ENFANT} className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="group gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <RefreshCw className="size-3.5 transition-transform group-hover:rotate-180 motion-reduce:transition-none" aria-hidden />
          Réessayer
        </Button>
      </motion.div>
    )}
  </CadreEtat>
)

/** Aucune donnée du tout (≠ recherche sans résultat). */
export const SectionVide = ({
  message = "Aucune donnée pour le moment.",
  titre = "Rien à afficher",
  icone: Icone = Inbox,
  action,
  className,
}) => (
  <CadreEtat variante="vide" className={className}>
    <motion.div variants={VARIANTS_ENFANT} className="relative">
      <MedaillonIcone icone={Icone} ton="vide" />
    </motion.div>
    <motion.div variants={VARIANTS_ENFANT} className="relative space-y-1">
      <h3 className="font-heading text-base font-bold tracking-tight text-brand-navy">{titre}</h3>
      <p className="mx-auto max-w-md text-sm text-muted-foreground">{message}</p>
    </motion.div>
    {action && (
      <motion.div variants={VARIANTS_ENFANT} className="relative">
        {action}
      </motion.div>
    )}
  </CadreEtat>
)

/** Recherche/filtre sans résultat — formulation distincte du vide. */
export const SectionAucunResultat = ({
  message = "Aucun résultat ne correspond aux critères.",
  titre = "Aucun résultat",
  description = "Essayez d'élargir vos critères ou de réinitialiser les filtres actifs.",
  onReset,
  libelleReset = "Réinitialiser",
  action,
  className,
}) => (
  <CadreEtat variante="recherche" className={className}>
    <motion.div variants={VARIANTS_ENFANT} className="relative">
      <MedaillonIcone icone={SearchX} ton="recherche" />
    </motion.div>
    <motion.div variants={VARIANTS_ENFANT} className="relative space-y-1">
      <h3 className="font-heading text-base font-bold tracking-tight text-brand-navy">{titre}</h3>
      <p className="mx-auto max-w-md text-sm text-muted-foreground">{message}</p>
      {description && <p className="mx-auto max-w-md text-xs text-muted-foreground/80">{description}</p>}
    </motion.div>
    {(onReset || action) && (
      <motion.div variants={VARIANTS_ENFANT} className="relative flex flex-wrap items-center justify-center gap-2">
        {action}
        {onReset && (
          <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5">
            <RotateCcw className="size-3.5" aria-hidden />
            {libelleReset}
          </Button>
        )}
      </motion.div>
    )}
  </CadreEtat>
)

export const TransitionEtat = ({ etat, className, children }) => (
  <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={etat}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  </AnimatePresence>
);
