// src/pages/sources/components/TickerSources.jsx
import { useMemo } from "react"
import { Ticker } from "@/components/shared"
import { HUES } from "@/lib/hues"
import { useSourcesContext } from "@/contexts/Sources.context"

/** Ticker alimenté par le cache — zéro prop depuis le parent. */
const TickerSources = () => {
  const { sources } = useSourcesContext()

  const items = useMemo(
    () =>
      sources.flatMap((s) =>
        Array.from({ length: Math.max(1, s.nouveaux || 1) }, (_, i) => ({
          key: `${s.slug || s.code}-${i}`,
          dot: HUES[s.hue]?.dot ?? "bg-brand-navy",
          titre: s.code,
          entreprise: `+${s.nouveaux} offre${s.nouveaux > 1 ? "s" : ""} ce matin`,
          source: s.shortCode,
        }))
      ),
    [sources]
  )

  if (!items.length) return null
  return <Ticker variant="dark" label="En direct" duration={220} items={items} />
}

export default TickerSources