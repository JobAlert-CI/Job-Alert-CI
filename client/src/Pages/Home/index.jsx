// src/pages/home/Home.jsx
import { MessageCircleQuestion } from "lucide-react"
import Seo from "@/components/seo/Seo"
import { homeSeo } from "@/lib/seo"
import { FaqSection } from "@/components/shared"
import { QUESTIONS } from "@/data/constanteMetier"
import Hero from "./sections/Hero"
import HowItWorks from "./sections/HowItWorks"
import RecentOffers from "./sections/RecentOffers"
import Testimonials from "./sections/Testimonials"

/**
 * Orchestrateur pur : aucun fetch, aucune prop transmise.
 * Chaque section se sert elle-même dans le cache TanStack Query.
 */
const Home = () => (
  <>
    <Seo {...homeSeo} />
    <main>
      <Hero />
      <HowItWorks />
      <RecentOffers />
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
      <Testimonials />
    </main>
  </>
)

export default Home