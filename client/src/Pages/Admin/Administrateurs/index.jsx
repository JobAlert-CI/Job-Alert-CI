import { useCallback, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  ShieldCheck, Plus, Search
} from "lucide-react"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { useNotify } from "@/contexts/Notify.context"
import {
  FiltresAdministrateursAdminProvider, useFiltresAdministrateursAdmin,
} from "@/contexts/FiltresAdministrateursAdmin.context"
import {
  useAdminAdministrateursQuery, useCreateAdministrateur, useUpdateAdministrateur,
  useChangerRoleAdministrateur, useBasculeStatutAdministrateur, useSupprimerAdministrateur,
  messageErreurAdmin,
} from "@/features/admin-administrateurs.tools"
import { useRechercheDebouncee } from "@/hooks/use-recherche-debouncee"
import { ROLE_LABELS } from "@/features/admin-auth.tools"
import PaginationListe from "@/components/admin/PaginationListe"
import HeroAdmin from "@/components/admin/HeroAdmin"
import BtnAction from "@/components/admin/BtnAction"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import CompteursAdministrateurs from "./sections/CompteursAdministrateurs"
import DialogCreation, { DialogMotDePasseTemporaire } from "../../../components/dialog/DialogCreationAdmin"
import { DialogEdition, DialogRole, DialogSuppression } from "../../../components/dialog/DialogsEditionAdmin"
import { SectionErreur, SectionVide, SectionAucunResultat } from "./components/EtatsSection"
import { Spinner } from "@/components/ui/spinner"
import { LigneAdministrateur, SkeletonLigneAdmin } from "./components/LigneAdministrateur"
import EnteteTriable from "@/components/admin/EnteteTriable"
import Bloc, { VARIANTS_PAGE, VARIANTS_BLOC } from "@/components/admin/Bloc"

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

/* Sens naturel du premier clic par colonne (pattern Filières). */
const DIRECTION_INITIALE = {
  nom: "asc",
  role: "asc",
  statut: "desc",     // actifs d'abord
  connexion: "desc",  // plus récents d'abord
  creation: "desc",   // plus récents d'abord
}

/* Accès aux valeurs triables — « jamais connecté » vaut l'epoch (0),
   donc il se classe dernier en desc. */
const ACCES_TRI = {
  nom: (a) => (a.full_name ?? "").toLowerCase(),
  role: (a) => ROLE_LABELS[a.role] ?? a.role ?? "",
  statut: (a) => (a.is_active ? 1 : 0),
  connexion: (a) => (a.last_login_at ? new Date(a.last_login_at).getTime() : 0),
  creation: (a) => (a.created_at ? new Date(a.created_at).getTime() : 0),
}


