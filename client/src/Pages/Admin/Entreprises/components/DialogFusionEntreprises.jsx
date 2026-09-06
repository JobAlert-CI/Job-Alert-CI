import { useState } from "react"
import { ArrowRightLeft, Merge } from "lucide-react"
import {
  useAdminCompaniesQuery, useFusionnerEntreprises, messageErreurCompany,
} from "@/features/admin-entreprises.tools"
import { useNotify } from "@/contexts/Notify.context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

/* ─────────────────────────────────────────────────────────────────────
   Dialog de fusion de deux entreprises en doublon.

   Contrat POST /companies/{target_id}/merge/{source_id} (vérifié) :
   réattribue TOUTES les offres de `source` vers `target` puis
   soft-delete la source. Réponse { message, offers_reassigned }.

   Doc v3 §6, point d'attention : la fusion est un fort impact
   silencieux (des dizaines d'offres changent de propriétaire) —
   l'écran DOIT montrer le nombre d'offres qui vont être déplacées
   AVANT de valider, pas seulement après. Les compteurs affichés
   viennent de la liste (active_offers_count, chargée au passage).

   Garde-fous : source ≠ target, réaffichage des noms complets avant
   validation, double étape (choix → confirmation).
   ───────────────────────────────────────────────────────────────────── */

const DialogFusionEntreprises = ({ ouvert, onFermer, sourcePreselect }) => {
  const notify = useNotify()
  const [sourceId, setSourceId] = useState(sourcePreselect?.id ?? "")
  const [targetId, setTargetId] = useState("")
  const [confirme, setConfirme] = useState(false)

  // Liste pour les sélecteurs + les compteurs d'offres AVANT fusion.
  const { data: entreprises } = useAdminCompaniesQuery({ limit: 200 })

  const fusionMutation = useFusionnerEntreprises()

  const source = entreprises?.find((c) => c.id === sourceId)
  const target = entreprises?.find((c) => c.id === targetId)

  const options = (exclu) => (entreprises ?? []).filter((c) => c.id !== exclu)

  const reinitialiser = () => {
    setSourceId(sourcePreselect?.id ?? "")
    setTargetId("")
    setConfirme(false)
  }

  const fermer = () => {
    reinitialiser()
    onFermer()
  }

  const fusionner = async () => {
    try {
      const res = await fusionMutation.mutateAsync({ targetId: target.id, sourceId: source.id })
      notify(res?.message || `Fusion terminée — ${res?.offers_reassigned ?? 0} offre(s) réattribuée(s)`, "success")
      fermer()
    } catch (err) {
      notify(messageErreurCompany(err) || "Fusion impossible", "error")
    }
  }

  // Étape 2 : écran de confirmation avec comptes AVANT validation.
  const pretPourConfirmation = source && target && source.id !== target.id
  const offresDeplacees = source?.active_offers_count ?? 0

  return (
    <Dialog open={ouvert} onOpenChange={(o) => { if (!o) fermer(); else reinitialiser() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="size-4" aria-hidden /> Fusionner deux entreprises
          </DialogTitle>
          <DialogDescription>
            Les offres de l'entreprise source sont réattribuées à l'entreprise cible, puis la source est
            désactivée. Utilisé pour les doublons de nommage (« Orange CI » vs « ORANGE CI SA »).
          </DialogDescription>
        </DialogHeader>

        {!confirme ? (
          /* Étape 1 : choix des deux entreprises */
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Entreprise à conserver (cible)</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir l'entreprise cible" />
                </SelectTrigger>
                <SelectContent>
                  {options(sourceId).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.active_offers_count} active{c.active_offers_count > 1 ? "s" : ""})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Entreprise à absorber (source — désactivée après)</Label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir l'entreprise source" />
                </SelectTrigger>
                <SelectContent>
                  {options(targetId).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.active_offers_count} active{c.active_offers_count > 1 ? "s" : ""})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={fermer}>Annuler</Button>
              <Button
                size="sm"
                onClick={() => pretPourConfirmation && setConfirme(true)}
                disabled={!pretPourConfirmation}
              >
                Continuer
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* Étape 2 : confirmation avec compte d'offres AVANT validation (doc v3 §6) */
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="font-medium">
                <span className="text-muted-foreground">Source (absorbée) :</span> {source.name}
              </p>
              <p className="font-medium">
                <span className="text-muted-foreground">Cible (conservée) :</span> {target.name}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant={offresDeplacees > 0 ? "destructive" : "secondary"} className="tabular-nums">
                  {offresDeplacees} offre{offresDeplacees > 1 ? "s" : ""} active{offresDeplacees > 1 ? "s" : ""} réattribuée{offresDeplacees > 1 ? "s" : ""}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  changeront de propriétaire silencieusement.
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Cette action est journalisée dans l'audit. La source sera désactivée (soft-delete), pas
              effacée — l'opération reste traçable.
            </p>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setConfirme(false)}>Retour</Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={fusionner}
                disabled={fusionMutation.isPending}
              >
                {fusionMutation.isPending ? <Spinner /> : <ArrowRightLeft aria-hidden />}
                {fusionMutation.isPending ? "Fusion en cours…" : "Confirmer la fusion"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default DialogFusionEntreprises
