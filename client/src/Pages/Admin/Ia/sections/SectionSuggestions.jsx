import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
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
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Section Suggestions de filière IA (cycle 19, doc v3 §19).

   Approbation = création de filière ACTIVE + mot-clé poids 50 → la
   suggestion est le POINT DE DÉPART, pas une fin : on redirige vers
   l'éditeur de mots-clés (doc §19 « sinon la filière restera
   sous-alimentée en matching »).

   ⚠️ La réponse d'approbation ne contient PAS l'id de la nouvelle
   filière — seulement son code. Le croisement local code→id se fait
   via le cache filières (useAdminFilieresQuery, pattern cycle 12 :
   zéro appel réseau dédié — l'invalidation filières déclenche le
   refetch qui résoudra le code).
   409 concurrence : le message serveur s'affiche tel quel.
   ───────────────────────────────────────────────────────────────────── */

const ONGLET_SUGGESTIONS = [
  { valeur: "pending", libelle: "En attente" },
  { valeur: "approved", libelle: "Approuvées" },
  { valeur: "rejected", libelle: "Rejetées" },
]

const VARIANTE_SUGGESTION = { pending: "secondary", approved: "default", rejected: "outline" }

const SectionSuggestions = () => {
  const notify = useNotify()
  const navigate = useNavigate()
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

  const pagePleine = Array.isArray(suggestions) && suggestions.length === paramsSuggestions.limit

  const revoirSuggestion = (suggestion, statut) => {
    revoir.mutate(
      { suggestionId: suggestion.id, status: statut },
      {
        onSuccess: () => {
          if (statut === "approved") {
            // La filière vient d'être créée : le cache filières de la page
            // est périmé (la Map idParCode ci-dessus date d'avant la
            // création). On rafraîchit le cache racine, on RELIT la
            // liste fraîche, puis on atterrit sur l'éditeur de mots-clés
            // de la nouvelle filière (doc v3 §19 — approbation ≠ fin du
            // travail : la filière n'a qu'un mot-clé de départ).
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

  return (
    <section aria-label="Suggestions de filière IA" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Lightbulb className="size-4 text-primary" aria-hidden /> Suggestions de filière
          </h2>
          <p className="text-xs text-muted-foreground">
            L'IA propose des filières quand aucune ne correspond à une offre. Approuver crée la filière
            (active, un mot-clé de départ) — pensez à l'enrichir.
          </p>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Filtrer par statut">
          {ONGLET_SUGGESTIONS.map((s) => (
            <Button
              key={s.valeur}
              variant={statutSuggestion === s.valeur ? "default" : "outline"}
              size="sm"
              onClick={() => setStatutSuggestion(statutSuggestion === s.valeur ? "" : s.valeur)}
              aria-pressed={statutSuggestion === s.valeur}
            >
              {s.libelle}
            </Button>
          ))}
        </div>
      </div>

      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les suggestions." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
        </div>
      ) : !suggestions?.length ? (
        statutSuggestion === "approved" ? (
          <SectionVide message="Aucune suggestion approuvée pour l'instant." />
        ) : statutSuggestion === "rejected" ? (
          <SectionVide message="Aucune suggestion rejetée pour l'instant." />
        ) : (
          <SectionVide message="Aucune suggestion en attente — l'IA n'a pas rencontré d'offre hors référentiel récemment." />
        )
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Proposée</TableHead>
                <TableHead>Filière proposée</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="max-w-64">Raison IA</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden lg:table-cell">Offre d'origine</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {suggestions.map((suggestion) => (
                <TableRow key={suggestion.id}>
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
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={VARIANTE_SUGGESTION[suggestion.status] ?? "outline"}>
                      {ONGLET_SUGGESTIONS.find((s) => s.valeur === suggestion.status)?.libelle ?? suggestion.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {suggestion.offer_id ? (
                      <Button variant="ghost" size="sm" className="text-xs"
                        onClick={() => navigate(`/admin/offres/${suggestion.offer_id}`)}>
                        Voir l'offre
                      </Button>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {suggestion.status === "pending" && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm"
                          disabled={revoir.isPending && revoir.variables?.suggestionId === suggestion.id}
                          onClick={() => revoirSuggestion(suggestion, "approved")}
                          aria-label={`Approuver la filière ${suggestion.label}`}>
                          <Check className="size-3.5" aria-hidden /> Approuver
                        </Button>
                        <Button variant="ghost" size="icon-sm"
                          disabled={revoir.isPending && revoir.variables?.suggestionId === suggestion.id}
                          onClick={() => revoirSuggestion(suggestion, "rejected")}
                          aria-label={`Rejeter la filière ${suggestion.label}`}>
                          <X className="size-3.5" aria-hidden />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PaginationListe page={pageSuggestions} pagePleine={pagePleine} onPageChange={setPageSuggestions} />
    </section>
  )
}

export default SectionSuggestions
