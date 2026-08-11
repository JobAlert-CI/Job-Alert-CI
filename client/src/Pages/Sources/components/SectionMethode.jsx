// src/pages/sources/components/SectionMethode.jsx
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, Radar } from "lucide-react"
import { SectionHeading } from "@/components/shared"
import { PRINCIPES } from "@/tools/sources.tools"

const SectionMethode = () => (
  <section className="border-y border-outline-variant/30 bg-surface-container-lowest py-16 md:py-20">
    {/* Desktop-first : grille 2 colonnes en base, empilée en repli */}
    <div className="mx-auto grid max-w-7xl gap-12 px-12 lg:grid-cols-[0.9fr_1.1fr] max-md:px-6 max-lg:grid-cols-1">
      <div className="self-start lg:sticky lg:top-28">
        <SectionHeading
          eyebrow="Notre méthode"
          title={
            <>
              On lit,{" "}
              <span className="text-brand-orange">on ne force pas</span>.
            </>
          }
          sub="Le scraping n'est pas une aspiration sauvage. C'est une lecture méthodique, polie et surveillée, pour que les sources restent saines et votre flux fiable."
        />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 max-w-md rounded-xl border border-outline-variant/50 bg-white p-6 shadow-soft"
        >
          <span className="flex size-11 items-center justify-center rounded-lg bg-brand-orange/10 text-brand-orange">
            <Radar className="size-5" strokeWidth={2} aria-hidden />
          </span>
          <h3 className="mt-4 font-heading text-base font-bold text-brand-navy">
            Envie de voir la chaîne complète ?
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">
            De la collecte à l'envoi de 8h00, on vous montre chaque étape en détail.
          </p>
          <Link
            to="/comment-ca-marche"
            className="group mt-4 inline-flex items-center gap-2 rounded-md bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-300 hover:bg-brand-navy/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Comment ça marche
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
          </Link>
        </motion.div>
      </div>

      <div className="relative">
        <div className="absolute bottom-6 left-6 top-6 w-px bg-outline-variant/50" aria-hidden />
        <div className="space-y-8">
          {PRINCIPES.map((p, i) => (
            <motion.div
              key={p.titre}
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.5,
                delay: i * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative flex gap-5 pl-0"
            >
              <span className="relative z-10 grid size-12 shrink-0 place-items-center rounded-full border border-brand-orange/40 bg-white font-heading text-sm font-extrabold text-brand-orange shadow-soft">
                0{i + 1}
              </span>
              <div className="flex-1 rounded-xl border border-outline-variant/40 bg-white p-5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-hover">
                <h3 className="flex items-center gap-2.5 font-heading text-base font-bold text-brand-navy">
                  <p.icon className="size-4.5 text-brand-orange" strokeWidth={2} aria-hidden />
                  {p.titre}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                  {p.texte}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </section>
)

export default SectionMethode