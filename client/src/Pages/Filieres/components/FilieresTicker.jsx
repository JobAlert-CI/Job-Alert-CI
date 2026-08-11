// src/pages/filieres/components/FilieresTicker.jsx
import { useMemo } from "react"
import { Ticker } from "@/components/shared"
import { HUES } from "@/lib/hues"
import { adaptOffers } from "@/lib/offers-adapter"
import { useTickerOffersQuery } from "@/tools/filieres.tools"

/* Ticker autonome — clé d'itération stable (uid), jamais l'index. */
const FilieresTicker = () => {
  const { data: rawOffers } = useTickerOffersQuery()
  const offres = useMemo(() => adaptOffers(rawOffers), [rawOffers])

  if (offres.length === 0) return null
  return (
    <Ticker
      variant="dark"
      duration={160}
      items={offres.map((o) => ({
        key: o.uid ?? o.slug ?? o.id,
        titre: o.titre,
        entreprise: o.entreprise,
        dot: (HUES[o.filiereHue] ?? HUES.sky).dot,
      }))}
    />
  )
}

export default FilieresTicker