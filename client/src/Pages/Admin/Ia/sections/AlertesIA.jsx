import { memo, useMemo, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import { BellRing, CheckCheck, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  messageErreurIa, SEVERITES, useAcquitterAlerte, useAlertesIaQuery,
} from "@/features/admin-ia.tools"
import { useNotify } from "@/contexts/Notify.context"
import { useFiltresIaAdmin } from "@/contexts/FiltresIaAdmin.context"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import PaginationListe from "@/components/admin/PaginationListe"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { SectionErreur, SectionAucunResultat, SectionVide, TransitionEtat } from "@/components/admin/EtatsSection"
import { dateHeure } from "@/lib/dates"
import BtnAction from "@/components/admin/BtnAction"

/* Tri « français » robuste : nombres, textes, dates ISO ; vides en fin
   (même pattern que RunsRecents). */
const comparerValeurs = (a, b) => {
  const videA = a === null || a === undefined || a === ""
  const videB = b === null || b === undefined || b === ""
  if (videA && videB) return 0
  if (videA) return 1
  if (videB) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" })
}

/* Rang de tri des sévérités — plus grave d'abord en desc ; les
   inconnues tombent à 0 (fin de liste). */
const RANG_SEVERITE = { critical: 3, warning: 2, info: 1 }

/* Sentinelle ISO : les alertes NON acquittées restent en fin de liste
   en desc (une valeur vide remonterait en tête après le reverse). */
const JAMAIS = "0000-01-01T00:00:00"

/* Colonnes triables — « Message » (texte long tronqué) est volontairement
   exclu. Tri CLIENT sur la page courante uniquement : la pagination est
   serveur (offset), l'ordre naturel fait foi entre les pages. */
const COLONNES = [
  { cle: "created", libelle: "Créée", directionInitiale: "desc", triValeur: (a) => a.created_at },
  { cle: "severite", libelle: "Sévérité", directionInitiale: "desc", triValeur: (a) => RANG_SEVERITE[a.severity] ?? 0 },
  { cle: "type", libelle: "Type", directionInitiale: "asc", triValeur: (a) => a.type ?? "" },
  { cle: "acquittee", libelle: "Acquittée", directionInitiale: "desc", triValeur: (a) => a.acknowledged_at ?? JAMAIS },
]

/* ── Carte mobile (miroir de la ligne desktop) ──────────────────────── */
const CarteAlerteMobile = memo(function CarteAlerteMobile({ alerte, enCours, onAcquitter }) {
  const conf = SEVERITES[alerte.severity] ?? { libelle: alerte.severity, variante: "outline" }
  return (
    <article
      aria-label={`Alerte ${alerte.type} du ${dateHeure(alerte.created_at)}`}
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-soft",
        alerte.acknowledged_at && "opacity-60"
      )}
    >
      {/* En-tête : date + type / badge de sévérité */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium leading-tight text-primary">{dateHeure(alerte.created_at)}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{alerte.type}</p>
        </div>
        <Badge variant={conf.variante}>{conf.libelle}</Badge>
      </div>

      {/* Message (tronqué sur 2 lignes, title complet) */}
      <p className="mt-2 line-clamp-2 text-xs" title={alerte.message}>{alerte.message}</p>

      {/* Pied : état d'acquittement + action */}
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2">
        {alerte.acknowledged_at ? (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Badge variant="secondary" className="w-fit gap-1 text-emerald-700">
              <CheckCircle2 className="size-3" aria-hidden="true" /> Traité
            </Badge>
            {dateHeure(alerte.acknowledged_at)}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Non acquittée</span>
        )}
        {!alerte.acknowledged_at && (
          <BtnAction
            variant="ghost"
            size="xs"
            onClick={onAcquitter}
            disabled={enCours}
            aria-label={`Acquitter l'alerte ${alerte.type}`}
          >
            {enCours ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCheck className="size-3.5" aria-hidden="true" />
            )}
            {enCours ? "Acquittement…" : "Acquitter"}
          </BtnAction>
        )}
      </div>
    </article>
  )
})

/* ── SKELETONS FIDÈLES ───────────────────────────────────────────── */

/** Bloc skeleton avec délai décalé (cascade ligne par ligne). */
const Bloc = ({ className, delay = 0 }) => (
  <Skeleton className={className} style={delay ? { animationDelay: `${delay}ms` } : undefined} />
)

/* Ligne desktop : 6 cellules, « Acquittée » masquée < lg. */
const SkeletonLigneAlerte = ({ delay = 0 }) => (
  <TableRow className="hover:bg-transparent">
    <TableCell><Bloc className="h-3 w-28" delay={delay} /></TableCell>
    <TableCell><Bloc className="h-5 w-20 rounded-full" delay={delay} /></TableCell>
    <TableCell><Bloc className="h-3 w-24" delay={delay} /></TableCell>
    <TableCell className="max-w-72"><Bloc className="h-3 w-48" delay={delay} /></TableCell>
    <TableCell className="hidden lg:table-cell">
      <Bloc className="h-5 w-16 rounded-full" delay={delay} />
      <Bloc className="mt-1 h-2.5 w-24" delay={delay} />
    </TableCell>
    <TableCell className="w-10"><Bloc className="h-7 w-20 rounded-md" delay={delay} /></TableCell>
  </TableRow>
)

