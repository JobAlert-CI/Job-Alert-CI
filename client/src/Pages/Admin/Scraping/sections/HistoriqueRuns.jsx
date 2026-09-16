import { useMemo, useState, memo } from "react"
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom"
import { ChevronRight, History, Loader2 } from "lucide-react"
import { useAdminScrapingRunsQuery, aUnRunActif } from "@/features/admin-scraping.tools"
import { Badge } from "@/components/ui/badge"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import PaginationListe from "@/components/admin/PaginationListe"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import {
  LIBELLE_STATUT_RUN, VARIANTE_STATUT_RUN, statutRunActif, dureeLisible, dateHeure,
} from "../components/statuts-scraping"
import { SectionErreur, SectionVide, SectionAucunResultat, TransitionEtat } from "@/components/admin/EtatsSection";

const TAILLE_PAGE = 20

const formatNombre = (v) => (v ?? 0).toLocaleString("fr-FR")

const dureeMsValeur = (run) => {
  if (!run.started_at || !run.finished_at) return null
  return new Date(run.finished_at) - new Date(run.started_at)
}

const comparerValeurs = (a, b) => {
  const videA = a === null || a === undefined || a === ""
  const videB = b === null || b === undefined || b === ""
  if (videA && videB) return 0
  if (videA) return 1
  if (videB) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" })
}



/**
 * Version mobile d'une ligne de l'historique des runs.
 * Toute la carte est un seul <Link> vers le détail du run :
 * cible tactile large + navigation clavier native (focus visible géré par index.css).
 */
