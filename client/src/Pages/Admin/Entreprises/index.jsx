import { useMemo, useState } from "react"
import { Building2, Merge, Pencil, Search, Trash2, Trophy } from "lucide-react"
import { cn } from "cn"
import { useFiltresEntreprisesAdmin, FiltresEntreprisesAdminProvider } from "@/contexts/FiltresEntreprisesAdmin.context"
import {
  useAdminCompaniesQuery, useAdminTopRecruteursQuery,
  useSupprimerEntreprise, messageErreurCompany,
} from "@/features/admin-entreprises.tools"
import { useRechercheDebouncee } from "@/hooks/use-recherche-debouncee"
import { useNotify } from "@/contexts/Notify.context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import DialogEditionEntreprise from "./components/DialogEditionEntreprise"
import DialogFusionEntreprises from "./components/DialogFusionEntreprises"
import { SectionErreur, SectionVide, SectionAucunResultat } from "./components/EtatsSection"
import { ApercuEntreprise } from "@/components/admin/ApercuEntreprise"
import PaginationListe from "@/components/admin/PaginationListe"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion des entreprises — /admin/entreprises.

   super_admin UNIQUEMENT (impact direct sur l'affichage public).

   Fonctionnalités (doc v3 §6) :
   - liste (nom, offres actives) avec recherche par nom ;
   - tri par nombre d'offres actives (côté serveur via top-recruiters
     pour le classement, tri local pour la liste courante) ;
   - Top recruteurs (classement dédié, agrégat SQL) ;
   - édition fiche (logo, site, description, filière principale) ;
   - fusion de doublons avec compte d'offres AVANT confirmation ;
   - suppression logique (soft delete).

   La liste /companies renvoie une LISTE PLATE sans total → pagination
   heuristique (suivante possible si len == limit), pattern Offres.
   ───────────────────────────────────────────────────────────────────── */

