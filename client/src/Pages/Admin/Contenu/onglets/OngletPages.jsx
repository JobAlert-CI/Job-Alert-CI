import { motion } from "framer-motion"
import { CompteursPage } from "../sections/CompteursContenue"
import Bloc, { VARIANTS_CONTENEUR } from "@/components/admin/Bloc"
import ListePage from "../sections/ListePage"

/* ─────────────────────────────────────────────────────────────────────
   Onglet — Pages statiques : CRUD + tri par colonne.
   ───────────────────────────────────────────────────────────────────── */


const OngletPages = () => {

  return (
    <motion.div variants={VARIANTS_CONTENEUR} initial="cache" animate="visible" className="flex flex-col gap-4">      
      <Bloc>
        <CompteursPage />
      </Bloc>      

      <Bloc>
        <ListePage />
      </Bloc>
    </motion.div>
  )
}

export default OngletPages