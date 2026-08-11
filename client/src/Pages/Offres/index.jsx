// src/pages/offres/index.jsx
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUp } from "lucide-react"
import Seo from "@/components/seo/Seo"
import { offresSeo } from "@/lib/seo"
import { useOffersOverviewQuery, useOffresFeedModel } from "@/tools/offres.tools"
import { OffresFiltersProvider } from "@/contexts/Offres.context"
import HeroOffres, { OffresTicker } from "./sections/HeroOffres"
import FiltersBar from "./sections/FiltersBar"
import OffersFeed from "./sections/OffersFeed"

/** SEO alimenté par le cache — mêmes clés que les sections, zéro fetch dupliqué. */
const OffresSeo = () => {
  const { data: overview } = useOffersOverviewQuery()
  const { offers } = useOffresFeedModel()
  return (
    <Seo
      {...offresSeo({
        total: overview?.total ?? 0,
        nouveaux: overview?.nouveaux ?? 0,
        parSource: overview?.parSource ?? [],
        offers,
      })}
    />
  )
}

const BackToTop = ({ visible }) => (
  <AnimatePresence>
    {visible && (
      <motion.button
        initial={{ opacity: 0, scale: 0.8, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 12 }}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Retour en haut de page"
        className="fixed bottom-6 right-6 z-40 grid size-11 place-items-center rounded-full bg-brand-navy text-white shadow-hover transition-colors duration-300 hover:bg-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowUp className="size-5" aria-hidden />
      </motion.button>
    )}
  </AnimatePresence>
)

/**
 * Orchestrateur pur : aucun fetch, aucune donnée transitée par props.
 * Tout passe par le cache TanStack Query et le contexte de filtres.
 */
const Offres = () => {
  const [showTop, setShowTop] = useState(false)

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 700)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <OffresFiltersProvider>
      <OffresSeo />
      <main>
        <OffresTicker />
        <HeroOffres />
        <FiltersBar />
        <OffersFeed />
        <BackToTop visible={showTop} />
      </main>
    </OffresFiltersProvider>
  )
}

export default Offres