const CarteRunMobile = memo(function CarteRunMobile({ run }) {
  const actif = statutRunActif(run.status);
  const dateLabel = dateHeure(run.started_at ?? run.created_at) ?? run.run_date;
  const declencheur = run.triggered_by?.startsWith("admin:")
    ? "Manuel"
    : run.triggered_by?.startsWith("beat:")
      ? "Planifié"
      : run.triggered_by;

  const stats = [
    { label: "Brutes", valeur: formatNombre(run.total_raw) },
    { label: "Insérées", valeur: formatNombre(run.total_inserted) },
    { label: "Mises à jour", valeur: formatNombre(run.total_updated) },
    { label: "Doublons", valeur: formatNombre(run.total_duplicates) },
    {
      label: "Erreurs",
      valeur: formatNombre(run.total_errors),
      enErreur: (run.total_errors ?? 0) > 0,
    },
    {
      label: "Durée",
      valeur: dureeLisible(null, run.started_at, run.finished_at) ?? (actif ? "…" : "—"),
    },
  ];

  return (
    <Link
      to={`/admin/scraping/runs/${run.id}`}
      aria-label={`Voir le détail du run du ${dateLabel}`}
      className="block rounded-xl border border-border bg-card p-4 shadow-soft transition-colors hover:bg-muted/50"
    >
      {/* En-tête : date + déclencheur / badge de statut */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium leading-tight text-primary">{dateLabel}</p>
          <p className="text-[10px] text-muted-foreground">{declencheur}</p>
        </div>
        <Badge variant={VARIANTE_STATUT_RUN[run.status] ?? "outline"}>
          {LIBELLE_STATUT_RUN[run.status] ?? run.status}
          {actif ? "…" : ""}
        </Badge>
      </div>

      {/* 6 indicateurs en grille 3×2 — mêmes données que les colonnes de la table */}
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {stats.map(({ label, valeur, enErreur }) => (
          <div key={label} className="rounded-lg bg-muted/40 px-2 py-1.5">
            <dt className="truncate text-[10px] text-muted-foreground">{label}</dt>
            <dd
              className={cn(
                "text-sm font-medium tabular-nums",
                enErreur && "font-semibold text-destructive"
              )}
            >
              {valeur}
            </dd>
          </div>
        ))}
      </dl>

      {/* Pied : affordance de navigation */}
      <span className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">
        Voir le détail
        <ChevronRight className="size-3.5" aria-hidden="true" />
      </span>
    </Link>
  );
});

/** Bloc skeleton avec délai décalé (cascade ligne par ligne). */
const Bloc = ({ className, delay = 0 }) => (
  <Skeleton className={className} style={delay ? { animationDelay: `${delay}ms` } : undefined} />
);

/**
 * État de chargement de l'historique des runs (/admin/scraping).
 * Reprend les mêmes classes responsives que la table réelle :
 *  - mobile  : date + statut + brutes + insérées + chevron
 *  - md+     : + mises à jour + doublons
 *  - lg+     : + erreurs + durée
 * `nbLignes` doit correspondre à la taille de page réelle (zéro layout shift).
 */

/** Géométrie des 6 tuiles de stats de CarteRunMobile : Brutes, Insérées, Mises à jour, Doublons, Erreurs, Durée. */
const TUILES_STATS = [
  { dt: "w-9", dd: "w-8" },
  { dt: "w-11", dd: "w-8" },
  { dt: "w-14", dd: "w-8" },
  { dt: "w-11", dd: "w-9" },
  { dt: "w-10", dd: "w-6" },
  { dt: "w-9", dd: "w-12" },
];

const HistoriqueRunsSkeleton = () => {
  const lignes = Array.from({ length: TAILLE_PAGE }, (_, i) => i);

  return (
    <div role="status" aria-label="Chargement de l'historique des runs">
      {/* ── Mobile : cartes (miroir de CarteRunMobile) ─────────────────────── */}
      <ul className="flex flex-col gap-3 px-4 pb-2 md:hidden" aria-hidden="true">
        {lignes.map((i) => {
          const delay = i * 80;
          return (
            <li key={i}>
              <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
                {/* En-tête : date + déclencheur / badge de statut */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <Bloc className="h-3.5 w-32" delay={delay} />
                    <Bloc className="h-2.5 w-14" delay={delay} />
                  </div>
                  <Bloc className="h-5 w-20 shrink-0 rounded-full" delay={delay} />
                </div>

                {/* Grille 3×2 des 6 indicateurs — mêmes tuiles bg-muted/40 que la carte réelle */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {TUILES_STATS.map(({ dt, dd }, k) => (
                    <div key={k} className="rounded-lg bg-muted/40 px-2 py-1.5">
                      <Bloc className={cn("h-2", dt)} delay={delay} />
                      <Bloc className={cn("mt-1 h-3.5", dd)} delay={delay} />
                    </div>
                  ))}
                </div>

                {/* Pied : « Voir le détail » */}
                <Bloc className="mt-3 h-3 w-24" delay={delay} />
              </div>
            </li>
          );
        })}
      </ul>

      {/* ── Desktop : table (inchangée) ────────────────────────────────────── */}
      <div className="hidden overflow-x-auto scrollbar-thin md:block">
        <Table aria-hidden="true">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><Bloc className="h-3 w-28" /></TableHead>
              <TableHead><Bloc className="h-3 w-14" /></TableHead>
              <TableHead className="text-right"><Bloc className="ml-auto h-3 w-10" /></TableHead>
              <TableHead className="text-right"><Bloc className="ml-auto h-3 w-10" /></TableHead>
              <TableHead className="hidden text-right md:table-cell"><Bloc className="ml-auto h-3 w-10" /></TableHead>
              <TableHead className="hidden text-right md:table-cell"><Bloc className="ml-auto h-3 w-12" /></TableHead>
              <TableHead className="hidden text-right lg:table-cell"><Bloc className="ml-auto h-3 w-10" /></TableHead>
              <TableHead className="hidden text-right lg:table-cell"><Bloc className="ml-auto h-3 w-12" /></TableHead>
              <TableHead className="w-10"><span className="sr-only">Détail</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((i) => {
              const delay = i * 80;
              return (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell>
                    <Bloc className="h-3.5 w-32" delay={delay} />
                    <Bloc className="mt-1 h-2.5 w-14" delay={delay} />
                  </TableCell>
                  <TableCell>
                    <Bloc className="h-5 w-20 rounded-full" delay={delay} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Bloc className="ml-auto h-3 w-8" delay={delay} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Bloc className="ml-auto h-3 w-8" delay={delay} />
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell">
                    <Bloc className="ml-auto h-3 w-8" delay={delay} />
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell">
                    <Bloc className="ml-auto h-3 w-9" delay={delay} />
                  </TableCell>
                  <TableCell className="hidden text-right lg:table-cell">
                    <Bloc className="ml-auto h-3 w-6" delay={delay} />
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-right lg:table-cell">
                    <Bloc className="ml-auto h-3 w-12" delay={delay} />
                  </TableCell>
                  <TableCell>
                    <Bloc className="size-4 rounded-sm" delay={delay} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pied partagé : équivalent de PaginationListe */}
      <div className="flex flex-col gap-2 border-t border-border px-4 py-3" aria-hidden="true">
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
  );
};

const COLONNES = [
  {
    cle: "started_at", libelle: "Date", directionInitiale: "desc",
    triValeur: (r) => r.started_at ?? r.created_at ?? r.run_date,
  },
  {
    cle: "total_raw", libelle: "Brutes", directionInitiale: "desc",
    triValeur: (r) => r.total_raw ?? 0,
  },
  {
    cle: "total_inserted", libelle: "Insérées", directionInitiale: "desc",
    triValeur: (r) => r.total_inserted ?? 0,
  },
  {
    cle: "total_updated", libelle: "M. à jour", directionInitiale: "desc",
    className: "hidden md:table-cell",
    triValeur: (r) => r.total_updated ?? 0,
  },
  {
    cle: "total_duplicates", libelle: "Doublons", directionInitiale: "desc",
    className: "hidden md:table-cell",
    triValeur: (r) => r.total_duplicates ?? 0,
  },
  {
    cle: "total_errors", libelle: "Erreurs", directionInitiale: "desc",
    className: "hidden lg:table-cell",
    triValeur: (r) => r.total_errors ?? 0,
  },
  {
    cle: "duree", libelle: "Durée", directionInitiale: "desc",
    className: "hidden lg:table-cell",
    triValeur: dureeMsValeur,
  },
]

const HistoriqueRuns = () => {
  const [statutFiltre, setStatutFiltre] = useState("")
  const [page, setPage] = useState(1)
  /* Tri INITIALISÉ : « Date » descendante d'office (le plus récent
     d'abord) — cohérent avec l'ordre serveur et le chevron actif est
     visible dès le premier rendu. */
  const [tri, setTri] = useState({ cle: "started_at", direction: "desc" })
  const params = { limit: TAILLE_PAGE, offset: (page - 1) * TAILLE_PAGE }
  const { data: runs, isLoading, isError, refetch } = useAdminScrapingRunsQuery(params)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const donnees = runs ?? []

  /* Filtre statut + tri s'appliquent côté client, sur la page courante. */
  const runsAffiches = useMemo(() => {
    const base = statutFiltre ? donnees.filter((r) => r.status === statutFiltre) : donnees
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [donnees, statutFiltre, tri])

  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  const pagePleine = Array.isArray(runs) && runs.length === TAILLE_PAGE
  const enActivite = aUnRunActif(runs)

  const changerStatut = (valeur) => {
    setStatutFiltre(valeur)
    setPage(1)
  }

  /* key = fondu léger du corps à chaque changement de tri / filtre. */
  const cleCorps = `${statutFiltre}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  return (
    <SectionCardAdmin
      title="Historique des runs"
      description="Voir les runs de scraping effectués et leurs statuts"
      icon={History}
      contentClassName="p-0 sm:p-0"
      action={
        <Select value={statutFiltre} onValueChange={changerStatut}>
          <SelectTrigger className="h-8 w-40 text-xs" aria-label="Filtrer les runs par statut">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tous</SelectItem>
            {Object.entries(LIBELLE_STATUT_RUN).map(([valeur, libelle]) => (
              <SelectItem key={valeur} value={valeur}>{libelle}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {/* Fondu enchaîné au changement de page / filtre / état. */}
      <TransitionEtat
        etat={`${page}-${statutFiltre}-${isLoading ? "chargement" : "donnees"}-${isError ? "erreur" : "ok"}`}
      >
        {isError ? (
          <div className="p-4">
            <SectionErreur onRetry={refetch} message="Impossible de charger l'historique des runs." />
          </div>
        ) : isLoading ? (
          <HistoriqueRunsSkeleton />
        ) : !donnees.length ? (
          <div className="p-4">
            <SectionVide message="Aucun run de scraping enregistré." />
          </div>
        ) : !runsAffiches.length ? (
          <div className="p-4">
            <SectionAucunResultat
              message="Aucun run ne correspond à ce statut sur la page courante."
              onReset={() => changerStatut("")}
            />
          </div>
        ) : (
          <>
            {/* Indicateur temps réel : icône animée + texte (role=status). */}
            {enActivite && (
              <p role="status" className="flex items-center gap-1.5 text-[11px] border-b pb-1 text-muted-foreground">
                <Loader2
                  className="size-3.5 animate-spin animation-duration-[1.8s] motion-reduce:animate-none"
                  aria-hidden="true"
                />
                Un run est en attente ou en cours, un rafraîchissement automatique est appliqué toutes les 5 s.
              </p>
            )}
            {/* ── Mobile : cartes ─────────────────────────── */}
            <ul
              key={cleCorps}
              className="flex animate-in flex-col gap-3 px-4 pb-2 duration-200 motion-reduce:animate-none md:hidden"
            >
              {runsAffiches.map((run) => (
                <li key={run.id}>
                  <CarteRunMobile run={run} />
                </li>
              ))}
            </ul>

            {/* ── Desktop : table ─────────────────────── */}
            <div className="hidden overflow-x-auto scrollbar-thin md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {/* Date — triable (initialisée desc) */}
                    <EnteteTriable
                      colonne={COLONNES.find((c) => c.cle === "started_at")}
                      tri={tri}
                      onTri={basculerTri}
                    />
                    {/* Statut — reste un filtre, jamais une colonne de tri */}
                    <TableHead>Statut</TableHead>
                    {/* Colonnes numériques + durée — triables, alignées à droite */}
                    {COLONNES.filter((c) => c.cle !== "started_at").map((colonne) => (
                      <EnteteTriable
                        key={colonne.cle}
                        colonne={colonne}
                        tri={tri}
                        onTri={basculerTri}
                        aligneDroite
                      />
                    ))}
                    <TableHead className="w-10"><span className="sr-only">Détail</span></TableHead>
                  </TableRow>
                </TableHeader>
                {/* key = fondu léger à chaque changement de tri / filtre */}
                <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                  {runsAffiches.map((run) => {
                    const actif = statutRunActif(run.status)
                    return (
                      <TableRow key={run.id} className="transition-colors hover:bg-muted/50">
                        <TableCell>
                          <Link
                            to={`/admin/scraping/runs/${run.id}`}
                            className="font-medium text-primary underline-offset-4 hover:underline"
                          >
                            {dateHeure(run.started_at ?? run.created_at) ?? run.run_date}
                          </Link>
                          <span className="block text-[10px] text-muted-foreground">
                            {run.triggered_by?.startsWith("admin:")
                              ? "Manuel"
                              : run.triggered_by?.startsWith("beat:")
                                ? "Planifié"
                                : run.triggered_by}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={VARIANTE_STATUT_RUN[run.status] ?? "outline"}>
                            {LIBELLE_STATUT_RUN[run.status] ?? run.status}
                            {actif ? "…" : ""}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNombre(run.total_raw)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNombre(run.total_inserted)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNombre(run.total_updated)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNombre(run.total_duplicates)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums lg:table-cell">
                          <span className={(run.total_errors ?? 0) > 0 ? "font-semibold text-destructive" : undefined}>
                            {formatNombre(run.total_errors)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-right tabular-nums text-muted-foreground lg:table-cell">
                          {dureeLisible(null, run.started_at, run.finished_at) ?? (actif ? "…" : "—")}
                        </TableCell>
                        <TableCell>
                          <Link
                            to={`/admin/scraping/runs/${run.id}`}
                            aria-label={`Voir le détail du run du ${dateHeure(run.started_at ?? run.created_at) ?? run.run_date}`}
                            className="inline-flex text-muted-foreground transition-colors hover:text-primary"
                          >
                            <ChevronRight className="size-4" aria-hidden="true" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
              <PaginationListe page={page} pagePleine={pagePleine} onPageChange={setPage} />
            </div>
          </>
        )}
      </TransitionEtat>
    </SectionCardAdmin>
  )
}

export default HistoriqueRuns