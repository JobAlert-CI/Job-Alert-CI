import { motion } from "framer-motion"
import { CompteursCategories } from "../sections/CompteursContenue"
import ListeCategories from "../sections/ListeCategories"
import Bloc, { VARIANTS_CONTENEUR } from "@/components/admin/Bloc"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Catégories d'articles : CRUD simple + tri par colonne.
   ───────────────────────────────────────────────────────────────────── */

const OngletCategories = () => {

  return (
    <motion.div variants={VARIANTS_CONTENEUR} initial="cache" animate="visible" className="flex flex-col gap-4">
      <Bloc>
        <CompteursCategories />
      </Bloc>

      <Bloc>
        <ListeCategories />
      </Bloc>
    </motion.div>
  )
}

export default OngletCategories