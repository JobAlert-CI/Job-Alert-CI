import { motion } from "framer-motion"
import { FiltresOffresAdminProvider } from "@/contexts/FiltresOffresAdmin.context"
import ListeOffres from "./sections/ListeOffres"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"

/* ─────────────────────────────────────────────────────────────────────
  Page Gestion des offres — /admin/offres (super_admin +
  gestionnaire_offres ; guard par route dans App.jsx).
  Orchestrateur pur : le contexte de filtres (URL) enveloppe la
  section unique ; les mutations invalident le cache via les hooks
  de features/admin-offres.tools.js.   
───────────────────────────────────────────────────────────────────── */
const Offres = () => (
  <FiltresOffresAdminProvider>
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <Bloc>
        <ListeOffres />
      </Bloc>
    </motion.div>
  </FiltresOffresAdminProvider>
)

export default Offres