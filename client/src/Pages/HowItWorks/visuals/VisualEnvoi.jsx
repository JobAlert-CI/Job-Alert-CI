// src/pages/comment-ca-marche/visuals/VisualEnvoi.jsx
import { motion } from "framer-motion"
import { BadgeCheck, RefreshCw } from "lucide-react"
import { VisualFrame } from "@/components/shared"
import { OFFRES_FILTREES } from "@/data/constanteMetier"

const VisualEnvoi = () => (
  <VisualFrame time="08h00">
    <span className="absolute -right-3 -top-3 z-10 inline-flex rotate-2 items-center gap-1.5 rounded-full bg-brand-navy px-3 py-1.5 text-[10px] font-bold text-white shadow-lg">
      <RefreshCw className="size-3 text-brand-orange" />
      3 tentatives si échec
    </span>

    <div className="overflow-hidden rounded-lg border border-outline-variant/40">
      <div className="flex items-center gap-2.5 border-b border-outline-variant/40 bg-surface-container-low/60 px-4 py-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-navy font-heading text-[9px] font-black text-white">
          JA
        </span>
        <p className="flex-1 truncate text-[12px] font-bold text-brand-navy">
          JobAlert CI{" "}
          <span className="font-medium text-muted-foreground">· Votre récapitulatif</span>
        </p>
        <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">08:00</span>
      </div>
      <div className="px-4 py-3.5">
        <p className="text-[12px] text-on-surface-variant">Bonjour Awa 👋</p>
        <p className="mt-0.5 text-[12px] text-on-surface-variant">
          <strong className="font-semibold text-on-surface">2 offres</strong>{" "}
          correspondent à vos filières :
        </p>
        <ul className="mt-2.5 space-y-1.5">
          {OFFRES_FILTREES.filter((o) => o.ok).map((o, i) => (
            <motion.li
              key={o.titre}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.4 + i * 0.15 }}
              className="flex items-center gap-2.5 rounded-md border border-outline-variant/40 px-3 py-2"
            >
              <span className="size-1.5 shrink-0 rounded-full bg-brand-orange" />
              <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-on-surface">
                {o.titre}
              </p>
              <span className="hidden shrink-0 text-[10px] text-muted-foreground max-sm:block">
                {o.entreprise}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
      <div className="flex gap-2 border-t border-outline-variant/40 bg-surface-container-low/40 px-4 py-2 text-[10px] font-medium text-muted-foreground">
        <span>Gérer mes filières</span>
        <span aria-hidden>·</span>
        <span>Me désinscrire en 1 clic</span>
      </div>
    </div>

    <p className="mt-3.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <BadgeCheck className="size-3.5 shrink-0 text-emerald-500" />
      Chaque envoi est journalisé : statut, horodatage, nombre d'offres.
    </p>
  </VisualFrame>
)

export default VisualEnvoi