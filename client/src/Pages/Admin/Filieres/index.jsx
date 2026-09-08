import { useMemo, useState } from "react"
import { KeyRound, Plus, ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import { ErrorBoundary } from "react-error-boundary"
import { useNotify } from "@/contexts/Notify.context"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import {
  useAdminFilieresQuery, useCreateFiliere, useUpdateFiliere, useDeleteFiliere,
  useUpdateFiliereKeywords, useStatsOffresParFiliere, useStatsAbonnesParFiliere,
  messageErreurReferentiel,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SectionErreur, SectionVide } from "./components/EtatsSection"
import CompteursFilieres from "./sections/CompteursFilieres"
import ChartCroisement from "./sections/ChartCroisement"
import EditeurMotsCles from "./components/EditeurMotsCles"
import SectionSpecialites from "./sections/SectionSpecialites"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion des filières — /admin/filieres (super_admin, doc v3 §12).

   Référentiel le plus stratégique du produit : chaque mot-clé affecte
   la qualité du matching offre ↔ abonné. L'édition n'est PAS à
   l'aveugle : simulate avant sauvegarde + avertissements permanents.

   Structure (cycle 12 + compteurs/charts sélection utilisateur) :
   - 4 compteurs (actives, offres rattachées, abonnés rattachés,
     sans mot-clé) — 2 dérivés de la liste, 2 via endpoints stats ;
   - chart « Offre vs demande » (croisement local, 0 appel en plus) ;
   - table des filières avec colonnes Offres / Abonnés par filière ;
   - panneau mots-clés + spécialités EN LIGNE D'EXPANSION sous la
     ligne de la filière concernée — UN SEUL panneau ouvert à la fois
     (ouvrir une autre filière referme la première) ;
   - dialog création/édition (code non modifiable après création) ;
   - suppression avec confirmation.

   ⚠️ PUT keywords REMPLACE la liste entière (vérifié serveur) :
   toujours charger l'existant avant d'autoriser la sauvegarde.
   ───────────────────────────────────────────────────────────────────── */

const FilierePage = () => {
  const notify = useNotify()
  const { data: filieres, isLoading, isError, refetch } = useAdminFilieresQuery()

  // Volumétrie par filière (colonnes table + chart) : maps code → nombre.
  const { data: statsOffres } = useStatsOffresParFiliere()
  const { data: statsAbonnes } = useStatsAbonnesParFiliere()
  const offresParCode = useMemo(
    () => new Map((statsOffres ?? []).map((f) => [f.code, f.total_offers ?? 0])),
    [statsOffres]
  )
  const abonnesParCode = useMemo(
    () => new Map((statsAbonnes ?? []).map((f) => [f.code, f.subscribers_count ?? 0])),
    [statsAbonnes]
  )

  // Cycle 19 (F4) : atterrissage post-approbation d'une suggestion IA —
  // ?etendue=<id> ouvre DIRECTEMENT le panneau mots-clés de la nouvelle
  // filière. Lecture UNE fois au montage (initialiseur paresseux : zéro
  // setState-in-effect) ; l'état local reprend ensuite la main — un clic
  // referme normalement, un refresh ré-ouvre (lien partageable).
  const [searchParams] = useSearchParams()
  const [etendue, setEtendue] = useState(() => searchParams.get("etendue"))  // UN SEUL panneau ouvert à la fois
  const [edition, setEdition] = useState(null)           // null = fermé ; {} = création
  const [suppression, setSuppression] = useState(null)    // confirmation

  const creerMutation = useCreateFiliere()
  const modifierMutation = useUpdateFiliere()
  const supprimerMutation = useDeleteFiliere()
  const keywordsMutation = useUpdateFiliereKeywords()

  // Ouvrir une autre filière referme automatiquement la précédente
  // (état unique `etendue`, pas de Set).
  const basculerExtension = (id) => setEtendue((prec) => (prec === id ? null : id))

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* ─── En-tête ─── */}
      <section aria-label="En-tête filières" className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-lg font-bold">
            <KeyRound className="size-5 text-primary" aria-hidden />
            Filières
          </h1>
          <p className="text-xs text-muted-foreground">
            Référentiel de matching offre ↔ abonné — {filieres?.length ?? "…"} filières.
            Les mots-clés s'appliquent au <strong>prochain</strong> scraping uniquement.
          </p>
        </div>
        <Button size="sm" onClick={() => setEdition({})}>
          <Plus aria-hidden /> Nouvelle filière
        </Button>
      </section>

      {/* ─── Compteurs (sélection utilisateur cycle 12) ─── */}
      <ErrorBoundary FallbackComponent={AdminSectionFallback}>
        <CompteursFilieres />
      </ErrorBoundary>

      {/* ─── Chart croisement Offre vs Demande ─── */}
      <ErrorBoundary FallbackComponent={AdminSectionFallback}>
        <ChartCroisement />
      </ErrorBoundary>

      {/* ─── Table des filières ─── */}
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les filières." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : !filieres?.length ? (
        <SectionVide message="Aucune filière configurée — créez la première pour activer le matching." />
      ) : (
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <section aria-label="Liste des filières" className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Filière</TableHead>
                  <TableHead className="hidden md:table-cell">Code</TableHead>
                  <TableHead className="text-right">Mots-clés</TableHead>
                  <TableHead className="text-right">Offres</TableHead>
                  <TableHead className="text-right">Abonnés</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Spécialités</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Ordre</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filieres.map((filiere) => {
                  const ouverte = etendue === filiere.id
                  return (
                    <ErrorBoundary key={filiere.id} FallbackComponent={AdminSectionFallback}>
                      <LigneFiliere
                        filiere={filiere}
                        ouverte={ouverte}
                        nbOffres={offresParCode.get(filiere.code) ?? 0}
                        nbAbonnes={abonnesParCode.get(filiere.code) ?? 0}
                        onEtendre={() => basculerExtension(filiere.id)}
                        onEditer={() => setEdition(filiere)}
                        onSupprimer={() => setSuppression(filiere)}
                      />
                      {ouverte && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={10} className="px-3 py-3">
                            <div className="flex flex-col gap-3">
                              {/* Panneau mots-clés + spécialités SOUS la ligne concernée */}
                              <EditeurMotsCles
                                filiere={filiere}
                                mutation={keywordsMutation}
                                onFermer={() => setEtendue(null)}
                                compact
                              />
                              <SectionSpecialites filiereId={filiere.id} />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </ErrorBoundary>
                  )
                })}
              </TableBody>
            </Table>
          </section>
        </ErrorBoundary>
      )}

      {/* ─── Dialog création / édition ─── */}
      {edition && (
        <DialogFiliere
          filiere={edition.id ? edition : null}
          mutation={edition.id ? modifierMutation : creerMutation}
          onFermer={() => setEdition(null)}
        />
      )}

      {/* ─── Confirmation suppression ─── */}
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
    </div>
  )
}

