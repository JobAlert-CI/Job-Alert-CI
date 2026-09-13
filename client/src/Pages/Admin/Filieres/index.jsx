import { useMemo, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronDown, ChevronRight, ChevronsUpDown, ChevronUp,
  KeyRound, Pencil, Plus, Trash2,
} from "lucide-react"
import { cn } from "cn"
import { useNotify } from "@/contexts/Notify.context"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import {
  useAdminFilieresQuery, useDeleteFiliere, useUpdateFiliereKeywords,
  useStatsOffresParFiliere, useStatsAbonnesParFiliere, messageErreurReferentiel,
  useUpdateFiliere,
  useCreateFiliere,
} from "@/features/admin-filieres.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { SectionVide } from "./components/EtatsSection"
import CompteursFilieres from "./sections/CompteursFilieres"
import ChartCroisement from "./sections/ChartCroisement"
import EditeurMotsCles from "./components/EditeurMotsCles"
import SectionSpecialites from "./sections/SectionSpecialites"
import DialogFiliere from "../../../components/dialog/DialogFiliere"
import HeroAdmin from "@/components/admin/HeroAdmin"
import BtnAction from "@/components/admin/BtnAction"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"

/* ─────────────────────────────────────────────────────────────────────
  Page Gestion des filières — /admin/filieres (super_admin).
───────────────────────────────────────────────────────────────────── */

const VARIANTS_PAGE = {
  cache: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
}

const VARIANTS_BLOC = {
  cache: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
}

/* Sens naturel du premier clic par colonne. */
const DIRECTION_INITIALE = {
  label: "asc",
  keywords: "desc",
  offres: "desc",
  abonnes: "desc",
  specialites: "desc",
  ordre: "asc",
}

/* ─── En-tête de colonne triable (aria-sort sur le <th>) ─── */
const EnteteTriable = ({ cle, label, tri, onTri, className }) => {
  const actif = tri?.cle === cle
  return (
    <TableHead
      aria-sort={actif ? (tri.direction === "asc" ? "ascending" : "descending") : "none"}
      className={className}
    >
      <button
        type="button"
        onClick={() => onTri(cle)}
        title={`Trier par ${label}`}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          actif ? "text-foreground" : "text-muted-foreground/80"
        )}
      >
        {label}
        {actif ? (
          tri.direction === "asc" ? (
            <ChevronUp className="size-3.5 text-primary" aria-hidden />
          ) : (
            <ChevronDown className="size-3.5 text-primary" aria-hidden />
          )
        ) : (
          <ChevronsUpDown className="size-3.5 opacity-40" aria-hidden />
        )}
      </button>
    </TableHead>
  )
}

/* ─── Skeleton réaliste : une ligne aux largeurs des vraies colonnes ─── */
const SkeletonLigneFiliere = () => (
  <TableRow className="hover:bg-transparent">
    <TableCell className="w-8"><Skeleton className="size-6 rounded-md" /></TableCell>
    <TableCell>
      <div className="flex items-center gap-2">
        <Skeleton className="size-2.5 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>
    </TableCell>
    <TableCell className="hidden md:table-cell"><Skeleton className="h-3 w-16" /></TableCell>
    <TableCell className="text-right"><Skeleton className="ml-auto h-3.5 w-8" /></TableCell>
    <TableCell className="text-right"><Skeleton className="ml-auto h-3.5 w-8" /></TableCell>
    <TableCell className="text-right"><Skeleton className="ml-auto h-3.5 w-8" /></TableCell>
    <TableCell className="hidden text-right lg:table-cell"><Skeleton className="ml-auto h-3.5 w-8" /></TableCell>
    <TableCell className="hidden text-right lg:table-cell"><Skeleton className="ml-auto h-3.5 w-8" /></TableCell>
    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
    <TableCell><Skeleton className="size-7 rounded-md" /></TableCell>
  </TableRow>
)

