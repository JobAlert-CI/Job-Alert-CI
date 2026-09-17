import { motion } from "framer-motion"
import Bloc, { VARIANTS_CONTENEUR } from "@/components/admin/Bloc"
import { CompteursConseil } from "../sections/CompteursContenue"
import ListeConseils from "../sections/ListeConseils"

/* ─────────────────────────────────────────────────────────────────────
   Onglet — Conseils du jour : CRUD + créneau de rotation + tri.
   ───────────────────────────────────────────────────────────────────── */

const OngletConseils = () => {  

  return (
    <motion.div variants={VARIANTS_CONTENEUR} initial="cache" animate="visible" className="flex flex-col gap-4">
      <Bloc>
        <CompteursConseil />
      </Bloc>
      
      <Bloc>
        <ListeConseils />
      </Bloc>
    </motion.div>
  )
}

export default OngletConseils