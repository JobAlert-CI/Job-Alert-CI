import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRightLeft, Merge } from "lucide-react"
import {
  useAdminCompaniesQuery, useFusionnerEntreprises, messageErreurCompany,
} from "@/features/admin-entreprises.tools"
import { useNotify } from "@/contexts/Notify.context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"


const DialogFusionEntreprises = ({ ouvert, onFermer, sourcePreselect }) => {
  const notify = useNotify()
  const [sourceId, setSourceId] = useState(sourcePreselect?.id ?? "")
  const [targetId, setTargetId] = useState("")
  const [confirme, setConfirme] = useState(false)
  // Verrou de confirmation : nom de la source à recopier exactement.
  const [confirmationNom, setConfirmationNom] = useState("")

  const { data: entreprises } = useAdminCompaniesQuery({ limit: 200 })
  const fusionMutation = useFusionnerEntreprises()

  const source = entreprises?.find((c) => c.id === sourceId)
  const target = entreprises?.find((c) => c.id === targetId)
  const options = (exclu) => (entreprises ?? []).filter((c) => c.id !== exclu)

  const reinitialiser = () => {
    setSourceId(sourcePreselect?.id ?? "")
    setTargetId("")
    setConfirme(false)
    setConfirmationNom("")
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

  const pretPourConfirmation = source && target && source.id !== target.id
  const offresDeplacees = source?.active_offers_count ?? 0
  const nomValide = !!source && confirmationNom.trim().toLowerCase() === source.name.trim().toLowerCase()

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

        {/* ─── Étapes animées : choix → confirmation ─── */}
        <AnimatePresence mode="wait" initial={false}>
          {!confirme ? (
            <motion.div
              key="choix"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex flex-col gap-4 motion-reduce:transition-none"
            >
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
                <Button size="sm" onClick={() => pretPourConfirmation && setConfirme(true)} disabled={!pretPourConfirmation}>
                  Continuer
                </Button>
              </DialogFooter>
            </motion.div>
          ) : (
            <motion.div
              key="confirmation"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex flex-col gap-4 motion-reduce:transition-none"
            >
              {/* Impact AVANT validation (doc v3 §6) */}
              <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Source (absorbée) :</span>{" "}
                  <strong>{source.name}</strong>
                </p>
                <p className="flex items-center gap-1.5">
                  <ArrowRightLeft className="size-3.5 text-muted-foreground" aria-hidden />
                  <span className="text-muted-foreground">Cible (conservée) :</span>{" "}
                  <strong>{target.name}</strong>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={offresDeplacees > 0 ? "destructive" : "secondary"} className="tabular-nums">
                    {offresDeplacees} offre{offresDeplacees > 1 ? "s" : ""} active{offresDeplacees > 1 ? "s" : ""} réattribuée{offresDeplacees > 1 ? "s" : ""}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    changeront de propriétaire silencieusement.
                  </span>
                </div>
              </div>

              {/* Verrou : recopier le nom de la source pour déverrouiller. */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fusion-nom">
                  Saisissez <span className="font-mono font-semibold">« {source.name} »</span> pour déverrouiller la confirmation
                </Label>
                <Input
                  id="fusion-nom"
                  value={confirmationNom}
                  onChange={(e) => setConfirmationNom(e.target.value)}
                  placeholder={source.name}
                  autoComplete="off"
                  aria-describedby="fusion-nom-aide"
                />
                <p id="fusion-nom-aide" className="text-[10px] text-muted-foreground">
                  Protection contre une fusion accidentelle : l'action est journalisée dans l'audit et la
                  source est désactivée (soft-delete), pas effacée.
                </p>
              </div>

              <DialogFooter>
                <Button variant="ghost" size="sm" onClick={() => setConfirme(false)}>Retour</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={fusionner}
                  disabled={fusionMutation.isPending || !nomValide}
                >
                  {fusionMutation.isPending ? <Spinner /> : <ArrowRightLeft aria-hidden />}
                  {fusionMutation.isPending ? "Fusion en cours…" : "Confirmer la fusion"}
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}

export default DialogFusionEntreprises