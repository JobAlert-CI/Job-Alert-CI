import { motion } from "framer-motion"
import Bloc, { VARIANTS_CONTENEUR } from "@/components/admin/Bloc"
import CompteursPilotageIA from "../sections/CompteursPilotageIA"
import HistoriqueJobs from "../sections/HistoriqueJobs"
import ClesAPI from "../sections/ClesAPI"
import AlertesIA from "../sections/AlertesIA"
import SuggestionsFiliereIA from "../sections/SuggestionsFiliereIA"


const OngletPilotage = () => {
  return (
    <motion.div variants={VARIANTS_CONTENEUR} initial="cache" animate="visible" className="flex flex-col gap-4">
      <Bloc>
        <CompteursPilotageIA />
      </Bloc>
      <Bloc>
        <HistoriqueJobs />
      </Bloc>
      <Bloc>
        <ClesAPI />
      </Bloc>
      <Bloc>
        <AlertesIA />
      </Bloc>
      <Bloc>
        <SuggestionsFiliereIA />
      </Bloc>
    </motion.div>
  )
}

export default OngletPilotage