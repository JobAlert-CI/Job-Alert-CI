import { memo, useMemo, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Link } from "react-router-dom"
import { AlertCircle, AlertTriangle, CalendarDays, CalendarX, Eye, History, Inbox, ListOrdered, RotateCcw, Search, User } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts"
import { cn } from "cn"
import { dateHeure } from "@/lib/dates"
import { useRechercheDebouncee } from "@/hooks/use-recherche-debouncee"
import { useFiltresLogsAdmin } from "@/contexts/FiltresLogsAdmin.context"
import {
  MOTIFS_EMAIL, VARIANTE_STATUT_EMAIL, libelleMotif, libelleStatutEmail,
  useEmailsTxQuery, useEmailsTxStatsQuery,
} from "@/features/admin-logs.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import CarteCompteur from "@/components/admin/CarteCompteur"
import PaginationListe from "@/components/admin/PaginationListe"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import CadreChart, { TooltipChart } from "../components/CadreChart"
import { SectionErreur, SectionVide, SectionAucunResultat } from "../components/EtatsSection"
import { VARIANTS_PAGE } from "@/components/admin/Bloc"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Emails transactionnels (cycle 17, doc v3 §17.3).
   Refonte :
   • FILTRES CORRIGÉS : selects shadcn avec sentinelle « tous » +
     filtrage client de GARANTIE (motif, statut, destinataire) en plus
     des paramètres serveur ; recherche debouncée conservée.
   • Tri par en-tête initialisé (« Date » desc ; statut desc = échecs
     en tête, utile opérationnellement).
   • Retour en haut du tableau au changement de page, skeleton fidèle
     (limite de page), transition framer-motion uniforme, animations
     des charts conditionnées par prefers-reduced-motion.
   Sécurité : request/response payloads JAMAIS exposés — le dialog ne
   montre que les métadonnées.
   ───────────────────────────────────────────────────────────────────── */
const COULEURS_STATUT = { sent: "#0F2D4D", failed: "#ef4444", queued: "#F5A623" }
const COULEUR_MOTIF = "#0F2D4D"
const STATUTS_EMAIL = ["failed", "queued", "sent"]

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

/* ─── Ligne mémoïsée ─── */
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

/* ─── Skeleton fidèle aux colonnes réelles ─── */
const LigneSkeletonEmail = () => (
  <TableRow className="hover:bg-transparent">
    <TableCell><Skeleton className="h-3.5 w-24" /></TableCell>
    <TableCell>
      <div className="flex flex-col gap-1.5 py-0.5">
        <Skeleton className="h-3.5 w-44" />
        <Skeleton className="h-2.5 w-24" />
      </div>
    </TableCell>
    <TableCell><Skeleton className="h-3.5 w-28" /></TableCell>
    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
    <TableCell className="hidden lg:table-cell"><Skeleton className="ml-auto h-3.5 w-8" /></TableCell>
    <TableCell><div className="flex justify-end"><Skeleton className="size-7 rounded-md" /></div></TableCell>
  </TableRow>
)

