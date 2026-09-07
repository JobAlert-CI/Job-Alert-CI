import { useState } from "react"
import { Link } from "react-router-dom"
import { Eye, FileDown, MoreHorizontal, Search } from "lucide-react"
import { cn } from "cn"
import { FiltresAbonnesAdminProvider, useFiltresAbonnesAdmin } from "@/contexts/FiltresAbonnesAdmin.context"
import {
  STATUTS_ABONNE, useAdminSubscribersQuery,
  useChangerStatutAbonne, useAnonymiserAbonne, useActionGroupeeAbonnes, messageErreurAbonne,
} from "@/features/admin-abonnes.tools"
import { useRechercheDebouncee } from "@/hooks/use-recherche-debouncee"
import { useReferentialsQuery } from "@/lib/referentiels-query"
import { useNotify } from "@/contexts/Notify.context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import PaginationListe from "@/components/admin/PaginationListe"
import { SectionErreur, SectionVide, SectionAucunResultat } from "./components/EtatsSection"
import CompteursAbonnes from "./sections/CompteursAbonnes"
import ChartsAbonnes from "./sections/ChartsAbonnes"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion des utilisateurs (abonnés) — /admin/utilisateurs.

   super_admin + gestionnaire_utilisateurs (guard par route).

   Fonctionnalités (doc v3 §7) :
   - table (email, nom, statut, filières, inscription) filtrable ;
   - recherche par email ou nom (debouncée → URL) ;
   - filtre par statut (VOCABULAIRE API : bouncing, pas bounced) ;
   - filtre par filière (UUID du référentiel public) ;
   - clic ligne → détail /admin/utilisateurs/:id (page 8/cycle 8) ;
   - mini-onglet Actions par ligne : activer, pause, désinscrire
     (motif), rebond, anonymiser (RGPD, confirmation dédiée).
   ───────────────────────────────────────────────────────────────────── */

const VARIANTE_STATUT = {
  active: "secondary",
  unsubscribed: "outline",
  bouncing: "destructive",
  paused: "outline",
  pending: "outline",
  deleted: "outline",
}

const LIBELLE_STATUT = Object.fromEntries(STATUTS_ABONNE.map((s) => [s.valeur, s.libelle]))

const dateCourte = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) : "—"