/* ─── Ligne de table + ligne d'expansion ─── */

const LigneFiliere = ({
  filiere, ouverte, nbOffres, nbAbonnes, onEtendre, onEditer, onSupprimer,
}) => (
  <TableRow className={ouverte ? "bg-muted/40" : undefined}>
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
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: filiere.color_hex }}
            aria-hidden
          />
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
)

/* ─── Dialog création / édition (code verrouillé en édition) ─── */

const CHAMPS_DIALOG = [
  { name: "code", label: "Code", aide: "Clé d'API unique (ex. tech-dev) — non modifiable après création." },
  { name: "label", label: "Libellé" },
  { name: "slug", label: "Slug", aide: "Segment d'URL public." },
]

const DialogFiliere = ({ filiere, mutation, onFermer }) => {
  const notify = useNotify()
  const edit = !!filiere
  const [valeurs, setValeurs] = useState(() => ({
    code: filiere?.code ?? "",
    label: filiere?.label ?? "",
    slug: filiere?.slug ?? "",
    tagline: filiere?.tagline ?? "",
    description: filiere?.description ?? "",
    sort_order: filiere?.sort_order ?? 100,
    is_active: filiere?.is_active ?? true,
  }))

  const enregistrer = () => {
    if (edit) {
      mutation.mutate(
        {
          id: filiere.id,
          data: {
            label: valeurs.label,
            slug: valeurs.slug,
            tagline: valeurs.tagline || null,
            description: valeurs.description || null,
            sort_order: Number(valeurs.sort_order) || 0,
            is_active: valeurs.is_active,
          },
        },
        {
          onSuccess: () => { notify("Filière mise à jour", "success"); onFermer() },
          onError: (err) => notify(messageErreurReferentiel(err), "error"),
        }
      )
    } else {
      mutation.mutate(
        {
          code: valeurs.code.trim(),
          label: valeurs.label.trim(),
          slug: valeurs.slug.trim(),
          tagline: valeurs.tagline.trim() || null,
          description: valeurs.description.trim() || null,
          sort_order: Number(valeurs.sort_order) || 100,
          is_active: valeurs.is_active,
        },
        {
          onSuccess: () => { notify("Filière créée", "success"); onFermer() },
          onError: (err) => notify(messageErreurReferentiel(err), "error"),
        }
      )
    }
  }

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{edit ? `Modifier « ${filiere.label} »` : "Nouvelle filière"}</DialogTitle>
          <DialogDescription>
            Le code et le libellé servent au matching et aux filtres publics.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {CHAMPS_DIALOG.map(({ name, label, aide }) => (
            <div key={name} className="flex flex-col gap-1.5">
              <Label htmlFor={`filiere-${name}`}>{label}</Label>
              <Input
                id={`filiere-${name}`}
                value={valeurs[name]}
                onChange={(e) => setValeurs((v) => ({ ...v, [name]: e.target.value }))}
                disabled={edit && name === "code"}
                className={name === "code" ? "font-mono" : undefined}
              />
              {aide && <p className="text-[10px] text-muted-foreground">{aide}</p>}
            </div>
          ))}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filiere-tagline">Accroche (optionnel)</Label>
            <Input
              id="filiere-tagline"
              value={valeurs.tagline}
              onChange={(e) => setValeurs((v) => ({ ...v, tagline: e.target.value }))}
              placeholder="Ex. Opportunités quotidiennes dans…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filiere-description">Description (optionnel)</Label>
            <Textarea
              id="filiere-description"
              value={valeurs.description}
              onChange={(e) => setValeurs((v) => ({ ...v, description: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filiere-ordre">Ordre d'affichage</Label>
              <Input
                id="filiere-ordre"
                type="number"
                min={0}
                value={valeurs.sort_order}
                onChange={(e) => setValeurs((v) => ({ ...v, sort_order: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filiere-active">Active</Label>
              <select
                id="filiere-active"
                value={valeurs.is_active ? "1" : "0"}
                onChange={(e) => setValeurs((v) => ({ ...v, is_active: e.target.value === "1" }))}
                className="h-7 rounded-md border border-input bg-input/20 px-2 text-xs"
              >
                <option value="1">Oui — visible publiquement</option>
                <option value="0">Non — masquée</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={enregistrer} disabled={mutation.isPending}>
            {mutation.isPending ? "Enregistrement…" : edit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default FilierePage
