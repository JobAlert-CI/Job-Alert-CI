
import { motion } from "framer-motion"
import { Radio } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * variant="dark"  → bandeau navy « En direct » (page Offres)
 * variant="light" → bandeau clair « Collecte du jour » (page Filières)
 * items : [{ key, dot, titre, entreprise, source }]
 */
const Ticker = ({ variant = "light", label, items = [], duration = 48, className }) => {
  const dark = variant === "dark"
  return (
    <div className={cn(
      "relative flex items-center overflow-hidden",
      dark ? "border-b border-white/10 bg-brand-navy text-white"
           : "border-y border-outline-variant/40 bg-surface-container-lowest",
      className
    )}>
      <div className={cn(
        "z-10 flex shrink-0 items-center gap-2.5 px-4 py-3 sm:px-6",
        dark ? "bg-brand-orange text-on-primary" : "border-r border-outline-variant/40 bg-surface-container-lowest"
      )}>
        {dark ? (
          <>
            <span className="relative hidden md:flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-card opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-card" />
            </span>
            <Radio className="size-3 hidden md:flex" />
          </>
        ) : (
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-orange opacity-70" />
            <span className="relative inline-flex size-2 rounded-full bg-brand-orange" />
          </span>
        )}
        <span className="whitespace-nowrap text-[9px] md:text-[11px] font-black uppercase tracking-[0.16em]">
          {label ?? (dark ? "En direct" : "Collecte du jour")}
        </span>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div className={cn("pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-linear-to-r to-transparent", dark ? "from-brand-navy" : "from-surface-container-lowest")} aria-hidden />
        <div className={cn("pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l to-transparent", dark ? "from-brand-navy" : "from-surface-container-lowest")} aria-hidden />
        <motion.div
          className="flex w-max gap-10 py-3.5 pl-8"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration, repeat: Infinity, ease: "linear" }}
        >
          {[...items, ...items].map((t, i) => (
            <span key={t.key ? `${t.key}-${i}` : i} className="flex items-center gap-2.5 whitespace-nowrap text-[13px]">
              {t.dot && <span className={cn("size-1.5 shrink-0 rounded-full", t.dot)} style={t.dotStyle} />}
              <strong className={cn("font-semibold", dark ? "text-white" : "text-brand-navy")}>{t.titre}</strong>
              {t.entreprise && <span className={dark ? "text-white/55" : "text-muted-foreground"}>· {t.entreprise}</span>}
              {t.source && <span className={cn("text-[11px]", dark ? "text-white/40" : "text-muted-foreground/70")}>via {t.source}</span>}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
export default Ticker