import { motion } from "framer-motion"
import { AlertTriangle, Inbox, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"

/* États de section — page Sources.
   Refonte : apparition en fondu + léger glissement, alignée sur les
   transitions du reste de la page (fini l'affichage brutal). */
const VARIANTS_ETAT = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } },
}

export const SectionErreur = ({ onRetry, message = "Chargement impossible." }) => (
  <motion.div
    variants={VARIANTS_ETAT}
    initial="initial"
    animate="animate"
    role="alert"
    className="flex flex-col items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center"
  >
    <AlertTriangle className="size-5 text-destructive" aria-hidden />
    <p className="text-sm font-medium text-destructive">{message}</p>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry}>
        Réessayer
      </Button>
    )}
  </motion.div>
)

export const SectionVide = ({ message = "Aucune donnée pour le moment." }) => (
  <motion.div variants={VARIANTS_ETAT} initial="initial" animate="animate">
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
        <EmptyTitle>Rien à afficher</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  </motion.div>
)

export const SectionAucunResultat = ({ message = "Aucun résultat ne correspond aux critères.", onReset }) => (
  <motion.div variants={VARIANTS_ETAT} initial="initial" animate="animate">
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
        <EmptyTitle>Aucun résultat</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      {onReset && (
        <Button variant="outline" size="sm" onClick={onReset}>
          Réinitialiser
        </Button>
      )}
    </Empty>
  </motion.div>
)