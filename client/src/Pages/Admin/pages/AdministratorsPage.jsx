import { useMemo, useState } from "react"
import { Loader2, PlusCircle, Search, ShieldCheck, Trash2, UserCog } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "../components/PageHeader"
import { DataTable } from "../components/DataTable"
import { ConfirmDialog } from "../components/ConfirmDialog"
import { StatusBadge } from "../components/StatusBadge"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { ADMIN_ROLE_LABELS, ADMIN_ROLES } from "@/api/admin/types"
import { extractErrorMessage } from "@/api/admin/adminAxios"
import { useAdminAdminsSafe, useSafeMutations } from "./adminHooks"
const EMPTY_FORM = { full_name: "", email: "", password: "", role: ADMIN_ROLES.MODERATOR }

/**
 * Page 3 — /admin/administrateurs (super_admin).
 * GET (filtres role, is_active) · POST · PATCH /{id}/role · PATCH /{id}/status
 * · DELETE /{id}. Actions désactivées sur soi-même.
 */
export const AdministratorsPage = () => {
  const { user: me } = useAdminAuth()
  const [roleFilter, setRoleFilter] = useState("")
  const [activeFilter, setActiveFilter] = useState("")
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const LIMIT = 20

  const params = useMemo(
    () => ({
      role: roleFilter || undefined,
      is_active: activeFilter === "" ? undefined : activeFilter === "true",
      limit: LIMIT,
      offset,
    }),
    [roleFilter, activeFilter, offset]
  )

  const adminsQuery = useAdminAdminsSafe(params)
  const m = useSafeMutations()
  const allAdmins = adminsQuery.data || []
  const rows = search
    ? allAdmins.filter(
        (a) =>
          a.full_name?.toLowerCase().includes(search.toLowerCase()) ||
          a.email?.toLowerCase().includes(search.toLowerCase())
      )
    : allAdmins

  /* Formulaire création */
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  /* Confirmations */
  const [confirmState, setConfirmState] = useState(null) // { type: "delete" | "toggle", admin }

  const closeForm = () => {
    setFormOpen(false)
    setForm(EMPTY_FORM)
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    try {
      await m.createAdminMutation.mutateAsync(form)
      toast.success("Administrateur créé", `${form.full_name} peut désormais se connecter.`)
      closeForm()
    } catch (error) {
      toast.error("Création impossible", extractErrorMessage(error))
    }
  }

  const handleRoleChange = async (admin, role) => {
    if (role === admin.role || admin.id === me?.id) return
    try {
      await m.updateAdminRoleMutation.mutateAsync({ id: admin.id, role })
      toast.success("Rôle mis à jour", `${admin.full_name} est maintenant ${ADMIN_ROLE_LABELS[role]}.`)
    } catch (error) {
      toast.error("Changement de rôle impossible", extractErrorMessage(error))
    }
  }

  const confirmAction = async () => {
    if (!confirmState) return
    const { type, admin } = confirmState
    try {
      if (type === "delete") {
        await m.deleteAdminMutation.mutateAsync(admin.id)
        toast.success("Compte supprimé", `Le compte de ${admin.full_name} a été supprimé définitivement.`)
      } else {
        await m.toggleAdminStatusMutation.mutateAsync(admin.id)
        toast.success(
          admin.is_active ? "Compte désactivé" : "Compte réactivé",
          `${admin.full_name} — accès ${admin.is_active ? "révoqué" : "restauré"}.`
        )
      }
    } catch (error) {
      toast.error("Action impossible", extractErrorMessage(error))
    } finally {
      setConfirmState(null)
    }
  }

  const columns = [
    {
      key: "full_name",
      header: "Administrateur",
      render: (a) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {a.full_name}
            {a.id === me?.id && (
              <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase text-secondary-foreground">
                vous
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">{a.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Rôle",
      render: (a) => {
        const isSelf = a.id === me?.id
        return (
          <select
            className="adm-input h-8 w-full max-w-52 text-xs"
            value={a.role}
            disabled={isSelf}
            title={isSelf ? "Vous ne pouvez pas modifier votre propre rôle" : undefined}
            onChange={(e) => handleRoleChange(a, e.target.value)}
          >
            {Object.entries(ADMIN_ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        )
      },
    },
    {
      key: "is_active",
      header: "Statut",
      render: (a) => (
        <StatusBadge status={a.is_active ? "active" : "inactive"} label={a.is_active ? "Actif" : "Inactif"} />
      ),
    },
    {
      key: "last_login_at",
      header: "Dernière connexion",
      className: "hidden md:table-cell",
      render: (a) => (
        <span className="text-xs text-muted-foreground">
          {a.last_login_at
            ? new Date(a.last_login_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
            : "Jamais"}
        </span>
      ),
    },
  ]

  /* Menu contextuel de ligne — actions désactivées sur son propre compte */
  const rowActions = (a) => {
    const isSelf = a.id === me?.id
    return [
      {
        key: "toggle",
        label: a.is_active ? "Désactiver le compte" : "Réactiver le compte",
        icon: UserCog,
        disabled: isSelf,
        title: isSelf ? "Action interdite sur votre propre compte" : undefined,
        onClick: () => setConfirmState({ type: "toggle", admin: a }),
      },
      {
        key: "delete",
        label: "Supprimer le compte",
        icon: Trash2,
        danger: true,
        disabled: isSelf,
        title: isSelf ? "Action interdite sur votre propre compte" : undefined,
        onClick: () => setConfirmState({ type: "delete", admin: a }),
      },
    ]
  }

  return (
    <>
      <PageHeader
        title="Administrateurs"
        description="Gestion des comptes du back-office : rôles, activation et suppression."
        crumbs={[{ label: "Accueil", to: "/admin" }, { label: "Administrateurs" }]}
        actions={
          <button type="button" className="adm-btn-primary" onClick={() => setFormOpen(true)}>
            <PlusCircle className="size-4" /> Nouvel administrateur
          </button>
        }
      />

      {/* Filtres */}
      <section className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="  Rechercher un nom ou email…"
            className="adm-input pl-9"
          />
        </div>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setOffset(0) }} className="adm-input w-auto">
          <option value="">Tous les rôles</option>
          {Object.entries(ADMIN_ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value); setOffset(0) }} className="adm-input w-auto">
          <option value="">Tous les statuts</option>
          <option value="true">Actifs</option>
          <option value="false">Inactifs</option>
        </select>
      </section>

      <DataTable
        columns={columns}
        rows={rows}
        rowActions={rowActions}
        loading={adminsQuery.isLoading}
        error={adminsQuery.error}
        onRetry={() => adminsQuery.refetch()}
        emptyLabel="Aucun administrateur"
        emptyHint="Ajustez les filtres ou créez un nouveau compte."
        limit={LIMIT}
        offset={offset}
        onOffsetChange={setOffset}
      />

      {/* Formulaire de création */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" onClick={closeForm}>
          <form className="adm-card w-full max-w-md p-6 shadow-hover" onSubmit={handleCreate} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading text-base font-bold">Nouvel administrateur</h3>

            <div className="mt-4 grid gap-3">
              <div>
                <label htmlFor="adm-name" className="adm-label">Nom complet</label>
                <input id="adm-name" required minLength={2} className="adm-input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Prénom Nom" />
              </div>
              <div>
                <label htmlFor="adm-email" className="adm-label">Email</label>
                <input id="adm-email" required type="email" className="adm-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="prenom@jobalert.ci" />
              </div>
              <div>
                <label htmlFor="adm-password" className="adm-label">Mot de passe provisoire</label>
                <input id="adm-password" required minLength={8} type="text" className="adm-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8 caractères minimum" />
              </div>
              <div>
                <label htmlFor="adm-role" className="adm-label">Rôle</label>
                <select id="adm-role" className="adm-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {Object.entries(ADMIN_ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="adm-btn-outline" onClick={closeForm}>Annuler</button>
              <button type="submit" className="adm-btn-primary" disabled={m.createAdminMutation.isPending}>
                {m.createAdminMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Créer le compte
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation suppression / activation */}
      <ConfirmDialog
        open={Boolean(confirmState)}
        onClose={() => setConfirmState(null)}
        onConfirm={confirmAction}
        loading={m.deleteAdminMutation.isPending || m.toggleAdminStatusMutation.isPending}
        tone={confirmState?.type === "delete" ? "danger" : "primary"}
        title={
          confirmState?.type === "delete"
            ? `Supprimer ${confirmState?.admin?.full_name} ?`
            : confirmState?.admin?.is_active
              ? `Désactiver ${confirmState?.admin?.full_name} ?`
              : `Réactiver ${confirmState?.admin?.full_name} ?`
        }
        message={
          confirmState?.type === "delete"
            ? "Suppression définitive du compte administrateur. Cette action est journalisée."
            : confirmState?.admin?.is_active
              ? "Le compte ne pourra plus se connecter tant qu'il n'est pas réactivé."
              : "L'accès au back-office sera restauré immédiatement."
        }
        confirmText={confirmState?.type === "delete" ? "Supprimer" : "Confirmer"}
      />

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" />
        Chaque création, changement de rôle, activation ou suppression apparaît dans le journal d'activité.
      </p>
    </>
  )
}




