import { useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Check, Lightbulb, X } from "lucide-react"
import {
  messageErreurIa, useRevoirSuggestion, useStatsIaQuery, useSuggestionsIaQuery,
} from "@/features/admin-ia.tools"
import { useNotify } from "@/contexts/Notify.context"
import { useFiltresIaAdmin } from "@/contexts/FiltresIaAdmin.context"
import { useAdminFilieresQuery, adminFilieresKeys } from "@/features/admin-filieres.tools"
import { queryClient } from "@/lib/queryClient"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import PaginationListe from "@/components/admin/PaginationListe"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

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

const SectionSuggestions = () => {
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
              <Button
                key={s.valeur}
                variant={statutSuggestion === s.valeur ? "secondary" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => setStatutSuggestion(statutSuggestion === s.valeur ? "" : s.valeur)}
                aria-pressed={statutSuggestion === s.valeur}
              >
                {s.libelle}
              </Button>
            ))}
          </div>
        }
      >
        {/* Fondu enchaîné au changement de filtre / page. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${pageSuggestions}-${statutSuggestion}-${isLoading ? "chargement" : "donnees"}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les suggestions." />
              </div>
            ) : isLoading ? (
              <div className="flex flex-col gap-2 p-4" aria-busy="true">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
              </div>
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
                <div className="overflow-x-auto scrollbar-thin">
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
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                                onClick={() => navigate(`/admin/offres/${suggestion.offer_id}`)}
                              >
                                Voir l'offre
                              </Button>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            {suggestion.status === "pending" && (
                              <div className="flex items-center gap-1">
                                {/* Action positive : teinte verte explicite. */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={revoir.isPending && revoir.variables?.suggestionId === suggestion.id}
                                  onClick={() => revoirSuggestion(suggestion, "approved")}
                                  aria-label={`Approuver la filière ${suggestion.label}`}
                                  className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                >
                                  <Check className="size-3.5" aria-hidden="true" /> Approuver
                                </Button>
                                {/* Action critique : teinte rouge explicite. */}
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={revoir.isPending && revoir.variables?.suggestionId === suggestion.id}
                                  onClick={() => revoirSuggestion(suggestion, "rejected")}
                                  aria-label={`Rejeter la filière ${suggestion.label}`}
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <X className="size-3.5" aria-hidden="true" />
                                </Button>
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
          </motion.div>
        </AnimatePresence>
      </SectionCardAdmin>
    </div>
  )
}

export default SectionSuggestions