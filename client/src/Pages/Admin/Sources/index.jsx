import { memo, useCallback, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useQueryClient } from "@tanstack/react-query"
import {
  Globe, Loader2, PauseCircle, Pencil, PlayCircle, Plus, Search, ShieldCheck, Trash2, X,
} from "lucide-react"
import { cn } from "cn"
import {
  useAdminSourcesQuery, useCreateSource, useUpdateSource, useChangerStatutSource,
  useDeleteSource, messageErreurSource, adminSourcesKeys,
} from "@/features/admin-sources.tools"
import { useNotify } from "@/contexts/Notify.context"
import CarteCompteur from "@/components/admin/CarteCompteur"
import EnteteTriable from "@/components/admin/EnteteTriable"
import HeroAdmin from "@/components/admin/HeroAdmin"
import BtnAction from "@/components/admin/BtnAction"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import DialogSource from "../../../components/dialog/DialogSource"
import { teinteProtection } from "./components/protection"
import { SectionErreur, SectionVide, SectionAucunResultat } from "./components/EtatsSection"
import { Spinner } from "@/components/ui/spinner"
import Bloc, {VARIANTS_PAGE, VARIANTS_BLOC} from "@/components/admin/Bloc"

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

const LIBELLE_STATUT = {
  active: ["Active", "secondary"],
  paused: ["En pause", "outline"],
  disabled: ["Désactivée", "outline"],
  error: ["En erreur", "destructive"],
}

const dateCourte = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) : "—"

/* Rang de tri des statuts : actif d'abord (desc), erreur en dernier. */
const RANG_STATUT = { active: 4, paused: 3, disabled: 2, error: 1 }

/* Tri « français » robuste : nombres, textes, dates ISO ; vides en fin. */
const comparerValeurs = (a, b) => {
  const videA = a === null || a === undefined || a === ""
  const videB = b === null || b === undefined || b === ""
  if (videA && videB) return 0
  if (videA) return 1
  if (videB) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" })
}

/* Colonnes triables — Actions exclue. `className` embarqué : repris par
   le <th> (EnteteTriable) pour suivre la responsivité du corps. */
const COLONNES = [
  { cle: "source", libelle: "Source", directionInitiale: "asc", triValeur: (s) => (s.name ?? "").toLowerCase() },
  { cle: "statut", libelle: "Statut", directionInitiale: "desc", triValeur: (s) => RANG_STATUT[s.status] ?? 0 },
  { cle: "priorite", libelle: "Priorité", directionInitiale: "asc", triValeur: (s) => s.priority ?? 0 },
  { cle: "protection", libelle: "Anti-scraping", directionInitiale: "desc", triValeur: (s) => s.anti_scraping_level ?? 0 },
  {
    cle: "dernier", libelle: "Dernier scraping", directionInitiale: "desc",
    className: "hidden md:table-cell",
    triValeur: (s) => s.last_scraped_at ?? null,
  },
  {
    cle: "url", libelle: "URL de base", directionInitiale: "asc",
    className: "hidden lg:table-cell",
    triValeur: (s) => s.base_url ?? "",
  },
]

/* ─── Skeleton aux largeurs réalistes (pas de layout shift) ─── */
const LigneSkeleton = () => (
  <motion.tr
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.18 }}
    className="hover:bg-transparent"
  >
    <TableCell>
      <div className="flex flex-col gap-1.5 py-0.5">
        <div className="flex items-center gap-2">
          <Skeleton className="size-2.5 rounded-full" />
          <Skeleton className="h-3.5 w-32" />
        </div>
        <Skeleton className="h-2.5 w-16" />
      </div>
    </TableCell>
    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
    <TableCell className="text-right"><Skeleton className="ml-auto h-3.5 w-8" /></TableCell>
    <TableCell className="text-right"><Skeleton className="ml-auto h-3.5 w-10" /></TableCell>
    <TableCell className="hidden md:table-cell"><Skeleton className="ml-auto h-3.5 w-20" /></TableCell>
    <TableCell className="hidden lg:table-cell"><Skeleton className="h-3 w-40" /></TableCell>
    <TableCell>
      <div className="flex items-center justify-end gap-1">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
      </div>
    </TableCell>
  </motion.tr>
)

const CarteSkeletonMobile = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.18 }}
    className="flex flex-col gap-3 border-b border-border p-4"
  >
    <div className="flex items-center justify-between gap-2">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
    <Skeleton className="h-3 w-full max-w-64" />
    <Skeleton className="h-3 w-48" />
  </motion.div>
)

