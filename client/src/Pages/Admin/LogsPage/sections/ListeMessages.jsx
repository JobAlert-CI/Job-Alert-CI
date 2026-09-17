import { memo, useMemo, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import { Eye, Inbox, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { dateHeure } from "@/lib/dates"
import { useFiltresLogsAdmin } from "@/contexts/FiltresLogsAdmin.context"
import {
  CONTACT_INTERNE_VERS_API, STATUTS_CONTACT, VARIANTE_CONTACT,
  messageErreurLogs, useChangerStatutContact, useContactsQuery, useLogsStatsQuery,
} from "@/features/admin-logs.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import PaginationListe from "@/components/admin/PaginationListe"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useNotify } from "@/contexts/Notify.context"
import { SectionErreur, SectionVide, SectionAucunResultat, TransitionEtat } from "@/components/admin/EtatsSection"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import Bloc from "@/components/admin/Bloc"
import DialogMessageDetail from "@/components/dialog/DialogMessageDetail"
import SelectStatutContact from "../components/SelectStatutContact"
import { SkeletonCarteContactMobile, SkeletonLigneContact } from "../components/SkeletonMessage"
import BlocSkel from "../components/BlocSkel"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Messages de contact (cycle 17, doc v3 §17.2).
   Mobile (< md) : cartes avec Select de statut intégré — Desktop : table.
───────────────────────────────────────────────────────────────────── */

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

/* ── Carte mobile (miroir de la ligne desktop) ─────────────────────
   Toutes les actions restent accessibles : badge de statut, changement
   de statut inline (Select + spinner), bouton détail (Dialog). */
const CarteMessageMobile = memo(function CarteMessageMobile({ message, enCours, onChanger, onDetail }) {
  const cleApi = statutApi(message.status)
  return (
    <article
      aria-label={`Message de ${message.full_name}`}
      className="rounded-xl border border-border bg-card p-4 shadow-soft"
    >
      {/* En-tête : date / identité + badge statut + détail */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] tabular-nums text-muted-foreground">
            Reçu le {dateHeure(message.created_at)}
          </p>
          <p className="mt-0.5 truncate text-sm font-medium" title={message.full_name}>
            {message.full_name}
          </p>
          <p className="truncate text-[10px] text-muted-foreground" title={message.email}>
            {message.email}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={VARIANTE_CONTACT[cleApi] ?? "outline"}>
            {STATUTS_CONTACT.find((s) => s.valeur === cleApi)?.libelle ?? cleApi}
          </Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDetail(message)}
            aria-label={`Détails du message de ${message.full_name}`}
          >
            <Eye className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Sujet (tronqué sur 2 lignes, title complet) */}
      <p className="mt-2 line-clamp-2 text-xs" title={message.subject_label}>
        {message.subject_label}
      </p>
      {message.replied_at && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          répondu le {dateHeure(message.replied_at)}
        </p>
      )}

      {/* Pied : changement de statut */}
      <div className="mt-3 border-t border-border pt-2">
        <SelectStatutContact message={message} enCours={enCours} onChanger={onChanger} />
      </div>
    </article>
  )
})

