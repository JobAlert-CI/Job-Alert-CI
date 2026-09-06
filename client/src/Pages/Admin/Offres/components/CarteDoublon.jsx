import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeftRight, Check, X } from "lucide-react"
import {
  useMarquerDoublon, useRejeterDoublon, messageErreurMutation,
} from "@/features/admin-offres.tools"
import { useNotify } from "@/contexts/Notify.context"
import { ApercuOffre, BoutonApercu } from "@/components/admin/ApercuOffre"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

/* ─────────────────────────────────────────────────────────────────────
   Carte d'une paire de doublons potentiels.

   Shape (vérifiée API live) : { offer_a_id, offer_b_id, offer_a_title,
   offer_b_title, offer_a_company, similarity_score, reason }.

   Interactions (doc v3 §5) :
   - « Fusionner » = marque B comme doublon de A, motif optionnel →
     dialog de confirmation (action semi-destructive : B quitte le
     scan et n'apparaît plus comme candidat, mais reste en base avec
     son statut — is_duplicate=true, vérifié live) ;
   - « Ce n'est pas un doublon » = rejet simple, la paire ne
     réapparaîtra plus (table RejectedDuplicatePair) ;
   - liens vers les fiches A et B pour comparaison manuelle.
   ───────────────────────────────────────────────────────────────────── */

const CarteDoublon = ({ paire, onTraitee }) => {
  const notify = useNotify()
  const [dialogOuvert, setDialogOuvert] = useState(false)
  const [motif, setMotif] = useState("")
  const [apercuOffreId, setApercuOffreId] = useState(null)

  const marquerMutation = useMarquerDoublon()
  const rejeterMutation = useRejeterDoublon()

  const score = paire.similarity_score ?? 0

  const fusionner = () => {
    marquerMutation.mutate(
      { offerBId: paire.offer_b_id, duplicateOfId: paire.offer_a_id, raison: motif.trim() || undefined },
      {
        onSuccess: (res) => {
          notify(res?.message || "Offre marquée comme doublon", "success")
          setDialogOuvert(false)
          onTraitee?.()
        },
        onError: (err) => notify(messageErreurMutation(err) || "Fusion impossible", "error"),
      }
    )
  }

  const rejeter = () => {
    rejeterMutation.mutate(
      { offerAId: paire.offer_a_id, offerBId: paire.offer_b_id },
      {
        onSuccess: (res) => {
          notify(res?.message || "Paire rejetée — elle ne reviendra plus dans les scans", "success")
          onTraitee?.()
        },
        onError: (err) => notify(messageErreurMutation(err) || "Rejet impossible", "error"),
      }
    )
  }

  const mutationEnCours = marquerMutation.isPending || rejeterMutation.isPending

  return (
    <article
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      data-testid="paire-doublon"
    >
      {/* En-tête : score + entreprise + raison */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={score >= 90 ? "destructive" : score >= 80 ? "default" : "secondary"}
          className="tabular-nums"
        >
          {score}% similaire
        </Badge>
        <span className="text-xs font-medium text-muted-foreground">
          {paire.offer_a_company || "Entreprise inconnue"}
        </span>
        <span className="ml-auto flex items-center gap-1 truncate text-[10px] text-muted-foreground/70" title={paire.reason}>
          {paire.reason}
        </span>
      </div>

      {/* Comparaison A | B */}
      <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 p-2.5">
          <span className="text-[9px] font-bold tracking-wider text-muted-foreground/70 uppercase">Offre A (conservee)</span>
          <div className="flex items-center gap-1.5">
            <BoutonApercu
              onClick={() => setApercuOffreId(paire.offer_a_id)}
              libelle={`Aperçu de ${paire.offer_a_title}`}
            />
            <Link
              to={`/admin/offres/${paire.offer_a_id}`}
              className="truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
              title={paire.offer_a_title}
            >
              {paire.offer_a_title}
            </Link>
          </div>
        </div>
        <div className="flex items-center justify-center text-muted-foreground/50" aria-hidden>
          <ArrowLeftRight className="size-4" />
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 p-2.5">
          <span className="text-[9px] font-bold tracking-wider text-muted-foreground/70 uppercase">Offre B (candidate au doublon)</span>
          <div className="flex items-center gap-1.5">
            <BoutonApercu
              onClick={() => setApercuOffreId(paire.offer_b_id)}
              libelle={`Aperçu de ${paire.offer_b_title}`}
            />
            <Link
              to={`/admin/offres/${paire.offer_b_id}`}
              className="truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
              title={paire.offer_b_title}
            >
              {paire.offer_b_title}
            </Link>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={rejeter}
          disabled={mutationEnCours}
        >
          <Check aria-hidden /> Ce n'est pas un doublon
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setDialogOuvert(true)}
          disabled={mutationEnCours}
        >
          <X aria-hidden /> Fusionner
        </Button>
      </div>

      {/* Confirmation fusion (motif optionnel) */}
      <Dialog open={dialogOuvert} onOpenChange={setDialogOuvert}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Marquer comme doublon ?</DialogTitle>
            <DialogDescription>
              « {paire.offer_b_title} » sera marquée comme doublon de « {paire.offer_a_title} ».
              L'offre B reste en base mais n'apparaîtra plus dans les scans de doublons.
              Vous pourrez toujours la retrouver dans la liste des offres.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            {/* Motif optionnel (doc v3 §5 : champ de motif optionnel) */}
            <Input
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Motif (optionnel) — ex. même poste reposté"
              maxLength={255}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOuvert(false)}>
              Annuler
            </Button>
            <Button variant="destructive" size="sm" onClick={fusionner} disabled={marquerMutation.isPending}>
              {marquerMutation.isPending ? "Marquage…" : "Marquer comme doublon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aperçu rapide de l'offre A ou B (comparaison avant décision) */}
      <ApercuOffre
        ouvert={!!apercuOffreId}
        onOpenChange={(o) => !o && setApercuOffreId(null)}
        offerId={apercuOffreId}
      />
    </article>
  )
}

export default CarteDoublon
