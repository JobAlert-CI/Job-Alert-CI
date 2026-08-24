import { lazy, Suspense } from "react"
import { Radar } from "lucide-react"
import { ErrorBoundary } from "react-error-boundary"
import { Skeleton } from "@/components/ui/skeleton"
import Seo from "@/components/seo/Seo"
import { howItWorksSeo } from "@/lib/seo"
import { FaqSection } from "@/components/shared"
import { QUESTIONS_HOW } from "@/data/constanteMetier"
import HeroHowItWorks from "./sections/HeroHowItWorks"

// Code-Splitting : EtapesDetail (lourd en animations SVG) et SourcesBand différés
const EtapesDetail = lazy(() => import("./sections/EtapesDetail"))
const SourcesBand = lazy(() => import("./components/SourcesBand"))

const SectionErrorFallback = ({ error, resetErrorBoundary }) => (
  <div role="alert" className="p-8 text-center bg-destructive/5 border border-destructive/20 rounded-xl m-4">
    <p className="text-destructive font-bold">Une erreur est survenue dans cette section.</p>
    <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
    <button onClick={resetErrorBoundary} className="mt-4 px-4 py-2 bg-brand-navy text-white rounded-lg text-sm font-bold">
      Réessayer
    </button>
  </div>
)

const SectionSkeleton = ({ height = "h-64" }) => (
  <div className="py-20 flex justify-center">
    <Skeleton className={`${height} w-full max-w-7xl rounded-xl`} />
  </div>
)

const HowItWorks = () => (
  <>
    <Seo {...howItWorksSeo} />
    <main>
      <ErrorBoundary FallbackComponent={SectionErrorFallback}>
        <HeroHowItWorks />
      </ErrorBoundary>
      
      <Suspense fallback={<SectionSkeleton height="h-[800px]" />}>
        <ErrorBoundary FallbackComponent={SectionErrorFallback}>
          <EtapesDetail />
        </ErrorBoundary>
      </Suspense>
      
      <Suspense fallback={<SectionSkeleton height="h-40" />}>
        <ErrorBoundary FallbackComponent={SectionErrorFallback}>
          <SourcesBand />
        </ErrorBoundary>
      </Suspense>
      
      <ErrorBoundary FallbackComponent={SectionErrorFallback}>
        <FaqSection
          background="bg-background"
          eyebrow="Questions de mécanique"
          title={<>Ce qu'on nous demande <span className="text-brand-orange">le plus souvent</span>.</>}
          sub="Le fonctionnement de la chaîne, expliqué sans jargon."
          questions={QUESTIONS_HOW}
          aside={{
            icon: Radar,
            title: "Curieux de voir d'où viennent les offres ?",
            text: "La page Sources détaille les 4 plateformes scannées et notre méthode de collecte, source par source.",
            to: "/sources",
            cta: "Explorer les sources",
          }}
        />
      </ErrorBoundary>
    </main>
  </>
)
export default HowItWorks