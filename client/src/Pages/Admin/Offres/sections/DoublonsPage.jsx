import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Inbox, SearchX, SlidersHorizontal, Loader2 } from "lucide-react"
import { useAdminDoublonsQuery } from "@/features/admin-offres.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { SectionErreur } from "../components/EtatsSection"
import CarteDoublon from "../components/CarteDoublon"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"

const SEUIL_DEFAUT = 80

/* Skeleton fidèle à CarteDoublon : en-tête, comparaison A|B, actions. */
const SkeletonCarteDoublon = () => (
  <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-hidden="true">
    <div className="flex items-center gap-2">
      <Skeleton className="h-5 w-24 rounded-full" />
      <Skeleton className="h-3 w-32" />
      <Skeleton className="ml-auto h-3 w-40" />
    </div>
    <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
      <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="mx-auto size-4 rounded" />
      <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
    <div className="flex justify-end gap-2">
      <Skeleton className="h-8 w-44 rounded-md" />
      <Skeleton className="h-8 w-28 rounded-md" />
    </div>
  </div>
)

const DoublonsPage = () => {
  const navigate = useNavigate()
  const [seuil, setSeuil] = useState(SEUIL_DEFAUT)
  const [filtreEntreprise, setFiltreEntreprise] = useState("")
  // true pendant le glissement → badge du seuil « tactile ».
  const [enGlissement, setEnGlissement] = useState(false)

  const { data: paires, isLoading, isError, refetch, isFetching } = useAdminDoublonsQuery({
    min_similarity: seuil,
  })

  // Filtre entreprise côté client (les noms viennent des paires elles-mêmes).
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

  // Fusion/rejet → invalide puis refetch silencieux du scan : les cartes
  // traitées sortent en animation, les suivantes remontent via `layout`.
  const surTraitee = () => refetch()

  if (isError) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <EnTete onRetour={() => navigate("/admin/offres")} />
        <SectionErreur onRetry={refetch} message="Impossible de lancer le scan de doublons." />
      </div>
    )
  }

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <Bloc>
        <EnTete onRetour={() => navigate("/admin/offres")} />

        {/* ─── Réglages : seuil + filtre entreprise ─── */}
        <SectionCardAdmin
          title="Réglages du scan"
          description="Plus le seuil est bas, plus il y a de paires — et de faux positifs."
          icon={SlidersHorizontal}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="seuil-doublons" className="text-xs font-medium">
                  Seuil de similarité
                </Label>
                {/* Badge « tactile » : grossit + passe en couleur pendant le
                  glissement, puis relance le scan au relâchement. */}
                <motion.span
                  animate={{ scale: enGlissement ? 1.12 : 1 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="motion-reduce:transition-none"
                >
                  <Badge variant={enGlissement ? "default" : "secondary"} className="tabular-nums">
                    {seuil}%
                  </Badge>
                </motion.span>
              </div>
              <Slider
                id="seuil-doublons"
                value={seuil}
                onValueChange={(v) => {
                  setSeuil(typeof v === "number" ? v : v[0])
                  setEnGlissement(true)
                }}
                onValueCommitted={() => {
                  setEnGlissement(false)
                  refetch()
                }}
                min={60}
                max={100}
                step={5}
                aria-label="Seuil minimal de similarité (60 à 100)"
              />
              <p className="text-[10px] text-muted-foreground">
                Le scan relance quand vous relâchez le curseur — pas pendant le glissement.
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
                className="h-8 max-w-sm text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
              {isLoading ? (
                <Skeleton className="h-4 w-40" />
              ) : (
                <>
                  <span className="tabular-nums">
                    {pairesFiltrees.length} paire{pairesFiltrees.length > 1 ? "s" : ""} à examiner
                  </span>
                  {isFetching && (
                    <span className="flex items-center gap-1">
                      <Loader2 className="size-3 animate-spin" aria-hidden /> scan en cours…
                    </span>
                  )}
                  {filtreEntreprise && paires?.length !== pairesFiltrees.length && (
                    <span className="tabular-nums">(sur {paires.length} non filtrées)</span>
                  )}
                </>
              )}
            </div>
          </div>
        </SectionCardAdmin>

        {/* ─── Résultats : sortie animée des paires traitées ─── */}
        {isLoading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            {[...Array(4)].map((_, i) => <SkeletonCarteDoublon key={i} />)}
          </div>
        ) : pairesFiltrees.length === 0 ? (
          filtreEntreprise ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50">
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
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card/50">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
                  <EmptyTitle>Aucun doublon potentiel</EmptyTitle>
                  <EmptyDescription>
                    Le scan n'a détecté aucune paire au seuil de {seuil}%. Baissez le seuil pour élargir la recherche.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          )
        ) : (
          <AnimatePresence mode="popLayout">
            {pairesFiltrees.map((paire) => (
              <CarteDoublon
                key={`${paire.offer_a_id}:${paire.offer_b_id}`}
                paire={paire}
                onTraitee={surTraitee}
              />
            ))}
          </AnimatePresence>
        )}
      </Bloc>
    </motion.div>
  )
}

const EnTete = ({ onRetour }) => (
  <div className="flex flex-wrap items-center gap-3">
    <Button variant="ghost" size="icon" onClick={onRetour} aria-label="Retour à la liste des offres">
      <ArrowLeft aria-hidden />
    </Button>
    <div className="flex flex-col">
      <h1 className="font-heading text-lg font-bold tracking-tight">Doublons à vérifier</h1>
      <p className="text-xs text-muted-foreground">
        Paires d'offres suspectes — similarité sans hash identique.
      </p>
    </div>
  </div>
)

export default DoublonsPage