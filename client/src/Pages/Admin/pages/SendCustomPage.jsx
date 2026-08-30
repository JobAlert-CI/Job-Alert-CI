import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Loader2, MailPlus, Send } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "../components/PageHeader"
import { ConfirmDialog } from "../components/ConfirmDialog"
import { OfferPickerDialog } from "../components/OfferPickerDialog"
import { GenericStatusBadge } from "../components/StatusBadge"
import { SUBSCRIBER_STATUS_LABELS } from "@/api/admin/types"
import { extractErrorMessage } from "@/api/admin/adminAxios"
import { useAdminMutations, useSubscriberDetailSafe } from "./adminHooks"

/**
 * Page 14 — /admin/utilisateurs/:id/envoyer.
 * POST /subscribers/{id}/send (offer_ids[], subject ?).
 * Sélecteur d'offres réutilisé (visible_site=true, status=active)
 * + confirmation → retour au détail de l'abonné.
 */
export const SendCustomPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const subscriberQuery = useSubscriberDetailSafe(id)
  const m = useAdminMutations()
  const sub = subscriberQuery.data

  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedOffers, setSelectedOffers] = useState([])
  const [subject, setSubject] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (subscriberQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Chargement…
      </div>
    )
  }

  if (!sub) {
    return (
      <div className="adm-card p-10 text-center">
        <p className="text-sm font-semibold">Abonné introuvable.</p>
        <Link to="/admin/utilisateurs" className="adm-btn-outline adm-btn-sm mt-4 inline-flex">← Retour à la liste</Link>
      </div>
    )
  }

  const handleSend = async () => {
    try {
      await m.sendCustomEmailMutation.mutateAsync({ id, offerIds: selectedOffers, subject: subject || undefined })
      toast.success("Envoi programmé", `${selectedOffers.length} offre(s) mise(s) en file pour ${sub.email}.`)
      navigate(`/admin/utilisateurs/${id}`)
    } catch (error) {
      toast.error("Envoi impossible", extractErrorMessage(error))
    }
  }

  return (
    <>
      <PageHeader
        title="Envoi personnalisé"
        description={`Composez une sélection d'offres à envoyer à ${sub.email}.`}
        crumbs={[
          { label: "Accueil", to: "/admin" },
          { label: "Utilisateurs", to: "/admin/utilisateurs" },
          { label: sub.full_name ?? sub.email, to: `/admin/utilisateurs/${id}` },
          { label: "Envoyer" },
        ]}
        actions={
          <Link to={`/admin/utilisateurs/${id}`} className="adm-btn-outline">
            <ArrowLeft className="size-4" /> Retour à la fiche
          </Link>
        }
      />

      <div className="mx-auto grid max-w-3xl gap-4">
        {/* Destinataire */}
        <section className="adm-card flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold uppercase text-primary-foreground">
            {(sub.full_name ?? sub.email).slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{sub.full_name ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{sub.email}</p>
          </div>
          <GenericStatusBadge status={sub.status} labels={SUBSCRIBER_STATUS_LABELS} />
        </section>

        {/* Composition */}
        <section className="adm-card grid gap-4 p-5">
          <div>
            <label htmlFor="send-subject" className="adm-label">Sujet (optionnel)</label>
            <input
              id="send-subject"
              className="adm-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Par défaut : Sélection personnalisée JobAlert CI"
              maxLength={255}
            />
          </div>

          <div>
            <span className="adm-label">Offres à inclure *</span>
            <button type="button" className="adm-btn-outline w-full justify-between" onClick={() => setPickerOpen(true)}>
              <span className="inline-flex items-center gap-2">
                <MailPlus className="size-4" />
                Ouvrir le sélecteur d'offres
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-secondary-foreground">
                {selectedOffers.length} sélectionnée(s)
              </span>
            </button>

            {selectedOffers.length > 0 && (
              <ul className="mt-3 divide-y divide-border/70 rounded-lg border border-border">
                {selectedOffers.map((offerId) => (
                  <li key={offerId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <code className="truncate font-mono text-[11px] text-muted-foreground">{offerId}</code>
                    <button
                      type="button"
                      onClick={() => setSelectedOffers(selectedOffers.filter((x) => x !== offerId))}
                      className="text-xs font-semibold text-destructive hover:underline"
                    >
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Link to={`/admin/utilisateurs/${id}`} className="adm-btn-outline">Annuler</Link>
            <button type="button" className="adm-btn-primary" disabled={selectedOffers.length === 0} onClick={() => setConfirmOpen(true)}>
              <Send className="size-4" /> Préparer l'envoi ({selectedOffers.length})
            </button>
          </div>
        </section>
      </div>

      {/* Sélecteur d'offres réutilisé (filtre visible_site + status=active) */}
      <OfferPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSubmit={(ids) => {
          setSelectedOffers(ids)
          setPickerOpen(false)
        }}
        title="Sélectionner des offres actives et visibles"
      />

      {/* Confirmation finale → retour au détail */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSend}
        loading={m.sendCustomEmailMutation.isPending}
        title="Confirmer l'envoi personnalisé"
        message={`${selectedOffers.length} offre(s) seront mises en file d'envoi vers ${sub.email}${subject ? ` avec le sujet « ${subject} »` : ""}. L'action est journalisée.`}
        confirmText="Confirmer l'envoi"
      />
    </>
  )
}