const Administrateurs = () => {
  const notify = useNotify()
  const { profile } = useAdminAuth()
  const { query, role, actif, page, paramsApi, setQuery, setRole, setActif, setPage, reinitialiser } =
    useFiltresAdministrateursAdmin()
  const { data: admins, isLoading, isError, refetch } = useAdminAdministrateursQuery(paramsApi)
  const creationMutation = useCreateAdministrateur()
  const editionMutation = useUpdateAdministrateur()
  const roleMutation = useChangerRoleAdministrateur()
  const statutMutation = useBasculeStatutAdministrateur()
  const suppressionMutation = useSupprimerAdministrateur()

  /* ─── Dialogs ──────────────────────────────────────────────────────
    Les 5 dialogs restent MONTÉS EN PERMANENCE et reçoivent une prop
    `open` : les animations d'entrée/sortie natives de Radix ne sont
    plus cassées par un démontage immédiat.
    • `type`    : quel dialog est ouvert (null = aucun).
    • `donnees` : l'admin ciblé / la réponse 201 — volontairement
      CONSERVÉ à la fermeture pour rester affiché pendant toute la
      durée de l'animation de sortie. Chaque dialog réinitialise son
      formulaire par useEffect à l'ouverture. 
  */
  const [dialogue, setDialogue] = useState({ type: null, donnees: null })
  const ouvrir = useCallback((type, donnees = null) => setDialogue({ type, donnees }), [])
  const fermer = useCallback(() => setDialogue((d) => ({ type: null, donnees: d.donnees })), [])

  /* ─── Tri client (pattern Filières) ───────────────────────────────
     Cycle : sens naturel → sens inverse → ordre initial. Porte sur la
     page affichée (pagination serveur offset). */
  const [tri, setTri] = useState(null) // null = ordre naturel de l'API
  const cycleTri = (cle) => {
    setTri((prec) => {
      if (prec?.cle !== cle) return { cle, direction: DIRECTION_INITIALE[cle] }
      if (prec.direction === DIRECTION_INITIALE[cle]) {
        return { cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      }
      return null
    })
  }

  const adminsTries = useMemo(() => {
    const base = [...(admins ?? [])]
    if (!tri) return base
    const get = ACCES_TRI[tri.cle]
    return base.sort((a, b) => {
      const va = get(a)
      const vb = get(b)
      const cmp = typeof va === "string" ? va.localeCompare(vb, "fr") : va - vb
      return tri.direction === "asc" ? cmp : -cmp
    })
  }, [admins, tri])

  const { valeurLocale, setValeurLocale } = useRechercheDebouncee({
    valeurUrl: query,
    setScalar: setQuery,
  })
  const filtresActifs = !!(query || role || actif)

  const moiMeme = useCallback((admin) => admin?.id === profile?.id, [profile?.id])

  /* Handlers stables (useCallback) → les lignes React.memo ne
     re-rendent pas pendant la saisie de la recherche. */
  const basculerStatut = useCallback(
    (admin) =>
      statutMutation.mutate(admin.id, {
        onSuccess: (res) =>
          notify(`« ${admin.full_name} » ${res?.is_active ? "réactivé" : "désactivé"}`, "success"),
        onError: (err) => notify(messageErreurAdmin(err), "error"),
      }),
    [statutMutation, notify]
  )
  const editer = useCallback((admin) => ouvrir("edition", admin), [ouvrir])
  const changerRole = useCallback((admin) => ouvrir("role", admin), [ouvrir])
  const supprimer = useCallback((admin) => ouvrir("suppression", admin), [ouvrir])

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
      <motion.div variants={VARIANTS_BLOC}>
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
      </motion.div>

      {/* ─── Compteurs (dérivés de la liste, un seul passage reduce) ─── */}
      <motion.div variants={VARIANTS_BLOC}>
        <Bloc>
          <CompteursAdministrateurs />
        </Bloc>
      </motion.div>

      {/* ─── Table des administrateurs (carte de section, pattern Filières) ─── */}
      <SectionCardAdmin
        title="Administrateurs"
        description="Comptes du back-office — rôles, statuts et dernières connexions."
        icon={ShieldCheck}
        contentClassName="p-0 sm:p-0"
        badge={
          !isLoading && !isError && admins?.length > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {admins.length} sur cette page
            </Badge>
          )
        }
      >
        {/* ─── Barre de filtres (regroupée sur une carte fine) ─── */}
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              {isLoading ? (
                <Spinner
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-primary"
                  aria-label="Recherche en cours"
                />
              ) : (
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
              )}
              <Input
                type="search"
                value={valeurLocale}
                onChange={(e) => setValeurLocale(e.target.value)}
                placeholder="Rechercher un email ou un nom…"
                aria-label="Rechercher un administrateur par email ou nom"
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-8 w-56 text-xs" aria-label="Filtrer par rôle">
                  <SelectValue placeholder="Filtrer par rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous les rôles</SelectItem>
                  {Object.entries(ROLE_LABELS).map(([valeur, libelle]) => (
                    <SelectItem key={valeur} value={valeur}>{libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={actif} onValueChange={setActif}>
                <SelectTrigger className="h-8 w-56 text-xs" aria-label="Filtrer par statut">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Actifs et inactifs</SelectItem>
                  <SelectItem value="actifs">Actifs seulement</SelectItem>
                  <SelectItem value="inactifs">Inactifs seulement</SelectItem>
                </SelectContent>
              </Select>

              {filtresActifs && (
                <Button variant="ghost" size="sm" onClick={reinitialiser}>
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>
        </div>

        <motion.div variants={VARIANTS_BLOC}>
          <Bloc>
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les administrateurs." />
              </div>
            ) : (
              <section aria-label="Liste des administrateurs" className="overflow-x-auto bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <EnteteTriable
                        colonne={{ cle: "nom", libelle: "Administrateur" }}
                        tri={tri}
                        onTri={(col) => cycleTri(col.cle)}
                      />
                      <EnteteTriable
                        colonne={{ cle: "role", libelle: "Rôle" }}
                        tri={tri}
                        onTri={(col) => cycleTri(col.cle)}
                      />
                      <EnteteTriable
                        colonne={{ cle: "statut", libelle: "Statut" }}
                        tri={tri}
                        onTri={(col) => cycleTri(col.cle)}
                      />
                      <EnteteTriable
                        colonne={{ cle: "connexion", libelle: "Dernière connexion" }}
                        tri={tri}
                        onTri={(col) => cycleTri(col.cle)}
                        className="hidden md:table-cell"
                      />
                      <EnteteTriable
                        colonne={{ cle: "creation", libelle: "Créé le" }}
                        tri={tri}
                        onTri={(col) => cycleTri(col.cle)}
                        className="hidden xl:table-cell"
                      />
                      <TableHead className="w-10">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      [...Array(5)].map((_, i) => <SkeletonLigneAdmin key={i} />)
                    ) : !admins?.length ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6}>
                          {filtresActifs ? (
                            <SectionAucunResultat onReset={reinitialiser} />
                          ) : (
                            <SectionVide message="Aucun administrateur — créez le premier compte." />
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      adminsTries.map((admin) => (
                        <LigneAdministrateur
                          key={admin.id}
                          admin={admin}
                          soi={moiMeme(admin)}
                          statutEnCours={statutMutation.isPending && statutMutation.variables === admin.id}
                          onBasculer={basculerStatut}
                          onEditer={editer}
                          onChangerRole={changerRole}
                          onSupprimer={supprimer}
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
              </section>
            )}
          </Bloc>
        </motion.div>
      </SectionCardAdmin>

      {/* ─── Pagination (liste plate, sans total serveur) ─── */}
      {!isLoading && !isError && admins?.length > 0 && (
        <motion.div variants={VARIANTS_BLOC}>
          <PaginationListe
            page={page}
            pagePleine={admins.length === paramsApi.limit}
            onPageChange={setPage}
          />
        </motion.div>
      )}

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
      <DialogEdition
        open={dialogue.type === "edition"}
        admin={dialogue.donnees}
        moiMeme={moiMeme(dialogue.donnees)}
        mutation={editionMutation}
        onFermer={fermer}
      />
      <DialogRole
        open={dialogue.type === "role"}
        admin={dialogue.donnees}
        moiMeme={moiMeme(dialogue.donnees)}
        mutation={roleMutation}
        onFermer={fermer}
      />
      <DialogSuppression
        open={dialogue.type === "suppression"}
        admin={dialogue.donnees}
        mutation={suppressionMutation}
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