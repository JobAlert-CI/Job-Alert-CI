// src/pages/filieres/components/CollectePanel.jsx
import { useMemo } from "react"
import { motion } from "framer-motion"
import { CheckCircle2, Clock, ShieldCheck } from "lucide-react"
import {
  HoverCard, HoverCardContent, HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Skeleton } from "@/components/ui/skeleton"
import { CountUp, CountdownEnvoi, SourceLogo } from "@/components/shared"
import { useStatsParSourceQuery, adaptSourceStats } from "@/tools/filieres.tools"

/* Panneau de collecte — se sert dans le cache et gère LUI-MÊME son
   chargement : le héro n'attend plus ses données. */
const CollectePanel = () => {
  const { data: rawSources, isPending } = useStatsParSourceQuery()
  const parSource = useMemo(() => adaptSourceStats(rawSources), [rawSources])
  const totalActives = parSource.reduce((acc, s) => acc + s.total, 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, rotate: 1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full min-w-0 max-md:mx-auto max-md:max-w-md"
    >
      <div className="absolute -inset-8 rounded-full bg-brand-orange/10 blur-3xl" aria-hidden />
      <div
        className="absolute inset-0 translate-x-4 translate-y-5 rotate-2 overflow-hidden rounded-2xl bg-brand-navy"
        aria-hidden
      >
        <div className="absolute inset-0 bg-pattern opacity-20" />
      </div>

      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
        transition={{ delay: 1, opacity: { duration: 0.4 }, scale: { duration: 0.4 }, y: { duration: 5, repeat: Infinity, ease: "easeInOut" } }}
        className="absolute -top-4 right-6 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3.5 py-1.5 text-[11px] font-bold text-emerald-600 shadow-hover"
      >
        <ShieldCheck className="size-3" aria-hidden />
        0 doublon
      </motion.span>

      <div className="relative overflow-hidden rounded-2xl border border-outline-variant/40 bg-white shadow-[0_24px_48px_-16px_rgba(15,45,77,0.22)]">
        <div className="flex items-center gap-3 border-b border-outline-variant/40 bg-surface-container-low/60 px-5 py-4">
          <span className="relative flex size-2.5 shrink-0" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm font-bold text-brand-navy">Collecte terminée</p>
            <p className="text-[11px] text-muted-foreground">
              Aujourd'hui · 06:02 · {parSource.length} source{parSource.length > 1 ? "s" : ""} scannée{parSource.length > 1 ? "s" : ""}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-navy px-2.5 py-1 text-[10px] font-bold text-white">
            <Clock className="size-3" aria-hidden />
            <CountUp to={totalActives} /> offre{totalActives > 1 ? "s" : ""}
          </span>
        </div>

        <ul className="divide-y divide-outline-variant/30 px-3">
          {isPending && parSource.length === 0
            ? [0, 1, 2, 3].map((i) => (
              <li key={`source-skeleton-${i}`} className="flex items-center gap-3 px-2 py-3" aria-hidden="true">
                <Skeleton className="size-8 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
                <Skeleton className="h-4 w-6" />
              </li>
            ))
            : parSource.map((s, i) => (
              <HoverCard key={s.code} openDelay={150}>
                <HoverCardTrigger asChild>
                  <motion.li
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.55 + i * 0.12, ease: "easeOut" }}
                    className="flex cursor-default items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-surface-container-low/60"
                  >
                    {/* Corrigé : SourceLogo attend un code, pas un label */}
                    <span className="grid size-8 shrink-0 place-items-center rounded-md font-heading text-[10px] font-extrabold text-white">
                      <SourceLogo code={s.code} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-on-surface">{s.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        +{s.nouveaux} nouvelle{s.nouveaux > 1 ? "s" : ""} offre{s.nouveaux > 1 ? "s" : ""} · {s.total} au total
                      </p>
                    </div>
                    <span className="shrink-0 font-heading text-sm font-extrabold text-brand-navy">{s.total}</span>
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-hidden />
                  </motion.li>
                </HoverCardTrigger>
                <HoverCardContent align="start" className="w-60">
                  <p className="font-heading text-sm font-semibold">{s.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.total} offre{s.total > 1 ? "s" : ""} active{s.total > 1 ? "s" : ""} dont {s.nouveaux} nouvelle{s.nouveaux > 1 ? "s" : ""} ce matin.
                  </p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    Source opérationnelle
                  </p>
                </HoverCardContent>
              </HoverCard>
            ))}
        </ul>

        <CountdownEnvoi className="border-t border-outline-variant/40 bg-surface-container-low/40 px-5 py-4" />
      </div>
    </motion.div>
  )
}

export default CollectePanel