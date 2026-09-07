import { useMemo, useState } from "react"
import { Globe, Plus, PauseCircle, PlayCircle, Pencil, Trash2, ShieldAlert } from "lucide-react"
import { ErrorBoundary } from "react-error-boundary"
import { useNotify } from "@/contexts/Notify.context"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import CarteCompteur from "@/components/admin/CarteCompteur"
import {
  useAdminSourcesQuery, useCreateSource, useUpdateSource,
  useChangerStatutSource, useDeleteSource, messageErreurSource,
} from "@/features/admin-sources.tools"
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
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { SectionErreur, SectionVide } from "./components/EtatsSection"
import DialogSource from "./components/DialogSource"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion des sources — /admin/sources (super_admin, doc v3 §13).

   Piloter l'état des sites scrapés sans toucher au code :
   - table (nom, URLs, statut, priorité, anti-scraping 0-5) ;
   - action rapide « mettre en pause / réactiver » isolée du
     formulaire complet (PATCH /{id}/status) ;
   - CRUD complet via dialog (URLs, priorité, anti-scraping, notes) ;
   - suppression avec confirmation (les offres liées portent une
     FK RESTRICT serveur — un delete peut donc échouer 409 si des
     offres y rattachent : message d'erreur serveur affiché tel quel).

   Compteurs dérivés de la liste (0 appel réseau en plus) :
   actives x/N, en pause, scrapées (supports_scraping), protection
   max. L'état `error` est affichable (données base) mais non
   assignable via PATCH (Literal serveur : active|paused|disabled).
   ───────────────────────────────────────────────────────────────────── */

const VARIANTE_STATUT = {
  active: "secondary",
  paused: "outline",
  error: "destructive",
  disabled: "outline",
}

const LIBELLE_STATUT = {
  active: "Active",
  paused: "En pause",
  error: "En erreur",
  disabled: "Désactivée",
}

const SourcesPage = () => {
  const notify = useNotify()
  const { data: sources, isLoading, isError, refetch } = useAdminSourcesQuery()

  const [edition, setEdition] = useState(null)       // null = fermé ; {} = création ; source = édition
  const [suppression, setSuppression] = useState(null)

  const creerMutation = useCreateSource()
  const modifierMutation = useUpdateSource()
  const statutMutation = useChangerStatutSource()
  const supprimerMutation = useDeleteSource()

  // Compteurs dérivés de la liste — 0 appel en plus.
  const compteurs = useMemo(() => {
    const liste = sources ?? []
    return {
      total: liste.length,
      actives: liste.filter((s) => s.status === "active").length,
      pause: liste.filter((s) => s.status === "paused").length,
      scrapables: liste.filter((s) => s.supports_scraping).length,
    }
  }, [sources])

  const changerStatut = (source, status) =>
    statutMutation.mutate(
      { id: source.id, status },
      {
        onSuccess: (res) =>
          notify(res?.message || `Source « ${source.name} » ${status === "active" ? "réactivée" : "mise en pause"}`, "success"),
        onError: (err) => notify(messageErreurSource(err), "error"),
      }
    )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* ─── En-tête ─── */}
      <section aria-label="En-tête sources" className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-lg font-bold">
            <Globe className="size-5 text-primary" aria-hidden />
            Sources
          </h1>
          <p className="text-xs text-muted-foreground">
            Sites scrapés — une source en pause est exclue du prochain déclenchement de scraping.
          </p>
        </div>
        <Button size="sm" onClick={() => setEdition({})}>
          <Plus aria-hidden /> Nouvelle source
        </Button>
      </section>

      {/* ─── Compteurs dérivés (0 appel) ─── */}
      <ErrorBoundary FallbackComponent={AdminSectionFallback}>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <CarteCompteur
            label="Sources actives"
            valeur={compteurs.actives}
            texte={`${compteurs.actives}/${compteurs.total}`}
            chargement={isLoading}
          />
          <CarteCompteur label="En pause" valeur={compteurs.pause} chargement={isLoading} />
          <CarteCompteur label="Scrapables" valeur={compteurs.scrapables} chargement={isLoading} />
          <CarteCompteur label="Total sources" valeur={compteurs.total} chargement={isLoading} />
        </div>
      </ErrorBoundary>

      {/* ─── Alerte planification (doc v3 §13) ─── */}
      <Alert>
        <ShieldAlert aria-hidden />
        <AlertTitle>La planification quotidienne n'est pas pilotée ici</AlertTitle>
        <AlertDescription>
          Le scheduler Celery est câblé sur des codes en dur (goafrica, jobivoire, educarriere) :
          désactiver une source l'exclut des déclenchements mais ne modifie pas la planification,
          et ajouter une nouvelle source nécessite une intervention côté code.
        </AlertDescription>
      </Alert>

      {/* ─── Table ─── */}
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les sources." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : !sources?.length ? (
        <SectionVide message="Aucune source configurée — lancez le seed (npm run seed:scraper-sources)." />
      ) : (
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <section aria-label="Liste des sources" className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="hidden lg:table-cell">URL des offres</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Priorité</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Anti-scraping</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Scraping</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => {
                  const enCours =
                    statutMutation.isPending && statutMutation.variables?.id === source.id
                  return (
                    <TableRow key={source.id} className={enCours ? "opacity-60" : undefined}>
                      <TableCell>
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {source.color_hex && (
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: source.color_hex }}
                              aria-hidden
                            />
                          )}
                          {source.name}
                        </span>
                        <span className="block truncate font-mono text-[10px] text-muted-foreground" title={source.base_url}>
                          {source.base_url}
                        </span>
                      </TableCell>
                      <TableCell className="hidden max-w-56 truncate text-xs text-muted-foreground lg:table-cell" title={source.jobs_url ?? ""}>
                        {source.jobs_url ? (
                          <a
                            href={source.jobs_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {source.jobs_url}
                          </a>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={VARIANTE_STATUT[source.status] ?? "outline"}>
                          {LIBELLE_STATUT[source.status] ?? source.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{source.priority}</TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">
                        {source.anti_scraping_level}/5
                      </TableCell>
                      <TableCell className="hidden text-right lg:table-cell">
                        <Badge variant={source.supports_scraping ? "secondary" : "outline"}>
                          {source.supports_scraping ? "Oui" : "Non"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {/* Action rapide isolée du formulaire (doc v3 §13) */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => changerStatut(source, source.status === "active" ? "paused" : "active")}
                            disabled={enCours || source.status === "disabled"}
                            aria-label={
                              source.status === "active"
                                ? `Mettre ${source.name} en pause`
                                : `Réactiver ${source.name}`
                            }
                            title={source.status === "active" ? "Mettre en pause" : "Réactiver"}
                          >
                            {source.status === "active"
                              ? <PauseCircle aria-hidden />
                              : <PlayCircle aria-hidden />}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${source.name}`} />}
                            />
                            <DropdownMenuContent align="end" className="min-w-48">
                              <DropdownMenuGroup>
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              </DropdownMenuGroup>
                              <DropdownMenuItem onClick={() => setEdition(source)} className="cursor-pointer">
                                <Pencil className="size-3.5" aria-hidden /> Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => changerStatut(source, "disabled")}
                                disabled={source.status === "disabled"}
                                className="cursor-pointer"
                              >
                                Désactiver
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setSuppression(source)} className="cursor-pointer text-destructive">
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

      {/* ─── Dialog création / édition ─── */}
      {edition && (
        <DialogSource
          source={edition.id ? edition : null}
          mutation={edition.id ? modifierMutation : creerMutation}
          onFermer={() => setEdition(null)}
        />
      )}

      {/* ─── Confirmation suppression ─── */}
      {suppression && (
        <ConfirmSuppression
          source={suppression}
          mutation={supprimerMutation}
          onFermer={() => setSuppression(null)}
        />
      )}
    </div>
  )
}

/* Confirmation suppression — FK RESTRICT : des offres liées font échouer. */
const ConfirmSuppression = ({ source, mutation, onFermer }) => {
  const notify = useNotify()
  return (
    <Alert role="alertdialog" className="flex-col items-center gap-3 text-center">
      <AlertTitle>Supprimer « {source.name} » ?</AlertTitle>
      <AlertDescription>
        Action irréversible — la suppression sera refusée par le serveur si des offres
        lui sont rattachées (clé étrangère protégée).
      </AlertDescription>
      <div className="mt-1 flex gap-2">
        <Button variant="outline" size="sm" onClick={onFermer}>Annuler</Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate(source.id, {
              onSuccess: () => {
                notify(`Source « ${source.name} » supprimée`, "success")
                onFermer()
              },
              onError: (err) => {
                notify(messageErreurSource(err), "error")
                // Erreur FK (409/400) : on laisse le dialog ouvert pour
                // laisser lire le message serveur.
              },
            })
          }
        >
          {mutation.isPending ? "Suppression…" : "Supprimer"}
        </Button>
      </div>
    </Alert>
  )
}

export default SourcesPage
