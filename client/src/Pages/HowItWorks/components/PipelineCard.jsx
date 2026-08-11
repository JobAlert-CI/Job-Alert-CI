// src/pages/comment-ca-marche/components/PipelineCard.jsx
import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, Clock, MailCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { SourceLogo } from "@/components/shared"
import chipFloat from "@/lib/chipFloat"
import { STEPS_HOW, EMAIL_JOBS } from "@/data/constanteMetier"
import {
  CHIP_POSITIONS,
  PIPELINE_TICK_INTERVAL_MS,
  PIPELINE_TICK_COUNT,
  PIPELINE_DELIVERED_AT,
  SEND_TIME_LABEL,
  formatDateFr, 
  getActiveSources,
  useSources,
} from "@/tools/ccm.tools"

/**
 * Console "run quotidien" — s'alimente seule depuis le cache (useSources).
 * L'animation (tick) est indépendante du fetch : la carte vit immédiatement,
 * les données n'ajoutent que les chips et les compteurs.
 */
const PipelineCard = () => {
  const { data: sources, isPending, isError } = useSources()
  // eslint-disable-next-line react-hooks/use-memo
  const dateFr = useMemo(formatDateFr, [])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(
      () => setTick((t) => (t + 1) % PIPELINE_TICK_COUNT),
      PIPELINE_TICK_INTERVAL_MS
    )
    return () => clearInterval(id)
  }, [])

  const delivered = tick >= PIPELINE_DELIVERED_AT
  const stateOf = (index) =>
    delivered || tick > index ? "done" : tick === index ? "active" : "pending"

  const chips = useMemo(() => {
    if (!Array.isArray(sources)) return []
    return sources.map((source, index) => ({
      ...source,
      ...CHIP_POSITIONS[index % CHIP_POSITIONS.length],
    }))
  }, [sources])

  const activeSourcesCount = getActiveSources(sources).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
      className="relative min-w-0"
    >
      {!isPending &&
        !isError &&
        chips.map((chip) => (
          <motion.span
            key={chip.id || chip.code}
            {...chipFloat(chip.delay, chip.dur)}
            className={cn(
              "absolute z-20 flex items-center gap-2 -rotate-3 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-hover max-md:hidden",
              chip.cls
            )}
          >
            <SourceLogo code={chip.code || chip.name} />
            {chip.name}
          </motion.span>
        ))}

      {/* Console « run quotidien » */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-hover">
        {/* En-tête console */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider">
              Run quotidien
            </span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">{dateFr}</span>
        </div>

        {/* Pipeline */}
        <div className="p-6 max-sm:p-5">
          {STEPS_HOW.map((s, i) => {
            const st = stateOf(i)
            return (
              <div key={s.title} className="relative flex gap-4 pb-7 last:pb-0">
                {/* Connecteur vertical */}
                {i < STEPS_HOW.length - 1 && (
                  <span
                    className="absolute left-5 top-11 h-[calc(100%-2.5rem)] w-0.5 -translate-x-1/2 rounded bg-border"
                    aria-hidden
                  >
                    <motion.span
                      className="block w-full origin-top rounded bg-brand-orange"
                      initial={false}
                      animate={{ scaleY: st === "done" ? 1 : 0 }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                      style={{ height: "100%" }}
                    />
                  </span>
                )}
                {/* Nœud */}
                <div
                  className={cn(
                    "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500",
                    st === "pending" && "border-border bg-muted text-muted-foreground",
                    st === "active" && "scale-110 border-brand-orange bg-brand-orange/10 text-brand-orange",
                    st === "done" && "border-transparent text-white"
                  )}
                  style={st === "done" ? { backgroundColor: s.hex } : undefined}
                >
                  {st === "done" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <s.icon className="h-4.5 w-4.5" />
                  )}
                  {st === "active" && (
                    <span
                      className="absolute inset-0 animate-ping rounded-full border-2 border-brand-orange opacity-50"
                      aria-hidden
                    />
                  )}
                </div>
                {/* Contenu étape */}
                <div className="min-w-0 pt-0.5">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="font-mono text-xs font-bold text-muted-foreground">
                      {s.time}
                    </span>
                    <span className="font-heading text-sm font-extrabold uppercase tracking-wide">
                      {s.title}
                    </span>
                    {/* Statut */}
                    <span className="relative inline-flex h-4 items-center">
                      <motion.span
                        animate={{ opacity: st === "active" ? 1 : 0 }}
                        transition={{ duration: 0.25 }}
                        className={cn(
                          "animate-pulse text-[10px] font-bold uppercase tracking-wider text-brand-orange",
                          st !== "active" && "hidden"
                        )}
                        aria-hidden={st !== "active"}
                      >
                        en cours…
                      </motion.span>
                      <motion.span
                        animate={{ opacity: st === "done" ? 1 : 0 }}
                        transition={{ duration: 0.25 }}
                        className={cn(
                          "absolute inset-0 flex items-center text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400",
                          st !== "done" && "hidden"
                        )}
                        aria-hidden={st !== "done"}
                      >
                        terminé
                      </motion.span>
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {s.desc}
                  </p>
                  <motion.p
                    initial={false}
                    animate={{ opacity: st === "done" ? 1 : 0, y: st === "done" ? 0 : 3 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="mt-0.5 text-[11px] font-bold"
                    style={{ color: s.hex === "#0F2D4D" ? undefined : s.hex }}
                    aria-hidden={st !== "done"}
                  >
                    <span className={s.hex === "#0F2D4D" ? "text-foreground" : ""}>
                      ▸ {s.metric}
                    </span>
                  </motion.p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Pied */}
        <div className="border-t border-border bg-muted/40 px-6 py-4 max-sm:px-5">
          {/* Ligne de statut */}
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center">
              <AnimatePresence mode="wait" initial={false}>
                {delivered ? (
                  <motion.span
                    key="sent"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                    className="flex min-w-0 items-center gap-2 text-xs font-extrabold"
                  >
                    <MailCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="min-w-0 truncate">
                      Récapitulatif envoyé — {SEND_TIME_LABEL}
                    </span>
                  </motion.span>
                ) : (
                  <motion.span
                    key="waiting"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                    className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 truncate">
                      Envoi programmé à{" "}
                      <span className="font-mono font-extrabold text-foreground">08h00</span>
                    </span>
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            {/* Pastille droite */}
            <div className="flex h-5 shrink-0 items-center">
              <AnimatePresence mode="wait" initial={false}>
                {delivered ? (
                  <motion.span
                    key="badge"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.3 }}
                    className="rounded-full bg-brand-orange/15 px-2 py-0.5 text-[10px] font-bold text-[#8a5c00] dark:text-brand-orange"
                  >
                    {activeSourcesCount} sources actives
                  </motion.span>
                ) : (
                  <motion.span
                    key="dots"
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-1"
                  >
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1 w-1 animate-bounce rounded-full bg-brand-orange"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
          {/* 3 lignes */}
          <div className="mt-2.5 space-y-1.5">
            {EMAIL_JOBS.map((j, i) =>
              delivered ? (
                <motion.div
                  key={`job-${j.t}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.12, duration: 0.3 }}
                  className="flex h-7.5 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-[11px]"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange" />
                  <span className="min-w-0 truncate font-semibold">{j.t}</span>
                  <span className="min-w-0 truncate text-muted-foreground">— {j.e}</span>
                </motion.div>
              ) : (
                <div
                  key={`skeleton-${j.t}`}
                  className="flex h-7.5 animate-pulse items-center gap-2 rounded-md border border-border bg-card px-2.5"
                  style={{ animationDelay: `${i * 0.2}s` }}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/20" />
                  <span
                    className="h-2 rounded-full bg-muted-foreground/15"
                    style={{ width: `${68 - i * 14}%` }}
                  />
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default PipelineCard