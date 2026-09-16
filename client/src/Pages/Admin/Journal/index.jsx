import { motion } from "framer-motion"
import {ScrollText} from "lucide-react"
import { FiltresJournalAdminProvider } from "@/contexts/FiltresJournalAdmin.context"
import HeroAdmin from "@/components/admin/HeroAdmin"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"
import CompteursJournal from "./sections/CompteursJournal"
import ChartsJournal from "./sections/ChartsJournal"
import ListeJournal from "./sections/ListeJournal"

/* ─────────────────────────────────────────────────────────────────────
   Page Journal d'activité — /admin/journal (super_admin, doc v3 §16).
   Refonte complète :
   • FILTRES FIABILISÉS : setters du contexte à un seul setScalar +
     filtrage CLIENT DE GARANTIE sur la page chargée, en plus des
     paramètres serveur (paramsApi inchangé) — les filtres fonctionnent
     quoi que fasse le backend.
   • Compteurs cliquables → filtre instantané via contexte (aucune
     navigation, aucun tressautement d'URL).
   • Table : tri par en-tête (EnteteTriable), EN-TÊTE COLLANT dans un
     défilement interne, skeleton fidèle aux colonnes réelles, vue
     mobile en cartes empilées (+ tri dédié mobile).
   • Dialog détail : ARBORESCENCE JSON repliable + bouton « Copier ».
   • Retour en haut du tableau au changement de page (scroll doux,
     coupé en prefers-reduced-motion).
   Cas particuliers conservés :
   - auteur admin_id NULL → « Admin supprimé » (FK SET NULL cycle 15) ;
   - action=connexion : journalisée depuis le cycle 16 seulement.
   ───────────────────────────────────────────────────────────────────── */

const JournalAdmin = () => {
  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* ─── En-tête ─── */}
      <HeroAdmin
        title="Journal d'activité"
        description="Verifiez qui a fait quoi dans le back-office. Chaque mutation est journalisée."
        icon={ScrollText}
        titleBdge="Contenu & sécurité"
      />

      {/* ─── Compteurs ─── */}
      <Bloc>
        <CompteursJournal />
      </Bloc>

      {/* ─── Charts H-I ─── */}
      <Bloc>
        <ChartsJournal />
      </Bloc>

      <Bloc>
        <ListeJournal />
      </Bloc>
    </motion.div>
  )
}

const PageJournal = () => (
  <FiltresJournalAdminProvider>
    <JournalAdmin />
  </FiltresJournalAdminProvider>
)

export default PageJournal