const OngletEmailsTx = () => {
  const mouvementReduit = useReducedMotion()
  const {
    motif, statutEmail, recherche, pageEmails, paramsEmails,
    setMotif, setStatutEmail, setPageEmails, reinitialiserEmails, setScalar,
  } = useFiltresLogsAdmin()
  // Stats 30 j (M1-M3, M5, M6) + stats 1 j (M4 badge « aujourd'hui »).
  const { data: stats, isLoading: statsCharge } = useEmailsTxStatsQuery(30)
  const { data: statsJour } = useEmailsTxStatsQuery(1)
  const { data: emails, isLoading, isError, refetch } = useEmailsTxQuery(paramsEmails)
  const [detail, setDetail] = useState(null)

  /* Tri INITIALISÉ : « Date » descendante (le plus récent d'abord). */
  const [tri, setTri] = useState({ cle: "date", direction: "desc" })
  /* Ancrage du retour en haut du tableau au changement de page. */
  const refTableau = useRef(null)

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

  /* Filtrage CLIENT DE GARANTIE sur la page chargée, en plus des
     paramètres serveur — les filtres fonctionnent quoi que fasse le
     backend. Recherche : `includes` sur le terme brut (le serveur fait
     l'ilike avec les %). */
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

  const ouvrirDetail = (email) => setDetail(email)

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

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* ─── Compteurs M1-M3 + badge M4 ─── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CarteCompteur label="Total (historique)" valeur={stats?.total ?? 0} icone={History} />
        <CarteCompteur
          label="Échecs"
          valeur={stats?.par_statut?.failed ?? 0}
          icone={AlertCircle}
          href="/admin/logs"
          query="?onglet=emails&statut=failed"
        />
        <CarteCompteur
          label="En file"
          valeur={stats?.par_statut?.queued ?? 0}
          icone={ListOrdered}
          href="/admin/logs"
          query="?onglet=emails&statut=queued"
        />
        <CarteCompteur
          label="Échecs aujourd'hui"
          valeur={echecsJour}
          icone={CalendarX}
          texte={echecsJour > 0 ? `${echecsJour} échec${echecsJour > 1 ? "s" : ""} aujourd'hui` : undefined}
        />
      </div>

      {/* Alerte opérationnelle doc v3 §17.3 : taux d'échec = signal Resend. */}
      {echecsJour > 0 && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-brand-orange px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          {echecsJour} échec{echecsJour > 1 ? "s" : ""} aujourd'hui — un taux élevé peut indiquer un problème
          côté fournisseur d'email (Resend) plutôt qu'un problème d'inscription.
        </p>
      )}

      {/* ─── Charts M5-M6 (animations conditionnées reduced-motion) ─── */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SectionCardAdmin
            title="Envois par jour (30 j)"
            description="Comparaison des envois par jour sur les derniers 30 jours."
            icon={CalendarDays}
          >
            <CadreChart chargement={statsCharge} vide={!parJour.length} videMessage="Aucun envoi dans la fenêtre.">
              <BarChart data={parJour} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="jour" fontSize={10} tickLine={false} />
                <YAxis allowDecimals={false} fontSize={10} tickLine={false} />
                <Tooltip content={<TooltipChart />} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Envoyés" stackId="s" fill={COULEURS_STATUT.sent} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" />
                <Bar dataKey="Échecs" stackId="s" fill={COULEURS_STATUT.failed} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" />
                <Bar dataKey="En file" stackId="s" fill={COULEURS_STATUT.queued} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" radius={[4, 4, 0, 0]} />
              </BarChart>
            </CadreChart>
          </SectionCardAdmin>
        </div>

        <SectionCardAdmin
          title="Envois par statut (historique)"
          description="Comparaison des envois par statut sur la totalité des envois."
          icon={ListOrdered}
        >
          <CadreChart chargement={statsCharge} vide={!parMotif.length} videMessage="Aucun email transactionnel envoyé." minHeight={240}>
            <BarChart data={parMotif} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: -50 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
              <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} />
              <YAxis type="category" dataKey="motif" width={120} fontSize={10} tickLine={false} />
              <Tooltip content={<TooltipChart />} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
              <Bar dataKey="total" name="Envois" fill={COULEUR_MOTIF} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" radius={[0, 4, 4, 0]} />
            </BarChart>
          </CadreChart>
        </SectionCardAdmin>
      </div>

      {/* ─── Table des emails ─── */}
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

          {/* ─── Corps : table triable, skeleton fidèle ─── */}
          {isError ? (
            <div className="p-4">
              <SectionErreur onRetry={refetch} message="Impossible de charger les emails transactionnels." />
            </div>
          ) : !emails?.length && !isLoading ? (
            <div className="p-4">
              {filtresActifs ? (
                <SectionAucunResultat onReset={reinitialiserEmails} message="Aucun email ne correspond aux critères." />
              ) : (
                <SectionVide message="Aucun email transactionnel pour l'instant." />
              )}
            </div>
          ) : (
            <>
              <section aria-label="Emails transactionnels" className="overflow-x-auto scrollbar-thin">
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
                  <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                    {isLoading ? (
                      [...Array(paramsEmails.limit)].map((_, i) => <LigneSkeletonEmail key={i} />)
                    ) : !emailsAffiches.length ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6}>
                          <SectionAucunResultat onReset={reinitialiserEmails} message="Aucun email ne correspond aux critères sur cette page." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      emailsAffiches.map((email) => (
                        <LigneEmail key={email.id} email={email} onDetail={ouvrirDetail} />
                      ))
                    )}
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
        </SectionCardAdmin>
      </div>

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
    </motion.div>
  )
}

export default OngletEmailsTx