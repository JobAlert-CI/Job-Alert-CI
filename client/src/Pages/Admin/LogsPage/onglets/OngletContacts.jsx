import { motion } from "framer-motion"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"
import CompteursContacts from "../sections/CompteursContacts"
import ListeMessages from "../sections/ListeMessages"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Messages de contact (cycle 17, doc v3 §17.2).
   Refonte :
   • FILTRE CORRIGÉ : sentinelle « tous » (Radix refuse la valeur
     vide qui verrouillait l'ancien SelectItem value="") + filtrage
     client de GARANTIE sur la page chargée.
   • Tri par en-tête initialisé (« Reçu » desc).
   • Changement de statut inline : Select shadcn + SPINNER pendant la
     mutation (au lieu d'un simple disabled grisé).
   • Retour en haut du tableau au changement de page, skeleton fidèle
     (limite de page), transition framer-motion uniforme, animations
     du donut conditionnées par prefers-reduced-motion.
   ⚠️ La réponse du PATCH renvoie le statut STOCKÉ — CONTACT_INTERNE_
   VERS_API traduit pour les badges.
   ───────────────────────────────────────────────────────────────────── */


const OngletContacts = () => {
  
  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* ─── Compteurs C1-C4 : chips cliquables ─── */}
      <Bloc>
        <CompteursContacts />
      </Bloc>
      
      <Bloc>
        <ListeMessages />
      </Bloc>      
    </motion.div>
  )
}

export default OngletContacts