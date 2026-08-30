import { useEffect, useMemo, useState } from "react"
import { Loader2, RotateCcw, Save } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "../components/PageHeader"
import { extractErrorMessage } from "@/api/admin/adminAxios"
import { useAdminMutations, useSettingsSafe } from "./adminHooks"

/**
 * Page 17 — /admin/parametres (super_admin).
 * GET /settings · GET/PUT /{key} · POST /bulk.
 * Édition inline clé/valeur ; enregistrement groupé via POST /settings/bulk.
 */
export const SettingsPage = () => {
  const settingsQuery = useSettingsSafe()
  const m = useAdminMutations()
  const settings = settingsQuery.data || []

  /* Brouillon local clé → valeur */
  const [drafts, setDrafts] = useState({})
  useEffect(() => {
    if (settingsQuery.data) {
      setDrafts(Object.fromEntries(settings.map((s) => [s.key, s.value])))
    }
  }, [settingsQuery.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const dirtyKeys = useMemo(
    () => Object.keys(drafts).filter((key) => {
      const original = settings.find((s) => s.key === key)
      return original && String(original.value) !== String(drafts[key])
    }),
    [drafts, settings]
  )

  const setValue = (key, value) => setDrafts((prev) => ({ ...prev, [key]: value }))

  const resetAll = () =>
    setDrafts(Object.fromEntries(settings.map((s) => [s.key, s.value])))

  /** Enregistrement groupé (POST /bulk). */
  const handleSaveAll = async () => {
    if (dirtyKeys.length === 0) return
    try {
      await m.bulkUpdateSettingsMutation.mutateAsync(Object.fromEntries(dirtyKeys.map((k) => [k, drafts[k]])))
      toast.success("Paramètres enregistrés", `${dirtyKeys.length} paramètre(s) mis à jour.`)
    } catch (error) {
      toast.error("Enregistrement impossible", extractErrorMessage(error))
    }
  }

  return (
    <>
      <PageHeader
        title="Paramètres du site"
        description="Configuration générale modifiable sans déploiement : envoi des digests, contact, textes."
        crumbs={[{ label: "Accueil", to: "/admin" }, { label: "Paramètres" }]}
        actions={
          <>
            <button type="button" className="adm-btn-outline" onClick={resetAll} disabled={dirtyKeys.length === 0}>
              <RotateCcw className="size-4" /> Réinitialiser
            </button>
            <button
              type="button"
              className="adm-btn-primary"
              onClick={handleSaveAll}
              disabled={dirtyKeys.length === 0 || m.bulkUpdateSettingsMutation.isPending}
            >
              {m.bulkUpdateSettingsMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Enregistrer ({dirtyKeys.length})
            </button>
          </>
        }
      />

      <div className="adm-card max-w-4xl overflow-hidden">
        <table className="adm-table">
          <thead>
            <tr>
              <th className="w-64">Clé</th>
              <th>Valeur</th>
              <th className="hidden md:table-cell w-72">Description</th>
            </tr>
          </thead>
          <tbody>
            {settingsQuery.isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={3}><div className="adm-skeleton-line h-6 w-full" /></td>
                </tr>
              ))}

            {!settingsQuery.isLoading &&
              settings.map((setting) => (
                <tr key={setting.key}>
                  <td>
                    <code className="rounded bg-surface-container px-1.5 py-0.5 text-[11px] font-semibold">{setting.key}</code>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground md:hidden">{setting.description}</p>
                  </td>
                  <td>
                    <input
                      className={`adm-input h-9 max-w-md text-sm ${
                        String(setting.value) !== String(drafts[setting.key]) ? "border-primary ring-1 ring-primary/30" : ""
                      }`}
                      value={drafts[setting.key] ?? ""}
                      onChange={(e) => setValue(setting.key, e.target.value)}
                      aria-label={`Valeur de ${setting.key}`}
                    />
                    {String(setting.value) !== String(drafts[setting.key]) && (
                      <p className="mt-1 text-[11px] font-medium text-primary">
                        Modifié — valeur actuelle : « {setting.value} »
                      </p>
                    )}
                  </td>
                  <td className="hidden md:table-cell">
                    <span className="text-xs leading-snug text-muted-foreground">{setting.description ?? "—"}</span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 max-w-4xl text-xs leading-relaxed text-muted-foreground">
        ℹ️ Les modifications sont appliquées au prochain cycle d'envoi pour les paramètres liés aux digests.
        Chaque enregistrement est journalisé dans le journal d'activité (table <code>site_settings</code>).
      </p>
    </>
  )
}
