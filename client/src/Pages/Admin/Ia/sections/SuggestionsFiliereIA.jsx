import { memo, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useReducedMotion } from "framer-motion"
import { Check, Lightbulb, X } from "lucide-react"
import {
  messageErreurIa, useRevoirSuggestion, useStatsIaQuery, useSuggestionsIaQuery,
} from "@/features/admin-ia.tools"
import { useNotify } from "@/contexts/Notify.context"
import { useFiltresIaAdmin } from "@/contexts/FiltresIaAdmin.context"
import { useAdminFilieresQuery, adminFilieresKeys } from "@/features/admin-filieres.tools"
import { queryClient } from "@/lib/queryClient"
import { Badge } from "@/components/ui/badge"
import BtnAction from "@/components/admin/BtnAction"
import { Skeleton } from "@/components/ui/skeleton"
import PaginationListe from "@/components/admin/PaginationListe"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { SectionErreur, SectionVide, TransitionEtat } from "@/components/admin/EtatsSection"

const ONGLET_SUGGESTIONS = [
  { valeur: "pending", libelle: "En attente" },
  { valeur: "approved", libelle: "Approuvées" },
  { valeur: "rejected", libelle: "Rejetées" },
]

const VARIANTE_SUGGESTION = { pending: "secondary", approved: "outline", rejected: "destructive" }

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

/* Colonnes triables — « Statut » est volontairement exclu (filtre par
   onglets dans l'en-tête de carte) et « Raison IA » aussi (texte long
   tronqué). Tri CLIENT sur la page courante uniquement (pagination
   serveur offset + status_filter). */
const COLONNES = [
  { cle: "created", libelle: "Proposée", directionInitiale: "desc", triValeur: (s) => s.created_at },
  { cle: "label", libelle: "Filière proposée", directionInitiale: "asc", triValeur: (s) => (s.label ?? "").toLowerCase() },
  { cle: "code", libelle: "Code", directionInitiale: "asc", triValeur: (s) => s.code ?? "" },
]

