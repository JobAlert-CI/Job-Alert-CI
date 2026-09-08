import { useMemo, useState } from "react"
import { ScrollText, RotateCcw, Eye, UserX } from "lucide-react"
import { ErrorBoundary } from "react-error-boundary"
import { cn } from "cn"
import { useFiltresJournalAdmin, FiltresJournalAdminProvider } from "@/contexts/FiltresJournalAdmin.context"
import {
  useJournalAuditQuery, useAdminsAuteurs,
} from "@/features/admin-journal.tools"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { SectionErreur, SectionVide, SectionAucunResultat } from "./components/EtatsSection"
import CompteursJournal from "./sections/CompteursJournal"
import ChartsJournal from "./sections/ChartsJournal"

/* ─────────────────────────────────────────────────────────────────────
   Page Journal d'activité — /admin/journal (super_admin, doc v3 §16).

   Traçabilité de qui a fait quoi dans le back-office :
   - compteurs G-E-F-C-B (sélection validée) + charts H-I, tous servis
     par /audit/stats (un seul appel) ;
   - table chronologique (date, auteur, action, cible) avec le détail
     JSON consultable (dialog œil) ;
   - filtres action / auteur / table cible, en URL (use-url-filters) ;
   - pagination SERVÉE : /audit renvoie {items, total} depuis le cycle
     16 → pages numérotées honnêtes, pas d'heuristique.

   Cas particuliers gérés :
   - auteur admin_id NULL → « Admin supprimé » (FK SET NULL cycle 15) ;
   - action=connexion : journalisée depuis le cycle 16 seulement — le
     filtre l'annonce (données absentes avant).
   ───────────────────────────────────────────────────────────────────── */

const ACTIONS = [
  { valeur: "creation", libelle: "Création" },
  { valeur: "modification", libelle: "Modification" },
  { valeur: "suppression", libelle: "Suppression" },
  { valeur: "envoi", libelle: "Envoi" },
  { valeur: "connexion", libelle: "Connexion (depuis cycles récents)" },
  { valeur: "scraping", libelle: "Scraping" },
]

const VARIANTE_ACTION = {
  creation: "secondary",
  modification: "default",
  suppression: "destructive",
  envoi: "outline",
  connexion: "outline",
  scraping: "outline",
}

const dateHeure = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

