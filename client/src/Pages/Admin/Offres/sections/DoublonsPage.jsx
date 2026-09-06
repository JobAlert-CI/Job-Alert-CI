import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Inbox, SearchX, SlidersHorizontal } from "lucide-react"
import { useAdminDoublonsQuery } from "@/features/admin-offres.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { SectionErreur } from "../components/EtatsSection"
import CarteDoublon from "../components/CarteDoublon"

/* ─────────────────────────────────────────────────────────────────────
   Page Doublons à vérifier — /admin/offres/doublons (sous-écran de la
   gestion des offres). super_admin + gestionnaire_offres.

   Objectif (doc v3 §5) : traiter les offres qui se ressemblent fortement
   (même entreprise, titre proche) SANS le même hash exact — ce que le
   dédoublonnage automatique ne peut pas capturer seul.

   Contrat API (vérifié live 2026-09-05) :
   - GET /offers/duplicates/candidates?min_similarity=80 [&company_id]
     → [{ offer_a_id, offer_b_id, offer_a_title, offer_b_title,
          offer_a_company, similarity_score, reason }]
     Déjà triée par score décroissant côté serveur.
   - Header X-Scan-Truncated: true → résultats partiels, affiner.
   - POST /{offer_b_id}/mark-duplicate { duplicate_of_id, duplicate_reason? }
     → B.is_duplicate=true (statut inchangé, vérifié), B sort du scan.
     Refuse A==B et cycles (erreur serveur explicite).
   - POST /duplicates/reject { offer_a_id, offer_b_id, reason? }
     → la paire ne revient plus dans les scans (RejectedDuplicatePair).

   Seuil : 60-100, défaut 80 (doc v3). Le scan coûte cher côté serveur :
   debounce manuel — le relance se fait au relâchement du curseur,
   jamais pendant le glissement.
   ───────────────────────────────────────────────────────────────────── */

const SEUIL_DEFAUT = 80

const DoublonsPage = () => {
  const navigate = useNavigate()

  const [seuil, setSeuil] = useState(SEUIL_DEFAUT)
  const [filtreEntreprise, setFiltreEntreprise] = useState("")

  // Scan au seuil courant — staleTime 2 min dans le hook, invalidé après
  // chaque fusion/rejet (queryKey racine ["admin","offers"]).
  // NOTE: le composant Slider base-ui passe `value` comme number simple
  // quand une seule poignée (onValueChange(value: number)), et expose
  // onValueCommitted pour ne relancer le scan qu'au relâchement.
  const { data: paires, isLoading, isError, refetch, isFetching } = useAdminDoublonsQuery({
    min_similarity: seuil,
  })

  // Filtre entreprise côté client (les noms viennent des paires elles-mêmes,
  // pas d'appel supplémentaire — le param company_id existe côté serveur
  // mais nécessite un UUID que la réponse ne fournit pas).
  const pairesFiltrees = useMemo(() => {
    if (!filtreEntreprise.trim()) return paires ?? []
    const q = filtreEntreprise.trim().toLowerCase()
    return (paires ?? []).filter(
      (p) =>
        (p.offer_a_company ?? "").toLowerCase().includes(q) ||
        (p.offer_a_title ?? "").toLowerCase().includes(q) ||
        (p.offer_b_title ?? "").toLowerCase().includes(q)
    )
  }, [paires, filtreEntreprise])

  const surTraitee = () => {
    // Fusion/rejet → invalide puis refetch silencieux du scan.
    refetch()
  }

  if (isError) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <EnTete onRetour={() => navigate("/admin/offres")} />
        <SectionErreur onRetry={refetch} message="Impossible de lancer le scan de doublons." />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <EnTete onRetour={() => navigate("/admin/offres")} />

      {/* Réglages : seuil + filtre entreprise */}
      <section
        aria-label="Réglages du scan"
        className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="seuil-doublons" className="text-xs font-medium">
              Seuil de similarité
            </Label>
            <Badge variant="secondary" className="tabular-nums">{seuil}%</Badge>
          </div>
          <Slider
            id="seuil-doublons"
            value={seuil}
            onValueChange={(v) => setSeuil(typeof v === "number" ? v : v[0])}
            onValueCommitted={() => refetch()}
            min={60}
            max={100}
            step={5}
            aria-label="Seuil minimal de similarité (60 à 100)"
          />
          <p className="text-[10px] text-muted-foreground">
            Plus bas = plus de paires (et plus de faux positifs). Le scan relance quand vous relâchez le curseur.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filtre-entreprise" className="text-xs font-medium">
            Filtrer par entreprise ou titre
          </Label>
          <Input
            id="filtre-entreprise"
            type="search"
            value={filtreEntreprise}
            onChange={(e) => setFiltreEntreprise(e.target.value)}
            placeholder="Ex. transcargo…"
            className="max-w-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <SlidersHorizontal className="size-3.5" aria-hidden />
          {isLoading ? (
            <Skeleton className="h-4 w-40" />
          ) : (
            <>
              {pairesFiltrees.length} paire{pairesFiltrees.length > 1 ? "s" : ""} à examiner
              {isFetching && <span className="animate-pulse">— scan en cours…</span>}
              {filtreEntreprise && paires?.length !== pairesFiltrees.length && (
                <span>(sur {paires.length} non filtrées)</span>
              )}
            </>
          )}
        </div>
      </section>

      {/* Résultats */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : pairesFiltrees.length === 0 ? (
        filtreEntreprise ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
              <EmptyTitle>Aucune paire pour ce filtre</EmptyTitle>
              <EmptyDescription>
                Aucune paire ne correspond à « {filtreEntreprise} » au seuil de {seuil}%.
              </EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" size="sm" onClick={() => setFiltreEntreprise("")}>
              Vider le filtre
            </Button>
          </Empty>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
              <EmptyTitle>Aucun doublon potentiel</EmptyTitle>
              <EmptyDescription>
                Le scan n'a détecté aucune paire au seuil de {seuil}%. Baissez le seuil pour élargir la recherche.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )
      ) : (
        <div className="flex flex-col gap-3">
          {pairesFiltrees.map((paire) => (
            <CarteDoublon
              key={`${paire.offer_a_id}:${paire.offer_b_id}`}
              paire={paire}
              onTraitee={surTraitee}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const EnTete = ({ onRetour }) => (
  <div className="flex flex-wrap items-center gap-3">
    <Button variant="ghost" size="icon" onClick={onRetour} aria-label="Retour à la liste des offres">
      <ArrowLeft aria-hidden />
    </Button>
    <div className="flex flex-col">
      <h1 className="font-heading text-lg font-bold">Doublons à vérifier</h1>
      <p className="text-xs text-muted-foreground">
        Paires d'offres suspectes — similarité sans hash identique.
      </p>
    </div>
  </div>
)

export default DoublonsPage
