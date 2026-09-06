import { Link } from "react-router-dom"
import { Archive, Check, Eye, EyeOff, MoreHorizontal } from "lucide-react"
import { cn } from "cn"
import { useFiltresOffresAdmin } from "@/contexts/FiltresOffresAdmin.context"
import { STATUTS_OFFRE, useModifierVisibilite, useModifierStatut, useArchiverOffre, messageErreurMutation } from "@/features/admin-offres.tools"
import { useNotify } from "@/contexts/Notify.context"
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
import { SectionErreur, SectionVide, SectionAucunResultat } from "./EtatsSection"
import { BoutonApercu } from "@/components/admin/ApercuOffre"

/* ─────────────────────────────────────────────────────────────────────
   Table des offres admin (toutes offres : visibles, masquées,
   archivées — contrairement au site public).

   Actions par ligne :
   - Toggle visibilité (PATCH /{id}/visibility) — sans ouvrir la fiche ;
   - Statut à la volée (PATCH /{id}/status) ;
   - Archiver (DELETE /{id} = soft delete, libellé honnête) —
     confirmation via double-clic volontaire (menu + dialog).

   Lien titre → fiche /admin/offres/:id (page 4, à venir).
   ───────────────────────────────────────────────────────────────────── */

const VARIANTE_STATUT = {
  active: "secondary",
  expired: "outline",
  filled: "outline",
  archived: "outline",
  en_relecture: "default",
  duplicate: "destructive",
  brut: "outline",
}

const LIBELLE_STATUT = Object.fromEntries(STATUTS_OFFRE.map((s) => [s.valeur, s.libelle]))

const dateCourte = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) : "—"

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

  if (erreur) {
    return <SectionErreur onRetry={onRetry} message="Impossible de charger les offres." />
  }

  const aFiltres = !!(query || status || origin || visible)

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
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
          {chargement ? (
            [...Array(8)].map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={9}><Skeleton className="h-6 w-full" /></TableCell>
              </TableRow>
            ))
          ) : !offres?.length ? (
            <TableRow>
              <TableCell colSpan={9}>
                {aFiltres ? (
                  <SectionAucunResultat onReset={onRetryFiltres} message={`Aucune offre ne correspond à ces filtres.`} />
                ) : (
                  <SectionVide message="Aucune offre collectée pour le moment." />
                )}
              </TableCell>
            </TableRow>
          ) : (
            offres.map((offre) => {
              const mutationEnCours =
                (visibiliteMutation.isPending && visibiliteMutation.variables?.offerId === offre.id) ||
                (statutMutation.isPending && statutMutation.variables?.offerId === offre.id) ||
                (archiverMutation.isPending && archiverMutation.variables === offre.id)
              return (
                <TableRow key={offre.id} className={cn(mutationEnCours && "opacity-60")}>
                  {/* Sélection multiple (checkbox) — pilotée par la section parente */}
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
                        className="block truncate font-medium text-primary underline-offset-4 hover:underline"
                        title={offre.title}
                      >
                        {offre.title}
                      </Link>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {offre.origin === "scraping" ? "Scraping" : offre.origin === "manual" ? "Manuel" : "Import"}
                      {offre.view_count != null && ` · ${offre.view_count} vues`}
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
                    <Badge variant={VARIANTE_STATUT[offre.status] ?? "outline"}>
                      {LIBELLE_STATUT[offre.status] ?? offre.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                    {dateCourte(offre.collected_at ?? offre.created_at)}
                  </TableCell>
                  <TableCell className="text-center">
                    <button
                      type="button"
                      onClick={() => basculerVisibilite(offre)}
                      disabled={mutationEnCours}
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
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {offre.visible_site ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    </button>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${offre.title}`}>
                            <MoreHorizontal />
                          </Button>
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
                            onClick={() => changerStatut(offre, s.valeur)}
                            className="cursor-pointer"
                          >
                            {s.libelle}
                            {offre.status === s.valeur && <Check className="ml-auto size-3" aria-hidden />}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => archiver(offre)}
                          className="cursor-pointer"
                        >
                          <Archive className="size-3.5" aria-hidden />
                          Archiver
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default TableOffres