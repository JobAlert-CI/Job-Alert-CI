import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { dateHeure } from "@/lib/dates"

const DialogMessageDetail = ({ detail, setDetail }) => {
  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) setDetail(null) }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Message de {detail.full_name}</DialogTitle>
          <DialogDescription>
            Reçu le {dateHeure(detail.created_at)} · {detail.subject_label}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{detail.message}</p>
          <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground">
            <p><span className="font-medium text-foreground">Email :</span> {detail.email}</p>
            {detail.user_agent && (
              <p className="truncate" title={detail.user_agent}>
                <span className="font-medium text-foreground">User-agent :</span> {detail.user_agent}
              </p>
            )}
            {detail.ip_hash && (
              <p className="truncate font-mono text-[10px]" title={detail.ip_hash}>
                <span className="font-medium text-foreground">IP (hashée) :</span> {detail.ip_hash}
              </p>
            )}
            {detail.replied_at && (
              <p><span className="font-medium text-foreground">Répondu le :</span> {dateHeure(detail.replied_at)}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default DialogMessageDetail