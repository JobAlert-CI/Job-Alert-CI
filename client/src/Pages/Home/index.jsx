// index.jsx
import { lazy, Suspense } from "react"
import { MessageCircleQuestion } from "lucide-react"
import { ErrorBoundary } from "react-error-boundary"
import Seo from "@/components/seo/Seo"
import { homeSeo } from "@/lib/seo"
import { FaqSection } from "@/components/shared"
import { QUESTIONS } from "@/data/constanteMetier"
import { Skeleton } from "@/components/ui/skeleton"
import Hero from "./sections/Hero"

// Code-Splitting : Ces composants ne sont chargés que lorsqu'ils approchent du viewport
const HowItWorks = lazy(() => import("./sections/HowItWorks"))
const RecentOffers = lazy(() => import("./sections/RecentOffers"))
const Testimonials = lazy(() => import("./sections/Testimonials"))

// eslint-disable-next-line no-unused-vars
const SectionErrorFallback = ({ error, resetErrorBoundary }) => (
  <div role="alert" className="p-8 text-center bg-destructive/5 border border-destructive/20 rounded-xl m-4">
    <p className="text-destructive font-bold">Une erreur est survenue dans cette section.</p>
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

const Home = () => (
  <>
    <Seo {...homeSeo} />
    <main>
      <ErrorBoundary FallbackComponent={SectionErrorFallback}>
        <Hero />
      </ErrorBoundary>
      
      <Suspense fallback={<SectionSkeleton height="h-96" />}>
        <ErrorBoundary FallbackComponent={SectionErrorFallback}>
          <HowItWorks />
        </ErrorBoundary>
      </Suspense>
      
      <Suspense fallback={<SectionSkeleton height="h-[600px]" />}>
        <ErrorBoundary FallbackComponent={SectionErrorFallback}>
          <RecentOffers />
        </ErrorBoundary>
      </Suspense>
      
      <FaqSection
        eyebrow="FAQ"
        title="Vos questions, nos réponses."
        sub="Le fonctionnement de JobAlert CI, expliqué sans jargon. Et si quelque chose manque, on vous répond."
        questions={QUESTIONS}
        separated={false}
        aside={{
          icon: MessageCircleQuestion,
          title: "Vous ne trouvez pas votre réponse ?",
          text: "Écrivez-nous via le formulaire de contact — réponse en moins de 24 h ouvrées.",
          to: "/contact",
          cta: "Poser ma question",
        }}
      />
      
      <Suspense fallback={<SectionSkeleton />}>
        <ErrorBoundary FallbackComponent={SectionErrorFallback}>
          <Testimonials />
        </ErrorBoundary>
      </Suspense>
    </main>
  </>
)
export default Home