// src/pages/comment-ca-marche/visuals/VisualDedup.jsx
import { motion } from "framer-motion"
import { Fingerprint } from "lucide-react"
import { VisualFrame } from "@/components/shared"

const VisualDedup = () => (
  <VisualFrame time="06h15">
    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      6h15 — même annonce, deux sources
    </p>
    <div className="mt-3.5 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="rounded-lg border border-emerald-500/30 bg-emerald-50/40 p-3.5"
      >
        <div className="flex items-center justify-between gap-2">
          <Fingerprint className="size-4 text-emerald-600" />
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            ✓ Insérée
          </span>
        </div>
        <p className="mt-2.5 text-[13px] font-bold text-brand-navy">Comptable senior</p>
        <p className="text-[11px] text-muted-foreground">Groupe SIFCA · via Novojob</p>
        <p className="mt-2 rounded bg-surface-container-low px-2 py-1 font-mono text-[10px] text-on-surface-variant">
          hash: a3f8…9c2
        </p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="relative rounded-lg border border-outline-variant/50 bg-surface-container-low/50 p-3.5 opacity-80"
      >
        <motion.span
          initial={{ scale: 1.7, opacity: 0, rotate: 16 }}
          whileInView={{ scale: 1, opacity: 1, rotate: 6 }}
          viewport={{ once: true }}
          transition={{ delay: 0.75, duration: 0.3, ease: "backOut" }}
          className="absolute right-2.5 top-2.5 rounded border-2 border-red-500/70 bg-white/80 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-red-600"
        >
          Doublon
        </motion.span>
        <Fingerprint className="size-4 text-muted-foreground" />
        <p className="mt-2.5 text-[13px] font-bold text-on-surface-variant line-through decoration-red-400/70">
          Comptable senior
        </p>
        <p className="text-[11px] text-muted-foreground">Groupe SIFCA · via GoAfrica</p>
        <p className="mt-2 rounded bg-surface-container px-2 py-1 font-mono text-[10px] text-muted-foreground">
          hash: a3f8…9c2
        </p>
        <p className="mt-1.5 text-[10px] font-semibold text-red-600/80">
          Écartée — déjà en base
        </p>
      </motion.div>
    </div>
    <p className="mt-3.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Fingerprint className="size-3.5 shrink-0 text-brand-orange" />
      Empreinte calculée depuis le lien de l'annonce — contrainte UNIQUE en base.
    </p>
  </VisualFrame>
)

export default VisualDedup