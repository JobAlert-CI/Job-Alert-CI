import { useMemo } from "react"
import { Ticker } from "@/components/shared"
import { useAdminLogs, useAdminScrapers } from "@/tools/admin.tools"

export const AdminTicker = () => {
  const { data: logs = [] } = useAdminLogs()
  const { data: scrapers = [] } = useAdminScrapers()

  const items = useMemo(() => {
    const list = []

    scrapers.forEach((s) => {
      list.push({
        key: `src-${s.code}`,
        dot: s.last_status === "error" ? "bg-rose-500" : "bg-emerald-500",
        titre: s.name,
        entreprise: s.schedule_label || "Chaque matin",
        source: s.last_status === "success" ? "Opérationnel" : "Scraping",
      })
    })

    logs.slice(0, 4).forEach((l) => {
      list.push({
        key: `log-${l.id}`,
        dot: l.niveau === "error" ? "bg-rose-500" : l.niveau === "warning" ? "bg-amber-500" : "bg-sky-500",
        titre: l.admin_name || l.module,
        entreprise: l.message,
        source: l.module,
      })
    })

    return list
  }, [scrapers, logs])

  if (!items.length) return null

  return <Ticker variant="dark" label="Supervision" duration={180} items={items} />
}
