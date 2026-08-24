import { useEffect, useState, lazy, Suspense } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUp } from "lucide-react"
import { ErrorBoundary } from "react-error-boundary"
import { Skeleton } from "@/components/ui/skeleton"
import Seo from "@/components/seo/Seo"
import { filiereSeo } from "@/lib/seo"
import { isNotFoundError } from "@/lib/query-helpers"
import { FiliereDetailProvider, useFiliereDetail } from "@/contexts/DetailsFiliere.context"
import { FiliereError, FiliereIntrouvable, FiliereLoading } from "./components/FiliereStates"
import HeroFiliere from "./sections/HeroFiliere"
import FiltersBar from "./sections/FiltersBar"
import FluxFiliere from "./sections/FluxFiliere"

// Code-Splitting : Ces composants ne sont chargés que lorsqu'ils approchent du viewport
const AutresFilieres = lazy(() => import("./components/AutresFilieres"))
const BandeauAlerte = lazy(() => import("./components/BandeauAlerte"))

const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div role="alert" className="p-8 text-center bg-destructive/5 border border-destructive/20 rounded-xl m-4">
    <p className="text-destructive font-bold">Une erreur est survenue dans cette section.</p>
    <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
    <button onClick={resetErrorBoundary} className="mt-4 px-4 py-2 bg-brand-navy text-white rounded-lg text-sm font-bold">
      Réessayer
    </button>
  </div>
)

const SuspenseFallback = ({ height = "h-64" }) => (
  <div className="py-20 flex justify-center">
    <Skeleton className={`${height} w-full max-w-7xl rounded-xl`} />
  </div>
)

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
  if (filiereQuery.isPending) return <FiliereLoading />

  if (filiereQuery.isError) {
    if (isNotFoundError(filiereQuery.error)) return <FiliereIntrouvable code={slug} />
    return <FiliereError code={slug} message={filiereQuery.error?.message} onRetry={() => filiereQuery.refetch()} />
  }

  if (!meta) return <FiliereIntrouvable code={slug} />

  return (
    <>
      <FiliereDetailSeo />
      <main>
        {/* Isolation des erreurs par section */}
        <ErrorBoundary FallbackComponent={ErrorFallback}><HeroFiliere /></ErrorBoundary>
        <ErrorBoundary FallbackComponent={ErrorFallback}><FiltersBar /></ErrorBoundary>
        <ErrorBoundary FallbackComponent={ErrorFallback}><FluxFiliere /></ErrorBoundary>

        {/* Lazy Loading pour les sections basses */}
        <Suspense fallback={<SuspenseFallback height="h-80" />}>
          <ErrorBoundary FallbackComponent={ErrorFallback}><BandeauAlerte /></ErrorBoundary>
        </Suspense>
        <Suspense fallback={<SuspenseFallback />}>
          <ErrorBoundary FallbackComponent={ErrorFallback}><AutresFilieres /></ErrorBoundary>
        </Suspense>

        <BackToTop visible={showTop} />
      </main>
    </>
  )
}

const DetailsFiliere = () => (
  <FiliereDetailProvider>
    <FilierePage />
  </FiliereDetailProvider>
)

export default DetailsFiliere