import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Loader2, MailPlus, Save, ShieldX, UserRound } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "../components/PageHeader"
import { ConfirmDialog } from "../components/ConfirmDialog"
import { GenericStatusBadge } from "../components/StatusBadge"
import {
  SUBSCRIBER_STATUSES,
  SUBSCRIBER_STATUS_LABELS,
} from "@/api/admin/types"
import { extractErrorMessage } from "@/api/admin/adminAxios"
import {
  useAdminMutations,
  useFilieresSafe,
  useSubscriberDetailSafe,
  useSubscriberSendsSafe,
} from "./adminHooks"

/**
 * Page 11 — /admin/utilisateurs/:id.
 * GET/PUT /{id} (nom, ville, notes internes, préférence conseils) ·
 * PATCH /{id}/status · GET /{id}/sends (historique) ·
 * DELETE /{id} = ANONYMISATION RGPD → texte de confirmation explicite.
 * Filières en lecture seule + lien vers l'envoi personnalisé.
 */
export const UserDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const subscriberQuery = useSubscriberDetailSafe(id)
  const sendsQuery = useSubscriberSendsSafe(id)
  const filieresQuery = useFilieresSafe()
  const m = useAdminMutations()

  const sub = subscriberQuery.data
  const filieres = filieresQuery.data || []
  const sends = sendsQuery.data || []

  const [draft, setDraft] = useState(null)
  const [confirmAnonymize, setConfirmAnonymize] = useState(false)

  useEffect(() => {
    if (!sub) return
    setDraft({
      full_name: sub.full_name ?? "",
      city: sub.city ?? "",
      admin_notes: sub.admin_notes ?? "",
      wants_career_tips: Boolean(sub.wants_career_tips),
    })
  }, [sub])

  if (subscriberQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Chargement de la fiche…
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

  const filiereLabel = (filiereIdOrCode) =>
    filieres.find((f) => f.id === filiereIdOrCode || f.code === filiereIdOrCode)?.label ?? filiereIdOrCode

  const handleSave = async () => {
    try {
      await m.updateSubscriberMutation.mutateAsync({ id, data: draft })
      toast.success("Fiche mise à jour", draft.full_name || sub.email)
    } catch (error) {
      toast.error("Enregistrement impossible", extractErrorMessage(error))
    }
  }

  const handleStatusChange = async (status) => {
    if (status === sub.status) return
    try {
      await m.updateSubscriberStatusMutation.mutateAsync({ id, status })
      toast.success("Statut mis à jour", SUBSCRIBER_STATUS_LABELS[status])
    } catch (error) {
      toast.error("Changement impossible", extractErrorMessage(error))
    }
  }

  const handleAnonymize = async () => {
    try {
      await m.anonymizeSubscriberMutation.mutateAsync(id)
      toast.success("Abonné anonymisé", "Les données personnelles ont été effacées (RGPD).")
      navigate("/admin/utilisateurs", { replace: true })
    } catch (error) {
      toast.error("Anonymisation impossible", extractErrorMessage(error))
    } finally {
      setConfirmAnonymize(false)
    }
  }

  return (
    <>
      <PageHeader
        title={sub.full_name ?? sub.email}
        description={`Abonné depuis le ${new Date(sub.subscribed_at).toLocaleDateString("fr-FR")} · source : ${sub.source ?? "site"}`}
        crumbs={[
          { label: "Accueil", to: "/admin" },
          { label: "Utilisateurs", to: "/admin/utilisateurs" },
          { label: sub.full_name ?? sub.email },
        ]}
        actions={
          <Link to={`/admin/utilisateurs/${id}/envoyer`} className="adm-btn-primary">
            <MailPlus className="size-4" /> Envoi personnalisé
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Fiche éditable */}
        <div className="flex flex-col gap-4">
          <section className="adm-card grid gap-3 p-5 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg bg-surface-container px-4 py-3 sm:col-span-2">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold uppercase text-primary-foreground">
                {(sub.full_name ?? sub.email).slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{sub.email}</p>
                <p className="text-xs text-muted-foreground">{sub.timezone}</p>
              </div>
              <GenericStatusBadge status={sub.status} labels={SUBSCRIBER_STATUS_LABELS} />
            </div>

            {draft && (
              <>
                <div>
                  <label htmlFor="sub-name" className="adm-label">Nom complet</label>
                  <input id="sub-name" className="adm-input" value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} placeholder="Prénom Nom" />
                </div>
                <div>
                  <label htmlFor="sub-city" className="adm-label">Ville</label>
                  <input id="sub-city" className="adm-input" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="Ex : Abidjan" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="sub-notes" className="adm-label">Notes internes</label>
                  <textarea id="sub-notes" rows={3} className="adm-input" value={draft.admin_notes} onChange={(e) => setDraft({ ...draft, admin_notes: e.target.value })} placeholder="Notes visibles uniquement par l'administration…" />
                </div>
                <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.wants_career_tips}
                      onChange={(e) => setDraft({ ...draft, wants_career_tips: e.target.checked })}
                      className="size-4 accent-[var(--primary)]"
                    />
                    Reçoit les conseils carrière du jour
                  </label>
                  <button type="button" className="adm-btn-danger adm-btn-sm" onClick={() => setConfirmAnonymize(true)}>
                    <ShieldX className="size-3.5" /> Anonymiser (RGPD)
                  </button>
                </div>
                <div className="sm:col-span-2">
                  <button type="button" className="adm-btn-primary adm-btn-sm" onClick={handleSave} disabled={m.updateSubscriberMutation.isPending}>
                    {m.updateSubscriberMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                    Enregistrer la fiche
                  </button>
                </div>
              </>
            )}
          </section>

          {/* Historique des envois */}
          <section className="adm-card overflow-hidden">
            <header className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-bold">Historique des envois ({sends.length})</h2>
            </header>
            {sendsQuery.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="adm-skeleton-line h-8 w-full" />
                ))}
              </div>
            ) : sends.length === 0 ? (
              <p className="px-5 py-6 text-center text-xs text-muted-foreground">Aucun envoi enregistré pour cet abonné.</p>
            ) : (
              <ul className="divide-y divide-border/70">
                {sends.map((send) => (
                  <li key={send.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{send.subject ?? "Digest quotidien"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(send.sent_at || send.scheduled_for || send.digest_date).toLocaleString("fr-FR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                        {" · "}
                        {send.offer_count} offre(s)
                      </p>
                    </div>
                    <GenericStatusBadge status={send.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Colonne latérale */}
        <div className="flex flex-col gap-4">
          <section className="adm-card p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Statut de l'abonnement</h2>
            <select value={sub.status} onChange={(e) => handleStatusChange(e.target.value)} className="adm-input" aria-label="Changer le statut">
              {SUBSCRIBER_STATUSES.map((s) => (
                <option key={s} value={s}>{SUBSCRIBER_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Le changement est immédiat et journalisé dans le journal d'activité.
            </p>
          </section>

          <section className="adm-card p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <UserRound className="size-3.5" /> Filières suivies (lecture)
            </h2>
            {(sub.filiere_links?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune filière sélectionnée.</p>
            ) : (
              <ol className="space-y-1.5">
                {sub.filiere_links.map((link) => (
                  <li key={link.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <span className="min-w-0 truncate font-medium">{filiereLabel(link.filiere_id)}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">priorité {link.priority}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">
              Les filières se modifient par l'abonné via son lien de gestion (token email).
            </p>
          </section>
        </div>
      </div>

      {/* Confirmation anonymisation RGPD — texte explicite */}
      <ConfirmDialog
        open={confirmAnonymize}
        onClose={() => setConfirmAnonymize(false)}
        onConfirm={handleAnonymize}
        loading={m.anonymizeSubscriberMutation.isPending}
        tone="danger"
        title="Anonymiser définitivement cet abonné ?"
        message={`Conformément au RGPD, « ${sub.email} » sera irréversiblement anonymisé : email remplacé par une adresse générique, nom effacé, ville et notes internes supprimées. L'historique d'envoi reste conservé sous forme agrégée. Cette action ne peut pas être annulée.`}
        confirmText="Anonymiser (RGPD)"
      />
    </>
  )
}


