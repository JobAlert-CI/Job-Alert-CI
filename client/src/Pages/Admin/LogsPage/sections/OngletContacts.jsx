import { useMemo, useState } from "react"
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { Eye, Inbox } from "lucide-react"
import { useFiltresLogsAdmin } from "@/contexts/FiltresLogsAdmin.context"
import {
  CONTACT_INTERNE_VERS_API, STATUTS_CONTACT, VARIANTE_CONTACT,
  messageErreurLogs, useChangerStatutContact, useContactsQuery, useLogsStatsQuery,
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
import { useNotify } from "@/contexts/Notify.context"
import { SectionErreur, SectionVide, SectionAucunResultat } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Messages de contact (cycle 17, doc v3 §17.2).

   Compteurs C1-C4 : chips cliquables (filtre en 1 clic, pattern
   Abonnés) servis par /logs/stats (contacts_par_statut, vocabulaire
   API). C5 : donut par statut (même appel).
   Table /logs/contacts + PATCH statut inline (spam assignable depuis
   le cycle 17) + dialog détail (message complet, user_agent, ip_hash).

   ⚠️ La réponse du PATCH renvoie le statut STOCKÉ ("in_progress",
   "closed") — CONTACT_INTERNE_VERS_API traduit pour les badges.
   ───────────────────────────────────────────────────────────────────── */

const COULEURS_STATUT = {
  new: "#0F2D4D",
  read: "#64748b",
  replied: "#10b981",
  archived: "#a8a29e",
  spam: "#ef4444",
}

const dateHeure = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

/** Traduit le statut d'une ligne (stocké OU API) vers la clé API. */
const statutApi = (statut) => CONTACT_INTERNE_VERS_API[statut] ?? statut

const OngletContacts = () => {
  const notify = useNotify()
  const { statutContact, pageContacts, paramsContacts, setStatutContact, setPageContacts, reinitialiserContacts } =
    useFiltresLogsAdmin()

  const { data: stats, isLoading: statsCharge } = useLogsStatsQuery(30)
  const { data: contacts, isLoading, isError, refetch } = useContactsQuery(paramsContacts)
  const changerStatut = useChangerStatutContact()

  const [detail, setDetail] = useState(null) // message ouvert en dialog

  // C5 : donut par statut (clés API, ordre du référentiel STATUTS_CONTACT).
  const parStatut = useMemo(
    () =>
      STATUTS_CONTACT.map((s) => ({
        statut: s.libelle,
        total: stats?.contacts_par_statut?.[s.valeur] ?? 0,
        couleur: COULEURS_STATUT[s.valeur],
      })).filter((e) => e.total > 0),
    [stats]
  )

  const filtresActifs = !!statutContact
  const pagePleine = Array.isArray(contacts) && contacts.length === paramsContacts.limit

  // Changement de statut inline (dropdown par ligne).
  const changer = (message, nouveauStatut) => {
    if (nouveauStatut === statutApi(message.status)) return
    changerStatut.mutate(
      { contactId: message.id, status: nouveauStatut },
      {
        onSuccess: () => notify(`Statut mis à jour : ${STATUTS_CONTACT.find((s) => s.valeur === nouveauStatut)?.libelle ?? nouveauStatut}`, "success"),
        onError: (err) => notify(messageErreurLogs(err) || "Changement de statut impossible", "error"),
      }
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Compteurs C1-C4 : chips cliquables ─── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {STATUTS_CONTACT.slice(0, 4).map((s) => {
          const valeur = stats?.contacts_par_statut?.[s.valeur] ?? 0
          const actif = statutContact === s.valeur
          return (
            <button key={s.valeur} type="button"
              onClick={() => setStatutContact(actif ? "" : s.valeur)}
              aria-pressed={actif}
              aria-label={`Filtrer sur ${s.libelle} (${valeur})`}
              className={`rounded-xl transition-focus ${actif ? "ring-2 ring-primary" : ""}`}>
              <CarteCompteur label={s.libelle} valeur={valeur} chargement={statsCharge} />
            </button>
          )
        })}
      </div>

      {/* ─── Chart C5 : donut par statut ─── */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
          Messages par statut <span className="font-normal normal-case">(total {stats?.contacts_total ?? 0})</span>
        </h3>
        {statsCharge ? (
          <Skeleton className="h-52 w-full rounded-lg" />
        ) : !parStatut.length ? (
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
              <EmptyTitle>Boîte vide</EmptyTitle>
              <EmptyDescription>Aucun message reçu pour l'instant.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Pie data={parStatut} dataKey="total" nameKey="statut" innerRadius={55} outerRadius={80}
                  paddingAngle={2} isAnimationActive={false}>
                  {parStatut.map((e) => <Cell key={e.statut} fill={e.couleur} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ─── Filtre statut (select, miroir des chips) ─── */}
      <section aria-label="Filtres contacts" className="flex flex-wrap items-center gap-2">
        <select value={statutContact} onChange={(e) => setStatutContact(e.target.value)}
          aria-label="Filtrer par statut"
          className="h-9 rounded-md border border-border bg-background px-2 text-xs">
          <option value="">Tous les statuts</option>
          {STATUTS_CONTACT.map((s) => (
            <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
          ))}
        </select>
        {filtresActifs && (
          <Button variant="ghost" size="sm" onClick={reinitialiserContacts}>Réinitialiser</Button>
        )}
      </section>

      {/* ─── Table ─── */}
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les messages." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
        </div>
      ) : !contacts?.length ? (
        filtresActifs ? (
          <SectionAucunResultat onReset={reinitialiserContacts} message="Aucun message ne correspond au statut." />
        ) : (
          <SectionVide message="Aucun message de contact pour l'instant." />
        )
      ) : (
        <section aria-label="Messages de contact" className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Reçu</TableHead>
                <TableHead>Expéditeur</TableHead>
                <TableHead>Sujet</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Changer le statut</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((message) => {
                const cleApi = statutApi(message.status)
                const enCours = changerStatut.isPending && changerStatut.variables?.contactId === message.id
                return (
                  <TableRow key={message.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {dateHeure(message.created_at)}
                    </TableCell>
                    <TableCell>
                      <span className="block text-xs font-medium">{message.full_name}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">{message.email}</span>
                    </TableCell>
                    <TableCell className="max-w-44 truncate text-xs" title={message.subject_label}>
                      {message.subject_label}
                    </TableCell>
                    <TableCell>
                      <Badge variant={VARIANTE_CONTACT[cleApi] ?? "outline"}>
                        {STATUTS_CONTACT.find((s) => s.valeur === cleApi)?.libelle ?? cleApi}
                      </Badge>
                      {message.replied_at && (
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">
                          répondu le {dateHeure(message.replied_at)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <select
                        value={cleApi}
                        disabled={enCours}
                        onChange={(e) => changer(message, e.target.value)}
                        aria-label={`Changer le statut du message de ${message.full_name}`}
                        className="h-8 rounded-md border border-border bg-background px-2 text-xs disabled:opacity-50">
                        {STATUTS_CONTACT.map((s) => (
                          <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDetail(message)}
                        aria-label={`Détails du message de ${message.full_name}`}>
                        <Eye className="size-3.5" aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </section>
      )}

      {/* ─── Pagination heuristique ─── */}
      <PaginationListe page={pageContacts} pagePleine={pagePleine} onPageChange={setPageContacts} />

      {/* ─── Dialog détail ─── */}
      {detail && (
        <Dialog open onOpenChange={(ouvert) => { if (!ouvert) setDetail(null) }}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Message de {detail.full_name}</DialogTitle>
              <DialogDescription>
                Reçu le {dateHeure(detail.created_at)} · {detail.subject_label}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <p className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">{detail.message}</p>
              <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground">
                <p><span className="font-medium text-foreground">Email :</span> {detail.email}</p>
                {detail.user_agent && (
                  <p className="truncate" title={detail.user_agent}>
                    <span className="font-medium text-foreground">User-agent :</span> {detail.user_agent}
                  </p>
                )}
                {detail.ip_hash && (
                  <p className="truncate font-mono text-[10px]" title={detail.ip_hash}>
                    <span className="font-medium text-foreground">IP (hashée) :</span> {detail.ip_hash}
                  </p>
                )}
                {detail.replied_at && (
                  <p><span className="font-medium text-foreground">Répondu le :</span> {dateHeure(detail.replied_at)}</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default OngletContacts
