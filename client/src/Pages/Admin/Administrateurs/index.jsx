import { useState } from "react"
import { ShieldCheck, Plus, Search, Pencil, Trash2, KeyRound, Power } from "lucide-react"
import { ErrorBoundary } from "react-error-boundary"
import { cn } from "cn"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { useNotify } from "@/contexts/Notify.context"
import { FiltresAdministrateursAdminProvider, useFiltresAdministrateursAdmin } from "@/contexts/FiltresAdministrateursAdmin.context"
import {
  useAdminAdministrateursQuery, useCreateAdministrateur, useUpdateAdministrateur,
  useChangerRoleAdministrateur, useBasculeStatutAdministrateur, useSupprimerAdministrateur,
  messageErreurAdmin,
} from "@/features/admin-administrateurs.tools"
import { useRechercheDebouncee } from "@/hooks/use-recherche-debouncee"
import { ROLE_LABELS } from "@/features/admin-auth.tools"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import PaginationListe from "@/components/admin/PaginationListe"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import CompteursAdministrateurs from "./sections/CompteursAdministrateurs"
import DialogCreation, { DialogMotDePasseTemporaire } from "./components/DialogCreation"
import { DialogEdition, DialogRole, DialogSuppression } from "./components/DialogsEdition"
import { SectionErreur, SectionVide, SectionAucunResultat } from "./components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion des administrateurs — /admin/administrateurs
   (super_admin uniquement, doc v3 §15).

   Page de sécurité la plus sensible du site :
   - table (nom, email, rôle, statut, dernière connexion) ;
   - recherche q (email/nom, ajoutée cycle 15) + filtres rôle/actif ;
   - création SANS mot de passe → temporaire affiché UNE fois (à
     changer obligatoirement à la première connexion) ;
   - édition, changement de rôle, bascule active/inactive, suppression ;
   - les 4 garde-fous serveur (400 auto-sabotage) sont GRISÉS sur sa
     propre ligne : on ne laisse jamais cliquer pour récolter l'erreur.
   ───────────────────────────────────────────────────────────────────── */

const dateCourte = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) : "—"

