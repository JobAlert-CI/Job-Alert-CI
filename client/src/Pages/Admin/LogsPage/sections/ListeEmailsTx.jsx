import { memo, useMemo, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import { Link } from "react-router-dom"
import { Eye, Inbox, RotateCcw, Search, User } from "lucide-react"
import { cn } from "cn"
import { dateHeure } from "@/lib/dates"
import { useRechercheDebouncee } from "@/hooks/use-recherche-debouncee"
import { useFiltresLogsAdmin } from "@/contexts/FiltresLogsAdmin.context"
import {
  MOTIFS_EMAIL, VARIANTE_STATUT_EMAIL, libelleMotif, libelleStatutEmail,
  useEmailsTxQuery,
} from "@/features/admin-logs.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import PaginationListe from "@/components/admin/PaginationListe"
import EnteteTriable from "@/components/admin/EnteteTriable"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import Bloc from "@/components/admin/Bloc"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SectionErreur, SectionVide, SectionAucunResultat, TransitionEtat } from "@/components/admin/EtatsSection"
import CarteEmailMobile from "../components/CarteEmailMobile"
import { SkeletonLigneEmail, SkeletonCarteEmailMobile } from "../components/SkeletonEmail"
import BlocSkel from "../components/BlocSkel"

/* ─────────────────────────────────────────────────────────────────────
   Liste des emails transactionnels — /admin/logs (onglet Emails).
   Mobile (< md) : cartes + tri par Select — Desktop : table triable.
   Alignement complet sur ListeEvenements / ListeMessages (cycle 17).
───────────────────────────────────────────────────────────────────── */

/* Tri « français » robuste : nombres, textes, dates ISO ; vides en fin. */
const comparerValeurs = (a, b) => {
  const videA = a === null || a === undefined || b === null
  const videB = b === null || b === undefined
  if (videA && videB) return 0
  if (videA) return 1
  if (videB) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" })
}

/* Rang de tri des statuts : échec d'abord (desc) — signal opérationnel. */
const RANG_STATUT_EMAIL = { failed: 3, queued: 2, sent: 1 }

const STATUTS_EMAIL = ["failed", "queued", "sent"]

const COLONNES = [
  { cle: "date", libelle: "Date", directionInitiale: "desc", triValeur: (e) => e.created_at ?? null },
  { cle: "destinataire", libelle: "Destinataire", directionInitiale: "asc", triValeur: (e) => (e.to_email ?? "").toLowerCase() },
  { cle: "motif", libelle: "Motif", directionInitiale: "asc", triValeur: (e) => libelleMotif(e.purpose) },
  { cle: "statut", libelle: "Statut", directionInitiale: "desc", triValeur: (e) => RANG_STATUT_EMAIL[e.status] ?? 0 },
  {
    cle: "tentatives", libelle: "Tentatives", directionInitiale: "desc",
    className: "hidden lg:table-cell",
    triValeur: (e) => e.attempts ?? 0,
  },
]

const classeDeclencheur = (actif, largeur) =>
  cn(
    "h-8 text-xs transition-colors",
    largeur,
    actif
      ? "border-brand-navy/30 bg-secondary font-semibold text-secondary-foreground"
      : "text-muted-foreground"
  )