/* Carte mobile : miroir de CarteAlerteMobile. */
const SkeletonCarteAlerteMobile = ({ delay = 0 }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-soft" aria-hidden="true">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 space-y-1">
        <Bloc className="h-3.5 w-32" delay={delay} />
        <Bloc className="h-2.5 w-24" delay={delay} />
      </div>
      <Bloc className="h-5 w-20 shrink-0 rounded-full" delay={delay} />
    </div>
    <Bloc className="mt-2 h-3 w-full" delay={delay} />
    <Bloc className="mt-1 h-3 w-2/3" delay={delay} />
    <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
      <Bloc className="h-5 w-24 rounded-full" delay={delay} />
      <Bloc className="h-7 w-20 rounded-md" delay={delay} />
    </div>
  </div>
)

const AlertesIASkeleton = ({ nbLignes = 4 }) => {
  const lignes = Array.from({ length: nbLignes }, (_, i) => i)
  return (
    <div role="status" aria-label="Chargement des alertes IA">
      {/* ── Mobile : cartes ─────────────────────────────── */}
      <ul className="flex flex-col gap-3 px-4 pb-2 md:hidden" aria-hidden="true">
        {lignes.map((i) => (
          <li key={i}><SkeletonCarteAlerteMobile delay={i * 80} /></li>
        ))}
      </ul>

      {/* ── Desktop : table ─────────────────────────────── */}
      <div className="hidden overflow-x-auto scrollbar-thin md:block">
        <Table aria-hidden="true">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><Bloc className="h-3 w-14" /></TableHead>
              <TableHead><Bloc className="h-3 w-16" /></TableHead>
              <TableHead><Bloc className="h-3 w-10" /></TableHead>
              <TableHead className="max-w-72"><Bloc className="h-3 w-16" /></TableHead>
              <TableHead className="hidden lg:table-cell"><Bloc className="h-3 w-18" /></TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((i) => <SkeletonLigneAlerte key={i} delay={i * 80} />)}
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
  )
}

/* ── COMPOSANT PRINCIPAL ─────────────────────────────────────────── */

