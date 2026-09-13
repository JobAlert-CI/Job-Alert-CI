import { memo, useCallback, useMemo, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { ErrorBoundary } from "react-error-boundary"
import {
  ScrollText, RotateCcw, Eye, UserX, RefreshCw, CalendarDays, Copy, Check,
  ChevronDown, ChevronRight,
} from "lucide-react"
import { cn } from "cn"
import { useFiltresJournalAdmin, FiltresJournalAdminProvider } from "@/contexts/FiltresJournalAdmin.context"
import { useJournalAuditQuery, useAdminsAuteurs } from "@/features/admin-journal.tools"
import { useNotify } from "@/contexts/Notify.context"
import { fmtDay } from "@/lib/dates"
import { FilterPopover, MiniCalendar } from "@/components/shared"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import EnteteTriable from "@/components/admin/EnteteTriable"
import HeroAdmin from "@/components/admin/HeroAdmin"
import BtnAction from "@/components/admin/BtnAction"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { SectionErreur, SectionVide, SectionAucunResultat } from "./components/EtatsSection"
import CompteursJournal from "./sections/CompteursJournal"
import ChartsJournal from "./sections/ChartsJournal"
import PaginationListe from "@/components/admin/PaginationListe"

/* ─────────────────────────────────────────────────────────────────────
   Page Journal d'activité — /admin/journal (super_admin, doc v3 §16).
   Refonte complète :
   • FILTRES FIABILISÉS : setters du contexte à un seul setScalar +
     filtrage CLIENT DE GARANTIE sur la page chargée, en plus des
     paramètres serveur (paramsApi inchangé) — les filtres fonctionnent
     quoi que fasse le backend.
   • Compteurs cliquables → filtre instantané via contexte (aucune
     navigation, aucun tressautement d'URL).
   • Table : tri par en-tête (EnteteTriable), EN-TÊTE COLLANT dans un
     défilement interne, skeleton fidèle aux colonnes réelles, vue
     mobile en cartes empilées (+ tri dédié mobile).
   • Dialog détail : ARBORESCENCE JSON repliable + bouton « Copier ».
   • Retour en haut du tableau au changement de page (scroll doux,
     coupé en prefers-reduced-motion).
   Cas particuliers conservés :
   - auteur admin_id NULL → « Admin supprimé » (FK SET NULL cycle 15) ;
   - action=connexion : journalisée depuis le cycle 16 seulement.
   ───────────────────────────────────────────────────────────────────── */

const ACTIONS = [
  { valeur: "creation", libelle: "Création" },
  { valeur: "modification", libelle: "Modification" },
  { valeur: "suppression", libelle: "Suppression" },
  { valeur: "envoi", libelle: "Envoi" },
  { valeur: "connexion", libelle: "Connexion (depuis cycles récents)" },
  { valeur: "deconnexion", libelle: "Déconnexion (depuis l'audit 4)" },
  { valeur: "scraping", libelle: "Scraping" },
]

const VARIANTE_ACTION = {
  creation: "secondary",
  modification: "secondary",
  suppression: "destructive",
  envoi: "outline",
  connexion: "outline",
  deconnexion: "outline",
  scraping: "outline",
}

/* Libellés courts des badges (sans la parenthèse de contexte). */
const LIBELLE_COURT_ACTION = Object.fromEntries(
  ACTIONS.map((a) => [a.valeur, a.libelle.split(" (")[0]])
)

const dateHeure = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
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

/* Date → « AAAA-MM-JJ » local (symétrique du parse en T00:00:00). */
const isoJour = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/* Déclencheur de filtre : surbrillance (fond secondary + texte navy +
   bordure) dès qu'une valeur autre que le défaut est sélectionnée. */
const classeDeclencheur = (actif, largeur) =>
  cn(
    "h-8 text-xs transition-colors",
    largeur,
    actif
      ? "border-brand-navy/30 bg-secondary font-semibold text-secondary-foreground"
      : "text-muted-foreground"
  )

/* ─── Auteur (desktop + mobile) : null avec admin_id = supprimé ─── */
const CelluleAuteur = ({ entree, auteurResolu }) =>
  entree.admin_id && !auteurResolu ? (
    <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Compte supprimé — entrées préservées (cycle 15)">
      <UserX className="size-3.5" aria-hidden /> Admin supprimé
    </span>
  ) : (
    <span className="text-xs font-medium">
      {auteurResolu?.full_name ?? "—"}
      {auteurResolu && (
        <span className="block truncate text-[10px] text-muted-foreground">{auteurResolu.email}</span>
      )}
    </span>
  )

/* ─── Skeleton fidèle : mêmes colonnes que la table réelle (zéro
   layout shift à l'arrivée des données) ─── */
const LigneSkeleton = () => (
  <TableRow className="hover:bg-transparent">
    <TableCell><Skeleton className="h-3.5 w-28" /></TableCell>
    <TableCell>
      <div className="flex flex-col gap-1.5 py-0.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-2.5 w-44" />
      </div>
    </TableCell>
    <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
    <TableCell><Skeleton className="h-3 w-24" /></TableCell>
    <TableCell className="hidden lg:table-cell"><Skeleton className="h-3 w-40" /></TableCell>
    <TableCell>
      <div className="flex justify-end"><Skeleton className="size-7 rounded-md" /></div>
    </TableCell>
  </TableRow>
)

const CarteSkeletonMobile = () => (
  <div className="flex flex-col gap-2.5 p-4">
    <div className="flex items-center justify-between gap-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-5 w-20 rounded-full" />
    </div>
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-3.5 w-32" />
      <Skeleton className="h-2.5 w-44" />
    </div>
    <Skeleton className="h-2.5 w-52" />
  </div>
)

/* ─── Ligne mémoïsée (desktop) ─── */
const LigneJournal = memo(function LigneJournal({ entree, auteurResolu, onDetail }) {
  return (
    <TableRow className="transition-colors hover:bg-muted/50">
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
        {dateHeure(entree.created_at)}
      </TableCell>
      <TableCell>
        <CelluleAuteur entree={entree} auteurResolu={auteurResolu} />
      </TableCell>
      <TableCell>
        <Badge variant={VARIANTE_ACTION[entree.action] ?? "outline"}>
          {LIBELLE_COURT_ACTION[entree.action] ?? entree.action}
        </Badge>
      </TableCell>
      <TableCell className="font-mono text-[10px] text-muted-foreground">
        {entree.target_table}
      </TableCell>
      <TableCell
        className="hidden max-w-44 truncate font-mono text-[10px] text-muted-foreground lg:table-cell"
        title={entree.target_id ?? ""}
      >
        {entree.target_id ?? "—"}
      </TableCell>
      <TableCell>
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDetail(entree)}
            aria-label={`Détails de l'action ${entree.action}`}
            disabled={!entree.details && !entree.target_id}
          >
            <Eye className="size-3.5" aria-hidden />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
})

/* ─── Carte mobile : lecture verticale, sans défilement horizontal ─── */
const CarteJournalMobile = memo(function CarteJournalMobile({ entree, auteurResolu, onDetail }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {dateHeure(entree.created_at)}
        </span>
        <Badge variant={VARIANTE_ACTION[entree.action] ?? "outline"}>
          {LIBELLE_COURT_ACTION[entree.action] ?? entree.action}
        </Badge>
      </div>
      <CelluleAuteur entree={entree} auteurResolu={auteurResolu} />
      <p className="truncate font-mono text-[10px] text-muted-foreground" title={entree.target_id ?? ""}>
        {entree.target_table}{entree.target_id ? ` · ${entree.target_id}` : ""}
      </p>
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => onDetail(entree)}
          disabled={!entree.details && !entree.target_id}
        >
          <Eye className="size-3.5" aria-hidden /> Détails
        </Button>
      </div>
    </div>
  )
})

