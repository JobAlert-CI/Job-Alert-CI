import adminApi from "./adminAxios"

/**
 * API paramètres du site (super_admin).
 * GET /settings · GET/PUT /{key} · POST /bulk.
 */

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms))

const MOCK_SETTINGS = [
  { key: "digest_send_hour", value: "08", description: "Heure d'envoi du digest quotidien (0-23, fuseau Abidjan)", updated_at: "2026-08-01T09:00:00Z" },
  { key: "digest_send_minute", value: "00", description: "Minute d'envoi du digest quotidien", updated_at: "2026-08-01T09:00:00Z" },
  { key: "site_contact_email", value: "contact@jobalert.ci", description: "Email de contact affiché sur le site public", updated_at: "2026-06-15T14:30:00Z" },
  { key: "site_whatsapp_number", value: "+225 07 00 00 00 00", description: "Numéro WhatsApp support", updated_at: "2026-06-15T14:30:00Z" },
  { key: "offers_retention_days", value: "60", description: "Durée avant expiration automatique des offres (jours)", updated_at: "2026-07-20T11:00:00Z" },
  { key: "homepage_banner_message", value: "Plus de 10 000 abonnés reçoivent chaque matin les meilleures offres.", description: "Bandeau d'accueil (vide = masqué)", updated_at: "2026-08-10T16:45:00Z" },
]

export const fetchSettings = async () => {
  try {
    const { data } = await adminApi.get("/settings")
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    return [...MOCK_SETTINGS]
  }
}

export const getSetting = async (key) => {
  const { data } = await adminApi.get(`/settings/${key}`)
  return data
}

export const updateSetting = async (key, value, description) => {
  const { data } = await adminApi.put(`/settings/${key}`, { value, description })
  return data
}

/** Enregistrement groupé : { settings: { clé → valeur } }. */
export const bulkUpdateSettings = async (settingsMap) => {
  const { data } = await adminApi.post("/settings/bulk", { settings: settingsMap })
  return data
}