const AlertesIA = () => {
  const notify = useNotify()
  const mouvementReduit = useReducedMotion()
  const {
    severite, inclureAcquittees, pageAlertes, paramsAlertes,
    setSeverite, setInclureAcquittees, setPageAlertes, reinitialiserAlertes,
  } = useFiltresIaAdmin()
  const { data: alertes, isLoading, isError, refetch } = useAlertesIaQuery(paramsAlertes)
  const acquitter = useAcquitterAlerte()

  /* Tri INITIALISÉ : « Créée » descendante (la plus récente d'abord). */
  const [tri, setTri] = useState({ cle: "created", direction: "desc" })

  /* Ancrage du retour en haut du tableau au changement de page. */
  const refTableau = useRef(null)

  const alertesAffichees = useMemo(() => {
    const base = alertes ?? []
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [alertes, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  /* Changement de page → retour en haut du tableau. */
  const changerPage = (nouvellePage) => {
    setPageAlertes(nouvellePage)
    refTableau.current?.scrollIntoView({
      behavior: mouvementReduit ? "auto" : "smooth",
      block: "start",
    })
  }

  const pagePleine = Array.isArray(alertes) && alertes.length === paramsAlertes.limit
  const filtresActifs = !!severite || inclureAcquittees

  const accuser = (alerte) => {
    acquitter.mutate(alerte.id, {
      onSuccess: () => notify("Alerte acquittée", "success"),
      onError: (err) => notify(messageErreurIa(err), "error"),
    })
  }

  /* key = fondu léger du corps à chaque changement de tri / filtres. */
  const cleCorps = `${severite}-${inclureAcquittees}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  /* Clé d'état de la transition : page + filtres inclus pour le fondu. */
  const etat = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !alertes?.length
        ? filtresActifs ? "aucun-resultat" : "vide"
        : "donnees"

  return (
    <div ref={refTableau} className="scroll-mt-20">
      <SectionCardAdmin
        title="Alertes"
        description="Signaux émis par le pipeline (clé indisponible, quota, désactivation auto…). Non acquittées par défaut."
        icon={BellRing}
        contentClassName="p-0 sm:p-0"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Sentinelle « toutes » : Radix refuse la valeur vide. */}
            <Select value={severite || "toutes"} onValueChange={(v) => setSeverite(v === "toutes" ? "" : v)}>
              <SelectTrigger className="h-8 w-40 text-xs" aria-label="Filtrer par sévérité">
                <SelectValue placeholder="Toutes sévérités" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes sévérités</SelectItem>
                {Object.entries(SEVERITES).map(([valeur, conf]) => (
                  <SelectItem key={valeur} value={valeur}>{conf.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={inclureAcquittees ? "avec" : "sans"} onValueChange={(v) => setInclureAcquittees(v === "avec")}>
              <SelectTrigger className="h-8 w-48 text-xs" aria-label="Inclure les alertes acquittées">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sans">Non acquittées uniquement</SelectItem>
                <SelectItem value="avec">Avec les acquittées</SelectItem>
              </SelectContent>
            </Select>
            {filtresActifs && (
              <BtnAction variant="outline" size="xs" className="text-xs" onClick={reinitialiserAlertes}>
                Réinitialiser
              </BtnAction>
            )}
          </div>
        }
      >
        {/* Fondu enchaîné au changement de filtres / page / état. */}
        <TransitionEtat etat={`${pageAlertes}-${severite}-${inclureAcquittees}-${etat}`}>
          {isError ? (
            <div className="p-4">
              <SectionErreur onRetry={refetch} message="Impossible de charger les alertes." />
            </div>
          ) : isLoading ? (
            <AlertesIASkeleton nbLignes={8} />
          ) : !alertes?.length ? (
            <div className="p-4">
              {filtresActifs ? (
                <SectionAucunResultat onReset={reinitialiserAlertes} message="Aucune alerte ne correspond aux filtres." />
              ) : (
                <SectionVide message="Aucune alerte IA en attente — le pipeline est serein." />
              )}
            </div>
          ) : (
            <>
              {/* ── Mobile : cartes ─────────────────────────── */}
              <ul
                key={cleCorps}
                className="flex animate-in flex-col gap-3 px-4 pb-2 duration-200 motion-reduce:animate-none md:hidden"
              >
                {alertesAffichees.map((alerte) => (
                  <li key={alerte.id}>
                    <CarteAlerteMobile
                      alerte={alerte}
                      enCours={acquitter.isPending && acquitter.variables === alerte.id}
                      onAcquitter={() => accuser(alerte)}
                    />
                  </li>
                ))}
              </ul>

              {/* ── Desktop : table ─────────────────────────── */}
              <div className="hidden overflow-x-auto scrollbar-thin md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "created")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "severite")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "type")} tri={tri} onTri={basculerTri} />
                      <TableHead className="max-w-72">Message</TableHead>
                      <EnteteTriable
                        colonne={COLONNES.find((c) => c.cle === "acquittee")}
                        tri={tri}
                        onTri={basculerTri}
                        className="hidden lg:table-cell"
                      />
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  {/* key = fondu léger à chaque changement de tri / filtres */}
                  <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                    {alertesAffichees.map((alerte) => {
                      const conf = SEVERITES[alerte.severity] ?? { libelle: alerte.severity, variante: "outline" }
                      const enCours = acquitter.isPending && acquitter.variables === alerte.id
                      return (
                        <TableRow
                          key={alerte.id}
                          className={alerte.acknowledged_at ? "opacity-60 transition-colors hover:bg-muted/50" : "transition-colors hover:bg-muted/50"}
                        >
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {dateHeure(alerte.created_at)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={conf.variante}>{conf.libelle}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-[10px] text-muted-foreground">{alerte.type}</span>
                          </TableCell>
                          <TableCell className="max-w-72">
                            <span className="block truncate text-xs" title={alerte.message}>{alerte.message}</span>
                          </TableCell>
                          {/* Indicateur explicite : badge « Traité » + horodatage. */}
                          <TableCell className="hidden lg:table-cell">
                            {alerte.acknowledged_at ? (
                              <span className="flex flex-col gap-1">
                                <Badge variant="secondary" className="w-fit gap-1 text-emerald-700">
                                  <CheckCircle2 className="size-3" aria-hidden="true" /> Traité
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">{dateHeure(alerte.acknowledged_at)}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {!alerte.acknowledged_at && (
                              <BtnAction
                                variant="ghost"
                                size="xs"
                                onClick={() => accuser(alerte)}
                                disabled={enCours}
                                aria-label={`Acquitter l'alerte ${alerte.type}`}
                              >
                                {enCours ? (
                                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                ) : (
                                  <CheckCheck className="size-3.5" aria-hidden="true" />
                                )}
                                {enCours ? "Acquittement…" : "Acquitter"}
                              </BtnAction>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="border-t border-border px-4 py-3">
                <PaginationListe page={pageAlertes} pagePleine={pagePleine} onPageChange={changerPage} />
              </div>
            </>
          )}
        </TransitionEtat>
      </SectionCardAdmin>
    </div>
  )
}

export default AlertesIA