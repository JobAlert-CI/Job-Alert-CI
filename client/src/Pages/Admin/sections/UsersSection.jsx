import { useState } from "react"
import { Shield, ShieldAlert, ShieldCheck, UserCheck, UserPlus, Check, X, Lock, Trash2, Edit } from "lucide-react"
import { AdminTable } from "../components/AdminTable"
import { AdminModal } from "../components/AdminModal"
import { AdminConfirmDialog } from "../components/AdminConfirmDialog"
import { AdminBadgeRole, StatusBadge } from "../components/AdminBadgeRole"
import { useToast } from "../components/AdminToast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { ALL_PERMISSIONS } from "@/api/admin/adminUsers.api"
import {
  useAdminAdmins,
  useAdminSubscribers,
  useAdminMutations,
} from "@/tools/admin.tools"

export const UsersSection = () => {
  const { user: currentUser, isSuperAdmin } = useAdminAuth()
  const toast = useToast()
  const {
    promoteUserMutation,
    updatePermissionsMutation,
    deleteAdminMutation,
  } = useAdminMutations()

  const [activeTab, setActiveTab] = useState("admins") // 'admins' | 'subscribers'
  const [searchTerm, setSearchTerm] = useState("")

  // Promotion & Edit permissions modal state
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false)
  const [selectedSubscriberToPromote, setSelectedSubscriberToPromote] = useState(null)
  const [editingAdmin, setEditingAdmin] = useState(null)
  const [adminToDelete, setAdminToDelete] = useState(null)

  // Form states
  const [formRole, setFormRole] = useState("superviseur")
  const [formPermissions, setFormPermissions] = useState(["manage_offers", "manage_logs"])
  const [formEmail, setFormEmail] = useState("")
  const [formName, setFormName] = useState("")

  const { data: admins = [], isLoading: loadingAdmins } = useAdminAdmins()
  const { data: subscribers = [], isLoading: loadingSubscribers } = useAdminSubscribers({ q: searchTerm })

  const handleOpenPromote = (subscriber = null) => {
    setSelectedSubscriberToPromote(subscriber)
    setEditingAdmin(null)
    setFormRole("superviseur")
    setFormPermissions(["manage_offers", "manage_sources", "trigger_scrape", "manage_logs"])
    setFormEmail(subscriber?.email || "")
    setFormName(subscriber?.full_name || "")
    setIsPromoteModalOpen(true)
  }

  const handleOpenEditPermissions = (admin) => {
    setEditingAdmin(admin)
    setSelectedSubscriberToPromote(null)
    setFormRole(admin.role || "superviseur")
    setFormPermissions(admin.permissions || [])
    setFormEmail(admin.email)
    setFormName(admin.full_name)
    setIsPromoteModalOpen(true)
  }

  const togglePermission = (permId) => {
    if (formPermissions.includes(permId)) {
      setFormPermissions(formPermissions.filter((p) => p !== permId))
    } else {
      setFormPermissions([...formPermissions, permId])
    }
  }

  const handleSavePermissions = async (e) => {
    e.preventDefault()
    if (!isSuperAdmin) {
      toast.error("Action non autorisée", "Seul un Super Administrateur peut modifier les pouvoirs des utilisateurs.")
      return
    }

    try {
      if (editingAdmin) {
        // Mise à jour d'un admin existant
        await updatePermissionsMutation.mutateAsync({
          adminId: editingAdmin.id,
          data: {
            role: formRole,
            permissions: formRole === "super_admin" ? ALL_PERMISSIONS.map((p) => p.id) : formPermissions,
            full_name: formName,
          },
        })
        toast.success("Pouvoirs modifiés", `Les permissions de ${formName} ont été mises à jour.`)
      } else {
        // Promotion d'un nouvel admin/superviseur
        await promoteUserMutation.mutateAsync({
          subscriberId: selectedSubscriberToPromote?.id,
          email: formEmail,
          full_name: formName,
          role: formRole,
          permissions: formRole === "super_admin" ? ALL_PERMISSIONS.map((p) => p.id) : formPermissions,
        })
        toast.success("Utilisateur promu", `${formName} a été promu avec succès au rôle de ${formRole}.`)
      }
      setIsPromoteModalOpen(false)
    } catch {
      toast.error("Erreur", "L'opération a échoué.")
    }
  }

  const handleDeleteAdmin = async () => {
    if (!adminToDelete) return
    try {
      await deleteAdminMutation.mutateAsync(adminToDelete.id)
      toast.success("Compte révoqué", "L'accès administrateur a été supprimé.")
    } catch {
      toast.error("Erreur", "Impossible de révoquer ce compte.")
    } finally {
      setAdminToDelete(null)
    }
  }

  // Columns for Admins Table
  const adminColumns = [
    {
      header: "Nom & Email",
      key: "full_name",
      render: (item) => (
        <div className="flex items-center gap-2.5">
          <div className="grid size-7 place-items-center rounded-full bg-brand-navy text-white text-xs font-bold">
            {item.full_name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <span className="font-semibold text-on-surface dark:text-zinc-200 block text-xs">
              {item.full_name} {item.id === currentUser?.id && "(Vous)"}
            </span>
            <span className="text-[11px] text-on-surface-variant/80 block">
              {item.email}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Rôle",
      key: "role",
      width: "140px",
      render: (item) => <AdminBadgeRole role={item.role} />,
    },
    {
      header: "Pouvoirs accordés",
      key: "permissions",
      render: (item) => {
        if (item.role === "super_admin") {
          return (
            <span className="text-xs font-semibold text-brand-orange flex items-center gap-1">
              <ShieldAlert className="size-3.5" />
              Tous les pouvoirs (Accès Total)
            </span>
          )
        }
        const perms = item.permissions || []
        return (
          <div className="flex flex-wrap gap-1 max-w-sm">
            {perms.map((p) => {
              const meta = ALL_PERMISSIONS.find((ap) => ap.id === p)
              return (
                <span
                  key={p}
                  className="rounded-md bg-surface-container px-1.5 py-0.5 text-[10px] font-medium text-on-surface-variant border border-outline-variant/20"
                >
                  {meta?.label || p}
                </span>
              )
            })}
          </div>
        )
      },
    },
    {
      header: "Dernière connexion",
      key: "last_login_at",
      width: "140px",
      render: (item) => (
        <span className="text-xs text-on-surface-variant font-mono">
          {item.last_login_at ? new Date(item.last_login_at).toLocaleDateString("fr-FR") : "Jamais"}
        </span>
      ),
    },
    {
      header: "Actions",
      key: "actions",
      width: "120px",
      className: "text-right",
      render: (item) => {
        const canEdit = isSuperAdmin && item.id !== currentUser?.id
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => handleOpenEditPermissions(item)}
              disabled={!canEdit}
              title={!canEdit ? "Réservé aux Super Administrateurs" : "Modifier les pouvoirs"}
            >
              <Edit className="size-3 mr-1" />
              Pouvoirs
            </Button>
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setAdminToDelete(item)}
                className="text-rose-600 hover:bg-rose-500/10 p-1"
                title="Supprimer ce compte"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  // Columns for Subscribers Table
  const subscriberColumns = [
    {
      header: "Abonné",
      key: "full_name",
      render: (item) => (
        <div>
          <span className="font-semibold text-on-surface dark:text-zinc-200 block text-xs">
            {item.full_name || "Abonné sans nom"}
          </span>
          <span className="text-[11px] text-on-surface-variant/80 block">
            {item.email}
          </span>
        </div>
      ),
    },
    {
      header: "Statut",
      key: "status",
      width: "110px",
      render: (item) => <StatusBadge status={item.status} label={item.status?.toUpperCase()} />,
    },
    {
      header: "Filières ciblées",
      key: "filieres",
      render: (item) => (
        <div className="flex flex-wrap gap-1">
          {item.filieres?.map((fil, idx) => (
            <span
              key={idx}
              className="rounded-full bg-brand-navy/10 text-brand-navy dark:text-sky-300 px-2 py-0.5 text-[10px] font-semibold"
            >
              {fil}
            </span>
          ))}
        </div>
      ),
    },
    {
      header: "Date d'inscription",
      key: "subscribed_at",
      width: "130px",
      render: (item) => (
        <span className="text-xs text-on-surface-variant font-mono">
          {new Date(item.subscribed_at).toLocaleDateString("fr-FR")}
        </span>
      ),
    },
    {
      header: "Action Clé",
      key: "promote",
      width: "160px",
      className: "text-right",
      render: (item) => (
        <Button
          type="button"
          size="xs"
          onClick={() => handleOpenPromote(item)}
          disabled={!isSuperAdmin}
          className="bg-brand-navy hover:bg-brand-navy/90 text-white font-semibold text-xs gap-1"
          title={!isSuperAdmin ? "Réservé au Super Admin" : "Promouvoir en administrateur ou superviseur"}
        >
          <UserPlus className="size-3" />
          Promouvoir
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-on-surface dark:text-zinc-100">
            Gestion des Utilisateurs, Rôles & Permissions
          </h2>
          <p className="text-xs text-on-surface-variant dark:text-zinc-400">
            Promotion des membres, attribution des privilèges d'accès et supervision des abonnés.
          </p>
        </div>

        {isSuperAdmin && (
          <Button
            type="button"
            onClick={() => handleOpenPromote(null)}
            className="bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold shadow-xs text-xs self-start sm:self-auto"
          >
            <UserPlus className="size-3.5 mr-1.5" />
            Ajouter un Admin / Superviseur
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant/20">
        <button
          type="button"
          onClick={() => setActiveTab("admins")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "admins"
              ? "border-brand-navy dark:border-sky-400 text-brand-navy dark:text-sky-400"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Shield className="size-4" />
          Administrateurs & Superviseurs ({admins.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("subscribers")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "subscribers"
              ? "border-brand-navy dark:border-sky-400 text-brand-navy dark:text-sky-400"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <UserCheck className="size-4" />
          Abonnés aux Alertes ({subscribers.length})
        </button>
      </div>

      {/* Table Content */}
      {activeTab === "admins" ? (
        <AdminTable
          columns={adminColumns}
          data={admins}
          loading={loadingAdmins}
          searchPlaceholder="Rechercher un administrateur..."
          pageSize={10}
        />
      ) : (
        <AdminTable
          columns={subscriberColumns}
          data={subscribers}
          loading={loadingSubscribers}
          searchPlaceholder="Rechercher un abonné par nom, email..."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          pageSize={10}
        />
      )}

      {/* Modal: Promote or Edit Permissions */}
      <AdminModal
        isOpen={isPromoteModalOpen}
        onClose={() => setIsPromoteModalOpen(false)}
        title={
          editingAdmin
            ? `Modifier les pouvoirs de : ${editingAdmin.full_name}`
            : selectedSubscriberToPromote
            ? `Promouvoir l'abonné : ${selectedSubscriberToPromote.full_name}`
            : "Créer / Promouvoir un compte d'administration"
        }
        subtitle="Définissez le rôle et cochez les permissions exactes accordées à cet utilisateur"
        size="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsPromoteModalOpen(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleSavePermissions}
              disabled={promoteUserMutation.isPending || updatePermissionsMutation.isPending}
              className="bg-brand-navy text-white font-semibold"
            >
              {editingAdmin ? "Enregistrer les pouvoirs" : "Confirmer la promotion"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSavePermissions} className="space-y-5 text-xs">
          {/* Identity fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-on-surface dark:text-zinc-200 mb-1">
                Nom complet :
              </label>
              <Input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Kouamé Jean"
                className="h-8 text-xs"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-on-surface dark:text-zinc-200 mb-1">
                Adresse Email :
              </label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="Ex: user@jobalert.ci"
                className="h-8 text-xs"
                required
                disabled={Boolean(editingAdmin)}
              />
            </div>
          </div>

          {/* Role selector */}
          <div>
            <label className="block font-semibold text-on-surface dark:text-zinc-200 mb-2">
              Sélectionner le rôle :
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: "super_admin",
                  title: "Super Admin",
                  desc: "Tous les pouvoirs (gestion totale des utilisateurs et configuration)",
                  icon: ShieldAlert,
                },
                {
                  id: "superviseur",
                  title: "Superviseur",
                  desc: "Gestion des offres, des sources et déclenchement de scraping",
                  icon: ShieldCheck,
                },
                {
                  id: "moderateur",
                  title: "Modérateur",
                  desc: "Modération et validation des offres d'emploi uniquement",
                  icon: Shield,
                },
              ].map((r) => {
                const Icon = r.icon
                const isSelected = formRole === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setFormRole(r.id)
                      if (r.id === "super_admin") {
                        setFormPermissions(ALL_PERMISSIONS.map((p) => p.id))
                      } else if (r.id === "moderateur") {
                        setFormPermissions(["manage_offers", "manage_logs"])
                      }
                    }}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? "border-brand-navy dark:border-sky-400 bg-brand-navy/5 dark:bg-sky-500/10 ring-1 ring-brand-navy"
                        : "border-outline-variant/30 bg-surface-container-lowest dark:bg-zinc-900 hover:bg-surface-container-low"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-brand-navy dark:text-sky-400 shrink-0" />
                      <span className="font-bold text-on-surface dark:text-zinc-100">{r.title}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-on-surface-variant/80 leading-snug">
                      {r.desc}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Permissions Matrix (Checkboxes) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-semibold text-on-surface dark:text-zinc-200">
                Matrice des permissions détaillées :
              </label>
              {formRole !== "super_admin" && (
                <button
                  type="button"
                  onClick={() =>
                    setFormPermissions(
                      formPermissions.length === ALL_PERMISSIONS.length
                        ? []
                        : ALL_PERMISSIONS.map((p) => p.id)
                    )
                  }
                  className="text-[11px] font-semibold text-brand-navy dark:text-sky-400 hover:underline"
                >
                  {formPermissions.length === ALL_PERMISSIONS.length
                    ? "Tout désélectionner"
                    : "Tout sélectionner"}
                </button>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-outline-variant/20 bg-surface-container-low/40 dark:bg-zinc-800/30 p-3">
              {ALL_PERMISSIONS.map((perm) => {
                const isChecked = formRole === "super_admin" || formPermissions.includes(perm.id)
                const isLocked = formRole === "super_admin"

                return (
                  <label
                    key={perm.id}
                    className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      isChecked
                        ? "bg-surface-container-lowest dark:bg-zinc-900 shadow-xs"
                        : "hover:bg-surface-container-low/80"
                    } ${isLocked ? "opacity-80 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isLocked}
                      onChange={() => togglePermission(perm.id)}
                      className="mt-0.5 size-4 rounded border-outline-variant text-brand-navy focus:ring-brand-navy"
                    />
                    <div className="flex-1">
                      <span className="font-semibold text-on-surface dark:text-zinc-200 block text-xs">
                        {perm.label}
                      </span>
                      <span className="text-[11px] text-on-surface-variant/80 block">
                        {perm.description}
                      </span>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        </form>
      </AdminModal>

      {/* Confirmation modal before removing an admin */}
      <AdminConfirmDialog
        isOpen={Boolean(adminToDelete)}
        onClose={() => setAdminToDelete(null)}
        onConfirm={handleDeleteAdmin}
        title="Révoquer l'accès administrateur ?"
        message={`Êtes-vous sûr de vouloir retirer les droits d'administration de ${adminToDelete?.full_name} (${adminToDelete?.email}) ?`}
        confirmText="Révoquer le compte"
        variant="danger"
        loading={deleteAdminMutation.isPending}
      />
    </div>
  )
}
