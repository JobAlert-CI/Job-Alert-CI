import { useCallback, useState } from "react"
import { motion } from "framer-motion"
import { Globe, Plus } from "lucide-react"
import { useCreateSource } from "@/features/admin-sources.tools"
import HeroAdmin from "@/components/admin/HeroAdmin"
import BtnAction from "@/components/admin/BtnAction"
import DialogSource from "@/components/dialog/DialogSource"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"
import CompteursSources from "./sections/CompteursSources"
import ListeSources from "./sections/ListeSources"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion des sources — /admin/sources (super_admin, doc v3 §13).
   Piloter l'état des sites scrapés sans toucher au code :
   - table triable (nom, URLs, statut, priorité, anti-scraping 0-5) ;
   - action rapide « mettre en pause / réactiver » avec MISE À JOUR
     OPTIMISTE du cache (flip immédiat, rollback en cas d'erreur) ;
   - recherche nom/code + filtre statut côté client ;
   - vue mobile en cartes empilées, table à partir de md ;
   - CRUD complet via dialog monté en permanence (prop open) ;
   - suppression avec confirmation (FK RESTRICT serveur → 409 possible).
   Compteurs dérivés de la liste en UN seul passage (reduce) :
   actives x/N, en pause, scrapables, protection forte (≥ 4/5).
   L'état `error` est affichable (données base) mais non assignable
   via PATCH (Literal serveur : active|paused|disabled).
   ───────────────────────────────────────────────────────────────────── */


const Sources = () => {
  const creerMutation = useCreateSource()
  const [open, setOpen] = useState(false)

  const fermerEdition = useCallback(() => setOpen(false), [])

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
          title="Gestion des sources"
          description="Gestion des sources de scraping : activation, pause, priorité et niveau de protection."
          icon={Globe}
          titleBdge="Référentiels"
        >
          <BtnAction size="sm" onClick={() => setOpen(true)}>
            <Plus aria-hidden className="size-4" /> Nouvelle source
          </BtnAction>
        </HeroAdmin>
      </Bloc>

      {/* ─── Compteurs (dérivés de la liste, un seul passage) ─── */}
      <Bloc>
        <CompteursSources />
      </Bloc>

      {/* ─── Carte principale : filtres + corps responsive ─── */}
      <Bloc>
        <ListeSources />
      </Bloc>

      {/* Dialog création/édition — monté en permanence, piloté par `open`. */}
      <DialogSource
        open={open}
        source={null}
        mutation={creerMutation}
        onFermer={fermerEdition}
      />
    </motion.div>
  )
}

export default Sources