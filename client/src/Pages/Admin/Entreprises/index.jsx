import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Building2, Merge, Pencil, Search, Trash2, TriangleAlert, Trophy,
} from "lucide-react"
import { cn } from "cn"
import {
  useFiltresEntreprisesAdmin, FiltresEntreprisesAdminProvider,
} from "@/contexts/FiltresEntreprisesAdmin.context"
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
import { Spinner } from "@/components/ui/spinner"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import DialogEditionEntreprise from "../../../components/dialog/DialogEditionEntreprise"
import DialogFusionEntreprises from "../../../components/dialog/DialogFusionEntreprises"
import { SectionErreur, SectionVide, SectionAucunResultat } from "./components/EtatsSection"
import { ApercuEntreprise } from "@/components/admin/ApercuEntreprise"
import PaginationListe from "@/components/admin/PaginationListe"
import HeroAdmin from "@/components/admin/HeroAdmin"
import BtnAction from "@/components/admin/BtnAction"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"

/* ─────────────────────────────────────────────────────────────────────
  Page Gestion des entreprises — /admin/entreprises.
  super_admin UNIQUEMENT (impact direct sur l'affichage public).
───────────────────────────────────────────────────────────────────── */

const VARIANTS_LISTE = {
  cache: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
}

const VARIANTS_LIGNE = {
  cache: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
}

/* Podium : or, argent, bronze — le reste en neutre. */
const STYLE_PODIUM = [
  "bg-amber-400 text-amber-950",
  "bg-slate-300 text-slate-800",
  "bg-orange-300 text-orange-950",
]
const styleRang = (i) => STYLE_PODIUM[i] ?? "bg-muted text-muted-foreground"

const formatNombre = (v) => (v ?? 0).toLocaleString("fr-FR")

/* Avatar : logo réel si chargé, sinon pictogramme (les URL cassées
   basculent sur le fallback via onError). */
const AvatarEntreprise = ({ entreprise }) => {
  const [erreur, setErreur] = useState(false)
  if (!entreprise.logo_url || erreur) {
    return (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden>
        <Building2 className="size-4" />
      </div>
    )
  }
  return (
    <img
      src={entreprise.logo_url}
      alt=""
      className="size-9 shrink-0 rounded-md border border-border bg-white object-contain p-0.5"
      onError={() => setErreur(true)}
    />
  )
}

