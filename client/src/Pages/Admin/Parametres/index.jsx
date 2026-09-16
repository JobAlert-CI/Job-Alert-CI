import { useState } from "react"
import { motion } from "framer-motion"
import { Plus, Settings2 } from "lucide-react"
import CompteursParametres from "./sections/CompteursParametres"
import TableauParametres from "./sections/TableauParametres"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"
import HeroAdmin from "@/components/admin/HeroAdmin"
import BtnAction from "@/components/admin/BtnAction"
import DialogCreationParametre from "@/components/dialog/DialogCreationParametre"

/* ─────────────────────────────────────────────────────────────────────
   Page Paramètres du site — /admin/parametres (super_admin, doc v3 §18).
   Configuration éditable sans déploiement (heure d'envoi, textes,
   coordonnées). Les valeurs sont CONSOMMÉES au runtime (résolveur
   site_settings → Settings, fallback env) : ce qui s'édite ici pilote
   VRAIMENT le site — confirmation d'email, TTL des liens, expéditeur,
   support, sujet des mails.
   Refonte :
   • Le dialog de création n'est géré QU'ICI (avant : état dupliqué
     dans index.jsx ET TableauParametres → conflits possibles). Le
     tableau reçoit l'action via la prop `onNouvelleCle`.
   • Dialog monté EN PERMANENCE (prop `open`) : animations Radix
     préservées, champs réinitialisés par useEffect à l'ouverture.
───────────────────────────────────────────────────────────────────── */

const ParametresAdmin = () => {
  /* UNIQUE source de vérité pour le dialog de création. */
  const [creationOuverte, setCreationOuverte] = useState(false)
  const ouvrirCreation = () => setCreationOuverte(true)
  const fermerCreation = () => setCreationOuverte(false)

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* ─── En-tête ─── */}
      <HeroAdmin
        title="Paramètres du site"
        description="Liste clé/valeur éditable — heure d'envoi, textes, coordonnées. Effet immédiat, sans redéploiement."
        icon={Settings2}
        titleBdge="Contenu & sécurité"
      >
        <BtnAction variant="primary" size="sm" onClick={ouvrirCreation}>
          <Plus aria-hidden className="size-4" /> Nouvelle clé
        </BtnAction>
      </HeroAdmin>

      {/* ─── Compteurs ─── */}
      <Bloc>
        <CompteursParametres />
      </Bloc>

      {/* ─── Table (recherche, groupes, édition inline, bulk) ─── */}
      <Bloc>
        <TableauParametres onNouvelleCle={ouvrirCreation} />
      </Bloc>

      {/* Dialog monté en permanence — piloté par `open`. */}
      <DialogCreationParametre open={creationOuverte} onFermer={fermerCreation} />
    </motion.div>
  )
}

export default ParametresAdmin