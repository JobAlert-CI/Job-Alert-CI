import adminApi from "./adminAxios"
import { INITIAL_SCRAPERS, INITIAL_SCRAPE_RUNS } from "./mockData"

/**
 * API scraping (super_admin).
 * GET /scraping/status · POST /scraping/trigger (crée des lignes pending,
 * exécution asynchrone → état « en cours » + polling) · GET /scraping/runs ·
 * GET /scraping/runs/{id} · GET /scraping/runs/{id}/logs.
 */

let localScrapers = [...INITIAL_SCRAPERS]
let localRuns = [...INITIAL_SCRAPE_RUNS]

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms))

const toRunApiShape = (r) => ({
  id: r.id,
  run_date: r.run_date,
  status: r.status,
  started_at: r.started_at,
  finished_at: r.completed_at || null,
  triggered_by: r.triggered_by,
  total_raw: r.total_offers_scraped ?? 0,
  total_inserted: r.new_offers_inserted ?? 0,
  total_updated: 0,
  total_duplicates: r.duplicates_filtered ?? 0,
  total_errors: 0,
  notes: r.notes ?? null,
  source_runs: [],
})

export const fetchScrapingStatus = async () => {
  try {
    const { data } = await adminApi.get("/scraping/status")
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    return localScrapers.map((s) => ({
      source_code: s.code,
      source_name: s.name,
      last_run_at: s.last_run_at,
      last_status: s.last_status,
      last_duration_ms: s.last_duration_ms,
      last_error: s.last_error,
      total_runs: s.total_runs,
    }))
  }
}

/** Déclenche une collecte — retourne un run `pending` (exécution async côté worker). */
export const triggerScrape = async ({ source_code = null, notes = "" } = {}) => {
  try {
    const { data } = await adminApi.post("/scraping/trigger", { source_code, notes })
    return data
  } catch (error) {
    if (error?.response) throw error
    // Mode démo : simule la création d'un run pending qui passe success après ~4s
    const newRun = {
      id: `run-${Date.now()}`,
      run_date: new Date().toISOString().slice(0, 10),
      status: "pending",
      started_at: new Date().toISOString(),
      completed_at: null,
      duration_ms: null,
      triggered_by: "admin:manuel",
      total_offers_scraped: 0,
      new_offers_inserted: 0,
      duplicates_filtered: 0,
      notes: notes || (source_code ? `Collecte manuelle ${source_code}` : "Collecte manuelle toutes sources"),
    }
    localRuns = [newRun, ...localRuns]
    setTimeout(() => {
      newRun.status = "success"
      newRun.completed_at = new Date().toISOString()
      newRun.duration_ms = 14200
      newRun.total_offers_scraped = 36
      newRun.new_offers_inserted = 24
      newRun.duplicates_filtered = 12
    }, 4000)
    return toRunApiShape(newRun)
  }
}

export const fetchScrapeRuns = async ({ limit = 30, offset = 0 } = {}) => {
  try {
    const { data } = await adminApi.get("/scraping/runs", { params: { limit, offset } })
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    return localRuns.slice(offset, offset + limit).map(toRunApiShape)
  }
}

export const getScrapeRunById = async (runId) => {
  try {
    const { data } = await adminApi.get(`/scraping/runs/${runId}`)
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    const found = localRuns.find((r) => r.id === runId)
    if (!found) {
      const notFound = new Error("Run introuvable")
      notFound.isNotFound = true
      throw notFound
    }
    const shaped = toRunApiShape(found)
    shaped.source_runs = localScrapers.map((s) => ({
      id: `${found.id}-${s.code}`,
      scrape_run_id: found.id,
      source_id: s.code,
      status: found.status,
      started_at: found.started_at,
      finished_at: found.completed_at,
      duration_ms: Math.round((s.last_duration_ms || 12000) / 4),
      raw_count: Math.round(shaped.total_raw / localScrapers.length),
      inserted_count: Math.round(shaped.total_inserted / localScrapers.length),
      updated_count: 0,
      duplicate_count: Math.round(shaped.total_duplicates / localScrapers.length),
      error_count: s.code === "goafrica" ? 2 : 0,
      error_message: s.code === "goafrica" ? s.last_error : null,
    }))
    return shaped
  }
}

export const fetchRunLogs = async (runId) => {
  try {
    const { data } = await adminApi.get(`/scraping/runs/${runId}/logs`)
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    return [
      {
        id: "evt-1",
        module: "scraping",
        niveau: "info",
        action: "inserted",
        offer_id: "off-8891",
        source_scrape_run_id: runId,
        raw_url: "https://novojob.com/ci/offer-8891",
        message: "Offre insérée : Développeur React",
        created_at: "2026-08-22T06:02:15Z",
      },
      {
        id: "evt-2",
        module: "scraping",
        niveau: "info",
        action: "duplicate",
        offer_id: "off-8870",
        source_scrape_run_id: runId,
        raw_url: "https://novojob.com/ci/offer-8870",
        message: "Doublon écarté (hash identique)",
        created_at: "2026-08-22T06:02:40Z",
      },
      {
        id: "evt-3",
        module: "scraping",
        niveau: "warning",
        action: "skipped",
        offer_id: null,
        source_scrape_run_id: runId,
        raw_url: "https://goafricaonline.com/offre-771",
        message: "Contenu incomplet : date manquante",
        created_at: "2026-08-22T06:44:10Z",
      },
      {
        id: "evt-4",
        module: "scraping",
        niveau: "error",
        action: "failed",
        offer_id: null,
        source_scrape_run_id: runId,
        raw_url: "https://goafricaonline.com/offre-772",
        message: "Erreur de parsing : sélecteur '.salary-badge' introuvable",
        created_at: "2026-08-22T06:45:02Z",
      },
    ]
  }
}
