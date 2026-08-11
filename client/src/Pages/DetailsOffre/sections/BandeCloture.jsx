// src/pages/offres/detail/sections/BandeCloture.jsx
import { motion } from "framer-motion"
import { ArrowRight, Bell } from "lucide-react"
import { CtaLink } from "@/components/shared"

/* Chute — dernier appel à l'alerte. Desktop-first : rangée en base. */
const BandeCloture = () => (
  <section className="bg-surface-container-lowest pb-16">
    <div className="mx-auto max-w-7xl px-12 max-md:px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-row items-center justify-between gap-5 rounded-xl border border-outline-variant/50 bg-white px-7 py-6 shadow-soft max-sm:flex-col max-sm:items-start"
      >
        <div>
          <p className="font-heading text-lg font-extrabold text-brand-navy">
            Ne revenez pas demain.{" "}
            <span className="text-brand-orange">Faites venir les offres.</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Récapitulatif quotidien à 8h00 · 13 filières · 4 sources scannées à 6h02.
          </p>
        </div>
        <div className="flex shrink-0 flex-row gap-2.5 max-sm:flex-col">
          <CtaLink to="/inscription" size="md" icon={Bell} animateIcon>
            Créer mon alerte
          </CtaLink>
          <CtaLink to="/comment-ca-marche" variant="outline" size="md" iconRight={ArrowRight}>
            Comment ça marche
          </CtaLink>
        </div>
      </motion.div>
    </div>
  </section>
)

export default BandeCloture