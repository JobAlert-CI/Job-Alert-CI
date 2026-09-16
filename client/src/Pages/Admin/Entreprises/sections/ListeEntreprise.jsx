import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Building2, Merge, MoreHorizontal, Pencil, Search, Trash2,
} from "lucide-react"
import {
  useFiltresEntreprisesAdmin,
} from "@/contexts/FiltresEntreprisesAdmin.context"
import {
  useAdminCompaniesQuery, useSupprimerEntreprise, messageErreurCompany,
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
import DialogEditionEntreprise from "@/components/dialog/DialogEditionEntreprise"
import DialogFusionEntreprises from "@/components/dialog/DialogFusionEntreprises"
import { SectionErreur, SectionVide, SectionAucunResultat, TransitionEtat } from "@/components/admin/EtatsSection"
import { ApercuEntreprise } from "@/components/admin/ApercuEntreprise"
import PaginationListe from "@/components/admin/PaginationListe"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import DialogSupprEntreprise from "@/components/dialog/DialogSupprEntreprise"
import BtnAction from "@/components/admin/BtnAction"
import Bloc from "@/components/admin/Bloc"

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

/* ── SKELETONS FIDÈLES ───────────────────────────────────────────── */

const BlocSkel = ({ className, delay = 0 }) => (
  <Skeleton className={className} style={delay ? { animationDelay: `${delay}ms` } : undefined} />
)

/* Ligne fidèle au motion.li réel : avatar (size-9) + nom/site + badge
   compteur + bouton actions — mêmes gap/border/padding. */
const SkeletonLigneEntreprise = ({ delay = 0 }) => (
  <div
    className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
    aria-hidden="true"
  >
    <BlocSkel className="size-9 shrink-0 rounded-md" delay={delay} />
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <BlocSkel className="h-3.5 w-2/3" delay={delay} />
      <BlocSkel className="h-2.5 w-1/3" delay={delay} />
    </div>
    <BlocSkel className="h-5 w-20 shrink-0 rounded-full" delay={delay} />
    <BlocSkel className="size-7 shrink-0 rounded-md" delay={delay} />
  </div>
)

const ListeEntrepriseSkeleton = ({ nbLignes = 6 }) => (
  <div
    role="status"
    aria-label="Chargement de la liste des entreprises"
    className="flex flex-col gap-1.5 p-4"
  >
    {Array.from({ length: nbLignes }, (_, i) => (
      <SkeletonLigneEntreprise key={i} delay={i * 70} />
    ))}
  </div>
)

/* ── COMPOSANT PRINCIPAL ─────────────────────────────────────────── */

const ListeEntreprise = () => {
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

  /* Clé d'état de la transition. Le tri reste volontairement EXCLU :
     il anime via `layout` sur les <li>, sans fondu global. */
  const etat = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !entreprisesTriees.length
        ? query ? "aucun-resultat" : "vide"
        : "donnees"

  return (
    <>
      <SectionCardAdmin
        title="Liste des entreprises"
        description="Recherche par nom, tri par offres actives ou alphabétique, actions par ligne."
        icon={Building2}
        contentClassName="p-0 sm:p-0"
      >
        <Bloc>
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
                  <BtnAction variant="outline" size="xs" onClick={reinitialiserFiltres}>
                    Réinitialiser
                  </BtnAction>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Fondu au changement de recherche / état — TransitionEtat. */}
          <TransitionEtat etat={`${query || "toutes"}-${etat}`} className="animate-in fade-in duration-200 motion-reduce:animate-none">
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les entreprises." />
              </div>
            ) : isLoading ? (
              <ListeEntrepriseSkeleton nbLignes={6} />
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
                                <MoreHorizontal aria-hidden />
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
          </TransitionEtat>

          {(entreprises?.length ?? 0) > 0 && (
            <div className="border-t border-border px-4 py-3">
              <PaginationListe page={page} pagePleine={pageSuivantePossible} onPageChange={setPage} />
            </div>
          )}
        </Bloc>
      </SectionCardAdmin>

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
        <DialogSupprEntreprise
          key={suppression.id}
          ouvert={!!suppression}
          onOpenChange={(o) => !o && setSuppression(null)}
          entreprise={suppression}
          entrepriseMut={supprimerMutation}
          confirmerSuppression={confirmerSuppression}
        />
      )}
    </>
  )
}

export default ListeEntreprise