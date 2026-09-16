import { useCallback, useMemo, useState } from "react"
import { ShieldCheck, Search } from "lucide-react"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { useNotify } from "@/contexts/Notify.context"
import { useFiltresAdministrateursAdmin } from "@/contexts/FiltresAdministrateursAdmin.context"
import {
  useAdminAdministrateursQuery, useUpdateAdministrateur,
  useChangerRoleAdministrateur, useBasculeStatutAdministrateur, useSupprimerAdministrateur,
  messageErreurAdmin,
} from "@/features/admin-administrateurs.tools"
import { useRechercheDebouncee } from "@/hooks/use-recherche-debouncee"
import { ROLE_LABELS } from "@/features/admin-auth.tools"
import PaginationListe from "@/components/admin/PaginationListe"
import BtnAction from "@/components/admin/BtnAction"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table, TableHeader, TableBody, TableHead, TableRow,
} from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DialogMotDePasseTemporaire } from "@/components/dialog/DialogCreationAdmin"
import { DialogEdition, DialogRole, DialogSuppression } from "@/components/dialog/DialogsEditionAdmin"
import { TransitionEtat, SectionErreur, SectionVide, SectionAucunResultat } from "@/components/admin/EtatsSection"
import { Spinner } from "@/components/ui/spinner"
import EnteteTriable from "@/components/admin/EnteteTriable"
import Bloc from "@/components/admin/Bloc"
import { Skeleton } from "@/components/ui/skeleton"
import {
  LigneAdministrateur, SkeletonLigneAdmin,
  CarteAdminMobile, SkeletonCarteAdminMobile,
} from "../components/LigneAdministrateur"


/* Sens naturel du premier clic par colonne (pattern Filières). */
const DIRECTION_INITIALE = {
  nom: "asc",
  role: "asc",
  statut: "desc",     // actifs d'abord
  connexion: "desc",  // plus récents d'abord
  creation: "desc",   // plus récents d'abord
}

const ACCES_TRI = {
  nom: (a) => (a.full_name ?? "").toLowerCase(),
  role: (a) => ROLE_LABELS[a.role] ?? a.role ?? "",
  statut: (a) => (a.is_active ? 1 : 0),
  connexion: (a) => (a.last_login_at ? new Date(a.last_login_at).getTime() : 0),
  creation: (a) => (a.created_at ? new Date(a.created_at).getTime() : 0),
}

const BlocSkel = ({ className, delay = 0 }) => (
  <Skeleton className={className} style={delay ? { animationDelay: `${delay}ms` } : undefined} />
)

