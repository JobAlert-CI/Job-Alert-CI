import { useMemo, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts"
import { Archive, BarChart3, Eye, Inbox, Loader2, MailOpen, OctagonAlert, Reply, RotateCcw } from "lucide-react"
import { cn } from "cn"
import { dateHeure } from "@/lib/dates"
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
import EnteteTriable from "@/components/admin/EnteteTriable"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useNotify } from "@/contexts/Notify.context"
import { SectionErreur, SectionVide, SectionAucunResultat } from "../components/EtatsSection"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import CadreChart, { TooltipChart } from "../components/CadreChart"
import { VARIANTS_PAGE } from "@/components/admin/Bloc"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Messages de contact (cycle 17, doc v3 §17.2).
   Refonte :
   • FILTRE CORRIGÉ : sentinelle « tous » (Radix refuse la valeur
     vide qui verrouillait l'ancien SelectItem value="") + filtrage
     client de GARANTIE sur la page chargée.
   • Tri par en-tête initialisé (« Reçu » desc).
   • Changement de statut inline : Select shadcn + SPINNER pendant la
     mutation (au lieu d'un simple disabled grisé).
   • Retour en haut du tableau au changement de page, skeleton fidèle
     (limite de page), transition framer-motion uniforme, animations
     du donut conditionnées par prefers-reduced-motion.
   ⚠️ La réponse du PATCH renvoie le statut STOCKÉ — CONTACT_INTERNE_
   VERS_API traduit pour les badges.
   ───────────────────────────────────────────────────────────────────── */
const COULEURS_STATUT = {
  new: "#0F2D4D",
  read: "#64748b",
  replied: "#10b981",
  archived: "#a8a29e",
  spam: "#ef4444",
}

const ICON_COMPT = {
  new: Inbox,
  read: MailOpen,
  replied: Reply,
  archived: Archive,
  spam: OctagonAlert,
}

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

/** Traduit le statut d'une ligne (stocké OU API) vers la clé API. */
const statutApi = (statut) => CONTACT_INTERNE_VERS_API[statut] ?? statut

/* Rang de tri des statuts : cycle de vie du message (new → spam). */
const RANG_STATUT_CONTACT = { new: 1, read: 2, replied: 3, archived: 4, spam: 5 }

const COLONNES = [
  { cle: "recu", libelle: "Reçu", directionInitiale: "desc", triValeur: (m) => m.created_at ?? null },
  { cle: "expediteur", libelle: "Expéditeur", directionInitiale: "asc", triValeur: (m) => (m.full_name ?? "").toLowerCase() },
  { cle: "sujet", libelle: "Sujet", directionInitiale: "asc", triValeur: (m) => m.subject_label ?? "" },
  { cle: "statut", libelle: "Statut", directionInitiale: "asc", triValeur: (m) => RANG_STATUT_CONTACT[statutApi(m.status)] ?? 0 },
]

const classeDeclencheur = (actif, largeur) =>
  cn(
    "h-8 text-xs transition-colors",
    largeur,
    actif
      ? "border-brand-navy/30 bg-secondary font-semibold text-secondary-foreground"
      : "text-muted-foreground"
  )

/* ─── Skeleton fidèle aux colonnes réelles ─── */
const LigneSkeletonContact = () => (
  <TableRow className="hover:bg-transparent">
    <TableCell><Skeleton className="h-3.5 w-24" /></TableCell>
    <TableCell>
      <div className="flex flex-col gap-1.5 py-0.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-2.5 w-36" />
      </div>
    </TableCell>
    <TableCell><Skeleton className="h-3.5 w-40" /></TableCell>
    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
    <TableCell><Skeleton className="h-8 w-36 rounded-md" /></TableCell>
    <TableCell><div className="flex justify-end"><Skeleton className="size-7 rounded-md" /></div></TableCell>
  </TableRow>
)

const OngletContacts = () => {
  const notify = useNotify()
  const mouvementReduit = useReducedMotion()
  const { statutContact, pageContacts, paramsContacts, setStatutContact, setPageContacts, reinitialiserContacts } =
    useFiltresLogsAdmin()
  const { data: stats, isLoading: statsCharge } = useLogsStatsQuery(30)
  const { data: contacts, isLoading, isError, refetch } = useContactsQuery(paramsContacts)
  const changerStatut = useChangerStatutContact()
  const [detail, setDetail] = useState(null)

  /* Tri INITIALISÉ : « Reçu » descendant (le plus récent d'abord). */
  const [tri, setTri] = useState({ cle: "recu", direction: "desc" })
  /* Ancrage du retour en haut du tableau au changement de page. */
  const refTableau = useRef(null)

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

  /* Filtrage CLIENT DE GARANTIE sur la page chargée, en plus du
     paramètre serveur — le filtre fonctionne quoi que fasse le backend. */
  const contactsFiltres = useMemo(() => {
    const base = contacts ?? []
    if (!statutContact) return base
    return base.filter((m) => statutApi(m.status) === statutContact)
  }, [contacts, statutContact])

  const contactsAffiches = useMemo(() => {
    if (!tri) return contactsFiltres
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return contactsFiltres
    const copie = [...contactsFiltres].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [contactsFiltres, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  /* Changement de statut inline (Select par ligne). */
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

  /* Changement de page → retour en haut du tableau. */
  const changerPage = (nouvellePage) => {
    setPageContacts(nouvellePage)
    refTableau.current?.scrollIntoView({
      behavior: mouvementReduit ? "auto" : "smooth",
      block: "start",
    })
  }

  /* key = fondu léger du corps à chaque changement de tri / filtre. */
  const cleCorps = `${statutContact}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* ─── Compteurs C1-C4 : chips cliquables ─── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {STATUTS_CONTACT.map((s) => (
          <CarteCompteur
            key={`statut-${s.valeur}`}
            label={`${s.libelle} (30 j)`}
            valeur={stats?.contacts_par_statut?.[s.valeur] ?? 0}
            icone={ICON_COMPT[s.valeur]}
            href="/admin/logs"
            query={`?onglet=contacts&statut=${s.valeur}`}
          />
        ))}
      </div>

      {/* ─── Chart C5 : donut par statut ─── */}
      <SectionCardAdmin
        title="Messages par statut (30 derniers jours)"
        description="Statut des derniers messages reçus dans la boîte."
        icon={BarChart3}
      >
        <CadreChart chargement={statsCharge} vide={!parStatut.length} videMessage="Aucun message reçu pour l'instant.">
          <PieChart>
            <Tooltip content={<TooltipChart />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Pie
              data={parStatut}
              dataKey="total"
              nameKey="statut"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              isAnimationActive={!mouvementReduit}
              animationDuration={600}
              animationEasing="ease-out"
            >
              {parStatut.map((e) => <Cell key={e.statut} fill={e.couleur} />)}
            </Pie>
          </PieChart>
        </CadreChart>
      </SectionCardAdmin>

      {/* ─── Table des messages ─── */}
      <div ref={refTableau} className="scroll-mt-20">
        <SectionCardAdmin
          title="Liste des messages"
          description="Messages reçus via le formulaire de contact"
          icon={Inbox}
          contentClassName="p-0 sm:p-0"
          action={
            <div className="flex flex-wrap items-center gap-2">
              {/* Sentinelle « tous » : Radix refuse la valeur vide (bug de
                  l'ancien SelectItem value=""). */}
              <Select value={statutContact || "tous"} onValueChange={(v) => setStatutContact(v === "tous" ? "" : v)}>
                <SelectTrigger className={classeDeclencheur(!!statutContact, "w-44")} aria-label="Filtrer par statut">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les statuts</SelectItem>
                  {STATUTS_CONTACT.map((s) => (
                    <SelectItem key={s.valeur} value={s.valeur}>
                      <span className="flex items-center justify-between gap-3">
                        {s.libelle}
                        <span className="tabular-nums text-muted-foreground">({stats?.contacts_par_statut?.[s.valeur] ?? 0})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filtresActifs && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={reinitialiserContacts}>
                  <RotateCcw aria-hidden /> Réinitialiser
                </Button>
              )}
            </div>
          }
        >
          {isError ? (
            <div className="p-4">
              <SectionErreur onRetry={refetch} message="Impossible de charger les messages." />
            </div>
          ) : !contacts?.length && !isLoading ? (
            <div className="p-4">
              {filtresActifs ? (
                <SectionAucunResultat onReset={reinitialiserContacts} message="Aucun message ne correspond au statut." />
              ) : (
                <SectionVide message="Aucun message de contact pour l'instant." />
              )}
            </div>
          ) : (
            <>
              <section aria-label="Messages de contact" className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "recu")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "expediteur")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "sujet")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "statut")} tri={tri} onTri={basculerTri} />
                      <TableHead>Changer le statut</TableHead>
                      <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                    {isLoading ? (
                      [...Array(paramsContacts.limit)].map((_, i) => <LigneSkeletonContact key={i} />)
                    ) : !contactsAffiches.length ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6}>
                          <SectionAucunResultat onReset={reinitialiserContacts} message="Aucun message ne correspond au statut sur cette page." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      contactsAffiches.map((message) => {
                        const cleApi = statutApi(message.status)
                        const enCours = changerStatut.isPending && changerStatut.variables?.contactId === message.id
                        return (
                          <TableRow key={message.id} className="transition-colors hover:bg-muted/50">
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
                              {/* Select inline + SPINNER pendant la mutation. */}
                              <div className="relative inline-flex items-center">
                                <Select value={cleApi} onValueChange={(v) => changer(message, v)} disabled={enCours}>
                                  <SelectTrigger
                                    className={cn("h-8 w-36 text-xs", enCours && "opacity-60")}
                                    aria-label={`Changer le statut du message de ${message.full_name}`}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STATUTS_CONTACT.map((s) => (
                                      <SelectItem key={s.valeur} value={s.valeur}>{s.libelle}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {enCours && (
                                  <Loader2
                                    className="pointer-events-none absolute right-8 size-3.5 animate-spin text-muted-foreground"
                                    aria-hidden="true"
                                  />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => setDetail(message)}
                                  aria-label={`Détails du message de ${message.full_name}`}
                                >
                                  <Eye className="size-3.5" aria-hidden />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </section>
              {/* Compteur honnête quand le filtre client s'applique. */}
              {filtresActifs && !isLoading && (
                <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
                  {contactsAffiches.length} message{contactsAffiches.length > 1 ? "s" : ""} affiché{contactsAffiches.length > 1 ? "s" : ""} sur {contacts.length} (page courante)
                </div>
              )}
              <div className="border-t border-border px-4 py-3">
                <PaginationListe page={pageContacts} pagePleine={pagePleine} onPageChange={changerPage} />
              </div>
            </>
          )}
        </SectionCardAdmin>
      </div>

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
    </motion.div>
  )
}

export default OngletContacts