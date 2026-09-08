import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, Eye, User } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useRechercheDebouncee } from "@/hooks/use-recherche-debouncee"
import { useFiltresLogsAdmin } from "@/contexts/FiltresLogsAdmin.context"
import {
  MOTIFS_EMAIL, VARIANTE_STATUT_EMAIL, libelleMotif, libelleStatutEmail,
  useEmailsTxQuery, useEmailsTxStatsQuery,
} from "@/features/admin-logs.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import CarteCompteur from "@/components/admin/CarteCompteur"
import PaginationListe from "@/components/admin/PaginationListe"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { SectionErreur, SectionVide, SectionAucunResultat } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Emails transactionnels (cycle 17, doc v3 §17.3).

   Compteurs M1-M3 (total/échecs/en file, globaux) + badge M4 « échecs
   aujourd'hui » (days=1) servis par UN SEUL appel /stats?days=30 :
   - M1 = stats.total, M2 = par_statut.failed, M3 = par_statut.queued ;
   - M4 : requête DÉDIÉE days=1 (fenêtre « aujourd'hui » — la doc v3
     §17.3 demande un badge visible sans ouvrir la liste) ;
   - M5 : envois/jour empilés sent/failed/queued (30 j) ;
   - M6 : barres horizontales par motif (6 valeurs de l'enum réel).

   Table : /transactional-emails (liste plate → heuristique) filtres
   purpose/status/to_email (recherche ilike : le Context envoie
   %terme% — le serveur ilike si %, exact sinon).

   Sécurité : request_payload/response_payload JAMAIS exposés par le
   serveur — le dialog détail n'affiche que les métadonnées.
   ───────────────────────────────────────────────────────────────────── */

const COULEURS_STATUT = { sent: "#10b981", failed: "#ef4444", queued: "#64748b" }
const COULEUR_MOTIF = "#0F2D4D"

const dateHeure = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

const CadreChart = ({ titre, chargement, vide, videMessage, children, minHeight = 220, className = "" }) => (
  <div className={`flex flex-col gap-2 rounded-xl border border-border bg-card p-4 ${className}`}>
    <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{titre}</h3>
    {chargement ? (
      <Skeleton className="w-full rounded-lg" style={{ height: minHeight }} />
    ) : vide ? (
      <Empty className="py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon" />
          <EmptyTitle>Pas encore de données</EmptyTitle>
          <EmptyDescription>{videMessage}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    ) : (
      <div style={{ height: minHeight }}>
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    )}
  </div>
)

const OngletEmailsTx = () => {
  const {
    motif, statutEmail, recherche, pageEmails, paramsEmails,
    setMotif, setStatutEmail, setPageEmails, reinitialiserEmails, setScalar,
  } = useFiltresLogsAdmin()

  // Stats 30 j (M1-M3, M5, M6) + stats 1 j (M4 badge « aujourd'hui »).
  const { data: stats, isLoading: statsCharge } = useEmailsTxStatsQuery(30)
  const { data: statsJour, isLoading: jourCharge } = useEmailsTxStatsQuery(1)
  const { data: emails, isLoading, isError, refetch } = useEmailsTxQuery(paramsEmails)

  const [detail, setDetail] = useState(null)

  // Recherche debouncée → setScalar BRUT (piège « q=query » documenté).
  const { valeurLocale, setValeurLocale } = useRechercheDebouncee({
    valeurUrl: recherche,
    setScalar,
    cle: "recherche",
  })

  // M5 : par jour empilé par statut.
  const parJour = useMemo(
    () =>
      (stats?.par_jour ?? []).map((j) => ({
        jour: new Date(`${j.jour}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        Envoyés: j.par_statut?.sent ?? 0,
        Échecs: j.par_statut?.failed ?? 0,
        "En file": j.par_statut?.queued ?? 0,
      })),
    [stats]
  )

  // M6 : par motif (6 valeurs de l'enum), tri décroissant pour le chart.
  const parMotif = useMemo(
    () =>
      Object.entries(stats?.par_motif ?? {})
        .map(([valeur, total]) => ({ motif: libelleMotif(valeur), total }))
        .sort((a, b) => b.total - a.total),
    [stats]
  )

  const filtresActifs = !!(motif || statutEmail || recherche)
  const pagePleine = Array.isArray(emails) && emails.length === paramsEmails.limit
  const echecsJour = statsJour?.echecs_fenetre ?? 0

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Compteurs M1-M3 + badge M4 ─── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CarteCompteur label="Total (historique)" valeur={stats?.total ?? 0} chargement={statsCharge} />
        <button type="button" onClick={() => setStatutEmail("failed")} className="text-left"
          aria-label={`Voir les échecs (${stats?.par_statut?.failed ?? 0})`}>
          <CarteCompteur label="Échecs" valeur={stats?.par_statut?.failed ?? 0} chargement={statsCharge} />
        </button>
        <button type="button" onClick={() => setStatutEmail("queued")} className="text-left"
          aria-label={`Voir les emails en file (${stats?.par_statut?.queued ?? 0})`}>
          <CarteCompteur label="En file" valeur={stats?.par_statut?.queued ?? 0} chargement={statsCharge} />
        </button>
        <button type="button" onClick={() => setStatutEmail("failed")} className="text-left"
          aria-label={`Voir les échecs du jour (${echecsJour})`}>
          <CarteCompteur
            label="Échecs aujourd'hui"
            valeur={echecsJour}
            chargement={jourCharge}
            texte={echecsJour > 0 ? `${echecsJour} échec${echecsJour > 1 ? "s" : ""} aujourd'hui` : undefined}
          />
        </button>
      </div>

      {/* Alerte opérationnelle doc v3 §17.3 : taux d'échec = signal Resend. */}
      {echecsJour > 0 && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          {echecsJour} échec{echecsJour > 1 ? "s" : ""} aujourd'hui — un taux élevé peut indiquer un problème
          côté fournisseur d'email (Resend) plutôt qu'un problème d'inscription.
        </p>
      )}

      {/* ─── Charts M5-M6 ─── */}
      <div className="grid gap-4 xl:grid-cols-3">
        <CadreChart titre="Envois par jour (30 j)" chargement={statsCharge} vide={!parJour.length}
          videMessage="Aucun envoi dans la fenêtre." className="xl:col-span-2">
          <BarChart data={parJour} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="jour" fontSize={10} tickLine={false} />
            <YAxis allowDecimals={false} fontSize={10} tickLine={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Envoyés" stackId="s" fill={COULEURS_STATUT.sent} isAnimationActive={false} />
            <Bar dataKey="Échecs" stackId="s" fill={COULEURS_STATUT.failed} isAnimationActive={false} />
            <Bar dataKey="En file" stackId="s" fill={COULEURS_STATUT.queued} isAnimationActive={false} radius={[4, 4, 0, 0]} />
          </BarChart>
        </CadreChart>

        <CadreChart titre="Envois par motif (historique)" chargement={statsCharge} vide={!parMotif.length}
          videMessage="Aucun email transactionnel envoyé." minHeight={240}>
          <BarChart data={parMotif} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
            <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} />
            <YAxis type="category" dataKey="motif" width={120} fontSize={10} tickLine={false} />
            <Tooltip formatter={(v) => [v, "Envois"]} />
            <Bar dataKey="total" name="Envois" fill={COULEUR_MOTIF} isAnimationActive={false} radius={[0, 4, 4, 0]} />
          </BarChart>
        </CadreChart>
      </div>

      {/* ─── Filtres ─── */}
      <section aria-label="Filtres emails transactionnels" className="flex flex-wrap items-center gap-2">
        <select value={motif} onChange={(e) => setMotif(e.target.value)} aria-label="Filtrer par motif"
          className="h-9 rounded-md border border-border bg-background px-2 text-xs">
          <option value="">Tous les motifs</option>
          {MOTIFS_EMAIL.map((m) => (
            <option key={m.valeur} value={m.valeur}>{m.libelle}</option>
          ))}
        </select>
        <select value={statutEmail} onChange={(e) => setStatutEmail(e.target.value)} aria-label="Filtrer par statut"
          className="h-9 rounded-md border border-border bg-background px-2 text-xs">
          <option value="">Tous les statuts</option>
          <option value="sent">Envoyé</option>
          <option value="queued">En file</option>
          <option value="failed">Échoué</option>
        </select>
        <input
          type="search"
          value={valeurLocale}
          onChange={(e) => setValeurLocale(e.target.value)}
          placeholder="Rechercher un destinataire…"
          aria-label="Rechercher un destinataire"
          className="h-9 w-56 rounded-md border border-border bg-background px-2 text-xs"
        />
        {filtresActifs && (
          <Button variant="ghost" size="sm" onClick={reinitialiserEmails}>Réinitialiser</Button>
        )}
      </section>

      {/* ─── Table ─── */}
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les emails transactionnels." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
        </div>
      ) : !emails?.length ? (
        filtresActifs ? (
          <SectionAucunResultat onReset={reinitialiserEmails} message="Aucun email ne correspond aux critères." />
        ) : (
          <SectionVide message="Aucun email transactionnel pour l'instant." />
        )
      ) : (
        <section aria-label="Emails transactionnels" className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Date</TableHead>
                <TableHead>Destinataire</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden lg:table-cell">Tentatives</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => (
                <TableRow key={email.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{dateHeure(email.created_at)}</TableCell>
                  <TableCell>
                    <span className="block max-w-48 truncate text-xs font-medium" title={email.to_email}>{email.to_email}</span>
                    {email.subscriber_id && (
                      <Link to={`/admin/utilisateurs/${email.subscriber_id}`}
                        className="inline-flex items-center gap-1 text-[10px] text-primary underline-offset-2 hover:underline">
                        <User className="size-3" aria-hidden /> Fiche abonné
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{libelleMotif(email.purpose)}</TableCell>
                  <TableCell>
                    <Badge variant={VARIANTE_STATUT_EMAIL[email.status] ?? "outline"}>
                      {libelleStatutEmail(email.status)}
                    </Badge>
                    {email.status === "failed" && email.last_error && (
                      <span className="mt-0.5 block max-w-48 truncate text-[10px] text-destructive" title={email.last_error}>
                        {email.last_error}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-xs tabular-nums text-muted-foreground lg:table-cell">{email.attempts}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDetail(email)}
                      aria-label={`Détails de l'email à ${email.to_email}`}>
                      <Eye className="size-3.5" aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {/* ─── Pagination heuristique ─── */}
      <PaginationListe page={pageEmails} pagePleine={pagePleine} onPageChange={setPageEmails} />

      {/* ─── Dialog détail (métadonnées seulement — jamais les payloads) ─── */}
      {detail && (
        <Dialog open onOpenChange={(ouvert) => { if (!ouvert) setDetail(null) }}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Email {libelleMotif(detail.purpose)}</DialogTitle>
              <DialogDescription>
                {dateHeure(detail.created_at)} · destinataire {detail.to_email}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <p><span className="font-medium">Statut :</span>{" "}
                <Badge variant={VARIANTE_STATUT_EMAIL[detail.status] ?? "outline"}>{libelleStatutEmail(detail.status)}</Badge>
              </p>
              <p><span className="font-medium">Fournisseur :</span> {detail.provider}</p>
              {detail.provider_email_id && (
                <p className="truncate font-mono text-[10px]" title={detail.provider_email_id}>
                  <span className="font-medium">ID fournisseur :</span> {detail.provider_email_id}
                </p>
              )}
              <p><span className="font-medium">Tentatives :</span> {detail.attempts}</p>
              {detail.last_error && (
                <p className="rounded-lg bg-destructive/10 p-2 font-mono text-[10px] text-destructive">
                  {detail.last_error}
                </p>
              )}
              {detail.subscriber_id && (
                <Link to={`/admin/utilisateurs/${detail.subscriber_id}`}
                  className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
                  <User className="size-3" aria-hidden /> Voir la fiche abonné
                </Link>
              )}
              <p className="text-[10px] text-muted-foreground">
                Les payloads de requête/réponse au fournisseur ne sont jamais exposés (principe de sécurité serveur).
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default OngletEmailsTx
