import { useCallback, useMemo, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import { ScrollText, RotateCcw, CalendarDays } from "lucide-react"
import { cn } from "cn"
import { useFiltresJournalAdmin } from "@/contexts/FiltresJournalAdmin.context"
import { useJournalAuditQuery, useAdminsAuteurs } from "@/features/admin-journal.tools"
import { fmtDay } from "@/lib/dates"
import { FilterPopover, MiniCalendar } from "@/components/shared"
import EnteteTriable from "@/components/admin/EnteteTriable"
import BtnAction from "@/components/admin/BtnAction"
import Bloc from "@/components/admin/Bloc"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import { SectionErreur, SectionVide, SectionAucunResultat, TransitionEtat } from "@/components/admin/EtatsSection"
import PaginationListe from "@/components/admin/PaginationListe"
import { ACTIONS } from "../components/CONSTANTES"
import { CarteJournalMobile, CarteSkeletonMobile } from "../components/CarteJournalMobile"
import { LigneJournal, LigneSkeleton } from "../components/LigneJournal"
import DialogDetailsJournal from "@/components/dialog/DialogDetailsJournal"


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



const ListeJournal = () => {
  const {
    action, admin, table, debut, fin, page, pageTaille, paramsApi,
    setAction, setAdmin, setTable, setDebut, setFin, setPage, reinitialiser,
  } = useFiltresJournalAdmin()
  const { data: pageJournal, isLoading: journalLoading, isError: journalError, refetch: refetchJournal } = useJournalAuditQuery(paramsApi)
  const { data: admins, isLoading: adminsLoading, isError: adminsError, refetch: refetchAdmins } = useAdminsAuteurs()
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

  const pageSuivantePossible = entreesAffichees?.length === pageTaille

  /* key = fondu léger du corps à chaque changement de page / filtres / tri. */
  const cleCorps = `${page}-${action}-${admin}-${table}-${debut}-${fin}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  const refetch = useCallback(() => {
    refetchJournal()
    refetchAdmins()
  }, [refetchJournal, refetchAdmins])

  const isLoading = journalLoading || adminsLoading
  const isError = journalError || adminsError

  const etat = isError ? "erreur" : isLoading ? "chargement" : !entreesAffichees.length ? "vide" : "donnees"

  return (
    <>
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
              <BtnAction variant="outline" size="xs" className="text-xs" onClick={reinitialiser}>
                <RotateCcw aria-hidden /> Réinitialiser
              </BtnAction>
            )}
          </div>

          {/* ─── Corps : mobile = cartes, desktop = table triable ─── */}
          <Bloc>
            <TransitionEtat etat={etat} className="animate-in fade-in duration-200 motion-reduce:animate-none" >
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
            </TransitionEtat>
          </Bloc>

          {/* ─── Pagination servie (total exact) ─── */}
          {!isLoading && total > 0 && (
            <div className="p-4 border-t">
              <PaginationListe page={page} pagePleine={pageSuivantePossible} onPageChange={changerPage} />
            </div>
          )}
        </SectionCardAdmin>
      </div>

      {/* ─── Dialog détails ─── */}
      {detail && (
        <DialogDetailsJournal entree={detail} onFermer={() => setDetail(null)} />
      )}
    </>
  )
}

export default ListeJournal