import { useState } from "react"
import { motion } from "framer-motion"
import { Building2, Merge } from "lucide-react"
import { FiltresEntreprisesAdminProvider, } from "@/contexts/FiltresEntreprisesAdmin.context"
import DialogFusionEntreprises from "@/components/dialog/DialogFusionEntreprises"
import HeroAdmin from "@/components/admin/HeroAdmin"
import BtnAction from "@/components/admin/BtnAction"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"
import ListeEntreprise from "./sections/ListeEntreprise"
import TopEntreprise from "./sections/TopEntreprise"

/* ─────────────────────────────────────────────────────────────────────
  Page Gestion des entreprises — /admin/entreprises.
  super_admin UNIQUEMENT (impact direct sur l'affichage public).
───────────────────────────────────────────────────────────────────── */

const Entreprises = () => {
  const [fusionOuvert, setFusionOuvert] = useState(false)
  const [fusionSource, setFusionSource] = useState(null)

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* ─── En-tête ─── */}
      <Bloc>
        <HeroAdmin
          title="Gestion des entreprises"
          titleBdge="Métier"
          icon={Building2}
          description="Recherche, tri, édition de fiche, fusion de doublons et désactivation des entreprises de recrutement."
        >
          <BtnAction
            size="sm"
            onClick={() => {
              setFusionSource(null)
              setFusionOuvert(true)
            }}
          >
            <Merge aria-hidden className="size-4" /> Fusionner des doublons
          </BtnAction>
        </HeroAdmin>
      </Bloc>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* ─── Colonne principale : recherche + tri + liste ─── */}
        <Bloc>
          <ListeEntreprise />
        </Bloc>

        {/* ─── Colonne latérale : Top recruteurs (cascade + podium) ─── */}
        <Bloc>
          <TopEntreprise />
        </Bloc>
      </div>

      <DialogFusionEntreprises
        key={fusionSource?.id ?? "vide"}
        ouvert={fusionOuvert}
        sourcePreselect={fusionSource}
        onFermer={() => {
          setFusionOuvert(false)
          setFusionSource(null)
        }}
      />
    </motion.div>
  )
}

const EntreprisesPage = () => (
  <FiltresEntreprisesAdminProvider>
    <Entreprises />
  </FiltresEntreprisesAdminProvider>
)

export default EntreprisesPage