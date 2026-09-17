import { Link } from "react-router-dom"
import { Archive, Check, Eye, EyeOff, MoreHorizontal } from "lucide-react"
import { cn } from "cn"
import { useFiltresOffresAdmin } from "@/contexts/FiltresOffresAdmin.context"
import {
  STATUTS_OFFRE, useModifierVisibilite, useModifierStatut, useArchiverOffre, messageErreurMutation,
} from "@/features/admin-offres.tools"
import { useNotify } from "@/contexts/Notify.context"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import { TransitionEtat, SectionErreur, SectionVide, SectionAucunResultat } from "@/components/admin/EtatsSection"
import { BoutonApercu } from "@/components/admin/ApercuOffre"
import BtnAction from "@/components/admin/BtnAction"

/* ─────────────────────────────────────────────────────────────────────
   Table des offres admin (toutes offres : visibles, masquées, archivées).
   Mobile (< md) : cartes empilées — desktop (md+) : table 9 colonnes.
   ───────────────────────────────────────────────────────────────────── */

const VARIANTE_STATUT = {
  active: "secondary",
  expired: "outline",
  filled: "outline",
  archived: "outline",
  en_relecture: "secondary",
  duplicate: "destructive",
  brut: "outline",
}

const LIBELLE_STATUT = Object.fromEntries(STATUTS_OFFRE.map((s) => [s.valeur, s.libelle]))

const dateCourte = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) : "—"

/* ── Sous-composants mutualisés desktop + mobile ─────────────────── */

/* Toggle de visibilité (même bouton dans la table et sur les cartes). */
const BoutonVisibilite = ({ offre, enCours, desactive, onBasculer }) => (
  <button
    type="button"
    onClick={onBasculer}
    disabled={desactive}
    aria-label={
      offre.visible_site
        ? `Masquer « ${offre.title} » du site public`
        : `Afficher « ${offre.title} » sur le site public`
    }
    aria-pressed={offre.visible_site}
    className={cn(
      "inline-flex size-6 items-center justify-center rounded-md transition-colors",
      offre.visible_site
        ? "text-emerald-600 hover:bg-emerald-500/10"
        : "text-destructive hover:bg-muted"
    )}
  >
    {enCours ? (
      <Spinner className="size-3.5" aria-hidden />
    ) : offre.visible_site ? (
      <Eye className="size-3.5" aria-hidden />
    ) : (
      <EyeOff className="size-3.5" aria-hidden />
    )}
  </button>
)

