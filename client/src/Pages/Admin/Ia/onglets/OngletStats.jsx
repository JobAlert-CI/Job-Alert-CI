import { motion } from "framer-motion"
import CompteursStatsIA from "../sections/CompteursStatsIA"
import Bloc, { VARIANTS_CONTENEUR } from "@/components/admin/Bloc"
import ChartVolumesTraites from "../sections/ChartVolumesTraites"
import ChartStatusJobs from "../sections/ChartStatutJobs"
import ChartDureeMoyJobs from "../sections/ChartDureeMoyJobs"
import ChartJobsDeclencheur from "../sections/ChartJobsDeclencheur"
import ChartAlertesSeverite from "../sections/ChartAlertesSeverite"


const OngletStats = () => {

  return (
    <motion.div variants={VARIANTS_CONTENEUR} initial="cache" animate="visible" className="flex flex-col gap-4">
      <Bloc>
        <CompteursStatsIA />
      </Bloc>

      <Bloc>
        <ChartVolumesTraites />
      </Bloc>

      <div className="grid gap-4 xl:grid-cols-3">
        <Bloc>
          <ChartStatusJobs />
        </Bloc>

        <Bloc className="xl:col-span-2">
          <ChartDureeMoyJobs />
        </Bloc>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Bloc>
          <ChartJobsDeclencheur />
        </Bloc>

        <Bloc>
          <ChartAlertesSeverite />
        </Bloc>
      </div>
    </motion.div>
  )
}

export default OngletStats