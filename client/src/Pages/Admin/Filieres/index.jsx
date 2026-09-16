import { useState } from "react"
import { motion } from "framer-motion"
import { KeyRound, Plus } from "lucide-react"
import { useCreateFiliere } from "@/features/admin-filieres.tools"

import CompteursFilieres from "./sections/CompteursFilieres"
import ChartCroisement from "./sections/ChartCroisement"
import DialogFiliere from "../../../components/dialog/DialogFiliere"
import HeroAdmin from "@/components/admin/HeroAdmin"
import BtnAction from "@/components/admin/BtnAction"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"
import ListeFilieres from "./sections/ListeFilieres"

/* ─────────────────────────────────────────────────────────────────────
  Page Gestion des filières — /admin/filieres (super_admin).
───────────────────────────────────────────────────────────────────── */

const FilierePage = () => {
  const creerMutation = useCreateFiliere()
  const [edition, setEdition] = useState(null)

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* ─── En-tête ─── */}
      <HeroAdmin
        title="Gestion des filières"
        titleBdge="Référentiels"
        icon={KeyRound}
        description="Référentiel le plus stratégique du produit : chaque mot-clé affecte la qualité du matching offre ↔ abonné. L'édition n'est PAS à l'aveugle."
      >
        <BtnAction size="sm" onClick={() => setEdition({})}>
          <Plus aria-hidden className="size-4" /> Nouvelle filière
        </BtnAction>
      </HeroAdmin>

      {/* ─── Compteurs (0 appel réseau en plus) ─── */}
      <Bloc>
        <CompteursFilieres />
      </Bloc>

      {/* ─── Chart Offre vs Demande ─── */}
      <Bloc>
        <ChartCroisement />
      </Bloc>

      {/* ─── Table des filières ─── */}
      <Bloc>
        <ListeFilieres />
      </Bloc>      

      {/* ─── Dialogs ─── */}
      {edition && (
        <DialogFiliere
          key="nouvelle"
          filiere={null}
          mutation={creerMutation}
          onFermer={() => setEdition(null)}
        />
      )}
    </motion.div>
  )
}

export default FilierePage