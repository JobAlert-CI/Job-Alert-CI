import adminApi from "./adminAxios"
import { INITIAL_SCRAPE_RUNS } from "./mockData"

/**
 * API tableau de bord — GET /dashboard/overview · GET /dashboard/runs.
 * Fallback démo si backend injoignable.
 */

export const fetchDashboardOverview = async () => {
  try {
    const { data } = await adminApi.get("/dashboard/overview")
    return data
  } catch (error) {
    if (error?.response && error.response.status !== 502 && error.response.status !== 503 && error.response.status !== 504 && error.response.status !== 404) {
      throw error
    }
    // Mode démo : cohérent avec les jeux de données factices
    return {
      offers_total: 1428,
      offers_active: 1187,
      subscribers_total: 10550,
      subscribers_active: 9240,
      contact_messages_new: 7,
      sources_active: 8,
      last_scrape_run_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      last_scrape_status: "success",
      pending_digests: 3,
    }
  }
}

/** Série hebdomadaire pour le graphique Recharts (dérivée des runs en mode démo). */
export const fetchDashboardTrends = async () => {
  try {
    const { data } = await adminApi.get("/dashboard/trends")
    return data
  } catch (error) {
    if (error?.response && error.response.status !== 502 && error.response.status !== 503 && error.response.status !== 504 && error.response.status !== 404) {
      throw error
    }
    return [
      { day: "Lun", offres: 74, abonnements: 32 },
      { day: "Mar", offres: 65, abonnements: 28 },
      { day: "Mer", offres: 88, abonnements: 41 },
      { day: "Jeu", offres: 52, abonnements: 25 },
      { day: "Ven", offres: 96, abonnements: 47 },
      { day: "Sam", offres: 38, abonnements: 18 },
      { day: "Dim", offres: 29, abonnements: 12 },
    ]
  }
}

/** Historique des runs quotidiens (GET /dashboard/runs). */
export const fetchDashboardRuns = async ({ limit = 5, offset = 0 } = {}) => {
  try {
    const { data } = await adminApi.get("/dashboard/runs", { params: { limit, offset } })
    return data
  } catch (error) {
    if (error?.response && error.response.status !== 502 && error.response.status !== 503 && error.response.status !== 504 && error.response.status !== 404) {
      throw error
    }
    return INITIAL_SCRAPE_RUNS.slice(offset, offset + limit).map((r) => ({
      id: r.id,
      run_date: r.run_date,
      status: r.status,
      started_at: r.started_at,
      finished_at: r.completed_at,
      triggered_by: r.triggered_by,
      total_raw: r.total_offers_scraped,
      total_inserted: r.new_offers_inserted,
      total_updated: 0,
      total_duplicates: r.duplicates_filtered,
      total_errors: 0,
      notes: r.notes,
      source_runs: [],
    }))
  }
}