const Entreprises = () => {
  const notify = useNotify()
  const { query, page, pageTaille, paramsApi, setQuery, setPage } = useFiltresEntreprisesAdmin()

  const [editionCible, setEditionCible] = useState(null) // entreprise ouverte en édition
  const [fusionOuvert, setFusionOuvert] = useState(false)
  const [suppression, setSuppression] = useState(null)  // entreprise en confirmation de suppression
  const [apercuEntreprise, setApercuEntreprise] = useState(null) // Sheet détails
  const [tri, setTri] = useState("offres")               // "offres" | "nom" (tri local)

  // Recherche debouncée vers l'URL (hook standard du repo) → paramsApi.
  const { valeurLocale, setValeurLocale } = useRechercheDebouncee({
    valeurUrl: query,
    setScalar: setQuery,
    cle: "query",
  })

  const { data: entreprises, isLoading, isError, refetch } = useAdminCompaniesQuery(paramsApi)

  const { data: top, isLoading: topCharge } = useAdminTopRecruteursQuery({ limit: 5 })

  const supprimerMutation = useSupprimerEntreprise()

  // Tri local (la liste n'est pas triée côté serveur hors top).
  const entreprisesTriees = useMemo(() => {
    const base = [...(entreprises ?? [])]
    if (tri === "offres") return base.sort((a, b) => (b.active_offers_count ?? 0) - (a.active_offers_count ?? 0))
    return base.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "fr"))
  }, [entreprises, tri])

  const pageSuivantePossible = Array.isArray(entreprises) && entreprises.length === pageTaille

  const confirmerSuppression = () => {
    if (!suppression) return
    supprimerMutation.mutate(suppression.id, {
      onSuccess: () => {
        notify(`« ${suppression.name} » désactivée`, "success")
        setSuppression(null)
      },
      onError: (err) => notify(messageErreurCompany(err) || "Suppression impossible", "error"),
    })
  }

  if (isError) {
    return <SectionErreur onRetry={refetch} message="Impossible de charger les entreprises." />
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-heading text-lg font-bold">Entreprises</h1>
          <p className="text-xs text-muted-foreground">
            Référentiel créé par le scraping — doublons de nommage à fusionner.
          </p>
        </div>
        <Button size="sm" onClick={() => setFusionOuvert(true)}>
          <Merge aria-hidden /> Fusionner des doublons
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Colonne principale : recherche + tri + liste */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-40 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={valeurLocale}
                onChange={(e) => setValeurLocale(e.target.value)}
                placeholder="Rechercher une entreprise…"
                aria-label="Rechercher une entreprise par nom"
                className="pl-8"
                maxLength={120}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button size="sm" variant="outline">Tri : {tri === "offres" ? "offres actives" : "nom"}</Button>}
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTri("offres")} className="cursor-pointer">
                  Offres actives (décroissant)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTri("nom")} className="cursor-pointer">
                  Nom (A→Z)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Liste */}
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : !entreprisesTriees.length ? (
            query ? (
              <SectionAucunResultat
                message={`Aucune entreprise ne correspond à « ${query} ».`}
                onReset={() => setValeurLocale("")}
              />
            ) : (
              <SectionVide message="Aucune entreprise en base." />
            )
          ) : (
            <ul className="flex flex-col gap-1.5" data-testid="liste-entreprises">
              {entreprisesTriees.map((entreprise) => (
                <li
                  key={entreprise.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden>
                    <Building2 className="size-4" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <button
                      type="button"
                      onClick={() => setApercuEntreprise(entreprise)}
                      className="truncate text-left text-sm font-medium underline-offset-4 hover:text-primary hover:underline"
                      title={`Voir les détails de ${entreprise.name}`}
                    >
                      {entreprise.name}
                    </button>
                    {entreprise.website_url && (
                      <a
                        href={entreprise.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                      >
                        {entreprise.website_url}
                      </a>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                    {entreprise.active_offers_count ?? 0} active{((entreprise.active_offers_count ?? 0) > 1) ? "s" : ""}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${entreprise.name}`}>
                          <Pencil aria-hidden />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="min-w-44">
                      <DropdownMenuItem onClick={() => setEditionCible(entreprise)} className="cursor-pointer">
                        <Pencil className="size-3.5" aria-hidden /> Modifier la fiche
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setFusionOuvert(true)} className="cursor-pointer">
                        <Merge className="size-3.5" aria-hidden /> Fusionner…
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setSuppression(entreprise)}
                        className="cursor-pointer"
                      >
                        <Trash2 className="size-3.5" aria-hidden /> Désactiver
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          )}

          {/* Pagination mutualisée (liste plate sans total) */}
          {entreprises?.length > 0 && (
            <PaginationListe
              page={page}
              pagePleine={pageSuivantePossible}
              onPageChange={setPage}
            />
          )}
        </div>

        {/* Colonne latérale : Top recruteurs */}
        <aside className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4" aria-label="Top recruteurs">
          <h2 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
            <Trophy className="size-3.5" aria-hidden /> Top recruteurs
          </h2>
          {topCharge ? (
            [...Array(5)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)
          ) : !top?.length ? (
            <p className="text-xs text-muted-foreground">Aucune donnée.</p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {top.map((entreprise, i) => (
                <li key={entreprise.id} className="flex items-center gap-2 text-xs">
                  <span className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
                    i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )} aria-hidden>
                    {i + 1}
                  </span>
                  <span className="truncate" title={entreprise.name}>{entreprise.name}</span>
                  <span className="ml-auto shrink-0 font-semibold tabular-nums text-muted-foreground">
                    {entreprise.active_offers_count}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>

      {/* Aperçu détaillé (Sheet latéral, lecture seule) — le bouton
          Modifier y bascule vers le dialog d'édition. */}
      <ApercuEntreprise
        ouverte={!!apercuEntreprise}
        onOpenChange={(o) => !o && setApercuEntreprise(null)}
        entreprise={apercuEntreprise}
        onModifier={(e) => setEditionCible(e)}
      />

      {/* Dialogs — key par entreprise : remontage du formulaire à
          chaque édition, zéro setState dans un effect. */}
      <DialogEditionEntreprise
        key={editionCible?.id ?? "ferme"}
        ouvert={!!editionCible}
        entreprise={editionCible}
        onFermer={() => setEditionCible(null)}
      />
      <DialogFusionEntreprises ouvert={fusionOuvert} onFermer={() => setFusionOuvert(false)} />

      {/* Confirmation suppression (soft delete) */}
      {suppression && (
        <Dialog open onOpenChange={(o) => !o && setSuppression(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Désactiver « {suppression.name} » ?</DialogTitle>
              <DialogDescription>
                Suppression logique : l'entreprise est masquée mais conserve son historique —
                l'action est réversible en base et journalisée dans l'audit.
                {suppression.active_offers_count > 0 && (
                  <>
                    {" "}Attention : {suppression.active_offers_count} offre(s) active(s) y sont
                    rattachées — préférez une fusion si elles doivent rester visibles.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setSuppression(null)}>Annuler</Button>
              <Button variant="destructive" size="sm" onClick={confirmerSuppression} disabled={supprimerMutation.isPending}>
                {supprimerMutation.isPending ? "…" : "Désactiver"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

/* Wrapper : le contexte de filtres (URL) enveloppe la page — pattern
   identique à /admin/offres (index.jsx de Offres). */
const EntreprisesPage = () => (
  <FiltresEntreprisesAdminProvider>
    <Entreprises />
  </FiltresEntreprisesAdminProvider>
)

export default EntreprisesPage