const VARIANTE_ROLE = {
  super_admin: "default",
  gestionnaire_offres: "secondary",
  gestionnaire_utilisateurs: "secondary",
  moderateur: "outline",
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

  // Dialogs : null = fermé. Montage conditionnel = réinitialisation.
  const [creationOuverte, setCreationOuverte] = useState(false)
  const [temporaire, setTemporaire] = useState(null)   // réponse 201 à afficher 1 fois
  const [edition, setEdition] = useState(null)
  const [roleAdmin, setRoleAdmin] = useState(null)
  const [suppression, setSuppression] = useState(null)

  const { valeurLocale, setValeurLocale } = useRechercheDebouncee({
    valeurUrl: query,
    setScalar: setQuery,
  })

  const filtresActifs = !!(query || role || actif)

  // Réponse 201 de la création : si temporaire, affichage unique dédié.
  const surCree = (reponse) => {
    setCreationOuverte(false)
    if (reponse?.temporary_password) {
      setTemporaire(reponse)
    } else {
      notify("Administrateur créé", "success")
    }
  }

  const basculerStatut = (admin) =>
    statutMutation.mutate(admin.id, {
      onSuccess: (res) =>
        notify(`« ${admin.full_name} » ${res?.is_active ? "réactivé" : "désactivé"}`, "success"),
      onError: (err) => notify(messageErreurAdmin(err), "error"),
    })

  const moiMeme = (admin) => admin.id === profile?.id

  return (
    <FiltresAdministrateursAdminProvider>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {/* ─── En-tête ─── */}
        <section aria-label="En-tête administrateurs" className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-heading text-lg font-bold">
              <ShieldCheck className="size-5 text-primary" aria-hidden />
              Administrateurs
            </h1>
            <p className="text-xs text-muted-foreground">
              Qui accède au back-office et avec quels droits — la page la plus sensible du site.
            </p>
          </div>
          <Button size="sm" onClick={() => setCreationOuverte(true)}>
            <Plus aria-hidden /> Nouvel administrateur
          </Button>
        </section>

        {/* ─── Compteurs (sélection 2-3-4-5-6, dérivés de la liste) ─── */}
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <CompteursAdministrateurs />
        </ErrorBoundary>

        {/* ─── Barre de filtres ─── */}
        <section aria-label="Filtres" className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={valeurLocale}
              onChange={(e) => setValeurLocale(e.target.value)}
              placeholder="Rechercher un email ou un nom…"
              className="pl-8"
              aria-label="Rechercher un administrateur par email ou nom"
            />
          </div>
          <select
            value={role}
            onChange={(e) => { setRole(e.target.value); setPage("1") }}
            aria-label="Filtrer par rôle"
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">Tous les rôles</option>
            {Object.entries(ROLE_LABELS).map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>{libelle}</option>
            ))}
          </select>
          <select
            value={actif}
            onChange={(e) => { setActif(e.target.value); setPage("1") }}
            aria-label="Filtrer par statut"
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">Actifs et inactifs</option>
            <option value="actifs">Actifs seulement</option>
            <option value="inactifs">Inactifs seulement</option>
          </select>
          {filtresActifs && (
            <Button variant="ghost" size="sm" onClick={reinitialiser}>
              Réinitialiser
            </Button>
          )}
        </section>

        {/* ─── Table ─── */}
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger les administrateurs." />
        ) : isLoading ? (
          <div className="flex flex-col gap-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : !admins?.length ? (
          filtresActifs ? (
            <SectionAucunResultat onReset={reinitialiser} />
          ) : (
            <SectionVide message="Aucun administrateur — créez le premier compte." />
          )
        ) : (
          <ErrorBoundary FallbackComponent={AdminSectionFallback}>
            <section aria-label="Liste des administrateurs" className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Administrateur</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden md:table-cell">Dernière connexion</TableHead>
                    <TableHead className="hidden xl:table-cell">Créé le</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((admin) => {
                    const soi = moiMeme(admin)
                    const statutEnCours =
                      statutMutation.isPending && statutMutation.variables === admin.id
                    return (
                      <TableRow key={admin.id} className={statutEnCours ? "opacity-60" : undefined}>
                        <TableCell>
                          <span className="flex items-center gap-2 text-sm font-medium">
                            {admin.full_name}
                            {soi && (
                              <Badge variant="outline" className="text-[9px]">vous</Badge>
                            )}
                            {admin.must_change_password && (
                              <Badge variant="outline" className="text-[9px]" title="Changement de mot de passe obligatoire à la prochaine connexion">
                                temporaire
                              </Badge>
                            )}
                          </span>
                          <span className="block truncate text-[10px] text-muted-foreground" title={admin.email}>
                            {admin.email}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={VARIANTE_ROLE[admin.role] ?? "outline"}>
                            {ROLE_LABELS[admin.role] ?? admin.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={admin.is_active ? "secondary" : "destructive"}>
                            {admin.is_active ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                          {admin.last_login_at
                            ? dateCourte(admin.last_login_at)
                            : <span title="Compte créé mais jamais utilisé">jamais</span>}
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                          {dateCourte(admin.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {/* Bascule rapide active/inactive — garde-fou n°3 : jamais sur soi */}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={soi || statutEnCours}
                              onClick={() => basculerStatut(admin)}
                              aria-label={
                                soi
                                  ? "Changer son propre statut est interdit"
                                  : admin.is_active
                                    ? `Désactiver ${admin.full_name}`
                                    : `Réactiver ${admin.full_name}`
                              }
                              title={soi ? "Interdit sur votre propre compte" : admin.is_active ? "Désactiver" : "Réactiver"}
                            >
                              <Power className={cn("size-3.5", admin.is_active ? "text-emerald-600" : "text-muted-foreground")} aria-hidden />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={<Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${admin.full_name}`} />}
                              />
                              <DropdownMenuContent align="end" className="min-w-48">
                                <DropdownMenuGroup>
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                </DropdownMenuGroup>
                                <DropdownMenuItem onClick={() => setEdition(admin)} className="cursor-pointer">
                                  <Pencil className="size-3.5" aria-hidden /> Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setRoleAdmin(admin)}
                                  className="cursor-pointer"
                                >
                                  <KeyRound className="size-3.5" aria-hidden /> Changer le rôle
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setSuppression(admin)}
                                  disabled={soi}
                                  className={cn("cursor-pointer text-destructive", soi && "opacity-50")}
                                  title={soi ? "Impossible de supprimer votre propre compte" : undefined}
                                >
                                  <Trash2 className="size-3.5" aria-hidden /> Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </section>
          </ErrorBoundary>
        )}

        {/* ─── Pagination (liste plate, sans total serveur) ─── */}
        {!isLoading && admins?.length > 0 && (
          <PaginationListe
            page={page}
            pagePleine={admins.length === paramsApi.limit}
            onPageChange={setPage}
          />
        )}

        {/* ─── Dialogs ─── */}
        {creationOuverte && (
          <DialogCreation mutation={creationMutation} onFermer={() => setCreationOuverte(false)} onCree={surCree} />
        )}
        {temporaire && (
          <DialogMotDePasseTemporaire reponse={temporaire} onFermer={() => setTemporaire(null)} />
        )}
        {edition && (
          <DialogEdition
            admin={edition}
            moiMeme={moiMeme(edition)}
            mutation={editionMutation}
            onFermer={() => setEdition(null)}
          />
        )}
        {roleAdmin && (
          <DialogRole
            admin={roleAdmin}
            moiMeme={moiMeme(roleAdmin)}
            mutation={roleMutation}
            onFermer={() => setRoleAdmin(null)}
          />
        )}
        {suppression && (
          <DialogSuppression
            admin={suppression}
            mutation={suppressionMutation}
            onFermer={() => setSuppression(null)}
          />
        )}
      </div>
    </FiltresAdministrateursAdminProvider>
  )
}

const PageAdministrateurs = () => (
  <FiltresAdministrateursAdminProvider>
    <Administrateurs />
  </FiltresAdministrateursAdminProvider>
)

export default PageAdministrateurs
