// src/pages/comment-ca-marche/visuals/VisualFiltrage.jsx
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { VisualFrame } from "@/components/shared"
import { OFFRES_FILTREES } from "@/data/constanteMetier"

const VisualFiltrage = () => (
  <VisualFrame time="07h00">
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-500 text-[11px] font-black text-white">
        AD
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold text-brand-navy">
          Awa D.{" "}
          <span className="font-medium text-muted-foreground">
            · abonnée depuis le 12/07
          </span>
        </p>
        <div className="mt-1 flex gap-1.5">
          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-700">
            RH
          </span>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            Comptabilité
          </span>
        </div>
      </div>
    </div>

    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-outline-variant/50" aria-hidden />
      <span className="whitespace-nowrap rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-bold text-on-surface-variant">
        47 offres du jour → 2 pour Awa
      </span>
      <span className="h-px flex-1 bg-outline-variant/50" aria-hidden />
    </div>

    <ul className="space-y-2">
      {OFFRES_FILTREES.map((o, i) => (
        <motion.li
          key={o.titre}
          initial={{ opacity: 0, x: -14 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 + i * 0.15, ease: "easeOut" }}
          className={cn(
            "flex items-center gap-3 rounded-lg border px-3.5 py-2.5",
            o.ok
              ? "border-brand-orange/40 border-l-2 border-l-brand-orange bg-orange-50/60"
              : "border-outline-variant/40 opacity-55"
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-on-surface">{o.titre}</p>
            <p className="truncate text-[11px] text-muted-foreground">{o.entreprise}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
              o.ok
                ? "bg-brand-orange/10 text-orange-700"
                : "bg-surface-container text-muted-foreground"
            )}
          >
            {o.ok ? "→ Dans son récap" : "Hors filières"}
          </span>
        </motion.li>
      ))}
    </ul>

    <div className="flex items-center justify-between gap-2 pt-3 max-md:flex-col">
      <p className="mt-3.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <SlidersHorizontal className="size-3.5 shrink-0 text-brand-orange" />
        Chaque abonné reçoit une liste différente — la sienne, et rien d'autre.
      </p>
      <Link
        to="/filieres"
        className="inline-flex h-8 items-center text-center gap-1 rounded-md px-2.5 text-xs font-bold bg-brand-orange text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]"
      >
        Voir toutes les filières
      </Link>
    </div>
  </VisualFrame>
)

export default VisualFiltrage