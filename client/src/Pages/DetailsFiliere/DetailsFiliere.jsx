// src/pages/filieres/detail/index.jsx
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUp } from "lucide-react"
import Seo from "@/components/seo/Seo"
import { filiereSeo } from "@/lib/seo"
import { isNotFoundError } from "@/lib/query-helpers"
import { FiliereDetailProvider, useFiliereDetail } from "@/contexts/DetailsFiliere.context"
import {
  FiliereError, FiliereIntrouvable, FiliereLoading,
} from "./components/FiliereStates"
import HeroFiliere from "./sections/HeroFiliere"
import FiltersBar from "./sections/FiltersBar"
import FluxFiliere from "./sections/FluxFiliere"
import BandeauAlerte from "./components/BandeauAlerte"
import AutresFilieres from "./components/AutresFilieres"

/** SEO alimenté par le cache — prêt dès que la filière est résolue. */
const FiliereDetailSeo = () => {
  const { slug, meta, filtered } = useFiliereDetail()
  if (!meta) return null
  return <Seo {...filiereSeo({ meta, filiere: slug, offres: filtered })} />
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

const FilierePage = () => {
  const { slug, filiereQuery, meta } = useFiliereDetail()
  const [showTop, setShowTop] = useState(false)

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 700)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  if (!slug) return <FiliereIntrouvable code="?" />

  if (filiereQuery.isPending) {
    return (
      <>
        <Seo title="Chargement… | JobAlert CI" description="" noindex />
        <FiliereLoading />
      </>
    )
  }

  /* 404 réelle ≠ erreur réseau : deux états distincts */
  if (filiereQuery.isError) {
    if (isNotFoundError(filiereQuery.error)) {
      return (
        <>
          <Seo title={`Filière « ${slug} » introuvable | JobAlert CI`} description="" noindex />
          <FiliereIntrouvable code={slug} />
        </>
      )
    }
    return (
      <>
        <Seo title="Erreur de chargement | JobAlert CI" description="" noindex />
        <FiliereError code={slug} message={filiereQuery.error?.message} onRetry={() => filiereQuery.refetch()} />
      </>
    )
  }

  if (!meta) return <FiliereIntrouvable code={slug} />

  return (
    <>
      <FiliereDetailSeo />
      <main>
        <HeroFiliere />
        <FiltersBar />
        <FluxFiliere />
        <BandeauAlerte />
        <AutresFilieres />
        <BackToTop visible={showTop} />
      </main>
    </>
  )
}

/**
 * Page détail d'une filière — orchestrateur pur.
 * Toutes les données transitent par le cache TanStack Query et le contexte :
 * aucun fetch manuel, aucune prop relayée entre sections.
 */
const DetailsFiliere = () => (
  <FiliereDetailProvider>
    <FilierePage />
  </FiliereDetailProvider>
)

export default DetailsFiliere