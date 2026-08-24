import { ErrorBoundary } from "react-error-boundary"
import Seo from "@/components/seo/Seo"
import { filieresSeo } from "@/lib/seo"
import { useFilieresAdapted } from "@/tools/filieres.tools"
import HeroFilieres from "./sections/HeroFilieres"
import ReferentielFilieres from "./sections/ReferentielFilieres"
import BandeMechanique from "./sections/BandeMechanique"
import FilieresTicker from "./components/FilieresTicker"

const SectionFallback = ({ error, resetErrorBoundary }) => (
  <div role="alert" className="p-8 text-center bg-destructive/5 border border-destructive/20 rounded-xl m-4">
    <p className="text-destructive font-bold">Une erreur est survenue dans cette section.</p>
    <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
    <button onClick={resetErrorBoundary} className="mt-4 px-4 py-2 bg-brand-navy text-white rounded-lg text-sm font-bold">
      Réessayer
    </button>
  </div>
)

const FilieresSeo = () => {
  const { filieres } = useFilieresAdapted()
  return <Seo {...filieresSeo(filieres)} />
}

const Filieres = () => (
  <>
    <FilieresSeo />
    <main>      
      <ErrorBoundary FallbackComponent={SectionFallback}>
        <FilieresTicker />
        <HeroFilieres />
      </ErrorBoundary>
      
      <ErrorBoundary FallbackComponent={SectionFallback}>
        <ReferentielFilieres />
      </ErrorBoundary>
      
      <ErrorBoundary FallbackComponent={SectionFallback}>
        <BandeMechanique />
      </ErrorBoundary>
    </main>
  </>
)
export default Filieres