/* Menu « ⋯ » : changement de statut + archivage. */
const MenuActionsOffre = ({ offre, archivageEnCours, mutationEnCours, onChangerStatut, onArchiver }) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={
        <BtnAction
          variant="outline"
          size="xs"
          disabled={mutationEnCours}
          aria-label={`Actions pour ${offre.title}`}
          className="border-none"
        >
          {archivageEnCours ? <Spinner className="size-3.5" aria-hidden /> : <MoreHorizontal aria-hidden />}
        </BtnAction>
      }
    />
    <DropdownMenuContent align="end" className="min-w-44">
      {/* base-ui : label de groupe TOUJOURS dans <DropdownMenuGroup>. */}
      <DropdownMenuGroup>
        <DropdownMenuLabel>Changer le statut</DropdownMenuLabel>
      </DropdownMenuGroup>
      {STATUTS_OFFRE.map((s) => (
        <DropdownMenuItem
          key={s.valeur}
          onClick={() => onChangerStatut(s.valeur)}
          className="cursor-pointer"
        >
          {s.libelle}
          {offre.status === s.valeur && <Check className="ml-auto size-3" aria-hidden />}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        onClick={onArchiver}
        className="cursor-pointer"
      >
        <Archive className="size-3.5" aria-hidden />
        Archiver
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)

/* ── Carte mobile (miroir de la ligne desktop) ─────────────────────
   La carte N'EST PAS un <Link> global : elle contient plusieurs
   contrôles interactifs (checkbox, aperçu, toggle, menu) — comme la
   ligne desktop, seul le titre est un lien. */
const CarteOffreMobile = ({
  offre, selectionne, onToggleSelection, onApercu,
  onBasculerVisibilite, onChangerStatut, onArchiver,
  visibiliteEnCours, statutEnCours, archivageEnCours, mutationEnCours,
}) => (
  <article
    aria-label={`Offre ${offre.title}`}
    className={cn(
      "rounded-xl border border-border bg-card p-3 shadow-soft transition-opacity",
      mutationEnCours && "opacity-70"
    )}
  >
    {/* En-tête : sélection + aperçu + titre (lien) + menu actions */}
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        className="size-3.5 shrink-0 accent-primary"
        checked={selectionne}
        onChange={onToggleSelection}
        aria-label={`Sélectionner ${offre.title}`}
      />
      <BoutonApercu
        onClick={() => onApercu?.(offre.id)}
        libelle={`Aperçu de ${offre.title}`}
      />
      <Link
        to={`/admin/offres/${offre.id}`}
        title={offre.title}
        className="min-w-0 flex-1 truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {offre.title}
      </Link>
      <MenuActionsOffre
        offre={offre}
        statutEnCours={statutEnCours}
        archivageEnCours={archivageEnCours}
        mutationEnCours={mutationEnCours}
        onChangerStatut={onChangerStatut}
        onArchiver={onArchiver}
      />
    </div>

    {/* Origine · vues (miroir du sous-titre desktop) */}
    <p className="mt-1 pl-14 text-[10px] text-muted-foreground">
      {offre.origin === "scraping" ? "Scraping" : offre.origin === "manual" ? "Manuel" : "Import"}
      {offre.view_count != null && ` · ${offre.view_count.toLocaleString("fr-FR")} vues`}
    </p>

    {/* Entreprise / Source / Filière / Collectée */}
    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
      <div className="min-w-0">
        <dt className="text-[10px] text-muted-foreground">Entreprise</dt>
        <dd className="truncate font-medium" title={offre.company?.name}>
          {offre.company?.name ?? "—"}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-[10px] text-muted-foreground">Source</dt>
        <dd className="truncate" title={offre.source?.name}>{offre.source?.name ?? "—"}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-[10px] text-muted-foreground">Filière</dt>
        <dd className="truncate" title={offre.primary_filiere?.label}>
          {offre.primary_filiere?.label ?? "—"}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-[10px] text-muted-foreground">Collectée</dt>
        <dd className="tabular-nums">{dateCourte(offre.collected_at ?? offre.created_at)}</dd>
      </div>
    </dl>

    {/* Pied : statut (+ feedback mutation) / toggle visibilité */}
    <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
      <span className="flex items-center gap-1.5">
        <Badge variant={VARIANTE_STATUT[offre.status] ?? "outline"}>
          {LIBELLE_STATUT[offre.status] ?? offre.status}
        </Badge>
        {statutEnCours && <Spinner className="size-3" aria-label="Changement de statut en cours" />}
      </span>
      <BoutonVisibilite
        offre={offre}
        enCours={visibiliteEnCours}
        desactive={mutationEnCours}
        onBasculer={onBasculerVisibilite}
      />
    </div>
  </article>
)

/* ── SKELETONS FIDÈLES ───────────────────────────────────────────── */

const Bloc = ({ className, delay = 0 }) => (
  <Skeleton className={className} style={delay ? { animationDelay: `${delay}ms` } : undefined} />
)

/* Ligne desktop : checkbox + (aperçu + titre + sous-titre) + 5 colonnes
   texte + badge statut + date + toggle + menu. */
const SkeletonLigneOffre = ({ delay = 0 }) => (
  <TableRow className="hover:bg-transparent">
    <TableCell className="pr-0"><Bloc className="size-3.5 rounded" delay={delay} /></TableCell>
    <TableCell>
      <div className="flex items-center gap-1.5">
        <Bloc className="size-6 shrink-0 rounded-md" delay={delay} />
        <Bloc className="h-3.5 w-44" delay={delay} />
      </div>
      <Bloc className="mt-1.5 h-2.5 w-24" delay={delay} />
    </TableCell>
    <TableCell><Bloc className="h-3.5 w-24" delay={delay} /></TableCell>
    <TableCell><Bloc className="h-3.5 w-20" delay={delay} /></TableCell>
    <TableCell><Bloc className="h-3.5 w-20" delay={delay} /></TableCell>
    <TableCell><Bloc className="h-5 w-16 rounded-full" delay={delay} /></TableCell>
    <TableCell><Bloc className="h-3.5 w-16" delay={delay} /></TableCell>
    <TableCell><Bloc className="mx-auto size-6 rounded-md" delay={delay} /></TableCell>
    <TableCell><Bloc className="size-7 rounded-md" delay={delay} /></TableCell>
  </TableRow>
)

/* Carte mobile : miroir exact de CarteOffreMobile. */
const SkeletonCarteOffreMobile = ({ delay = 0 }) => (
  <div className="rounded-xl border border-border bg-card p-3 shadow-soft">
    <div className="flex items-center gap-2">
      <Bloc className="size-3.5 shrink-0 rounded" delay={delay} />
      <Bloc className="size-6 shrink-0 rounded-md" delay={delay} />
      <Bloc className="h-3.5 min-w-0 flex-1" delay={delay} />
      <Bloc className="size-7 shrink-0 rounded-md" delay={delay} />
    </div>
    <Bloc className="mt-1.5 ml-14 h-2.5 w-32" delay={delay} />
    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
      {[0, 1, 2, 3].map((k) => (
        <div key={k} className="space-y-1">
          <Bloc className="h-2 w-14" delay={delay} />
          <Bloc className="h-3 w-24" delay={delay} />
        </div>
      ))}
    </div>
    <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
      <Bloc className="h-5 w-16 rounded-full" delay={delay} />
      <Bloc className="size-6 rounded-md" delay={delay} />
    </div>
  </div>
)

const TableOffresSkeleton = ({ nbLignes = 8 }) => {
  const lignes = Array.from({ length: nbLignes }, (_, i) => i)
  return (
    <div role="status" aria-label="Chargement de la liste des offres">
      {/* Mobile : cartes */}
      <ul className="flex flex-col gap-3 px-4 py-3 md:hidden" aria-hidden="true">
        {lignes.map((i) => (
          <li key={i}><SkeletonCarteOffreMobile delay={i * 70} /></li>
        ))}
      </ul>

      {/* Desktop : table avec en-tête */}
      <div className="hidden overflow-x-auto scrollbar-thin md:block">
        <Table aria-hidden="true">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8"><Bloc className="size-3.5 rounded" /></TableHead>
              <TableHead><Bloc className="h-3 w-12" /></TableHead>
              <TableHead><Bloc className="h-3 w-20" /></TableHead>
              <TableHead><Bloc className="h-3 w-14" /></TableHead>
              <TableHead><Bloc className="h-3 w-14" /></TableHead>
              <TableHead><Bloc className="h-3 w-12" /></TableHead>
              <TableHead><Bloc className="h-3 w-16" /></TableHead>
              <TableHead className="text-center"><Bloc className="mx-auto h-3 w-12" /></TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((i) => <SkeletonLigneOffre key={i} delay={i * 70} />)}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/* ── COMPOSANT PRINCIPAL ─────────────────────────────────────────── */

const TableOffres = ({
  offres, chargement, erreur, onRetry, onRetryFiltres,
  selection = new Set(), onToggleSelection, onToutSelectionner, toutSelectionne,
  onApercu,
}) => {
  const { query, status, origin, visible } = useFiltresOffresAdmin()
  const notify = useNotify()
  const visibiliteMutation = useModifierVisibilite()
  const statutMutation = useModifierStatut()
  const archiverMutation = useArchiverOffre()

  const basculerVisibilite = (offre) => {
    visibiliteMutation.mutate(
      { offerId: offre.id, visibleSite: !offre.visible_site },
      {
        onSuccess: (res) =>
          notify(res?.message || `Visibilité mise à jour pour « ${offre.title} »`, "success"),
        onError: (err) => notify(messageErreurMutation(err) || "Action impossible", "error"),
      }
    )
  }

  const changerStatut = (offre, nouveauStatut) => {
    statutMutation.mutate(
      { offerId: offre.id, status: nouveauStatut },
      {
        onSuccess: (res) =>
          notify(res?.message || `Statut mis à jour pour « ${offre.title} »`, "success"),
        onError: (err) => notify(messageErreurMutation(err) || "Action impossible", "error"),
      }
    )
  }

  const archiver = (offre) => {
    archiverMutation.mutate(offre.id, {
      onSuccess: () => notify(`« ${offre.title} » archivée`, "success"),
      onError: (err) => notify(messageErreurMutation(err) || "Archivage impossible", "error"),
    })
  }

  /* Feedback ciblé par offre — même calcul pour la ligne desktop et la
     carte mobile. */
  const etatsMutation = (offre) => {
    const visibiliteEnCours = visibiliteMutation.isPending && visibiliteMutation.variables?.offerId === offre.id
    const statutEnCours = statutMutation.isPending && statutMutation.variables?.offerId === offre.id
    const archivageEnCours = archiverMutation.isPending && archiverMutation.variables === offre.id
    return {
      visibiliteEnCours,
      statutEnCours,
      archivageEnCours,
      mutationEnCours: visibiliteEnCours || statutEnCours || archivageEnCours,
    }
  }

  const aFiltres = !!(query || status || origin || visible)

  /* Clé d'état de la transition : le changement d'état (erreur /
     chargement / vide / aucun-résultat / données) est désormais animé
     ICI, au niveau du composant. */
  const etat = erreur
    ? "erreur"
    : chargement
      ? "chargement"
      : !offres?.length
        ? aFiltres ? "aucun-resultat" : "vide"
        : "donnees"

  return (
    <TransitionEtat etat={etat} className="animate-in fade-in duration-200 motion-reduce:animate-none">
      {erreur ? (
        <div className="p-4">
          <SectionErreur onRetry={onRetry} message="Impossible de charger les offres." />
        </div>
      ) : chargement ? (
        <TableOffresSkeleton nbLignes={8} />
      ) : !offres?.length ? (
        <div className="p-4">
          {aFiltres ? (
            <SectionAucunResultat onReset={onRetryFiltres} message="Aucune offre ne correspond à ces filtres." />
          ) : (
            <SectionVide message="Aucune offre collectée pour le moment." />
          )}
        </div>
      ) : (
        <>
          {/* ── Mobile : cartes ────────────────────────────── */}
          <ul className="flex flex-col gap-3 px-4 py-3 md:hidden">
            {offres.map((offre) => {
              const { visibiliteEnCours, statutEnCours, archivageEnCours, mutationEnCours } = etatsMutation(offre)
              return (
                <li key={offre.id}>
                  <CarteOffreMobile
                    offre={offre}
                    selectionne={selection.has(offre.id)}
                    onToggleSelection={() => onToggleSelection?.(offre.id)}
                    onApercu={onApercu}
                    onBasculerVisibilite={() => basculerVisibilite(offre)}
                    onChangerStatut={(s) => changerStatut(offre, s)}
                    onArchiver={() => archiver(offre)}
                    visibiliteEnCours={visibiliteEnCours}
                    statutEnCours={statutEnCours}
                    archivageEnCours={archivageEnCours}
                    mutationEnCours={mutationEnCours}
                  />
                </li>
              )
            })}
          </ul>

          {/* ── Desktop : table ────────────────────────────── */}
          <div className="hidden overflow-x-auto scrollbar-thin md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-8">
                    <input
                      type="checkbox"
                      className="size-3.5 accent-primary"
                      checked={!!toutSelectionne}
                      onChange={onToutSelectionner}
                      aria-label="Sélectionner toutes les offres de la page"
                    />
                  </TableHead>
                  <TableHead>Offre</TableHead>
                  <TableHead>Entreprise</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Filière</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Collectée</TableHead>
                  <TableHead className="text-center">Visible</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {offres.map((offre) => {
                  const { visibiliteEnCours, statutEnCours, archivageEnCours, mutationEnCours } = etatsMutation(offre)
                  return (
                    <TableRow
                      key={offre.id}
                      className={cn(
                        "transition-colors hover:bg-muted/50",
                        mutationEnCours && "opacity-70"
                      )}
                    >
                      {/* Sélection multiple — pilotée par la section parente. */}
                      <TableCell className="pr-0">
                        <input
                          type="checkbox"
                          className="size-3.5 accent-primary"
                          checked={selection.has(offre.id)}
                          onChange={() => onToggleSelection?.(offre.id)}
                          aria-label={`Sélectionner ${offre.title}`}
                        />
                      </TableCell>
                      <TableCell className="max-w-56">
                        <div className="flex items-center gap-1.5">
                          <BoutonApercu
                            onClick={() => onApercu?.(offre.id)}
                            libelle={`Aperçu de ${offre.title}`}
                          />
                          <Link
                            to={`/admin/offres/${offre.id}`}
                            className="block font-medium text-primary underline-offset-4 hover:underline truncate"
                            title={offre.title}
                          >
                            {offre.title}
                          </Link>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {offre.origin === "scraping" ? "Scraping" : offre.origin === "manual" ? "Manuel" : "Import"}
                          {offre.view_count != null && ` · ${offre.view_count.toLocaleString("fr-FR")} vues`}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-40 truncate" title={offre.company?.name}>
                        {offre.company?.name ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-32 truncate text-muted-foreground" title={offre.source?.name}>
                        {offre.source?.name ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-32 truncate text-muted-foreground" title={offre.primary_filiere?.label}>
                        {offre.primary_filiere?.label ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <Badge variant={VARIANTE_STATUT[offre.status] ?? "outline"}>
                            {LIBELLE_STATUT[offre.status] ?? offre.status}
                          </Badge>
                          {/* Feedback ciblé : changement de statut en cours. */}
                          {statutEnCours && <Spinner className="size-3" aria-label="Changement de statut en cours" />}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                        {dateCourte(offre.collected_at ?? offre.created_at)}
                      </TableCell>
                      <TableCell className="text-center">
                        <BoutonVisibilite
                          offre={offre}
                          enCours={visibiliteEnCours}
                          desactive={mutationEnCours}
                          onBasculer={() => basculerVisibilite(offre)}
                        />
                      </TableCell>
                      <TableCell>
                        <MenuActionsOffre
                          offre={offre}
                          statutEnCours={statutEnCours}
                          archivageEnCours={archivageEnCours}
                          mutationEnCours={mutationEnCours}
                          onChangerStatut={(s) => changerStatut(offre, s)}
                          onArchiver={() => archiver(offre)}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </TransitionEtat>
  )
}

export default TableOffres