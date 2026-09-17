import {Mail,} from "lucide-react"
import { cn } from "cn"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,  
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SectionErreur } from "../admin/EtatsSection"

const MODE_APERCU = {
  SELECTION: "selection",
  AUTO: "auto",
}


const DialogRecapSelection = ({ apercu, apercuCharge, apercuOuvert, setApercuOuvert, selection, modeApercu, apercuErreur, setModeApercu, refetchApercu }) => {
  return (
    <Dialog
      open={apercuOuvert}
      onOpenChange={(ouvert) => !ouvert && setApercuOuvert(false)}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-4" aria-hidden="true" /> Aperçu du digest
          </DialogTitle>

          <DialogDescription>
            {apercu?.message ?? "Aperçu (non envoyé)"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          {[
            {
              mode: MODE_APERCU.SELECTION,
              libelle: "Ma sélection",
              disabled: !selection.length || apercuCharge,
            },
            {
              mode: MODE_APERCU.AUTO,
              libelle: "Selon ses filières",
              disabled: apercuCharge,
            },
          ].map(({ mode, libelle, disabled }) => (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              onClick={() => setModeApercu(mode)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors motion-reduce:transition-none",
                modeApercu === mode
                  ? "bg-primary text-on-primary"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {libelle}
            </button>
          ))}
        </div>

        {apercuCharge ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-64 w-full rounded-lg sm:h-80" />
          </div>
        ) : apercuErreur ? (
          <SectionErreur onRetry={refetchApercu} message="Aperçu indisponible — réessayez ou vérifiez la sélection." />
        ) : apercu?.preview ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Objet :{" "}
              <strong className="text-foreground">
                {apercu.preview.subject_preview}
              </strong>{" "}
              · {apercu.preview.offer_count} offre(s)
            </p>

            <iframe
              title="Aperçu du rendu de l'email"
              sandbox=""
              srcDoc={apercu.preview.html_snippet}
              className="h-64 w-full rounded-lg border border-border bg-white sm:h-80"
            />
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Aucun aperçu disponible — vérifiez la sélection.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default DialogRecapSelection