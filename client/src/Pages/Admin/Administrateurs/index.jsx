import { useCallback, useState } from "react"
import { motion } from "framer-motion"
import {ShieldCheck, Plus} from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {FiltresAdministrateursAdminProvider} from "@/contexts/FiltresAdministrateursAdmin.context"
import {useCreateAdministrateur} from "@/features/admin-administrateurs.tools"
import HeroAdmin from "@/components/admin/HeroAdmin"
import BtnAction from "@/components/admin/BtnAction"
import CompteursAdministrateurs from "./sections/CompteursAdministrateurs"
import DialogCreation, { DialogMotDePasseTemporaire } from "../../../components/dialog/DialogCreationAdmin"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"
import ListeAdmins from "./sections/ListeAdmin"

/* ─────────────────────────────────────────────────────────────────────
  Page Gestion des administrateurs — /admin/administrateurs
  (super_admin uniquement, doc v3 §15).
  Page de sécurité la plus sensible du site :
    - table (nom, email, rôle, statut, dernière connexion) ;
    - recherche q (email/nom) + filtres rôle/actif ;
    - création SANS mot de passe → temporaire affiché UNE fois (à
      changer obligatoirement à la première connexion) ;
    - édition, changement de rôle, bascule active/inactive, suppression ;
    - les 4 garde-fous serveur (400 auto-sabotage) sont GRISÉS sur sa propre ligne : on ne laisse jamais cliquer pour récolter l'erreur.
───────────────────────────────────────────────────────────────────── */

const Administrateurs = () => {
  const notify = useNotify()
  const creationMutation = useCreateAdministrateur()
  const [dialogue, setDialogue] = useState({ type: null, donnees: null })
  const ouvrir = useCallback((type, donnees = null) => setDialogue({ type, donnees }), [])
  const fermer = useCallback(() => setDialogue((d) => ({ type: null, donnees: d.donnees })), [])


  /* Réponse 201 de la création : si temporaire, enchaînement direct
     création → dialog d'affichage unique (une seule transition). */
  const surCree = useCallback((reponse) => {
    if (reponse?.temporary_password) {
      setDialogue({ type: "temporaire", donnees: reponse })
    } else {
      fermer()
      notify("Administrateur créé", "success")
    }
  }, [fermer, notify])

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
          title="Gestion des administrateurs"
          description="Gestion des utilisateurs qui peuvent accéder au back-office et avec quels droits"
          icon={ShieldCheck}
          titleBdge="Contenu & sécurité"
        >
          <BtnAction size="sm" onClick={() => ouvrir("creation")}>
            <Plus aria-hidden className="size-4" /> Nouvel administrateur
          </BtnAction>
        </HeroAdmin>
      </Bloc>

      {/* ─── Compteurs (dérivés de la liste, un seul passage reduce) ─── */}
      <Bloc>
        <CompteursAdministrateurs />
      </Bloc>

      {/* ─── Table des administrateurs (carte de section, pattern Filières) ─── */}
      <ListeAdmins />

      {/* ─── Dialogs (montés en permanence, pilotés par `open`) ─── */}
      <DialogCreation
        open={dialogue.type === "creation"}
        mutation={creationMutation}
        onFermer={fermer}
        onCree={surCree}
      />

      <DialogMotDePasseTemporaire
        open={dialogue.type === "temporaire"}
        reponse={dialogue.donnees}
        onFermer={fermer}
      />
    </motion.div >
  )
}

/* Provider filtres posé UNE seule fois, ici (le doublon interne à
   Administrateurs a été retiré — un unique nœud de contexte). */
const PageAdministrateurs = () => (
  <FiltresAdministrateursAdminProvider>
    <Administrateurs />
  </FiltresAdministrateursAdminProvider>
)

export default PageAdministrateurs