/* ─── Ligne desktop mémoïsée ─── */
const LigneEmail = memo(function LigneEmail({ email, onDetail }) {
  return (
    <TableRow className="transition-colors hover:bg-muted/50">
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{dateHeure(email.created_at)}</TableCell>
      <TableCell>
        <span className="block max-w-48 truncate text-xs font-medium" title={email.to_email}>{email.to_email}</span>
        {email.subscriber_id && (
          <Link
            to={`/admin/utilisateurs/${email.subscriber_id}`}
            className="inline-flex items-center gap-1 text-[10px] text-primary underline-offset-2 hover:underline"
          >
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
        <div className="flex justify-end">
          <Button variant="ghost" size="icon-sm" onClick={() => onDetail(email)} aria-label={`Détails de l'email à ${email.to_email}`}>
            <Eye className="size-3.5" aria-hidden />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
})

/* ─── SKELETON FIDÈLE ──────────────────────────────────────────────── */
const EmailsSkeleton = ({ nbLignes = 20 }) => {
  const lignes = Array.from({ length: nbLignes }, (_, i) => i)
  const lignesMobile = lignes.slice(0, Math.min(nbLignes, 6))
  return (
    <div role="status" aria-label="Chargement des emails transactionnels">
      {/* Mobile : Select de tri + cartes */}
      <div className="px-4 pt-3 md:hidden" aria-hidden="true">
        <Skeleton className="h-8 w-full" />
      </div>
      <ul className="flex flex-col gap-3 px-4 pb-2 md:hidden" aria-hidden="true">
        {lignesMobile.map((i) => (
          <li key={i}><SkeletonCarteEmailMobile delay={i * 70} /></li>
        ))}
      </ul>
      {/* Desktop : table avec en-tête */}
      <div className="hidden overflow-x-auto scrollbar-thin md:block">
        <Table aria-hidden="true">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><BlocSkel className="h-3 w-10" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-20" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-12" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-12" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-14" /></TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((i) => <SkeletonLigneEmail key={i} delay={i * 70} />)}
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

/* ─── COMPOSANT PRINCIPAL ────────────────────────────────────────── */
const ListeEmailsTx = () => {
  const mouvementReduit = useReducedMotion()
  const {
    motif, statutEmail, recherche, pageEmails, paramsEmails,
    setMotif, setStatutEmail, setPageEmails, reinitialiserEmails, setScalar,
  } = useFiltresLogsAdmin()

  const { data: emails, isLoading, isError, refetch } = useEmailsTxQuery(paramsEmails)
  const [detail, setDetail] = useState(null)

  /* Tri INITIALISÉ : « Date » descendante (le plus récent d'abord). */
  const [tri, setTri] = useState({ cle: "date", direction: "desc" })

  /* Ancrage du retour en haut du tableau au changement de page. */
  const refTableau = useRef(null)

  // Recherche debouncée → setScalar BRUT.
  const { valeurLocale, setValeurLocale } = useRechercheDebouncee({
    valeurUrl: recherche,
    setScalar,
    cle: "recherche",
  })

  const filtresActifs = !!(motif || statutEmail || recherche)
  const pagePleine = Array.isArray(emails) && emails.length === paramsEmails.limit

  /* Filtrage CLIENT DE GARANTIE sur la page chargée. */
  const emailsFiltres = useMemo(() => {
    const base = emails ?? []
    if (!filtresActifs) return base
    const q = recherche.trim().toLowerCase()
    return base.filter((e) => {
      if (motif && e.purpose !== motif) return false
      if (statutEmail && e.status !== statutEmail) return false
      if (q && !(e.to_email ?? "").toLowerCase().includes(q)) return false
      return true
    })
  }, [emails, filtresActifs, motif, statutEmail, recherche])

  const emailsAffiches = useMemo(() => {
    if (!tri) return emailsFiltres
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return emailsFiltres
    const copie = [...emailsFiltres].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [emailsFiltres, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  /* Tri mobile : un Select (les en-têtes cliquables sont masqués < md). */
  const trierMobile = (valeur) => {
    if (valeur === "serveur") return setTri(null)
    const colonne = COLONNES.find((c) => c.cle === valeur)
    if (colonne) setTri({ cle: colonne.cle, direction: colonne.directionInitiale })
  }

  /* Changement de page → retour en haut du tableau. */
  const changerPage = (nouvellePage) => {
    setPageEmails(nouvellePage)
    refTableau.current?.scrollIntoView({
      behavior: mouvementReduit ? "auto" : "smooth",
      block: "start",
    })
  }

  /* key = fondu léger du corps à chaque changement de tri / filtres. */
  const cleCorps = `${motif}-${statutEmail}-${recherche}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  const etat = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !emails?.length
        ? filtresActifs ? "aucun-resultat" : "vide"
        : "donnees"

  return (
    <div ref={refTableau} className="scroll-mt-20">
      <SectionCardAdmin
        title="Emails transactionnels"
        description="Inscriptions, confirmations, désinscriptions — filtrez par motif, statut ou destinataire."
        icon={Inbox}
        contentClassName="p-0 sm:p-0"
      >
        {/* ─── Filtres : selects shadcn + recherche, responsifs ─── */}
        <div className="flex items-center flex-wrap gap-3 border-b border-border px-4 py-3">
          <div className="relative min-w-52 flex-1">
            {isLoading ? (
              <span
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-primary border-t-transparent"
                aria-label="Recherche en cours"
              />
            ) : (
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            )}
            <Input
              type="search"
              value={valeurLocale}
              onChange={(e) => setValeurLocale(e.target.value)}
              placeholder="Rechercher un destinataire…"
              aria-label="Rechercher un destinataire"
              className="h-8 pl-8 text-xs"
            />
          </div>
          {/* Sentinelle « tous » : Radix refuse la valeur vide. */}
          <Select value={motif || "tous"} onValueChange={(v) => setMotif(v === "tous" ? "" : v)}>
            <SelectTrigger className={classeDeclencheur(!!motif, "w-full sm:w-48")} aria-label="Filtrer par motif">
              <SelectValue placeholder="Filtrer par motif" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous les motifs</SelectItem>
              {MOTIFS_EMAIL.map((m) => (
                <SelectItem key={m.valeur} value={m.valeur}>{m.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statutEmail || "tous"} onValueChange={(v) => setStatutEmail(v === "tous" ? "" : v)}>
            <SelectTrigger className={classeDeclencheur(!!statutEmail, "w-full sm:w-40")} aria-label="Filtrer par statut">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous les statuts</SelectItem>
              {STATUTS_EMAIL.map((v) => (
                <SelectItem key={v} value={v}>{libelleStatutEmail(v)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtresActifs && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={reinitialiserEmails}>
              <RotateCcw aria-hidden /> Réinitialiser
            </Button>
          )}
        </div>

        {/* ─── Corps : états + cartes mobile / table desktop ─── */}
        <Bloc>
          <TransitionEtat etat={etat}>
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les emails transactionnels." />
              </div>
            ) : isLoading ? (
              <EmailsSkeleton nbLignes={paramsEmails.limit} />
            ) : !emails?.length ? (
              <div className="p-4">
                {filtresActifs ? (
                  <SectionAucunResultat onReset={reinitialiserEmails} message="Aucun email ne correspond aux critères." />
                ) : (
                  <SectionVide message="Aucun email transactionnel pour l'instant." />
                )}
              </div>
            ) : (
              <>
                {/* ── Tri — mobile (desktop : en-têtes cliquables) ── */}
                <div className="px-4 pt-3 md:hidden">
                  <Select value={tri?.cle ?? "serveur"} onValueChange={trierMobile}>
                    <SelectTrigger className="h-8 w-full text-xs" aria-label="Trier les emails">
                      <SelectValue placeholder="Trier par…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="serveur">Ordre du serveur (défaut)</SelectItem>
                      <SelectItem value="date">Date (plus récentes d'abord)</SelectItem>
                      <SelectItem value="destinataire">Destinataire (A→Z)</SelectItem>
                      <SelectItem value="motif">Motif (A→Z)</SelectItem>
                      <SelectItem value="statut">Statut (échecs d'abord)</SelectItem>
                      <SelectItem value="tentatives">Tentatives (décroissant)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* ── Mobile : cartes ─────────────────────────── */}
                <ul
                  key={cleCorps}
                  className="flex animate-in flex-col gap-3 px-4 pb-2 duration-200 motion-reduce:animate-none md:hidden"
                >
                  {emailsAffiches.map((email) => (
                    <li key={email.id}>
                      <CarteEmailMobile email={email} onDetail={setDetail} />
                    </li>
                  ))}
                </ul>

                {/* ── Desktop : table ─────────────────────────── */}
                <section aria-label="Emails transactionnels" className="hidden overflow-x-auto scrollbar-thin md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "date")} tri={tri} onTri={basculerTri} />
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "destinataire")} tri={tri} onTri={basculerTri} />
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "motif")} tri={tri} onTri={basculerTri} />
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "statut")} tri={tri} onTri={basculerTri} />
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "tentatives")} tri={tri} onTri={basculerTri} aligneDroite />
                        <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    {/* key = fondu léger à chaque changement de tri / filtres */}
                    <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                      {emailsAffiches.map((email) => (
                        <LigneEmail key={email.id} email={email} onDetail={setDetail} />
                      ))}
                    </TableBody>
                  </Table>
                </section>

                {/* Compteur honnête quand le filtre client s'applique. */}
                {filtresActifs && !isLoading && (
                  <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
                    {emailsAffiches.length} email{emailsAffiches.length > 1 ? "s" : ""} affiché{emailsAffiches.length > 1 ? "s" : ""} sur {emails.length} (page courante)
                  </div>
                )}

                {/* ─── Pagination heuristique ─── */}
                <div className="border-t border-border px-4 py-3">
                  <PaginationListe page={pageEmails} pagePleine={pagePleine} onPageChange={changerPage} />
                </div>
              </>
            )}
          </TransitionEtat>
        </Bloc>
      </SectionCardAdmin>

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
                <Link
                  to={`/admin/utilisateurs/${detail.subscriber_id}`}
                  className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                >
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

export default ListeEmailsTx