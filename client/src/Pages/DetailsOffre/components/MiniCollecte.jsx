// src/pages/offres/detail/components/MiniCollecte.jsx
import { motion } from "framer-motion"
import { SourceLogo } from "@/components/shared"
import { useCollecteJourQuery } from "@/tools/offre-detail.tools"

const MiniCollecte = () => {
  /* Une seule requête groupée (avant : 2 useFetchData séparés). */
  const { data: collecte } = useCollecteJourQuery()

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-outline-variant/40 bg-white p-5 shadow-soft"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Collecte du jour
        </p>
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
      </div>
      <p className="mt-2 font-heading text-3xl font-black text-brand-navy">
        {collecte.total}{" "}
        <span className="text-sm font-bold text-muted-foreground">offres · 0 doublon</span>
      </p>
      <div className="mt-3 flex items-center gap-2 border-t border-outline-variant/40 pt-3">
        {collecte.sources.map((s) => (
          /* Corrigé : SourceLogo attend un code, pas un label. */
          <SourceLogo key={s.id ?? s.code} code={s.code ?? s.label} className="size-6 rounded" />
        ))}
        <span className="ml-auto text-[11px] font-semibold text-muted-foreground">
          scannées à 6h02
        </span>
      </div>
    </motion.div>
  )
}

export default MiniCollecte