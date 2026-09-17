import { motion } from "framer-motion"
import { CompteursSeries } from "../sections/CompteursContenue"
import Bloc, { VARIANTS_CONTENEUR } from "@/components/admin/Bloc"
import ListeSeries from "../sections/ListeSeries"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Séries : CRUD + composition + tri par colonne.
───────────────────────────────────────────────────────────────────── */


const OngletSeries = () => {

  return (
    <motion.div variants={VARIANTS_CONTENEUR} initial="cache" animate="visible" className="flex flex-col gap-4">
      <Bloc>
        <CompteursSeries />
      </Bloc>

      <Bloc>
        <ListeSeries />
      </Bloc>

    </motion.div>
  )
}

export default OngletSeries