const ListeAbonnes = () => {
  const notify = useNotify()
  const { query, status, filiereId, page, pageTaille, paramsApi, setQuery, setStatus, setFiliereId, setPage, reinitialiser } = useFiltresAbonnesAdmin()

  const { data: referentiels } = useReferentialsQuery()
  const filieres = referentiels?.filieres ?? []

  const { data: abonnes, isLoading, isError, refetch } = useAdminSubscribersQuery(paramsApi)

  const [anonymCible, setAnonymCible] = useState(null) // confirmation RGPD
  const [selection, setSelection] = useState(() => new Set())
  const [exportEnCours, setExportEnCours] = useState(false)

  const statutMutation = useChangerStatutAbonne()
  const anonymiserMutation = useAnonymiserAbonne()
  const groupeeMutation = useActionGroupeeAbonnes()

  const { valeurLocale, setValeurLocale } = useRechercheDebouncee({
    valeurUrl: query,
    setScalar: setQuery,
    cle: "query",
  })

  const pageSuivantePossible = Array.isArray(abonnes) && abonnes.length === pageTaille
  const nbFiltresActifs = [status, filiereId].filter(Boolean).length + (query ? 1 : 0)

  const changerStatut = (abonne, nouveauStatut) => {
    statutMutation.mutate(
      { subscriberId: abonne.id, status: nouveauStatut },
      {
        onSuccess: (res) =>
          notify(res?.message || `Statut de ${abonne.full_name ?? abonne.email} mis à jour`, "success"),
        onError: (err) => notify(messageErreurAbonne(err) || "Action impossible", "error"),
      }
    )
  }

  const anonymiser = () => {
    if (!anonymCible) return
    anonymiserMutation.mutate(anonymCible.id, {
      onSuccess: () => {
        notify(`${anonymCible.full_name ?? anonymCible.email} anonymisé — historique conservé`, "success")
        setAnonymCible(null)
      },
      onError: (err) => notify(messageErreurAbonne(err) || "Anonymisation impossible", "error"),
    })
  }

  const basculerSelection = (id) => {
    setSelection((prev) => {
      const suivant = new Set(prev)
      suivant.has(id) ? suivant.delete(id) : suivant.add(id)
      return suivant
    })
  }

  const toutSelectionner = () => {
    setSelection((prev) => {
      if (abonnes?.length && prev.size === abonnes.length) return new Set()
      return new Set((abonnes ?? []).map((a) => a.id))
    })
  }

  const actionGroupee = (statut) => {
    if (!selection.size) return
    groupeeMutation.mutate(
      { subscriberIds: [...selection], status: statut },
      {
        onSuccess: (res) => {
          notify(res?.message || `${selection.size} abonné(s) mis à jour`, "success")
          setSelection(new Set())
        },
        onError: (err) => notify(messageErreurAbonne(err) || "Action groupée impossible", "error"),
      }
    )
  }

  const lancerExport = async (format) => {
    setExportEnCours(true)
    try {
      const { exportSubscribers } = await import("@/api/admin/system")
      const { blob, filename } = await exportSubscribers(
        { q: paramsApi.q, status: paramsApi.status, filiere_id: paramsApi.filiere_id },
        format
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      notify(`Export ${format.toUpperCase()} téléchargé (${filename})`, "success")
    } catch (err) {
      notify(messageErreurAbonne(err) || "Export impossible", "error")
    } finally {
      setExportEnCours(false)
    }
  }

  if (isError) {
    return <SectionErreur onRetry={refetch} message="Impossible de charger les abonnés." />
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-heading text-lg font-bold">Utilisateurs (abonnés)</h1>
          <p className="text-xs text-muted-foreground">
            Base d'abonnés au digest — actifs, désinscrits, rebonds, pauses.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="sm" variant="outline" disabled={exportEnCours}>
                <FileDown aria-hidden /> Exporter
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Format</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuItem onClick={() => lancerExport("csv")} className="cursor-pointer">CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => lancerExport("json")} className="cursor-pointer">JSON</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Compteurs + KPI + chips de filtre rapide */}
      <CompteursAbonnes />

      {/* Charts (recharts confiné au chunk lazy de la page) */}
      <ChartsAbonnes />

      {/* Barre de filtres */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={valeurLocale}
              onChange={(e) => setValeurLocale(e.target.value)}
              placeholder="Rechercher par email ou nom…"
              aria-label="Rechercher un abonné par email ou nom"
              className="pl-8"
            />
          </div>

          {/* Statut — VOCABULAIRE API (bouncing, jamais bounced) */}
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-7 w-40" aria-label="Filtrer par statut">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous</SelectItem>
              {STATUTS_ABONNE.map((s) => (
                <SelectItem key={s.valeur} value={s.valeur}>{s.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filière (UUID référentiel public) */}
          <Select value={filiereId} onValueChange={setFiliereId}>
            <SelectTrigger className="h-7 w-40" aria-label="Filtrer par filière">
              <SelectValue placeholder="Filière" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Toutes</SelectItem>
              {filieres.map((f) => (
                <SelectItem key={f.id ?? f.code} value={f.id ?? f.code}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {nbFiltresActifs > 0 && (
            <Button variant="ghost" size="sm" onClick={reinitialiser}>
              Réinitialiser ({nbFiltresActifs})
            </Button>
          )}
        </div>
      </div>

      {/* Barre actions groupées (visible avec sélection) */}
      {selection.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-xs font-semibold">
            {selection.size} abonné{selection.size > 1 ? "s" : ""} sélectionné{selection.size > 1 ? "s" : ""}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button size="sm" disabled={groupeeMutation.isPending}>Action groupée</Button>}
            />
            <DropdownMenuContent align="start" className="min-w-44">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Appliquer à la sélection</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuItem onClick={() => actionGroupee("active")} className="cursor-pointer">Réactiver</DropdownMenuItem>
              <DropdownMenuItem onClick={() => actionGroupee("paused")} className="cursor-pointer">Mettre en pause</DropdownMenuItem>
              <DropdownMenuItem onClick={() => actionGroupee("unsubscribed")} className="cursor-pointer">Marquer désinscrits</DropdownMenuItem>
              <DropdownMenuItem onClick={() => actionGroupee("bouncing")} className="cursor-pointer">Marquer en rebond</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSelection(new Set())} className="cursor-pointer">
                Vider la sélection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="sm" onClick={toutSelectionner}>
            {selection.size === abonnes?.length && abonnes?.length > 0 ? "Tout désélectionner" : "Tout sélectionner (page)"}
          </Button>
          <p className="ml-auto hidden text-[10px] text-muted-foreground sm:block">
            L'anonymisation RGPD reste strictement individuelle.
          </p>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : !abonnes?.length ? (
        (query || status || filiereId) ? (
          <SectionAucunResultat
            message="Aucun abonné ne correspond à ces filtres."
            onReset={reinitialiser}
          />
        ) : (
          <SectionVide message="Aucun abonné pour le moment." />
        )
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-primary"
                    checked={!!abonnes?.length && selection.size === abonnes.length}
                    onChange={toutSelectionner}
                    aria-label="Sélectionner tous les abonnés de la page"
                  />
                </TableHead>
                <TableHead>Abonné</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden md:table-cell">Filières</TableHead>
                <TableHead className="hidden lg:table-cell">Inscription</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {abonnes.map((abonne) => {
                const enCours =
                  statutMutation.isPending && statutMutation.variables?.subscriberId === abonne.id
                return (
                  <TableRow key={abonne.id} className={cn(enCours && "opacity-60")}>
                    <TableCell className="pr-0">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-primary"
                        checked={selection.has(abonne.id)}
                        onChange={() => basculerSelection(abonne.id)}
                        aria-label={`Sélectionner ${abonne.email}`}
                      />
                    </TableCell>
                    <TableCell className="max-w-56">
                      <Link
                        to={`/admin/utilisateurs/${abonne.id}`}
                        className="block truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
                        title={abonne.email}
                      >
                        {abonne.email}
                      </Link>
                      <span className="text-[10px] text-muted-foreground">
                        {abonne.full_name || "—"}
                        {abonne.city && ` · ${abonne.city}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={VARIANTE_STATUT[abonne.status] ?? "outline"}>
                        {LIBELLE_STATUT[abonne.status] ?? abonne.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden max-w-40 truncate text-xs text-muted-foreground md:table-cell">
                      {abonne.filiere_links?.length
                        ? `${abonne.filiere_links.length} filière${abonne.filiere_links.length > 1 ? "s" : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground tabular-nums lg:table-cell">
                      {dateCourte(abonne.subscribed_at ?? abonne.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${abonne.email}`}>
                              <MoreHorizontal />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="min-w-48">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          </DropdownMenuGroup>
                          <DropdownMenuItem
                            render={<Link to={`/admin/utilisateurs/${abonne.id}`} className="cursor-pointer" />}
                          >
                            <Eye className="size-3.5" aria-hidden /> Voir la fiche
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => changerStatut(abonne, "active")}
                            disabled={abonne.status === "active"}
                            className="cursor-pointer"
                          >
                            Réactiver
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => changerStatut(abonne, "paused")}
                            disabled={abonne.status === "paused"}
                            className="cursor-pointer"
                          >
                            Mettre en pause
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => changerStatut(abonne, "bouncing")}
                            disabled={abonne.status === "bouncing"}
                            className="cursor-pointer"
                          >
                            Marquer en rebond
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => changerStatut(abonne, "unsubscribed")}
                            disabled={abonne.status === "unsubscribed"}
                            className="cursor-pointer"
                          >
                            Marquer désinscrit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setAnonymCible(abonne)}
                            disabled={abonne.status === "deleted"}
                            className="cursor-pointer"
                          >
                            Anonymiser (RGPD)…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination mutualisée */}
      {abonnes?.length > 0 && (
        <PaginationListe
          page={page}
          pagePleine={pageSuivantePossible}
          onPageChange={setPage}
        />
      )}

      {/* Confirmation anonymisation RGPD — libellé explicite (doc v3 §8) */}
      <Dialog open={!!anonymCible} onOpenChange={(o) => !o && setAnonymCible(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Anonymiser cet abonné ?</DialogTitle>
            <DialogDescription>
              Conformément au RGPD, l'abonné « {anonymCible?.email} » sera <strong>anonymisé</strong> :
              son email sera remplacé par une valeur technique, son nom, sa ville et ses notes
              internes effacés, et son statut passera à « Supprimé ». Son historique d'envois est
              conservé pour la cohérence des statistiques. Cette action est définitive.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setAnonymCible(null)}>Annuler</Button>
            <Button variant="destructive" size="sm" onClick={anonymiser} disabled={anonymiserMutation.isPending}>
              {anonymiserMutation.isPending ? "Anonymisation…" : "Anonymiser définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const AbonnesPage = () => (
  <FiltresAbonnesAdminProvider>
    <ListeAbonnes />
  </FiltresAbonnesAdminProvider>
)

export default AbonnesPage
