// src/pages/filieres/sections/BandeMechanique.jsx
import { Fragment } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, ChevronRight } from "lucide-react"
import { ETAPES_MECHANIQUE } from "@/tools/filieres.tools"

/* La mécanique — contenu statique, layout desktop-first. */
const BandeMechanique = () => (
  <section className="border-y border-outline-variant/30 bg-surface-container-low/60 py-14 max-md:py-12">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto mb-12 flex max-w-7xl flex-col px-12 max-md:px-6"
    >
      <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-orange">
        <span className="h-px w-6 bg-brand-orange" aria-hidden />
        La mécanique
      </p>
      <h2 className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-brand-navy">
        Réglée comme une horloge.
      </h2>
    </motion.div>

    {/* Desktop-first : rangée en base, colonne en repli mobile */}
    <div className="mx-auto flex max-w-7xl flex-row items-center gap-8 px-12 max-md:flex-col max-md:items-stretch max-md:px-6">
      <ol className="flex flex-1 flex-row items-stretch gap-3 max-sm:flex-col max-sm:gap-5">
        {ETAPES_MECHANIQUE.map((e, i) => (
          <Fragment key={e.titre}>
            {i > 0 && (
              <ChevronRight
                className="size-5 shrink-0 self-center text-outline-variant max-sm:hidden"
                aria-hidden
              />
            )}
            <motion.li
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-1 items-start gap-3.5"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-brand-orange/40 bg-white font-heading text-sm font-extrabold text-brand-orange shadow-soft">
                0{i + 1}
              </span>
              <div>
                <p className="flex items-center gap-2 font-heading text-sm font-bold text-brand-navy">
                  <e.icon className="size-4 text-brand-orange" aria-hidden />
                  {e.titre}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{e.texte}</p>
              </div>
            </motion.li>
          </Fragment>
        ))}
      </ol>
      <Link
        to="/comment-ca-marche"
        className="group inline-flex shrink-0 items-center gap-2 rounded-lg border border-brand-navy/20 bg-white px-5 py-2.5 text-sm font-bold text-brand-navy shadow-soft transition-all duration-300 hover:border-brand-navy hover:bg-brand-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:self-center"
      >
        Voir le détail
        <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
      </Link>
    </div>
  </section>
)

export default BandeMechanique