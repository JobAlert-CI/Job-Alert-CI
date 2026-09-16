import { useState } from "react"
import { Lock, Radar, RotateCw } from "lucide-react"
import {
  useTriggerScraping, messageErreurScraping, useAdminScrapingStatusQuery, useRunAdminDuJour,
} from "@/features/admin-scraping.tools"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { useNotify } from "@/contexts/Notify.context"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import CompteurCaracteres from "@/components/shared/CompteurCaracteres"


const MAX_NOTES = 1000

const DialogRunScraping = ({ dialogOuvert, setDialogOuvert }) => {
  const notify = useNotify()
  const { profile } = useAdminAuth()
  const [sourceCode, setSourceCode] = useState("")
  const [notes, setNotes] = useState("")

  const { data: sources } = useAdminScrapingStatusQuery()
  const triggerMutation = useTriggerScraping()

  /* Audit 4, C.2 : run du jour déjà déclenché par CET admin → l'option
     « toutes sources » est grisée d'avance (409 sinon). */
  const { data: runDuJour } = useRunAdminDuJour(profile?.id)
  const dejaDeclenche = !!runDuJour

  const lancerScraping = () => {
    triggerMutation.mutate(
      /* source_code vide → undefined via cleanParams → toutes les
         sources actives (sémantique serveur, cf. scraping.py). */
      { source_code: sourceCode || undefined, notes: notes.trim() || undefined },
      {
        onSuccess: (run) => {
          const nb = run?.source_runs?.length
          notify(
            nb === 1
              ? "Scraping mis en file d'attente pour 1 source — suivez son avancement ci-dessous."
              : `Scraping mis en file d'attente pour ${nb ?? "les"} source${nb > 1 ? "s" : ""} — suivez son avancement ci-dessous.`,
            "success"
          )
          setDialogOuvert(false)
        },
        onError: (err) => notify(messageErreurScraping(err), "error"),
      }
    )
  }

  return (
    <Dialog open={dialogOuvert} onOpenChange={setDialogOuvert}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-navy text-brand-orange" aria-hidden="true">
              <Radar className="size-4" />
            </span>
            Lancer un scraping
          </DialogTitle>
          <DialogDescription>
            Le scraping est mis en file d'attente puis exécuté par le worker de collecte —
            l'écran se rafraîchit automatiquement pendant l'exécution.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scraping-source">Source</Label>
            <Select value={sourceCode} onValueChange={setSourceCode}>
              <SelectTrigger id="scraping-source" className="w-full">
                <SelectValue placeholder="Toutes les sources actives" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="" disabled={dejaDeclenche}>
                  {/* Option grisée : infobulle explicative au survol
                        (audit 4, C.2 — une fois par admin et par jour). */}
                  {dejaDeclenche ? (
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex w-full cursor-help items-center gap-1.5">
                            <Lock className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                            Toutes les sources actives
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-60 text-xs">
                          Déjà déclenché aujourd'hui — une fois par administrateur et par jour.
                          Choisissez une source seule.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    "Toutes les sources actives"
                  )}
                </SelectItem>
                {(sources ?? []).map((s) => (
                  <SelectItem key={s.source_code} value={s.source_code}>
                    {s.source_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              {dejaDeclenche
                ? "Toutes sources : déjà déclenché aujourd'hui (une fois par administrateur et par jour). Lancez une source seule ou attendez demain."
                : "Les sources en pause sont exclues automatiquement (404 si aucune source active)."}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scraping-notes">Notes (optionnel)</Label>
            <Textarea
              id="scraping-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={MAX_NOTES}
              rows={3}
              placeholder="Ex. relance manuelle après correction de l'URL d'offres…"
              aria-describedby="scraping-notes-compteur"
            />
            <CompteurCaracteres id="scraping-notes-compteur" valeur={notes.length} max={MAX_NOTES} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOuvert(false)}>Annuler</Button>
          <Button
            onClick={lancerScraping}
            disabled={triggerMutation.isPending || (dejaDeclenche && !sourceCode)}
          >
            <RotateCw aria-hidden="true" className={triggerMutation.isPending ? "animate-spin" : undefined} />
            {triggerMutation.isPending ? "Mise en file…" : "Lancer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DialogRunScraping