/* ─── Skeleton complet : cartes mobile + table desktop ─────────────── */
const AdminsSkeleton = ({ nbLignes = 5 }) => {
  const lignes = Array.from({ length: nbLignes }, (_, i) => i)
  return (
    <div role="status" aria-label="Chargement des administrateurs">
      {/* Mobile : Select de tri + cartes */}
      <div className="px-4 pt-3 md:hidden" aria-hidden="true">
        <Skeleton className="h-8 w-full" />
      </div>
      <ul className="flex flex-col gap-3 px-4 py-3 md:hidden" aria-hidden="true">
        {lignes.map((i) => (
          <li key={i}><SkeletonCarteAdminMobile delay={i * 70} /></li>
        ))}
      </ul>

      {/* Desktop : table avec en-tête */}
      <div className="hidden overflow-x-auto scrollbar-thin md:block">
        <Table aria-hidden="true">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><BlocSkel className="h-3 w-32" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-10" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-12" /></TableHead>
              <TableHead className="hidden md:table-cell"><BlocSkel className="h-3 w-24" /></TableHead>
              <TableHead className="hidden xl:table-cell"><BlocSkel className="h-3 w-20" /></TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((i) => <SkeletonLigneAdmin key={i} delay={i * 70} />)}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

const ListeAdmins = () => {
  const notify = useNotify()
  const { profile } = useAdminAuth()
  const { query, role, actif, page, paramsApi, setQuery, setRole, setActif, setPage, reinitialiser } =
    useFiltresAdministrateursAdmin()
  const { data: admins, isLoading, isError, refetch } = useAdminAdministrateursQuery(paramsApi)
  const editionMutation = useUpdateAdministrateur()
  const roleMutation = useChangerRoleAdministrateur()
  const statutMutation = useBasculeStatutAdministrateur()
  const suppressionMutation = useSupprimerAdministrateur()

  const [dialogue, setDialogue] = useState({ type: null, donnees: null })
  const ouvrir = useCallback((type, donnees = null) => setDialogue({ type, donnees }), [])
  const fermer = useCallback(() => setDialogue((d) => ({ type: null, donnees: d.donnees })), [])

  const [tri, setTri] = useState(null)
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

  const trierMobile = (valeur) => {
    if (valeur === "defaut") return setTri(null)
    setTri({ cle: valeur, direction: DIRECTION_INITIALE[valeur] })
  }

  const { valeurLocale, setValeurLocale } = useRechercheDebouncee({
    valeurUrl: query,
    setScalar: setQuery,
  })
  const filtresActifs = !!(query || role || actif)

  const moiMeme = useCallback((admin) => admin?.id === profile?.id, [profile?.id])

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


  const etat = isError ? "erreur" : isLoading ? "chargement" : !admins?.length ? "vide" : "donnees"

  return (
    <>
      {/* ─── Table des administrateurs ─── */}
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
        <BarreFiltre
          valeurLocale={valeurLocale}
          setValeurLocale={setValeurLocale}
          role={role}
          setRole={setRole}
          actif={actif}
          setActif={setActif}
          filtresActifs={filtresActifs}
          reinitialiser={reinitialiser}
          isLoading={isLoading}
        />

        <Bloc>
          <TransitionEtat etat={etat}>
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les administrateurs." />
              </div>
            ) : isLoading ? (
              <AdminsSkeleton nbLignes={5} />
            ) : !admins?.length ? (
              <div className="p-4">
                {filtresActifs ? (
                  <SectionAucunResultat onReset={reinitialiser} />
                ) : (
                  <SectionVide message="Aucun administrateur — créez le premier compte." />
                )}
              </div>
            ) : (
              <>
                {/* ── Tri — mobile (desktop : en-têtes cliquables) ── */}
                <div className="px-4 pt-3 md:hidden">
                  <Select value={tri?.cle ?? "defaut"} onValueChange={trierMobile}>
                    <SelectTrigger className="h-8 w-full text-xs" aria-label="Trier les administrateurs">
                      <SelectValue placeholder="Trier par…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="defaut">Ordre du serveur (défaut)</SelectItem>
                      <SelectItem value="nom">Administrateur (A→Z)</SelectItem>
                      <SelectItem value="role">Rôle (A→Z)</SelectItem>
                      <SelectItem value="statut">Statut (actifs d'abord)</SelectItem>
                      <SelectItem value="connexion">Dernière connexion (décroissant)</SelectItem>
                      <SelectItem value="creation">Créé le (décroissant)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* ── Mobile : cartes ────────────────────────────── */}
                <ul className="flex flex-col gap-3 px-4 py-3 md:hidden">
                  {adminsTries.map((admin) => (
                    <li key={admin.id}>
                      <CarteAdminMobile
                        admin={admin}
                        soi={moiMeme(admin)}
                        statutEnCours={statutMutation.isPending && statutMutation.variables === admin.id}
                        onBasculer={basculerStatut}
                        onEditer={editer}
                        onChangerRole={changerRole}
                        onSupprimer={supprimer}
                      />
                    </li>
                  ))}
                </ul>

                {/* ── Desktop : table ────────────────────────────── */}
                <section
                  aria-label="Liste des administrateurs"
                  className="hidden overflow-x-auto scrollbar-thin bg-card md:block"
                >
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
                      {adminsTries.map((admin) => (
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
                      ))}
                    </TableBody>
                  </Table>
                </section>
              </>
            )}

            {/* ─── Pagination (inchangée) ─── */}
            {!isLoading && !isError && admins?.length > 0 && (
              <PaginationListe
                page={page}
                pagePleine={admins.length === paramsApi.limit}
                onPageChange={setPage}
                className="border-t p-2"
              />
            )}
          </TransitionEtat>
        </Bloc>
      </SectionCardAdmin>

      {/* ─── Dialogs (montés en permanence, pilotés par `open`) ─── */}
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
    </>
  )
}

const BarreFiltre = (
  { valeurLocale, setValeurLocale, role, setRole, actif, setActif, filtresActifs, reinitialiser, isLoading },
) => {
  return (
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
            <BtnAction variant="outline" size="xs" onClick={reinitialiser}>
              Réinitialiser
            </BtnAction>
          )}
        </div>
      </div>
    </div>
  )
}

export default ListeAdmins