const JournalAdmin = () => {
  const { action, admin, table, page, pageTaille, paramsApi, setAction, setAdmin, setTable, setPage, reinitialiser } =
    useFiltresJournalAdmin()

  const { data: pageJournal, isLoading, isError, refetch } = useJournalAuditQuery(paramsApi)
  const { data: admins } = useAdminsAuteurs()

  const [detail, setDetail] = useState(null)   // ligne dont on affiche les détails

  // Résolution locale des auteurs : admin_id → nom (zéro appel dédié).
  const auteursParId = useMemo(() => {
    const m = new Map()
    for (const a of admins ?? []) m.set(a.id, a)
    return m
  }, [admins])

  // Tables cibles distinctes (issues de la page courante).
  const tablesDistintes = useMemo(
    () => [...new Set((pageJournal?.items ?? []).map((e) => e.target_table))].sort(),
    [pageJournal]
  )

  const entrees = pageJournal?.items ?? []
  const total = pageJournal?.total ?? 0
  const pagesTotales = Math.max(1, Math.ceil(total / pageTaille))
  const filtresActifs = !!(action || admin || table)

  return (
    <FiltresJournalAdminProvider>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {/* ─── En-tête ─── */}
        <section aria-label="En-tête journal" className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-heading text-lg font-bold">
              <ScrollText className="size-5 text-primary" aria-hidden />
              Journal d'activité
            </h1>
            <p className="text-xs text-muted-foreground">
              Qui a fait quoi dans le back-office — chaque mutation est journalisée dans la même
              transaction que l'opération elle-même.
            </p>
          </div>
        </section>

        {/* ─── Compteurs G-E-F-C-B ─── */}
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <CompteursJournal />
        </ErrorBoundary>

        {/* ─── Charts H-I ─── */}
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <ChartsJournal />
        </ErrorBoundary>

        {/* ─── Filtres ─── */}
        <section aria-label="Filtres" className="flex flex-wrap items-center gap-2">
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            aria-label="Filtrer par action"
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">Toutes les actions</option>
            {ACTIONS.map((a) => (
              <option key={a.valeur} value={a.valeur}>{a.libelle}</option>
            ))}
          </select>
          <select
            value={admin}
            onChange={(e) => setAdmin(e.target.value)}
            aria-label="Filtrer par auteur"
            className="h-9 max-w-56 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">Tous les auteurs</option>
            {(admins ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.full_name}</option>
            ))}
          </select>
          <select
            value={table}
            onChange={(e) => setTable(e.target.value)}
            aria-label="Filtrer par table cible"
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">Toutes les tables</option>
            {tablesDistintes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {filtresActifs && (
            <Button variant="ghost" size="sm" onClick={reinitialiser}>
              <RotateCcw aria-hidden /> Réinitialiser
            </Button>
          )}
        </section>

        {/* ─── Table ─── */}
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger le journal." />
        ) : isLoading ? (
          <div className="flex flex-col gap-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
          </div>
        ) : !entrees.length ? (
          filtresActifs ? (
            <SectionAucunResultat onReset={reinitialiser} />
          ) : (
            <SectionVide message="Aucune action journalisée pour l'instant." />
          )
        ) : (
          <ErrorBoundary FallbackComponent={AdminSectionFallback}>
            <section aria-label="Entrées du journal" className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead>Auteur</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Cible</TableHead>
                    <TableHead className="hidden lg:table-cell">Identifiant cible</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entrees.map((entree) => {
                    const auteurConnu = entree.admin_id ? auteursParId.get(entree.admin_id) : null
                    return (
                      <TableRow key={entree.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {dateHeure(entree.created_at)}
                        </TableCell>
                        <TableCell>
                          {entree.admin_id && !auteurConnu ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Compte supprimé — entrées préservées (cycle 15)">
                              <UserX className="size-3.5" aria-hidden /> Admin supprimé
                            </span>
                          ) : (
                            <span className="text-xs font-medium">
                              {auteurConnu?.full_name ?? "—"}
                              {auteurConnu && (
                                <span className="block truncate text-[10px] text-muted-foreground">{auteurConnu.email}</span>
                              )}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={VARIANTE_ACTION[entree.action] ?? "outline"}>
                            {ACTIONS.find((a) => a.valeur === entree.action)?.libelle.split(" (")[0] ?? entree.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">
                          {entree.target_table}
                        </TableCell>
                        <TableCell className="hidden max-w-44 truncate font-mono text-[10px] text-muted-foreground lg:table-cell" title={entree.target_id ?? ""}>
                          {entree.target_id ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDetail(entree)}
                            aria-label={`Détails de l'action ${entree.action}`}
                            disabled={!entree.details && !entree.target_id}
                          >
                            <Eye className="size-3.5" aria-hidden />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </section>
          </ErrorBoundary>
        )}

        {/* ─── Pagination servie (total exact) ─── */}
        {!isLoading && total > 0 && (
          <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground tabular-nums">
              {total} action{total > 1 ? "s" : ""} · Page {page} sur {pagesTotales}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                aria-label="Page précédente"
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(pagesTotales, page + 1))}
                disabled={page >= pagesTotales}
                aria-label="Page suivante"
              >
                Suivant
              </Button>
            </div>
          </nav>
        )}

        {/* ─── Dialog détails ─── */}
        {detail && (
          <DialogDetails entree={detail} onFermer={() => setDetail(null)} />
        )}
      </div>
    </FiltresJournalAdminProvider>
  )
}

/* ─── Dialog : détail d'une entrée (JSON lisible) ──────────────────── */

const DialogDetails = ({ entree, onFermer }) => {
  const lignes = Object.entries(entree.details ?? {})
  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {ACTIONS.find((a) => a.valeur === entree.action)?.libelle.split(" (")[0] ?? entree.action} — {entree.target_table}
          </DialogTitle>
          <DialogDescription>
            {dateHeure(entree.created_at)}
            {entree.target_id && (
              <> · cible <code className="font-mono text-[10px]">{entree.target_id}</code></>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {entree.admin_id ? (
            <p className="text-xs text-muted-foreground">
              Auteur : <code className="font-mono text-[10px]">{entree.admin_id}</code>
            </p>
          ) : (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <UserX className="size-3.5" aria-hidden /> Auteur : compte supprimé (entrées préservées)
            </p>
          )}

          {lignes.length ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-xs">
                <tbody>
                  {lignes.map(([cle, valeur], i) => (
                    <tr key={cle} className={cn(i > 0 && "border-t border-border")}>
                      <td className="w-1/3 bg-muted/40 px-2 py-1.5 font-medium">{cle}</td>
                      <td className="px-2 py-1.5 font-mono text-[11px] break-all">
                        {typeof valeur === "object" ? JSON.stringify(valeur) : String(valeur)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Aucun détail supplémentaire pour cette action.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

const PageJournal = () => (
  <FiltresJournalAdminProvider>
    <JournalAdmin />
  </FiltresJournalAdminProvider>
)

export default PageJournal
