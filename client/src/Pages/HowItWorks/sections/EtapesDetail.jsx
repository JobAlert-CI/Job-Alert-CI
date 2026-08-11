// src/pages/comment-ca-marche/sections/EtapesDetail.jsx
import { useRef } from "react"
import { useScroll, useSpring } from "framer-motion"
import { Fingerprint, Radar, Send, SlidersHorizontal } from "lucide-react"
import { SectionHeading, StepBlock } from "@/components/shared"
import SerpentineTrace from "../components/SerpentineTrace"
import VisualCollecte from "../visuals/VisualCollecte"
import VisualDedup from "../visuals/VisualDedup"
import VisualFiltrage from "../visuals/VisualFiltrage"
import VisualEnvoi from "../visuals/VisualEnvoi"

const EtapesDetail = () => {
  const stepsRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: stepsRef,
    offset: ["start 0.8", "end 0.55"],
  })
  const traceProgress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 26,
    restDelta: 0.001,
  })

  return (
    <section
      id="chaine"
      className="scroll-mt-24 overflow-hidden bg-surface-container-lowest py-24 max-md:py-20"
    >
      <div className="mx-auto max-w-7xl px-12 max-md:px-6">
        <SectionHeading
          eyebrow="Sous le capot"
          title={
            <>
              Deux heures de mécanique,{" "}
              <span className="text-brand-orange">zéro intervention</span>.
            </>
          }
          sub="La chaîne s'exécute seule chaque matin, sans action humaine. Voici exactement ce que fait chaque maillon et ce qu'il ne fait pas."
        />

        <div ref={stepsRef} className="relative mt-16">
          <SerpentineTrace progress={traceProgress} />
          <div className="relative z-10 space-y-24 max-lg:space-y-20">
            <StepBlock
              num="01"
              time="06h00"
              icon={Radar}
              title="Collecte & centralisation"
              intro="À 6h00 tapantes, plusieurs scrapers se lancent en parallèle. Chacun parcourt la page « dernières offres » de sa source, extrait titre, entreprise, lien et date de publication, puis nettoie le tout : accents, casse, espaces superflus."
              points={[
                "Un scraper isolé par source : une panne ne bloque jamais les trois autres",
                "Chaque offre reçoit un tag de filière par mots-clés (« ingénieur logiciel » → Tech & Dev)",
                "Chaque échec est journalisé avec horodatage",
              ]}
            >
              <VisualCollecte />
            </StepBlock>

            <StepBlock
              num="02"
              time="06h15"
              icon={Fingerprint}
              title="Dédoublonnage"
              reverse
              intro="Avant d'entrer en base, chaque offre reçoit une empreinte unique calculée depuis son lien d'annonce ou à défaut du couple titre + entreprise. Si l'empreinte existe déjà, l'offre est ignorée. Définitivement."
              points={[
                "Contrainte UNIQUE en base : une annonce ne peut physiquement pas être insérée deux fois",
                "Même offre repérée sur deux sources ? Une seule version est conservée",
                "Résultat : vous ne recevez jamais deux fois la même offre",
              ]}
            >
              <VisualDedup />
            </StepBlock>

            <StepBlock
              num="03"
              time="07h00"
              icon={SlidersHorizontal}
              title="Filtrage par filière"
              intro="Une fois le scraping terminé, le système croise les nouvelles offres du jour avec les filières de chaque abonné actif. Chacun reçoit une liste différente, la sienne, construite à partir de ses 1 à 3 filières choisies à l'inscription."
              points={[
                "Vos filières sont modifiables à tout moment via le lien en bas de chaque email",
                "Une offre n'entre dans votre email que si elle correspond à l'une de vos filières",
                "Aucune offre pertinente un jour donné ? Aucun email vide n'est envoyé",
              ]}
            >
              <VisualFiltrage />
            </StepBlock>

            <StepBlock
              num="04"
              time="08h00"
              icon={Send}
              title="Envoi du récapitulatif"
              reverse
              intro="À 8h00 précises, chaque abonné concerné reçoit son récapitulatif personnalisé : les offres filtrées, avec titre, entreprise, lien direct vers l'annonce d'origine et date de publication. Prêt à postuler avant tout le monde."
              points={[
                "Jusqu'à 3 tentatives espacées en cas d'échec d'envoi",
                "Chaque tentative (succès ou échec) est journalisée avec horodatage",
                "Lien de désinscription en bas de chaque email : un clic, zéro justification",
              ]}
            >
              <VisualEnvoi />
            </StepBlock>
          </div>
        </div>
      </div>
    </section>
  )
}

export default EtapesDetail