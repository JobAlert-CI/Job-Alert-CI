import { motion } from "framer-motion"
import { CompteursArticles } from "../sections/CompteursContenue"
import ListeArticles from "../sections/ListeArticles"
import Bloc, { VARIANTS_CONTENEUR } from "@/components/admin/Bloc"

/* ─────────────────────────────────────────────────────────────────────
   Onglet 14.1 — Articles : compteurs, liste filtrable (statut,
   catégorie, recherche titre) TRIABLE par colonne, actions rapides
   (publier/dépublier, à la une, suppression) + éditeur complet.
   Tri CLIENT sur la liste retournée (le serveur filtre q/status/
   category_id mais ne trie pas).
───────────────────────────────────────────────────────────────────── */

const OngletArticles = () => {

  return (
    <motion.div variants={VARIANTS_CONTENEUR} initial="cache" animate="visible" className="flex flex-col gap-4">
      <Bloc>
        <CompteursArticles />
      </Bloc>

      <Bloc>
        <ListeArticles />
      </Bloc>
    </motion.div>
  )
}

export default OngletArticles