const Entreprises = () => {
  const notify = useNotify()
  const { query, page, pageTaille, paramsApi, setQuery, setPage } = useFiltresEntreprisesAdmin()

  const [editionCible, setEditionCible] = useState(null)
  const [fusionOuvert, setFusionOuvert] = useState(false)
  const [fusionSource, setFusionSource] = useState(null) // préselection depuis le menu ligne
  const [suppression, setSuppression] = useState(null)
  const [apercuEntreprise, setApercuEntreprise] = useState(null)
  const [tri, setTri] = useState("offres")

  const { valeurLocale, setValeurLocale } = useRechercheDebouncee({
    valeurUrl: query,
    setScalar: setQuery,
    cle: "query",
  })

  const { data: entreprises, isLoading, isError, isFetching, refetch } = useAdminCompaniesQuery(paramsApi)
  const { data: top, isLoading: topCharge } = useAdminTopRecruteursQuery({ limit: 20 })
  const supprimerMutation = useSupprimerEntreprise()

  /* Tri local (la liste n'est pas triée côté serveur hors top). */
  const entreprisesTriees = useMemo(() => {
    const base = [...(entreprises ?? [])]
    if (tri === "offres") return base.sort((a, b) => (b.active_offers_count ?? 0) - (a.active_offers_count ?? 0))
    return base.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "fr"))
  }, [entreprises, tri])

  const pageSuivantePossible = Array.isArray(entreprises) && entreprises.length === pageTaille

  const reinitialiserFiltres = () => {
    setValeurLocale("")
    setQuery("")
    setPage(1)
  }

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


  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <Bloc>
        {/* ─── En-tête ─── */}
        <HeroAdmin
          title="Gestion des entreprises"
          titleBdge="Métier"
          icon={Building2}
          description="Recherche, tri, édition de fiche, fusion de doublons et désactivation des entreprises de recrutement."
        >
          <BtnAction
            size="sm"
            onAction={() => {
              setFusionSource(null)
              setFusionOuvert(true)
            }}
          >
            <Merge aria-hidden className="size-4" /> Fusionner des doublons
          </BtnAction>
        </HeroAdmin>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* ─── Colonne principale : recherche + tri + liste ─── */}
          <SectionCardAdmin
            title="Liste des entreprises"
            description="Recherche par nom, tri par offres actives ou alphabétique, actions par ligne."
            icon={Building2}
            contentClassName="p-0 sm:p-0"
          >
            {/* Barre recherche + tri */}
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <div className="relative min-w-52 flex-1">
                {isFetching ? (
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
                  placeholder="Rechercher une entreprise…"
                  aria-label="Rechercher une entreprise par nom"
                  className="h-8 pl-8 text-xs"
                  maxLength={120}
                />
              </div>

              <Select value={tri} onValueChange={setTri}>
                <SelectTrigger className="h-8 w-56 text-xs" aria-label="Trier la liste">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="offres">Offres actives (décroissant)</SelectItem>
                  <SelectItem value="nom">Nom (A→Z)</SelectItem>
                </SelectContent>
              </Select>

              {/* Chip recherche active : apparition animée. */}
              <AnimatePresence initial={false}>
                {query && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="flex items-center gap-2 motion-reduce:transition-none"
                  >
                    <Badge variant="secondary">« {query} »</Badge>
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={reinitialiserFiltres}>
                      Réinitialiser
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Fondu au changement de recherche / état. Le tri, lui, ne
              remonte PAS la clé : il anime via `layout` sur les <li>. */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${query || "toutes"}-${isLoading ? "chargement" : isError ? "erreur" : "donnees"}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {isError ? (
                  <div className="p-4">
                    <SectionErreur onRetry={refetch} message="Impossible de charger les entreprises." />
                  </div>
                ) : isLoading ? (
                  <div className="flex flex-col gap-2 p-4" aria-busy="true">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                  </div>
                ) : !entreprisesTriees.length ? (
                  <div className="p-4">
                    {query ? (
                      <SectionAucunResultat
                        message={`Aucune entreprise ne correspond à « ${query} ».`}
                        onReset={reinitialiserFiltres}
                      />
                    ) : (
                      <SectionVide message="Aucune entreprise en base." />
                    )}
                  </div>
                ) : (
                  <motion.ul
                    variants={VARIANTS_LISTE}
                    initial="cache"
                    animate="visible"
                    className="flex list-none flex-col gap-1.5 p-4"
                    data-testid="liste-entreprises"
                  >
                    <AnimatePresence initial={false}>
                      {entreprisesTriees.map((entreprise) => (
                        <motion.li
                          key={entreprise.id}
                          layout
                          variants={VARIANTS_LIGNE}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ layout: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
                          onClick={() => setApercuEntreprise(entreprise)}
                          className="group flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:border-primary/30 hover:bg-muted/50"
                        >
                          <AvatarEntreprise entreprise={entreprise} />

                          <div className="flex min-w-0 flex-1 flex-col">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setApercuEntreprise(entreprise)
                              }}
                              className="truncate text-left text-sm font-medium text-primary underline-offset-4 hover:underline"
                              title={`Voir les détails de ${entreprise.name}`}
                            >
                              {entreprise.name}
                            </button>
                            {entreprise.website_url && (
                              <a
                                href={entreprise.website_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="truncate text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                              >
                                {entreprise.website_url}
                              </a>
                            )}
                          </div>

                          <Badge variant="secondary" className="shrink-0 tabular-nums">
                            {entreprise.active_offers_count ?? 0} active{(entreprise.active_offers_count ?? 0) > 1 ? "s" : ""}
                          </Badge>

                          {/* stopPropagation : le menu ne doit pas ouvrir l'aperçu. */}
                          <div onClick={(e) => e.stopPropagation()}>
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
                                <DropdownMenuItem
                                  onClick={() => {
                                    setFusionSource(entreprise)
                                    setFusionOuvert(true)
                                  }}
                                  className="cursor-pointer"
                                >
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
                          </div>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </motion.ul>
                )}
              </motion.div>
            </AnimatePresence>

            {(entreprises?.length ?? 0) > 0 && (
              <div className="border-t border-border px-4 py-3">
                <PaginationListe page={page} pagePleine={pageSuivantePossible} onPageChange={setPage} />
              </div>
            )}
          </SectionCardAdmin>

          {/* ─── Colonne latérale : Top recruteurs (cascade + podium) ─── */}
          <SectionCardAdmin
            title="Top recruteurs"
            description="Classement par offres actives."
            icon={Trophy}
          >
            {topCharge ? (
              <div className="flex flex-col gap-2" aria-busy="true">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : !top?.length ? (
              <p className="text-xs text-muted-foreground">Aucune donnée.</p>
            ) : (
              <motion.ol
                variants={VARIANTS_LISTE}
                initial="cache"
                animate="visible"
                className="flex flex-col gap-1.5"
                aria-label="Top 5 des recruteurs"
              >
                {top.map((entreprise, i) => (
                  <motion.li
                    key={entreprise.id}
                    variants={VARIANTS_LIGNE}
                    className="flex items-center gap-2 rounded-md px-1 py-0.5 text-xs transition-colors hover:bg-muted/50"
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
                        styleRang(i)
                      )}
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <span className="truncate" title={entreprise.name}>{entreprise.name}</span>
                    <span className="ml-auto shrink-0 font-semibold tabular-nums text-muted-foreground">
                      {formatNombre(entreprise.active_offers_count)}
                    </span>
                  </motion.li>
                ))}
              </motion.ol>
            )}
          </SectionCardAdmin>
        </div>

        {/* ─── Aperçu détaillé (Sheet latéral) ─── */}
        <ApercuEntreprise
          ouverte={!!apercuEntreprise}
          onOpenChange={(o) => !o && setApercuEntreprise(null)}
          entreprise={apercuEntreprise}
          onModifier={(e) => setEditionCible(e)}
        />

        {/* ─── Dialogs — key par cible : remontage du formulaire ─── */}
        <DialogEditionEntreprise
          key={editionCible?.id ?? "ferme"}
          ouvert={!!editionCible}
          entreprise={editionCible}
          onFermer={() => setEditionCible(null)}
        />
        <DialogFusionEntreprises
          key={fusionSource?.id ?? "vide"}
          ouvert={fusionOuvert}
          sourcePreselect={fusionSource}
          onFermer={() => {
            setFusionOuvert(false)
            setFusionSource(null)
          }}
        />

        {/* ─── Confirmation désactivation (soft delete) ─── */}
        {suppression && (
          <Dialog open onOpenChange={(o) => !o && setSuppression(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Désactiver « {suppression.name} » ?</DialogTitle>
                <DialogDescription>
                  Suppression logique : l'entreprise est masquée mais conserve son historique —
                  l'action est réversible en base et journalisée dans l'audit.
                </DialogDescription>
              </DialogHeader>

              {/* Avertissement critique isolé (offres actives rattachées). */}
              {(suppression.active_offers_count ?? 0) > 0 && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
                >
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <p>
                    <strong className="tabular-nums">{suppression.active_offers_count}</strong> offre
                    {suppression.active_offers_count > 1 ? "s" : ""} active
                    {suppression.active_offers_count > 1 ? "s" : ""} y sont rattachées — elles
                    disparaîtront du site public. Préférez une <strong>fusion</strong> si elles
                    doivent rester visibles.
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button variant="ghost" size="sm" onClick={() => setSuppression(null)}>Annuler</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={confirmerSuppression}
                  disabled={supprimerMutation.isPending}
                >
                  {supprimerMutation.isPending ? <Spinner className="size-3.5" /> : <Trash2 aria-hidden className="size-3.5" />}
                  {supprimerMutation.isPending ? "Désactivation…" : "Désactiver"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </Bloc>
    </motion.div>
  )
}

const EntreprisesPage = () => (
  <FiltresEntreprisesAdminProvider>
    <Entreprises />
  </FiltresEntreprisesAdminProvider>
)

export default EntreprisesPage