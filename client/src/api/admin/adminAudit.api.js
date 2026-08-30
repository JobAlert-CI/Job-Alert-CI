import adminApi from "./adminAxios"

/**
 * API journal d'audit (super_admin) — GET /logs/audit.
 * Filtres : admin_id, action (6 valeurs), target_table · pagination limit/offset.
 */

export const AUDIT_TARGET_TABLES = [
  "administrators",
  "job_offers",
  "subscribers",
  "email_digests",
  "filieres",
  "sources",
  "content_pages",
  "site_settings",
  "scrape_runs",
]

const MOCK_AUDIT = [
  {
    id: "aud-1",
    admin_id: "adm-1",
    action: "connexion",
    target_table: "administrators",
    target_id: "adm-1",
    details: { ip_hash: "a3f9…c21" },
    created_at: "2026-08-22T07:58:12Z",
  },
  {
    id: "aud-2",
    admin_id: "adm-2",
    action: "modification",
    target_table: "job_offers",
    target_id: "off-102",
    details: { status: "archived", reason: "Annonce expirée côté recruteur" },
    created_at: "2026-08-21T11:20:00Z",
  },
  {
    id: "aud-3",
    admin_id: "adm-1",
    action: "creation",
    target_table: "administrators",
    target_id: "adm-4",
    details: { role: "moderateur" },
    created_at: "2026-08-20T15:42:30Z",
  },
  {
    id: "aud-4",
    admin_id: "adm-3",
    action: "envoi",
    target_table: "email_digests",
    target_id: "dig-8871",
    details: { subscriber_id: "sub-2", offer_ids: ["off-31", "off-32"] },
    created_at: "2026-08-19T09:14:22Z",
  },
  {
    id: "aud-5",
    admin_id: "adm-1",
    action: "suppression",
    target_table: "sources",
    target_id: "src-old",
    details: { name: "Source test" },
    created_at: "2026-08-18T16:05:47Z",
  },
  {
    id: "aud-6",
    admin_id: "adm-1",
    action: "scraping",
    target_table: "scrape_runs",
    target_id: "run-20260818-1",
    details: { source_code: null, sources: ["novojob", "linkedin"] },
    created_at: "2026-08-18T14:30:00Z",
  },
]

export const fetchAuditLogs = async ({ admin_id, action, target_table, limit = 50, offset = 0 } = {}) => {
  try {
    const { data } = await adminApi.get("/logs/audit", {
      params: {
        admin_id: admin_id || undefined,
        action: action || undefined,
        target_table: target_table || undefined,
        limit,
        offset,
      },
    })
    return data
  } catch (error) {
    if (error?.response) throw error
    let list = [...MOCK_AUDIT]
    if (admin_id) list = list.filter((l) => l.admin_id === admin_id)
    if (action) list = list.filter((l) => l.action === action)
    if (target_table) list = list.filter((l) => l.target_table === target_table)
    return list.slice(offset, offset + limit)
  }
}
