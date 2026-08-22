import adminApi from "./adminAxios"
import { INITIAL_SCRAPE_RUNS, INITIAL_SCRAPERS } from "./mockData"
import { addMockLog } from "./adminLogs.api"

let localScrapers = [...INITIAL_SCRAPERS]
let localRuns = [...INITIAL_SCRAPE_RUNS]

export const fetchScrapingStatus = async () => {
  try {
    const res = await adminApi.get("/api/admin/scraping/status")
    return res.data
  } catch {
    return localScrapers
  }
}

export const fetchScrapeRuns = async (params = {}) => {
  try {
    const res = await adminApi.get("/api/admin/scraping/runs", { params })
    return res.data
  } catch {
    return localRuns
  }
}

export const triggerScrape = async ({ source_code = null, notes = "" } = {}) => {
  try {
    const res = await adminApi.post("/api/admin/scraping/trigger", {
      source_code,
      notes,
    })
    return res.data
  } catch {
    // Mode démo : simule un déclenchement avec succès
    const sourceLabel = source_code ? `source ${source_code}` : "toutes les sources"
    const newRun = {
      id: `run-${Date.now()}`,
      run_date: new Date().toISOString().slice(0, 10),
      status: "running",
      started_at: new Date().toISOString(),
      completed_at: null,
      duration_ms: null,
      triggered_by: "admin:manuel",
      total_offers_scraped: 0,
      new_offers_inserted: 0,
      duplicates_filtered: 0,
      notes: notes || `Scrape manuel lancé pour ${sourceLabel}`,
    }

    localRuns = [newRun, ...localRuns]

    // Mise à jour de l'état du scraper
    if (source_code) {
      localScrapers = localScrapers.map((s) =>
        s.code === source_code
          ? { ...s, last_status: "running", last_run_at: new Date().toISOString() }
          : s
      )
    } else {
      localScrapers = localScrapers.map((s) => ({
        ...s,
        last_status: "running",
        last_run_at: new Date().toISOString(),
      }))
    }

    addMockLog({
      module: "scraping",
      type: "audit",
      niveau: "info",
      action: "scraping",
      message: `Déclenchement manuel du scraping (${sourceLabel}).`,
      details: { source_code, notes },
    })

    // Simuler la fin de run après 4 secondes
    setTimeout(() => {
      newRun.status = "success"
      newRun.completed_at = new Date().toISOString()
      newRun.duration_ms = 14200
      newRun.total_offers_scraped = 36
      newRun.new_offers_inserted = 24
      newRun.duplicates_filtered = 12

      localScrapers = localScrapers.map((s) =>
        source_code && s.code !== source_code
          ? s
          : { ...s, last_status: "success", offers_found_last: (s.offers_found_last || 20) + 5 }
      )
    }, 4000)

    return newRun
  }
}

export const updateScraperSchedule = async (sourceCode, { cron, label, interval_minutes }) => {
  localScrapers = localScrapers.map((s) =>
    s.code === sourceCode
      ? {
          ...s,
          schedule_cron: cron || s.schedule_cron,
          schedule_label: label || s.schedule_label,
          interval_minutes: interval_minutes || s.interval_minutes,
        }
      : s
  )

  addMockLog({
    module: "scraping",
    type: "audit",
    niveau: "info",
    action: "modification",
    message: `Modification de la fréquence de scrape pour ${sourceCode} : ${label || cron}`,
    details: { sourceCode, cron, interval_minutes },
  })

  return localScrapers.find((s) => s.code === sourceCode)
}
