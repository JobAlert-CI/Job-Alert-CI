// src/pages/offres/detail/components/CarteEntreprise.jsx
import { motion } from "framer-motion"
import { Building2, MapPin } from "lucide-react"
import { useOffreDetail } from "@/contexts/DetailsOffre.context"
import { ENTREPRISE_TOTAL_FALLBACK, getInitials } from "@/tools/offre-detail.tools"

const CarteEntreprise = () => {
  const { offre } = useOffreDetail()

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="mt-6 rounded-xl border border-outline-variant/40 bg-white p-7 shadow-soft max-sm:p-6"
    >
      <h2 className="flex items-center gap-2.5 font-heading text-xl font-extrabold text-brand-navy">
        <Building2 className="size-5 text-brand-orange" aria-hidden />
        L'entreprise
      </h2>

      <div className="mt-4 flex items-center gap-4">
        <span
          className="grid size-14 shrink-0 place-items-center rounded-xl bg-brand-navy font-heading text-lg font-extrabold text-white"
          aria-hidden
        >
          {getInitials(offre.entreprise)}
        </span>
        <div className="min-w-0">
          <p className="font-heading text-base font-bold text-brand-navy">{offre.entreprise}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden />
            {offre.ville}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-surface-container-low/70 px-4 py-3">
          <p className="font-heading text-2xl font-black text-brand-navy">
            {ENTREPRISE_TOTAL_FALLBACK}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
            offre(s) active(s) sur JobAlert CI
          </p>
        </div>
        <div className="rounded-lg bg-surface-container-low/70 px-4 py-3">
          <p className="font-heading text-2xl font-black text-brand-navy max-md:text-xl">
            {offre.jours === 0 ? "Aujourd'hui" : `Il y a ${offre.jours} j`}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
            publication sur {offre.sourceLabel || offre.source}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

export default CarteEntreprise