/* ─── Arborescence JSON du détail : objets/tableaux repliables,
   valeurs typées mises en forme — les payloads imbriqués restent
   lisibles, sans « break-all » monolithique. ─── */
const formaterValeurJson = (valeur) => {
  if (valeur === null) return "null"
  if (valeur === undefined) return "undefined"
  if (typeof valeur === "string") return valeur
  return String(valeur)
}

const classeValeurJson = (valeur) => {
  if (valeur === null || valeur === undefined) return "italic text-muted-foreground"
  if (typeof valeur === "boolean") return "font-semibold text-primary"
  if (typeof valeur === "number") return "tabular-nums text-primary"
  return ""
}

const NoeudJson = ({ cle, valeur, profondeur }) => {
  const estConteneur = valeur !== null && typeof valeur === "object"
  /* Premier niveau ouvert d'office, les niveaux imbriqués repliés. */
  const [ouvert, setOuvert] = useState(profondeur < 1)

  if (!estConteneur) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-2 py-0.5 pl-5">
        {cle !== null && <span className="text-xs font-medium text-muted-foreground">{cle} :</span>}
        <span className={cn("font-mono text-[11px] break-all", classeValeurJson(valeur))}>
          {formaterValeurJson(valeur)}
        </span>
      </div>
    )
  }

  const entreesObjet = Object.entries(valeur)
  return (
    <div className="py-0.5">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex items-center gap-1 rounded-sm py-0.5 pl-1 text-left transition-colors hover:text-foreground"
      >
        {ouvert ? <ChevronDown className="size-3 shrink-0" aria-hidden /> : <ChevronRight className="size-3 shrink-0" aria-hidden />}
        {cle !== null && <span className="text-xs font-medium text-muted-foreground">{cle} :</span>}
        <span className="text-[10px] text-muted-foreground">
          {Array.isArray(valeur)
            ? `${entreesObjet.length} élément${entreesObjet.length > 1 ? "s" : ""}`
            : `${entreesObjet.length} clé${entreesObjet.length > 1 ? "s" : ""}`}
        </span>
      </button>
      {ouvert && (
        <div className="ml-2 border-l border-border pl-1">
          {entreesObjet.map(([k, v]) => (
            <NoeudJson key={k} cle={k} valeur={v} profondeur={profondeur + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Dialog : détail d'une entrée (arborescence JSON + copie) ────── */
const DialogDetails = ({ entree, onFermer }) => {
  const notify = useNotify()
  const [copie, setCopie] = useState(false)

  const copierJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entree.details ?? {}, null, 2))
      setCopie(true)
      notify("JSON copié dans le presse-papiers", "success")
      setTimeout(() => setCopie(false), 2000)
    } catch {
      notify("Copie impossible — sélectionnez le texte manuellement", "warning")
    }
  }

  const details = entree.details ?? {}
  const aDesDetails = Object.keys(details).length > 0

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {LIBELLE_COURT_ACTION[entree.action] ?? entree.action} — {entree.target_table}
          </DialogTitle>
          <DialogDescription>
            {dateHeure(entree.created_at)}
            {entree.target_id && (
              <> · cible <code className="font-mono text-[10px]">{entree.target_id}</code></>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {entree.admin_id ? (
            <p className="text-xs text-muted-foreground">
              Auteur : <code className="font-mono text-[10px]">{entree.admin_id}</code>
            </p>
          ) : (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <UserX className="size-3.5" aria-hidden /> Auteur : compte supprimé (entrées préservées)
            </p>
          )}
          {aDesDetails ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold">Détails (payload JSON)</p>
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={copierJson}>
                  {copie ? (
                    <Check className="size-3.5 text-emerald-600" aria-hidden />
                  ) : (
                    <Copy className="size-3.5" aria-hidden />
                  )}
                  {copie ? "Copié" : "Copier le JSON"}
                </Button>
              </div>
              <div className="max-h-72 overflow-auto rounded-lg border border-border bg-muted/30 p-2 scrollbar-thin">
                {Object.entries(details).map(([cle, valeur]) => (
                  <NoeudJson key={cle} cle={cle} valeur={valeur} profondeur={0} />
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Aucun détail supplémentaire pour cette action.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

const JournalAdmin = () => {
  const {
    action, admin, table, debut, fin, page, pageTaille, paramsApi,
    setAction, setAdmin, setTable, setDebut, setFin, setPage, reinitialiser,
  } = useFiltresJournalAdmin()
  const { data: pageJournal, isLoading, isError, refetch } = useJournalAuditQuery(paramsApi)
  const { data: admins } = useAdminsAuteurs()
  const mouvementReduit = useReducedMotion()
  const [detail, setDetail] = useState(null)
  const [calendrierOuvert, setCalendrierOuvert] = useState(false)
  /* Tri INITIALISÉ : « Date » descendante (le plus récent d'abord). */
  const [tri, setTri] = useState({ cle: "date", direction: "desc" })
  /* Ancrage du retour en haut du tableau au changement de page. */
  const refTableau = useRef(null)

  /* Résolution locale des auteurs : admin_id → nom (zéro appel dédié). */
  const auteursParId = useMemo(() => {
    const m = new Map()
    for (const a of admins ?? []) m.set(a.id, a)
    return m
  }, [admins])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entrees = pageJournal?.items ?? []
  const total = pageJournal?.total ?? 0
  const filtresActifs = !!(action || admin || table || debut || fin)

  /* Tables cibles distinctes + compteurs d'options (page chargée) —
     affichés dans les listes déroulantes des filtres. */
  const { tablesDistintes, compteursFiltres } = useMemo(() => {
    const tables = new Set()
    const parAction = {}
    const parAuteur = {}
    const parTable = {}
    for (const e of entrees) {
      if (e.target_table) {
        tables.add(e.target_table)
        parTable[e.target_table] = (parTable[e.target_table] ?? 0) + 1
      }
      parAction[e.action] = (parAction[e.action] ?? 0) + 1
      if (e.admin_id) parAuteur[e.admin_id] = (parAuteur[e.admin_id] ?? 0) + 1
    }
    return { tablesDistintes: [...tables].sort(), compteursFiltres: { parAction, parAuteur, parTable } }
  }, [entrees])

  /* ─── Filtrage CLIENT DE GARANTIE ─────────────────────────────────
     paramsApi est aussi envoyé au serveur : s'il filtre, cette passe
     est neutre ; s'il ne filtre pas, les filtres restent effectifs
     sur la page chargée. Bornes inclusives : début 00:00 → fin 23:59. */
  const entreesFiltrees = useMemo(() => {
    if (!filtresActifs) return entrees
    const tDebut = debut ? new Date(`${debut}T00:00:00`).getTime() : null
    const tFin = fin ? new Date(`${fin}T23:59:59.999`).getTime() : null
    return entrees.filter((e) => {
      if (action && e.action !== action) return false
      if (admin && e.admin_id !== admin) return false
      if (table && e.target_table !== table) return false
      if (tDebut !== null || tFin !== null) {
        const t = e.created_at ? new Date(e.created_at).getTime() : null
        if (t === null) return false
        if (tDebut !== null && t < tDebut) return false
        if (tFin !== null && t > tFin) return false
      }
      return true
    })
  }, [entrees, filtresActifs, action, admin, table, debut, fin])

  /* ─── Colonnes triables (format EnteteTriable v2) ─────────────────
     « Identifiant cible » (UUID, colonne masquée) est exclu. Le tri
     porte sur les entrées affichées (page courante filtrée). ──────── */
  const COLONNES = useMemo(() => [
    { cle: "date", libelle: "Date", directionInitiale: "desc", triValeur: (e) => e.created_at ?? null },
    {
      cle: "auteur", libelle: "Auteur", directionInitiale: "asc",
      triValeur: (e) => (e.admin_id ? auteursParId.get(e.admin_id)?.full_name ?? "" : null),
    },
    { cle: "action", libelle: "Action", directionInitiale: "asc", triValeur: (e) => e.action ?? "" },
    { cle: "cible", libelle: "Cible", directionInitiale: "asc", triValeur: (e) => e.target_table ?? "" },
  ], [auteursParId])

  const entreesAffichees = useMemo(() => {
    if (!tri) return entreesFiltrees
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return entreesFiltrees
    const copie = [...entreesFiltrees].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [entreesFiltrees, tri, COLONNES])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  /* Tri dédié mobile (les en-têtes triables ne sont visibles qu'en md+). */
  const optionsTriMobile = useMemo(() => {
    const options = [{ valeur: "aucun", libelle: "Ordre naturel" }]
    for (const c of COLONNES) {
      options.push({ valeur: `${c.cle}:desc`, libelle: `${c.libelle} — décroissant` })
      options.push({ valeur: `${c.cle}:asc`, libelle: `${c.libelle} — croissant` })
    }
    return options
  }, [COLONNES])

  const changerTriMobile = (valeur) => {
    if (valeur === "aucun") {
      setTri(null)
      return
    }
    const [cle, direction] = valeur.split(":")
    setTri({ cle, direction })
  }

  /* ─── Période : URL « AAAA-MM-JJ » ↔ MiniCalendar (Date) ────────────
     Parse en T00:00:00 local pour éviter tout décalage de jour. */
  const plageDates = useMemo(() => ({
    start: debut ? new Date(`${debut}T00:00:00`) : null,
    end: fin ? new Date(`${fin}T00:00:00`) : null,
  }), [debut, fin])

  const changerPlage = (r) => {
    setDebut(r?.start ? isoJour(r.start) : "")
    setFin(r?.end ? isoJour(r.end) : "")
  }

  const libellePeriode = debut && fin
    ? `Du ${fmtDay(plageDates.start)} au ${fmtDay(plageDates.end)}`
    : debut
      ? `Depuis le ${fmtDay(plageDates.start)}`
      : "Période"

  const ouvrirDetail = useCallback((entree) => setDetail(entree), [])

  /* Changement de page → retour en haut du tableau (scroll doux,
     remplacé par un saut instantané en prefers-reduced-motion). */
  const changerPage = (nouvellePage) => {
    setPage(nouvellePage)
    refTableau.current?.scrollIntoView({
      behavior: mouvementReduit ? "auto" : "smooth",
      block: "start",
    })
  }

  /* key = fondu léger du corps à chaque changement de page / filtres / tri. */
  const cleCorps = `${page}-${action}-${admin}-${table}-${debut}-${fin}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* ─── En-tête ─── */}
      <HeroAdmin
        title="Journal d'activité"
        description="Verifiez qui a fait quoi dans le back-office. Chaque mutation est journalisée."
        icon={ScrollText}
        titleBdge="Contenu & sécurité"
      >
        <BtnAction size="xs" variant="primary" onClick={refetch}>
          <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          Rafraîchir
        </BtnAction>
      </HeroAdmin>

      {/* ─── Compteurs G-E-F-C-B (clic = filtre instantané) ─── */}
      <Bloc>
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <CompteursJournal />
        </ErrorBoundary>
      </Bloc>

      {/* ─── Charts H-I ─── */}
      <Bloc>
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <ChartsJournal />
        </ErrorBoundary>
      </Bloc>

      {/* ─── Table + filtres + pagination ───
         div ancrage : le changement de page y ramène le haut de la
         carte (scroll-mt-20 = marge sous un éventuel header sticky). */}
      <div ref={refTableau} className="scroll-mt-20">
        <SectionCardAdmin
          title="Journal d'activité"
          description="Chronologie des actions du back-office — filtrez, triez, consultez le détail JSON."
          icon={ScrollText}
          contentClassName="p-0 sm:p-0"
        >
          {/* ─── Barre de filtres : surbrillance + compteurs d'options ─── */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            {/* Sentinelle « toutes/tous » : Radix refuse la valeur vide. */}
            <Select value={action || "toutes"} onValueChange={(v) => setAction(v === "toutes" ? "" : v)}>
              <SelectTrigger className={classeDeclencheur(!!action, "w-52")} aria-label="Filtrer par action">
                <SelectValue placeholder="Filtrer par action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes les actions</SelectItem>
                {ACTIONS.map((a) => (
                  <SelectItem key={a.valeur} value={a.valeur}>
                    <span className="flex items-center justify-between gap-3">
                      {a.libelle}
                      <span className="tabular-nums text-muted-foreground">({compteursFiltres.parAction[a.valeur] ?? 0})</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={admin || "tous"} onValueChange={(v) => setAdmin(v === "tous" ? "" : v)}>
              <SelectTrigger className={classeDeclencheur(!!admin, "w-52")} aria-label="Filtrer par auteur">
                <SelectValue placeholder="Filtrer par auteur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les auteurs</SelectItem>
                {(admins ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="flex items-center justify-between gap-3">
                      {a.full_name}
                      <span className="tabular-nums text-muted-foreground">({compteursFiltres.parAuteur[a.id] ?? 0})</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={table || "toutes"} onValueChange={(v) => setTable(v === "toutes" ? "" : v)}>
              <SelectTrigger className={classeDeclencheur(!!table, "w-48")} aria-label="Filtrer par table cible">
                <SelectValue placeholder="Filtrer par table" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes les tables</SelectItem>
                {tablesDistintes.map((t) => (
                  <SelectItem key={t} value={t}>
                    <span className="flex items-center justify-between gap-3">
                      {t}
                      <span className="tabular-nums text-muted-foreground">({compteursFiltres.parTable[t] ?? 0})</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Période : déclencheur → panneau MiniCalendar (presets inclus). */}
            <FilterPopover
              open={calendrierOuvert}
              onToggle={() => setCalendrierOuvert((o) => !o)}
              onClose={() => setCalendrierOuvert(false)}
              label={libellePeriode}
              icon={CalendarDays}
              align="right"
              panelClassName="w-[19.5rem] p-3"
            >
              <MiniCalendar range={plageDates} onChange={changerPlage} />
            </FilterPopover>
            {/* Tri — mobile uniquement (desktop : en-têtes de colonnes). */}
            <div className="md:hidden">
              <Select value={tri ? `${tri.cle}:${tri.direction}` : "aucun"} onValueChange={changerTriMobile}>
                <SelectTrigger className={classeDeclencheur(!!tri, "w-52")} aria-label="Trier les entrées">
                  <SelectValue placeholder="Trier" />
                </SelectTrigger>
                <SelectContent>
                  {optionsTriMobile.map((o) => (
                    <SelectItem key={o.valeur} value={o.valeur}>{o.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filtresActifs && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={reinitialiser}>
                <RotateCcw aria-hidden /> Réinitialiser
              </Button>
            )}
          </div>

          {/* ─── Corps : mobile = cartes, desktop = table triable ─── */}
          {isError ? (
            <div className="p-4">
              <SectionErreur onRetry={refetch} message="Impossible de charger le journal." />
            </div>
          ) : !entrees.length && !isLoading ? (
            <div className="p-4">
              {filtresActifs ? (
                <SectionAucunResultat onReset={reinitialiser} message="Aucune action ne correspond aux filtres." />
              ) : (
                <SectionVide message="Aucune action journalisée pour l'instant." />
              )}
            </div>
          ) : (
            <>
              {/* Vue mobile : cartes empilées, sans défilement horizontal. */}
              <div key={`mobile-${cleCorps}`} className="animate-in fade-in duration-200 motion-reduce:animate-none md:hidden">
                {isLoading ? (
                  <div className="divide-y divide-border" aria-busy="true">
                    {[...Array(4)].map((_, i) => <CarteSkeletonMobile key={i} />)}
                  </div>
                ) : !entreesAffichees.length ? (
                  <div className="p-4">
                    <SectionAucunResultat onReset={reinitialiser} message="Aucune entrée ne correspond aux filtres sur cette page." />
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {entreesAffichees.map((entree) => (
                      <CarteJournalMobile
                        key={entree.id}
                        entree={entree}
                        auteurResolu={entree.admin_id ? auteursParId.get(entree.admin_id) : null}
                        onDetail={ouvrirDetail}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Vue desktop : table triable — EN-TÊTE COLLANT dans un
                  défilement interne (bg-card : la table vit dans la carte). */}
              <div key={`table-${cleCorps}`} className="hidden animate-in fade-in duration-200 motion-reduce:animate-none md:block">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
                    <TableRow className="hover:bg-transparent">
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "date")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "auteur")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "action")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "cible")} tri={tri} onTri={basculerTri} />
                      <TableHead className="hidden lg:table-cell">Identifiant cible</TableHead>
                      <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      [...Array(6)].map((_, i) => <LigneSkeleton key={i} />)
                    ) : !entreesAffichees.length ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6}>
                          <SectionAucunResultat onReset={reinitialiser} message="Aucune entrée ne correspond aux filtres sur cette page." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      entreesAffichees.map((entree) => (
                        <LigneJournal
                          key={entree.id}
                          entree={entree}
                          auteurResolu={entree.admin_id ? auteursParId.get(entree.admin_id) : null}
                          onDetail={ouvrirDetail}
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* ─── Pagination servie (total exact) ─── */}
          {!isLoading && total > 0 && (
            <div className="p-4 border-t">
              <PaginationListe page={page} pagePleine={pageTaille} onPageChange={changerPage} />
            </div>
          )}
        </SectionCardAdmin>
      </div>

      {/* ─── Dialog détails ─── */}
      {detail && (
        <DialogDetails entree={detail} onFermer={() => setDetail(null)} />
      )}
    </motion.div>
  )
}

const PageJournal = () => (
  <FiltresJournalAdminProvider>
    <JournalAdmin />
  </FiltresJournalAdminProvider>
)

export default PageJournal