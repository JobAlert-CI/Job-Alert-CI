// src/pages/home/sections/RecentOffers.jsx
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { CountUp, SectionHeading } from "@/components/shared"
import { SCRAPE_TIME, useHomeMetrics, useRecentOffers, getViewState } from "@/tools/home.tools"
import { OffersFeed } from "../components/OffersFeed"
import { RepartitionPanel } from "../components/RepartitionPanel"

/* ------------------------------------------------------------------ */
/*  Contenus pilotés par un état unique (au lieu de 3 fonctions       */
/*  getTitre / getSub / getLinkLabel à conditions croisées)           */
/* ------------------------------------------------------------------ */
const SUBTITLES = {
  loading:
    "La collecte du jour est en cours. Votre aperçu arrive dans quelques instants.",
  degraded:
    "Certaines données sont momentanément indisponibles. Voici un aperçu des offres disponibles.",
  ready:
    "Un aperçu de la collecte. Les autres vous attendent dans le récapitulatif de 8h00.",
}

const CountTitle = ({ count }) => {
  if (count === null) {
    return (
      <>
        Ce matin, <span className="text-brand-orange">plusieurs offres</span>{" "}
        sont arrivées.
      </>
    )
  }
  if (count === 0) {
    return (
      <>
        Ce matin, <span className="text-brand-orange">vos offres</span> sont
        prêtes.
      </>
    )
  }
  if (count === 1) {
    return (
      <>
        Ce matin, <span className="text-brand-orange">1 offre</span> est
        arrivée.
      </>
    )
  }
  return (
    <>
      Ce matin,{" "}
      <span className="text-brand-orange">
        <CountUp to={count} /> offres
      </span>{" "}
      sont arrivées.
    </>
  )
}

const getLinkLabel = (count) => {
  if (count === null) return "Voir toutes les offres"
  if (count === 0) return "Voir les offres"
  if (count === 1) return "Voir l'offre du jour"
  return `Voir les ${count} offres du jour`
}

/* ------------------------------------------------------------------ */
/*  Section — aucune donnée transitée par props                       */
/* ------------------------------------------------------------------ */
const RecentOffers = () => {
  const { statsQuery, filieresQuery, countForTitle } = useHomeMetrics()
  const offersQuery = useRecentOffers()

  // Un seul état dérivé pour toute la section : "loading" | "degraded" | "ready"
  const viewState = getViewState([statsQuery, filieresQuery, offersQuery])

  const title =
    viewState === "loading" && countForTitle === null ? (
      <>
        Ce matin, <span className="text-brand-orange">la collecte</span> est en
        cours.
      </>
    ) : (
      <CountTitle count={countForTitle} />
    )

  const linkLabel = getLinkLabel(countForTitle)

  return (
    <section className="border-y border-outline-variant/30 bg-background py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow={`Collecte du jour · ${SCRAPE_TIME}`}
            title={title}
            sub={SUBTITLES[viewState]}
          />
          <Link
            to="/offres"
            className="group hidden items-center gap-2 rounded-md border border-brand-navy/15 bg-white px-5 py-3 text-sm font-bold text-brand-navy transition-all duration-300 hover:border-brand-navy/40 hover:shadow-soft md:inline-flex"
          >
            {linkLabel}
            <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Feed d'offres — autonome (son propre hook) */}
          <div>
            <OffersFeed />
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-5 text-center md:hidden"
            >
              <Link
                to="/offres"
                className="inline-flex items-center gap-2 text-sm font-bold text-brand-navy transition-colors hover:text-brand-orange"
              >
                {linkLabel}
                <ArrowRight className="size-4" />
              </Link>
            </motion.div>
          </div>

          {/* Répartition du jour — autonome (son propre hook) */}
          <RepartitionPanel />
        </div>
      </div>
    </section>
  )
}

export default RecentOffers