/* ── Carte mobile (miroir de la ligne desktop) ──────────────────────── */
const CarteSuggestionMobile = memo(function CarteSuggestionMobile({
  suggestion, enCours, onRevoir, onVoirOffre,
}) {
  return (
    <article
      aria-label={`Suggestion de filière ${suggestion.label}`}
      className="rounded-xl border border-border bg-card p-4 shadow-soft"
    >
      {/* En-tête : libellé + code / badge de statut */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{suggestion.label}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{suggestion.code}</p>
        </div>
        <Badge variant={VARIANTE_SUGGESTION[suggestion.status] ?? "outline"}>
          {ONGLET_SUGGESTIONS.find((s) => s.valeur === suggestion.status)?.libelle ?? suggestion.status}
        </Badge>
      </div>

      {/* Raison IA (tronquée sur 2 lignes, title complet) */}
      {suggestion.reason && (
        <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground" title={suggestion.reason}>
          {suggestion.reason}
        </p>
      )}

      {/* Pied : date + offre d'origine + actions d'approbation */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <span className="text-[10px] text-muted-foreground">
          Proposée le {new Date(suggestion.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
        </span>
        <div className="flex items-center gap-1">
          {suggestion.offer_id && (
            <BtnAction
              variant="ghost"
              size="xs"
              className="text-xs"
              onClick={() => onVoirOffre(suggestion)}
            >
              Voir l'offre
            </BtnAction>
          )}
          {suggestion.status === "pending" && (
            <>
              {/* Action positive : teinte verte explicite. */}
              <BtnAction
                variant="ghost"
                size="xs"
                disabled={enCours}
                onClick={() => onRevoir("approved")}
                aria-label={`Approuver la filière ${suggestion.label}`}
                className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
              >
                <Check className="size-3.5" aria-hidden="true" /> Approuver
              </BtnAction>
              {/* Action critique : teinte rouge explicite. */}
              <BtnAction
                variant="ghost"
                size="icon-sm"
                disabled={enCours}
                onClick={() => onRevoir("rejected")}
                aria-label={`Rejeter la filière ${suggestion.label}`}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-3.5" aria-hidden="true" />
              </BtnAction>
            </>
          )}
        </div>
      </div>
    </article>
  )
})

/* ── SKELETONS FIDÈLES ───────────────────────────────────────────── */

const Bloc = ({ className, delay = 0 }) => (
  <Skeleton className={className} style={delay ? { animationDelay: `${delay}ms` } : undefined} />
)

/* Ligne desktop : 7 cellules — « Offre d'origine » masquée < lg. */
const SkeletonLigneSuggestion = ({ delay = 0 }) => (
  <TableRow className="hover:bg-transparent">
    <TableCell><Bloc className="h-3 w-16" delay={delay} /></TableCell>
    <TableCell><Bloc className="h-3.5 w-32" delay={delay} /></TableCell>
    <TableCell><Bloc className="h-3 w-12" delay={delay} /></TableCell>
    <TableCell className="max-w-64"><Bloc className="h-3 w-40" delay={delay} /></TableCell>
    <TableCell><Bloc className="h-5 w-20 rounded-full" delay={delay} /></TableCell>
    <TableCell className="hidden lg:table-cell"><Bloc className="h-7 w-16 rounded-md" delay={delay} /></TableCell>
    <TableCell className="w-10"><Bloc className="h-7 w-24 rounded-md" delay={delay} /></TableCell>
  </TableRow>
)

/* Carte mobile : miroir de CarteSuggestionMobile. */
const SkeletonCarteSuggestionMobile = ({ delay = 0 }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-soft" aria-hidden="true">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 space-y-1.5">
        <Bloc className="h-3.5 w-32" delay={delay} />
        <Bloc className="h-2.5 w-16" delay={delay} />
      </div>
      <Bloc className="h-5 w-20 shrink-0 rounded-full" delay={delay} />
    </div>
    <Bloc className="mt-2 h-3 w-full" delay={delay} />
    <Bloc className="mt-1 h-3 w-3/4" delay={delay} />
    <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
      <Bloc className="h-2.5 w-24" delay={delay} />
      <Bloc className="h-7 w-24 rounded-md" delay={delay} />
    </div>
  </div>
)

const SuggestionsSkeleton = ({ nbLignes = 3 }) => {
  const lignes = Array.from({ length: nbLignes }, (_, i) => i)
  return (
    <div role="status" aria-label="Chargement des suggestions de filière">
      {/* ── Mobile : cartes ─────────────────────────────── */}
      <ul className="flex flex-col gap-3 px-4 pb-2 md:hidden" aria-hidden="true">
        {lignes.map((i) => (
          <li key={i}><SkeletonCarteSuggestionMobile delay={i * 80} /></li>
        ))}
      </ul>

      {/* ── Desktop : table ─────────────────────────────── */}
      <div className="hidden overflow-x-auto scrollbar-thin md:block">
        <Table aria-hidden="true">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><Bloc className="h-3 w-16" /></TableHead>
              <TableHead><Bloc className="h-3 w-24" /></TableHead>
              <TableHead><Bloc className="h-3 w-10" /></TableHead>
              <TableHead className="max-w-64"><Bloc className="h-3 w-16" /></TableHead>
              <TableHead><Bloc className="h-3 w-12" /></TableHead>
              <TableHead className="hidden lg:table-cell"><Bloc className="h-3 w-20" /></TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((i) => <SkeletonLigneSuggestion key={i} delay={i * 80} />)}
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

const SuggestionsFiliereIA = () => {
  const notify = useNotify()
  const navigate = useNavigate()
  const mouvementReduit = useReducedMotion()
  const { statutSuggestion, pageSuggestions, paramsSuggestions, setStatutSuggestion, setPageSuggestions } =
    useFiltresIaAdmin()
  const params = useMemo(
    () => ({ ...paramsSuggestions, status_filter: statutSuggestion || undefined }),
    [paramsSuggestions, statutSuggestion]
  )
  const { data: suggestions, isLoading, isError, refetch } = useSuggestionsIaQuery(params)
  // Cache filières préchauffé : l'atterrissage post-approbation sur la page
  // Filières trouvera la liste déjà fraîche (fetchQuery l'actualise au pire).
  useAdminFilieresQuery()
  const revoir = useRevoirSuggestion()
  const { refetch: refetchStats } = useStatsIaQuery(30)

  /* Tri INITIALISÉ : « Proposée » descendante (la plus récente d'abord). */
  const [tri, setTri] = useState({ cle: "created", direction: "desc" })

  /* Ancrage du retour en haut du tableau au changement de page. */
  const refTableau = useRef(null)

  const pagePleine = Array.isArray(suggestions) && suggestions.length === paramsSuggestions.limit

  const suggestionsAffichees = useMemo(() => {
    const base = suggestions ?? []
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [suggestions, tri])

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
    setPageSuggestions(nouvellePage)
    refTableau.current?.scrollIntoView({
      behavior: mouvementReduit ? "auto" : "smooth",
      block: "start",
    })
  }

  const revoirSuggestion = (suggestion, statut) => {
    revoir.mutate(
      { suggestionId: suggestion.id, status: statut },
      {
        onSuccess: () => {
          if (statut === "approved") {
            // La filière vient d'être créée : le cache filières est périmé.
            // On invalide, on RELIT la liste fraîche, puis on atterrit sur
            // l'éditeur de mots-clés de la nouvelle filière (doc v3 §19).
            queryClient
              .invalidateQueries({ queryKey: adminFilieresKeys.root })
              .then(() => queryClient.fetchQuery({
                queryKey: adminFilieresKeys.root,
                queryFn: async () => {
                  const { getFilieres } = await import("@/api/admin/referentials")
                  return getFilieres()
                },
              }))
              .then((filieresFraiches) => {
                const idFiliere = (filieresFraiches ?? []).find((f) => f.code === suggestion.code)?.id
                if (idFiliere) {
                  notify(
                    `Filière « ${suggestion.label} » créée — enrichissez ses mots-clés pour le matching`,
                    "success",
                    6000
                  )
                  navigate(`/admin/filieres?etendue=${idFiliere}`)
                } else {
                  notify(
                    `Filière « ${suggestion.label} » créée — ouvrez la page Filières pour enrichir ses mots-clés`,
                    "success",
                    6000
                  )
                  navigate("/admin/filieres")
                }
              })
              .catch(() => {
                notify("Filière créée — allez dans Filières pour enrichir ses mots-clés", "success")
                navigate("/admin/filieres")
              })
          } else {
            notify("Suggestion rejetée", "success")
          }
          refetchStats()
        },
        onError: (err) => notify(messageErreurIa(err), "error"),
      }
    )
  }

  /* key = fondu léger du corps à chaque changement de tri / filtre. */
  const cleCorps = `${statutSuggestion}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  const etat = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !suggestions?.length
        ? "vide"
        : "donnees"

  return (
    <div ref={refTableau} className="scroll-mt-20">
      <SectionCardAdmin
        title="Suggestions de filière"
        description="L'IA propose des filières quand aucune ne correspond à une offre. Approuver crée la filière (active, un mot-clé de départ) — pensez à l'enrichir. Tri par colonne."
        icon={Lightbulb}
        contentClassName="p-0 sm:p-0"
        action={
          <div className="flex items-center gap-1" role="group" aria-label="Filtrer par statut">
            {ONGLET_SUGGESTIONS.map((s) => (
              <BtnAction
                key={s.valeur}
                variant={statutSuggestion === s.valeur ? "secondary" : "outline"}
                size="xs"
                className="text-xs"
                onClick={() => setStatutSuggestion(statutSuggestion === s.valeur ? "" : s.valeur)}
                aria-pressed={statutSuggestion === s.valeur}
              >
                {s.libelle}
              </BtnAction>
            ))}
          </div>
        }
      >
        {/* Fondu enchaîné au changement de filtre / page / état. */}
        <TransitionEtat etat={`${pageSuggestions}-${statutSuggestion}-${etat}`}>
          {isError ? (
            <div className="p-4">
              <SectionErreur onRetry={refetch} message="Impossible de charger les suggestions." />
            </div>
          ) : isLoading ? (
            <SuggestionsSkeleton nbLignes={8} />
          ) : !suggestions?.length ? (
            <div className="p-4">
              {statutSuggestion === "approved" ? (
                <SectionVide message="Aucune suggestion approuvée pour l'instant." />
              ) : statutSuggestion === "rejected" ? (
                <SectionVide message="Aucune suggestion rejetée pour l'instant." />
              ) : (
                <SectionVide message="Aucune suggestion en attente — l'IA n'a pas rencontré d'offre hors référentiel récemment." />
              )}
            </div>
          ) : (
            <>
              {/* ── Mobile : cartes ─────────────────────────── */}
              <ul
                key={cleCorps}
                className="flex animate-in flex-col gap-3 px-4 pb-2 duration-200 motion-reduce:animate-none md:hidden"
              >
                {suggestionsAffichees.map((suggestion) => (
                  <li key={suggestion.id}>
                    <CarteSuggestionMobile
                      suggestion={suggestion}
                      enCours={revoir.isPending && revoir.variables?.suggestionId === suggestion.id}
                      onRevoir={(statut) => revoirSuggestion(suggestion, statut)}
                      onVoirOffre={(s) => navigate(`/admin/offres/${s.offer_id}`)}
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
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "label")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "code")} tri={tri} onTri={basculerTri} />
                      <TableHead className="max-w-64">Raison IA</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="hidden lg:table-cell">Offre d'origine</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                    {suggestionsAffichees.map((suggestion) => (
                      <TableRow key={suggestion.id} className="transition-colors hover:bg-muted/50">
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(suggestion.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{suggestion.label}</TableCell>
                        <TableCell>
                          <span className="font-mono text-[10px] text-muted-foreground">{suggestion.code}</span>
                        </TableCell>
                        <TableCell className="max-w-64">
                          {suggestion.reason ? (
                            <span className="block truncate text-[11px] text-muted-foreground" title={suggestion.reason}>
                              {suggestion.reason}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={VARIANTE_SUGGESTION[suggestion.status] ?? "outline"}>
                            {ONGLET_SUGGESTIONS.find((s) => s.valeur === suggestion.status)?.libelle ?? suggestion.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {suggestion.offer_id ? (
                            <BtnAction
                              variant="ghost"
                              size="xs"
                              className="text-xs"
                              onClick={() => navigate(`/admin/offres/${suggestion.offer_id}`)}
                            >
                              Voir l'offre
                            </BtnAction>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {suggestion.status === "pending" && (
                            <div className="flex items-center gap-1">
                              {/* Action positive : teinte verte explicite. */}
                              <BtnAction
                                variant="ghost"
                                size="xs"
                                disabled={revoir.isPending && revoir.variables?.suggestionId === suggestion.id}
                                onClick={() => revoirSuggestion(suggestion, "approved")}
                                aria-label={`Approuver la filière ${suggestion.label}`}
                                className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                              >
                                <Check className="size-3.5" aria-hidden="true" /> Approuver
                              </BtnAction>
                              {/* Action critique : teinte rouge explicite. */}
                              <BtnAction
                                variant="ghost"
                                size="icon-sm"
                                disabled={revoir.isPending && revoir.variables?.suggestionId === suggestion.id}
                                onClick={() => revoirSuggestion(suggestion, "rejected")}
                                aria-label={`Rejeter la filière ${suggestion.label}`}
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                <X className="size-3.5" aria-hidden="true" />
                              </BtnAction>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="border-t border-border px-4 py-3">
                <PaginationListe page={pageSuggestions} pagePleine={pagePleine} onPageChange={changerPage} />
              </div>
            </>
          )}
        </TransitionEtat>
      </SectionCardAdmin>
    </div>
  )
}

export default SuggestionsFiliereIA