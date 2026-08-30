import adminApi from "./adminAxios"
import { INITIAL_LOGS } from "./mockData"

/**
 * API journaux (super_admin).
 * Onglet 1 : GET /logs/events (filtres module=scraping, level, source_id).
 * Onglet 2 : GET /logs/contacts + PATCH /contacts/{id}/status.
 */

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms))

const MOCK_EVENTS = INITIAL_LOGS.filter((l) => l.module === "scraping").map((l, i) => ({
  id: `evt-${i}`,
  module: "scraping",
  niveau: l.niveau,
  action: l.action,
  offer_id: null,
  source_scrape_run_id: null,
  hash_unique: null,
  raw_url: null,
  message: l.message,
  created_at: l.created_at,
}))

const MOCK_CONTACTS = [
  {
    id: "ct-1",
    full_name: "Aya Konaté",
    email: "aya.konate@gmail.com",
    subject_code: "partnership",
    subject_label: "Partenariat",
    message:
      "Bonjour, nous sommes une école de formation en informatique et souhaitons diffuser nos offres d'alternance via votre plateforme.",
    status: "new",
    replied_at: null,
    created_at: "2026-08-22T10:24:00Z",
  },
  {
    id: "ct-2",
    full_name: "Jean-Marc Ettien",
    email: "jm.ettien@yahoo.fr",
    subject_code: "bug",
    subject_label: "Problème technique",
    message: "Je ne reçois plus le digest quotidien depuis lundi. Mon adresse est pourtant active.",
    status: "read",
    replied_at: null,
    created_at: "2026-08-21T18:40:12Z",
  },
  {
    id: "ct-3",
    full_name: "Fatoumata Sylla",
    email: "fatou.sylla@outlook.com",
    subject_code: "unsubscribe",
    subject_label: "Désabonnement",
    message: "Merci de supprimer mon abonnement, je quitte le pays.",
    status: "replied",
    replied_at: "2026-08-20T09:12:00Z",
    created_at: "2026-08-19T20:05:33Z",
  },
]

export const fetchEventLogs = async ({ level, source_id, limit = 50, offset = 0 } = {}) => {
  try {
    const { data } = await adminApi.get("/logs/events", {
      params: { module: "scraping", level: level || undefined, source_id: source_id || undefined, limit, offset },
    })
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    let list = [...MOCK_EVENTS]
    if (level) list = list.filter((l) => l.niveau === level)
    return list.slice(offset, offset + limit)
  }
}

export const fetchContactMessages = async ({ status, limit = 50, offset = 0 } = {}) => {
  try {
    const { data } = await adminApi.get("/logs/contacts", {
      params: { status: status || undefined, limit, offset },
    })
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    let list = [...MOCK_CONTACTS]
    if (status) list = list.filter((c) => c.status === status)
    return list.slice(offset, offset + limit)
  }
}

export const updateContactStatus = async (contactId, status) => {
  const { data } = await adminApi.patch(`/logs/contacts/${contactId}/status`, { status })
  return data
}