/* ─── Actions par source (table + cartes mobiles) ───
   stopPropagation : la ligne/carte entière ouvre l'édition. */
const ActionsSource = ({ source, statutEnCours, onBasculer, onEditer, onSupprimer }) => {
  const enPause = source.status === "paused" || source.status === "disabled"
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {/* Bascule rapide pause/réactivation — désactivée pour `disabled`
          (réactivation via le formulaire complet). */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onBasculer(source)}
        disabled={statutEnCours || source.status === "disabled"}
        aria-busy={statutEnCours || undefined}
        aria-label={enPause ? `Réactiver ${source.name}` : `Mettre en pause ${source.name}`}
        title={source.status === "disabled" ? "Source désactivée — réactivation via le formulaire" : enPause ? "Réactiver" : "Mettre en pause"}
      >
        {statutEnCours ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : enPause ? (
          <PlayCircle aria-hidden />
        ) : (
          <PauseCircle aria-hidden />
        )}
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => onEditer(source)} aria-label={`Modifier ${source.name}`}>
        <Pencil aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onSupprimer(source)}
        aria-label={`Supprimer ${source.name}`}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 aria-hidden />
      </Button>
    </div>
  )
}

/* ─── Ligne mémoïsée (table desktop) ────────────────────────────────
   La LIGNE ENTIERE ouvre l'édition au clic (raccourci souris) ; les
   boutons restent le chemin clavier/lecteur d'écran. Feedback
   anti-scraping : pastille colorée selon la sévérité. */
const LigneSource = memo(function LigneSource({
  source, statutEnCours, onBasculer, onEditer, onSupprimer,
}) {
  const [libelle, variante] = LIBELLE_STATUT[source.status] ?? [source.status, "outline"]
  const teinte = teinteProtection(source.anti_scraping_level ?? 0)
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={() => onEditer(source)}
      className="cursor-pointer transition-colors hover:bg-muted/50 motion-reduce:transition-none"
    >
      <TableCell>
        <div className="flex items-center gap-2">
          {source.color_hex && (
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: source.color_hex }} aria-hidden />
          )}
          <span className="font-medium">{source.name}</span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{source.code}</span>
      </TableCell>
      <TableCell>
        <Badge variant={variante}>{libelle}</Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">{source.priority}</TableCell>
      <TableCell className="text-right">
        <span
          className={cn("inline-flex items-center gap-1.5 tabular-nums", teinte.texte)}
          title={`Protection ${teinte.libelle.toLowerCase()} (${source.anti_scraping_level}/5)`}
        >
          <span className={cn("size-1.5 rounded-full", teinte.fond)} aria-hidden />
          {source.anti_scraping_level}/5
        </span>
      </TableCell>
      <TableCell className="hidden whitespace-nowrap text-right text-muted-foreground tabular-nums md:table-cell">
        {dateCourte(source.last_scraped_at)}
      </TableCell>
      <TableCell className="hidden max-w-40 truncate text-muted-foreground lg:table-cell" title={source.base_url}>
        {source.base_url}
      </TableCell>
      <TableCell>
        <ActionsSource
          source={source}
          statutEnCours={statutEnCours}
          onBasculer={onBasculer}
          onEditer={onEditer}
          onSupprimer={onSupprimer}
        />
      </TableCell>
    </motion.tr>
  )
})

/* ─── Carte mémoïsée (vue mobile) ─── */
const CarteSourceMobile = memo(function CarteSourceMobile({
  source, statutEnCours, onBasculer, onEditer, onSupprimer,
}) {
  const [libelle, variante] = LIBELLE_STATUT[source.status] ?? [source.status, "outline"]
  const teinte = teinteProtection(source.anti_scraping_level ?? 0)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={() => onEditer(source)}
      className="flex cursor-pointer flex-col gap-2.5 border-b border-border p-4 transition-colors hover:bg-muted/40 motion-reduce:transition-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {source.color_hex && (
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: source.color_hex }} aria-hidden />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{source.name}</p>
            <p className="font-mono text-[10px] text-muted-foreground">{source.code}</p>
          </div>
        </div>
        <Badge variant={variante} className="shrink-0">{libelle}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>Priorité <span className="font-semibold tabular-nums text-foreground">{source.priority}</span></span>
        <span className={cn("inline-flex items-center gap-1", teinte.texte)}>
          <span className={cn("size-1.5 rounded-full", teinte.fond)} aria-hidden />
          Anti-scraping {source.anti_scraping_level}/5 · {teinte.libelle}
        </span>
        <span>Scrapée le {dateCourte(source.last_scraped_at)}</span>
      </div>
      {source.base_url && (
        <p className="truncate text-[10px] text-muted-foreground" title={source.base_url}>{source.base_url}</p>
      )}
      <ActionsSource
        source={source}
        statutEnCours={statutEnCours}
        onBasculer={onBasculer}
        onEditer={onEditer}
        onSupprimer={onSupprimer}
      />
    </motion.div>
  )
})