/* ─── Ligne filière + panneau d'expansion animé ─── */
const LigneFiliere = ({
  filiere, ouverte, nbOffres, nbAbonnes,
  onEtendre, onFermer, onEditer, onSupprimer, keywordsMutation,
}) => (
  <>
    <TableRow className={cn("transition-colors hover:bg-muted/50", ouverte && "bg-muted/40")}>
      <TableCell>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onEtendre}
          aria-expanded={ouverte}
          aria-label={ouverte ? `Replier ${filiere.label}` : `Déplier ${filiere.label} (mots-clés et spécialités)`}
        >
          {ouverte ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
        </Button>
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-2 text-sm font-medium">
          {filiere.color_hex && (
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: filiere.color_hex }} aria-hidden />
          )}
          {filiere.label}
        </span>
      </TableCell>
      <TableCell className="hidden font-mono text-[10px] text-muted-foreground md:table-cell">
        {filiere.code}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className="inline-flex items-center gap-1">
          <KeyRound className="size-3 text-muted-foreground" aria-hidden />
          {filiere.keywords?.length ?? 0}
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">{nbOffres}</TableCell>
      <TableCell className="text-right tabular-nums">{nbAbonnes}</TableCell>
      <TableCell className="hidden text-right tabular-nums text-muted-foreground lg:table-cell">
        {filiere.specialties?.length ?? 0}
      </TableCell>
      <TableCell className="hidden text-right tabular-nums text-muted-foreground lg:table-cell">
        {filiere.sort_order}
      </TableCell>
      <TableCell>
        <Badge variant={filiere.is_active ? "secondary" : "outline"}>
          {filiere.is_active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${filiere.label}`} />}
          />
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuItem onClick={onEtendre} className="cursor-pointer">
              <KeyRound className="size-3.5" aria-hidden /> Mots-clés
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEditer} className="cursor-pointer">
              <Pencil className="size-3.5" aria-hidden /> Modifier
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSupprimer} className="cursor-pointer text-destructive">
              <Trash2 className="size-3.5" aria-hidden /> Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>

    {/* Panneau d'expansion : déploiement height 0 → auto (AnimatePresence). */}
    <AnimatePresence initial={false}>
      {ouverte && (
        <motion.tr
          key="panneau"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-b border-border bg-muted/30"
        >
          <TableCell colSpan={10} className="p-0">
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden motion-reduce:transition-none"
            >
              <div className="flex flex-col gap-3 p-3">
                <EditeurMotsCles
                  filiere={filiere}
                  mutation={keywordsMutation}
                  onFermer={onFermer}
                  compact
                />
                <SectionSpecialites filiereId={filiere.id} />
              </div>
            </motion.div>
          </TableCell>
        </motion.tr>
      )}
    </AnimatePresence>
  </>
)

const FilierePage = () => {
  const notify = useNotify()
  const { data: filieres, isLoading } = useAdminFilieresQuery()
  const { data: statsOffres } = useStatsOffresParFiliere()
  const { data: statsAbonnes } = useStatsAbonnesParFiliere()
  const creerMutation = useCreateFiliere()
  const modifierMutation = useUpdateFiliere()
  const offresParCode = useMemo(
    () => new Map((statsOffres ?? []).map((f) => [f.code, f.total_offers ?? 0])),
    [statsOffres]
  )
  const abonnesParCode = useMemo(
    () => new Map((statsAbonnes ?? []).map((f) => [f.code, f.subscribers_count ?? 0])),
    [statsAbonnes]
  )

  const [etendue, setEtendue] = useState(null)      // UN SEUL panneau ouvert à la fois
  const [tri, setTri] = useState(null)              // null = ordre naturel (sort_order)
  const [edition, setEdition] = useState(null)      // null fermé | {} création | filière
  const [suppression, setSuppression] = useState(null)
  const supprimerMutation = useDeleteFiliere()
  const keywordsMutation = useUpdateFiliereKeywords()

  const basculerExtension = (id) => setEtendue((prec) => (prec === id ? null : id))

  /* Cycle de tri : sens naturel → sens inverse → ordre initial. */
  const cycleTri = (cle) => {
    setTri((prec) => {
      if (prec?.cle !== cle) return { cle, direction: DIRECTION_INITIALE[cle] }
      if (prec.direction === DIRECTION_INITIALE[cle]) {
        return { cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      }
      return null
    })
  }

  const filieresTriees = useMemo(() => {
    const base = [...(filieres ?? [])]
    if (!tri) return base.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const acces = {
      label: (f) => (f.label ?? "").toLowerCase(),
      keywords: (f) => f.keywords?.length ?? 0,
      offres: (f) => offresParCode.get(f.code) ?? 0,
      abonnes: (f) => abonnesParCode.get(f.code) ?? 0,
      specialites: (f) => f.specialties?.length ?? 0,
      ordre: (f) => f.sort_order ?? 0,
    }
    const get = acces[tri.cle]
    return base.sort((a, b) => {
      const va = get(a)
      const vb = get(b)
      const cmp = typeof va === "string" ? va.localeCompare(vb, "fr") : va - vb
      return tri.direction === "asc" ? cmp : -cmp
    })
  }, [filieres, tri, offresParCode, abonnesParCode])

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
          title="Gestion des filières"
          titleBdge="Référentiels"
          icon={KeyRound}
          description="Référentiel le plus stratégique du produit : chaque mot-clé affecte la qualité du matching offre ↔ abonné. L'édition n'est PAS à l'aveugle."
        >
          <BtnAction size="sm" onClick={() => setEdition({})}>
            <Plus aria-hidden className="size-4" /> Nouvelle filière
          </BtnAction>
        </HeroAdmin>
      </motion.div>

      {/* ─── Compteurs (0 appel réseau en plus) ─── */}
      <motion.div variants={VARIANTS_BLOC}>
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <CompteursFilieres />
        </ErrorBoundary>
      </motion.div>

      {/* ─── Chart Offre vs Demande ─── */}
      <motion.div variants={VARIANTS_BLOC}>
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <ChartCroisement />
        </ErrorBoundary>
      </motion.div>

      <SectionCardAdmin
        title="Filières"
        description="Liste des filières, ordonnées par ordre de priorité."
        icon={KeyRound}
        contentClassName="p-0 sm:p-0"
      >
        <motion.div variants={VARIANTS_BLOC}>
          <ErrorBoundary FallbackComponent={AdminSectionFallback}>
            <section aria-label="Liste des filières" className="overflow-x-auto bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-8" />
                    <EnteteTriable cle="label" label="Filière" tri={tri} onTri={cycleTri} />
                    <TableHead className="hidden text-muted-foreground/80 md:table-cell">Code</TableHead>
                    <EnteteTriable cle="keywords" label="Mots-clés" tri={tri} onTri={cycleTri} className="text-right" />
                    <EnteteTriable cle="offres" label="Offres" tri={tri} onTri={cycleTri} className="text-right" />
                    <EnteteTriable cle="abonnes" label="Abonnés" tri={tri} onTri={cycleTri} className="text-right" />
                    <EnteteTriable
                      cle="specialites" label="Spécialités" tri={tri} onTri={cycleTri}
                      className="hidden text-right lg:table-cell"
                    />
                    <EnteteTriable
                      cle="ordre" label="Ordre" tri={tri} onTri={cycleTri}
                      className="hidden text-right lg:table-cell"
                    />
                    <TableHead className="hidden text-muted-foreground/80 md:table-cell">Statut</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(6)].map((_, i) => <SkeletonLigneFiliere key={i} />)
                  ) : !filieresTriees.length ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={10}>
                        <SectionVide message="Aucune filière configurée — créez la première pour activer le matching." />
                      </TableCell>
                    </TableRow>
                  ) : (
                    filieresTriees.map((filiere) => (
                      <LigneFiliere
                        key={filiere.id}
                        filiere={filiere}
                        ouverte={etendue === filiere.id}
                        nbOffres={offresParCode.get(filiere.code) ?? 0}
                        nbAbonnes={abonnesParCode.get(filiere.code) ?? 0}
                        onEtendre={() => basculerExtension(filiere.id)}
                        onFermer={() => setEtendue(null)}
                        onEditer={() => setEdition(filiere)}
                        onSupprimer={() => setSuppression(filiere)}
                        keywordsMutation={keywordsMutation}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </section>
          </ErrorBoundary>
        </motion.div>
      </SectionCardAdmin>

      {/* ─── Table des filières ─── */}

      {/* ─── Dialogs ─── */}
      {edition && (
        <DialogFiliere
          key={edition.id ?? "nouvelle"}
          filiere={edition.id ? edition : null}
          mutation={edition.id ? modifierMutation : creerMutation}
          onFermer={() => setEdition(null)}
        />
      )}

      {suppression && (
        <Dialog open onOpenChange={(ouvert) => !ouvert && setSuppression(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Supprimer la filière « {suppression.label} » ?</DialogTitle>
              <DialogDescription>
                Les abonnés rattachés perdront cette filière de matching et les offres
                ne seront plus taguées avec. Action irréversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
              <Button
                variant="destructive"
                disabled={supprimerMutation.isPending}
                onClick={() =>
                  supprimerMutation.mutate(suppression.id, {
                    onSuccess: () => {
                      notify(`Filière « ${suppression.label} » supprimée`, "success")
                      setSuppression(null)
                      if (etendue === suppression.id) setEtendue(null)
                    },
                    onError: (err) => notify(messageErreurReferentiel(err), "error"),
                  })
                }
              >
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </motion.div>
  )
}

export default FilierePage