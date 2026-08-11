// src/pages/comment-ca-marche/HowItWorks.jsx
import { Radar } from "lucide-react"
import Seo from "@/components/seo/Seo"
import { howItWorksSeo } from "@/lib/seo"
import { FaqSection } from "@/components/shared"
import { QUESTIONS_HOW } from "@/data/constanteMetier"
import HeroHowItWorks from "./sections/HeroHowItWorks"
import EtapesDetail from "./sections/EtapesDetail"
import SourcesBand from "./components/SourcesBand"

/**
 * Orchestrateur pur : aucun fetch, aucune prop transmise.
 * Les données circulent exclusivement via le cache TanStack Query.
 */
const HowItWorks = () => (
  <>
    <Seo {...howItWorksSeo} />
    <main>
      <HeroHowItWorks />
      <EtapesDetail />
      <SourcesBand />
      <FaqSection
        background="bg-background"
        eyebrow="Questions de mécanique"
        title={
          <>
            Ce qu'on nous demande{" "}
            <span className="text-brand-orange">le plus souvent</span>.
          </>
        }
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
    </main>
  </>
)

export default HowItWorks