// src/pages/sources/components/CtaFinal.jsx
import { motion } from "framer-motion"
import { ArrowRight, Bell, Check } from "lucide-react"
import { CtaLink } from "@/components/shared"

const CtaFinal = () => (
  <section className="mt-8 bg-surface-container-lowest pb-16 md:pb-20">
    <div className="mx-auto max-w-7xl px-12 max-md:px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-xl border border-outline-variant/50 bg-white px-6 py-10 shadow-soft sm:px-10"
      >
        <div
          className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-brand-orange/10 blur-3xl"
          aria-hidden
        />
        {/* Desktop-first : row en base, column en repli */}
        <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-heading text-2xl font-black tracking-tight text-brand-navy sm:text-3xl">
              Le meilleur de ces sources,{" "}
              <span className="text-brand-orange">dans votre boîte mail</span>.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-on-surface-variant">
              Un seul récapitulatif à 8h00, filtré sur vos filières. Vous n'ouvrez plus
              jamais un site d'emploi. C'est lui qui vient à vous.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {["Gratuit pour toujours", "1 email par jour", "Désinscription en 1 clic"].map(
                (r) => (
                  <span
                    key={r}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant"
                  >
                    <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500/10">
                      <Check className="size-2.5 text-emerald-600" strokeWidth={3} aria-hidden />
                    </span>
                    {r}
                  </span>
                )
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
            <CtaLink to="/inscription" icon={Bell} animateIcon>
              Créer mon alerte 8h00
            </CtaLink>
            <CtaLink to="/offres" variant="outline" iconRight={ArrowRight}>
              Voir les offres
            </CtaLink>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
)

export default CtaFinal