const ContactsSkeleton = ({ nbLignes }) => {
  const lignes = Array.from({ length: nbLignes }, (_, i) => i)
  return (
    <div role="status" aria-label="Chargement des messages de contact">
      {/* ── Mobile : cartes ─────────────────────────────── */}
      <ul className="flex flex-col gap-3 px-4 pb-2 md:hidden" aria-hidden="true">
        {lignes.slice(0, Math.min(nbLignes, 6)).map((i) => (
          <li key={i}><SkeletonCarteContactMobile delay={i * 70} /></li>
        ))}
      </ul>

      {/* ── Desktop : table avec en-tête ────────────────── */}
      <div className="hidden overflow-x-auto scrollbar-thin md:block">
        <Table aria-hidden="true">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><BlocSkel className="h-3 w-10" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-20" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-10" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-12" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-24" /></TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((i) => <SkeletonLigneContact key={i} delay={i * 70} />)}
          </TableBody>
        </Table>
      </div>

      {/* Pied partagé : équivalent de PaginationListe */}
      <div className="border-t border-border px-4 py-3" aria-hidden="true">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-3 w-24" />
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }, (_, j) => (
              <Skeleton key={j} className="size-8 rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── COMPOSANT PRINCIPAL ────────────────────────────────────────── */
const ListeMessages = () => {
  const notify = useNotify()
  const mouvementReduit = useReducedMotion()
  const { statutContact, pageContacts, paramsContacts, setStatutContact, setPageContacts, reinitialiserContacts } =
    useFiltresLogsAdmin()
  const { data: stats } = useLogsStatsQuery(30)
  const { data: contacts, isLoading, isError, refetch } = useContactsQuery(paramsContacts)
  const changerStatut = useChangerStatutContact()
  const [detail, setDetail] = useState(null)
  /* Tri INITIALISÉ : « Reçu » descendant (le plus récent d'abord). */
  const [tri, setTri] = useState({ cle: "recu", direction: "desc" })
  /* Ancrage du retour en haut du tableau au changement de page. */
  const refTableau = useRef(null)

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

  /* key = fondu léger du corps à chaque changement de tri / filtre.
     ⚠️ Le tri / filtres ne font PAS partie de la clé de TransitionEtat :
     l'ancienne clé `${etat}-${cleCorps}` rejouait le fondu global de la
     section à chaque tri en plus du fondu du corps (double animation). */
  const cleCorps = `${statutContact}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  const etat = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !contacts?.length
        ? filtresActifs ? "aucun-resultat" : "vide"
        : "donnees"

  return (
    <>
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
          <Bloc>
            <TransitionEtat etat={etat}>
              {isError ? (
                <div className="p-4">
                  <SectionErreur onRetry={refetch} message="Impossible de charger les messages." />
                </div>
              ) : isLoading ? (
                <ContactsSkeleton nbLignes={paramsContacts.limit} />
              ) : !contacts?.length ? (
                <div className="p-4">
                  {filtresActifs ? (
                    <SectionAucunResultat onReset={reinitialiserContacts} message="Aucun message ne correspond au statut." />
                  ) : (
                    <SectionVide message="Aucun message de contact pour l'instant." />
                  )}
                </div>
              ) : !contactsAffiches.length ? (
                <div className="p-4">
                  <SectionAucunResultat onReset={reinitialiserContacts} message="Aucun message ne correspond au statut sur cette page." />
                </div>
              ) : (
                <>
                  {/* ── Mobile : cartes ─────────────────────────── */}
                  <ul
                    key={cleCorps}
                    className="flex animate-in flex-col gap-3 px-4 pb-2 duration-200 motion-reduce:animate-none md:hidden"
                  >
                    {contactsAffiches.map((message) => (
                      <li key={message.id}>
                        <CarteMessageMobile
                          message={message}
                          enCours={changerStatut.isPending && changerStatut.variables?.contactId === message.id}
                          onChanger={changer}
                          onDetail={setDetail}
                        />
                      </li>
                    ))}
                  </ul>

                  {/* ── Desktop : table ─────────────────────────── */}
                  <section aria-label="Messages de contact" className="hidden overflow-x-auto scrollbar-thin md:block">
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
                      {/* key = fondu léger à chaque changement de tri / filtre */}
                      <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                        {contactsAffiches.map((message) => {
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
                                <SelectStatutContact message={message} enCours={enCours} onChanger={changer} />
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
                        })}
                      </TableBody>
                    </Table>
                  </section>

                  {/* Compteur honnête quand le filtre client s'applique. */}
                  {filtresActifs && (
                    <div className="border-t border-border px-4 py-2.5 text-xs tabular-nums text-muted-foreground">
                      {contactsAffiches.length} message{contactsAffiches.length > 1 ? "s" : ""} affiché{contactsAffiches.length > 1 ? "s" : ""} sur {contacts.length} (page courante)
                    </div>
                  )}

                  {/* ─── Pagination heuristique (liste plate sans total) ─── */}
                  <div className="border-t border-border px-4 py-3">
                    <PaginationListe page={pageContacts} pagePleine={pagePleine} onPageChange={changerPage} />
                  </div>
                </>
              )}
            </TransitionEtat>
          </Bloc>
        </SectionCardAdmin>
      </div>

      {/* ─── Dialog détail ─── */}
      {detail && (
        <DialogMessageDetail message={detail} onClose={setDetail} />
      )}
    </>
  )
}

export default ListeMessages