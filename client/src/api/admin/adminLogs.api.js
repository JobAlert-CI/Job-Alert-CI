import adminApi from "./adminAxios"
import { INITIAL_LOGS } from "./mockData"

let localLogs = [...INITIAL_LOGS]

export const fetchAuditLogs = async (params = {}) => {
  try {
    const res = await adminApi.get("/api/admin/logs/audit", { params })
    return res.data
  } catch {
    let list = localLogs.filter((l) => l.type === "audit" || !l.type)
    if (params.action) list = list.filter((l) => l.action === params.action)
    if (params.admin_id) list = list.filter((l) => l.admin_id === params.admin_id)
    return list
  }
}

export const fetchEventLogs = async (params = {}) => {
  try {
    const res = await adminApi.get("/api/admin/logs/events", { params })
    return res.data
  } catch {
    let list = localLogs.filter((l) => l.type === "technique" || l.module === "scraping")
    if (params.level) list = list.filter((l) => l.niveau === params.level)
    return list
  }
}

export const fetchAllLogs = async (params = {}) => {
  try {
    const [audit, events] = await Promise.all([
      fetchAuditLogs(params),
      fetchEventLogs(params),
    ])
    return [...audit, ...events].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  } catch {
    return localLogs
  }
}

export const addMockLog = (logData) => {
  const newLog = {
    id: `log-${Date.now()}`,
    created_at: new Date().toISOString(),
    niveau: "info",
    type: "audit",
    ...logData,
  }
  localLogs = [newLog, ...localLogs]
  return newLog
}