const Sources = () => {
  const notify = useNotify()
  const queryClient = useQueryClient()
  const { data: sources, isLoading, isError, refetch } = useAdminSourcesQuery()
  const creerMutation = useCreateSource()
  const modifierMutation = useUpdateSource()
  const statutMutation = useChangerStatutSource()
  const supprimerMutation = useDeleteSource()

  /* Filtres + tri 100 % client (liste courte chargée en une fois). */
  const [recherche, setRecherche] = useState("")
  const [filtreStatut, setFiltreStatut] = useState("")
  /* Tri INITIALISÉ : « Priorité » ascendante = ordre naturel de
     planification du scraping (le chevron actif est visible d'emblée). */
  const [tri, setTri] = useState({ cle: "priorite", direction: "asc" })

  /* Dialog : monté en permanence (prop open) — `enEdition` survit à la
     fermeture pour rester affiché pendant l'animation de sortie. */
  const [enEdition, setEnEdition] = useState(null)
  const [editionOuverte, setEditionOuverte] = useState(false)
  const [suppression, setSuppression] = useState(null)

  const ouvrirCreation = () => {
    setEnEdition({})
    setEditionOuverte(true)
  }
  const ouvrirEdition = useCallback((source) => {
    setEnEdition(source)
    setEditionOuverte(true)
  }, [])
  const fermerEdition = useCallback(() => setEditionOuverte(false), [])
  const demanderSuppression = useCallback((source) => setSuppression(source), [])

  /* Compteurs dérivés — UN seul passage (reduce), zéro appel réseau. */
  const compteurs = useMemo(
    () =>
      (sources ?? []).reduce(
        (acc, s) => {
          acc.total += 1
          if (s.status === "active") acc.actives += 1
          else if (s.status === "paused") acc.enPause += 1
          if (s.supports_scraping) acc.scrapables += 1
          if ((s.anti_scraping_level ?? 0) >= 4) acc.protectionForte += 1
          return acc
        },
        { total: 0, actives: 0, enPause: 0, scrapables: 0, protectionForte: 0 }
      ),
    [sources]
  )

  /* Recherche (nom/code) + filtre statut + tri, en une dérivation. */
  const sourcesAffichees = useMemo(() => {
    let base = sources ?? []
    const q = recherche.trim().toLowerCase()
    if (q) {
      base = base.filter(
        (s) => (s.name ?? "").toLowerCase().includes(q) || (s.code ?? "").toLowerCase().includes(q)
      )
    }
    if (filtreStatut) base = base.filter((s) => s.status === filtreStatut)
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [sources, recherche, filtreStatut, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre naturel). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "asc" }
      if (prec.direction === (colonne.directionInitiale ?? "asc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  const reinitialiserFiltres = () => {
    setRecherche("")
    setFiltreStatut("")
  }
  const filtresActifs = !!(recherche.trim() || filtreStatut)

  /* ─── Bascule statut OPTIMISTE ─────────────────────────────────────
     Le cache TanStack est mis à jour AVANT la réponse serveur : le
     flip PauseCircle ↔ PlayCircle est immédiat. En cas d'erreur :
     rollback sur l'instantané puis resynchronisation (onSettled). ─── */
  const basculerStatut = useCallback(
    (source) => {
      const nouveau = source.status === "active" ? "paused" : "active"
      const cle = [...adminSourcesKeys.root]
      const instantane = queryClient.getQueryData(cle)
      queryClient.setQueryData(cle, (ancien) =>
        (ancien ?? []).map((s) => (s.id === source.id ? { ...s, status: nouveau } : s))
      )
      statutMutation.mutate(
        { id: source.id, status: nouveau },
        {
          onSuccess: () =>
            notify(`Source « ${source.name} » ${nouveau === "active" ? "réactivée" : "mise en pause"}`, "success"),
          onError: (err) => {
            queryClient.setQueryData(cle, instantane) // rollback
            notify(messageErreurSource(err) || "Action impossible", "error")
          },
          onSettled: () => queryClient.invalidateQueries({ queryKey: adminSourcesKeys.root }),
        }
      )
    },
    [queryClient, statutMutation, notify]
  )

  const confirmerSuppression = () => {
    if (!suppression) return
    supprimerMutation.mutate(suppression.id, {
      onSuccess: () => {
        notify(`Source « ${suppression.name} » supprimée`, "success")
        setSuppression(null)
        refetch()
      },
      onError: (err) => {
        notify(messageErreurSource(err) || "Suppression impossible (source liée à des offres ?)", "error")
        setSuppression(null)
      },
    })
  }

  const statutEnCoursPour = (source) =>
    statutMutation.isPending && statutMutation.variables?.id === source.id

  /* key = fondu du corps à chaque changement de tri / filtre statut
     (la recherche, elle, est gérée par l'AnimatePresence ligne à ligne). */
  const cleCorps = `${filtreStatut}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* ─── En-tête ─── */}
      <motion.div variants={VARIANTS_BLOC}>
        <Bloc>
          <HeroAdmin
            title="Gestion des sources"
            description="Gestion des sources de scraping : activation, pause, priorité et niveau de protection."
            icon={Globe}
            titleBdge="Référentiels"
          >
            <BtnAction size="sm" onClick={ouvrirCreation}>
              <Plus aria-hidden className="size-4" /> Nouvelle source
            </BtnAction>
          </HeroAdmin>
        </Bloc>
      </motion.div>

      {/* ─── Compteurs (dérivés de la liste, un seul passage) ─── */}
      <motion.div variants={VARIANTS_BLOC}>
        <Bloc className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <CarteCompteur
            label="Sources actives"
            valeur={compteurs.actives}
            suffixe={`/${compteurs.total}`}
            icone={Globe}
            chargement={isLoading}
          />
          <CarteCompteur label="En pause" valeur={compteurs.enPause} icone={PauseCircle} chargement={isLoading} />
          <CarteCompteur label="Scrapables" valeur={compteurs.scrapables} icone={PlayCircle} chargement={isLoading} />
          <CarteCompteur
            label="Protection forte"
            valeur={compteurs.protectionForte}
            description="anti-scraping ≥ 4/5"
            icone={ShieldCheck}
            chargement={isLoading}
          />
        </Bloc>
      </motion.div>

      {/* ─── Carte principale : filtres + corps responsive ─── */}
      <SectionCardAdmin
        title="Liste des sources"
        description="Gestion des sources de scraping : activation, pause, priorité et niveau de protection."
        icon={Globe}
        contentClassName="p-0 sm:p-0"
        badge={
          !isLoading && !isError && (sources?.length ?? 0) > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {sources.length} source{sources.length > 1 ? "s" : ""}
            </Badge>
          )
        }
      >        
        {/* ─── Barre de filtres : recherche nom/code + statut ─── */}
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* ─── Recherche : Spinner tant que la requête est en cours ─── */}
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
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher un nom ou un code…"
                aria-label="Rechercher une source par nom ou code"
                className="h-8 pl-8 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Sentinelle « tous » : Radix refuse la valeur vide. */}
              <Select value={filtreStatut || "tous"} onValueChange={(v) => setFiltreStatut(v === "tous" ? "" : v)}>
                <SelectTrigger className="h-8 w-44 text-xs" aria-label="Filtrer par statut">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les statuts</SelectItem>
                  {Object.entries(LIBELLE_STATUT).map(([valeur, [libelle]]) => (
                    <SelectItem key={valeur} value={valeur}>{libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filtresActifs && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={reinitialiserFiltres}>
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {isError ? (
          <div className="p-4">
            <SectionErreur onRetry={refetch} message="Impossible de charger les sources." />
          </div>
        ) : (
          <Bloc>
            {/* ─── Vue mobile : cartes empilées ─── */}
            <div key={`mobile-${cleCorps}`} className="animate-in fade-in duration-200 motion-reduce:animate-none md:hidden">
              <AnimatePresence mode="wait" initial={false}>
                {isLoading ? (
                  [...Array(3)].map((_, i) => <CarteSkeletonMobile key={`msquel-${i}`} />)
                ) : !sources?.length ? (
                  <motion.div key="vide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="p-4">
                    <SectionVide message="Aucune source configurée. Lancez le seed (npm run seed:scraper-sources)." />
                  </motion.div>
                ) : !sourcesAffichees.length ? (
                  <motion.div key="aucun" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="p-4">
                    <SectionAucunResultat onReset={reinitialiserFiltres} message="Aucune source ne correspond à ces critères." />
                  </motion.div>
                ) : (
                  sourcesAffichees.map((source) => (
                    <CarteSourceMobile
                      key={source.id}
                      source={source}
                      statutEnCours={statutEnCoursPour(source)}
                      onBasculer={basculerStatut}
                      onEditer={ouvrirEdition}
                      onSupprimer={demanderSuppression}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* ─── Vue desktop : table triable ─── */}
            <div key={`table-${cleCorps}`} className="hidden overflow-x-auto scrollbar-thin animate-in fade-in duration-200 motion-reduce:animate-none md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <EnteteTriable colonne={COLONNES.find((c) => c.cle === "source")} tri={tri} onTri={basculerTri} />
                    <EnteteTriable colonne={COLONNES.find((c) => c.cle === "statut")} tri={tri} onTri={basculerTri} />
                    <EnteteTriable colonne={COLONNES.find((c) => c.cle === "priorite")} tri={tri} onTri={basculerTri} aligneDroite />
                    <EnteteTriable colonne={COLONNES.find((c) => c.cle === "protection")} tri={tri} onTri={basculerTri} aligneDroite />
                    <EnteteTriable colonne={COLONNES.find((c) => c.cle === "dernier")} tri={tri} onTri={basculerTri} aligneDroite />
                    <EnteteTriable colonne={COLONNES.find((c) => c.cle === "url")} tri={tri} onTri={basculerTri} />
                    <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                {/* AnimatePresence + motion.tr : le squelette fond en
                    douceur vers les lignes réelles (pas de tressautement). */}
                <TableBody>
                  <AnimatePresence mode="wait" initial={false}>
                    {isLoading ? (
                      [...Array(6)].map((_, i) => <LigneSkeleton key={`squel-${i}`} />)
                    ) : !sources?.length ? (
                      <motion.tr key="vide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="hover:bg-transparent">
                        <TableCell colSpan={7}>
                          <SectionVide message="Aucune source configurée. Lancez le seed (npm run seed:scraper-sources)." />
                        </TableCell>
                      </motion.tr>
                    ) : !sourcesAffichees.length ? (
                      <motion.tr key="aucun" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="hover:bg-transparent">
                        <TableCell colSpan={7}>
                          <SectionAucunResultat onReset={reinitialiserFiltres} message="Aucune source ne correspond à ces critères." />
                        </TableCell>
                      </motion.tr>
                    ) : (
                      sourcesAffichees.map((source) => (
                        <LigneSource
                          key={source.id}
                          source={source}
                          statutEnCours={statutEnCoursPour(source)}
                          onBasculer={basculerStatut}
                          onEditer={ouvrirEdition}
                          onSupprimer={demanderSuppression}
                        />
                      ))
                    )}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>

            {/* ─── Pied : compteur affiché + reset ─── */}
            {!isLoading && (sources?.length ?? 0) > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {sourcesAffichees.length} source{sourcesAffichees.length > 1 ? "s" : ""} affichée{sourcesAffichees.length > 1 ? "s" : ""} sur {sources.length}
                </span>
                {filtresActifs && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={reinitialiserFiltres}
                  >
                    <X className="size-3.5" aria-hidden="true" /> Réinitialiser
                  </Button>
                )}
              </div>
            )}
          </Bloc>
        )}
      </SectionCardAdmin>

      {/* Dialog création/édition — monté en permanence, piloté par `open`. */}
      <DialogSource
        open={editionOuverte}
        source={enEdition?.id ? enEdition : null}
        mutation={enEdition?.id ? modifierMutation : creerMutation}
        onFermer={fermerEdition}
      />

      {/* Confirmation suppression — AlertDialog (overlay + focus trap). */}
      <AlertDialog open={!!suppression} onOpenChange={(o) => !o && setSuppression(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {suppression?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Si des offres sont rattachées à cette source
              (clé étrangère), la suppression sera refusée par le serveur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setSuppression(null)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmerSuppression} disabled={supprimerMutation.isPending}>
              {supprimerMutation.isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}

export default Sources