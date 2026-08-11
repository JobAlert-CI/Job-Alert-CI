// src/pages/sources/components/ConsoleScan.jsx
import { useMemo } from "react"
import { motion } from "framer-motion"
import {
  Check, Clock, Radar, ShieldCheck, Zap,
} from "lucide-react"
import {
  HoverCard, HoverCardContent, HoverCardTrigger,
} from "@/components/ui/hover-card"
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { POSITIONS_RADAR } from "@/tools/sources.tools"
import { CompteReboursScan } from "./CompteReboursScan"
import { SourceLogo } from "@/components/shared"
import { useSourcesContext } from "@/contexts/Sources.context"

const formatDateFr = () => {
  const d = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  return d.charAt(0).toUpperCase() + d.slice(1)
}

/* ═══ Panneau radar — gère ses propres états ═══ */
const ConsoleScan = () => {
  const { sources, nbSourcesActives, sourcesQuery, statsQuery } = useSourcesContext()
  const dateFr = useMemo(() => formatDateFr(), [])

  const isLoading = (sourcesQuery.isPending || statsQuery.isPending) && sources.length === 0
  const hasError = (sourcesQuery.isError || statsQuery.isError) && sources.length === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, rotate: 1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-md min-w-0 md:max-w-none"
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
        animate={{ opacity: 1, scale: 1, y: [0, -7, 0] }}
        transition={{
          delay: 0.9,
          opacity: { duration: 0.4 },
          scale: { duration: 0.4 },
          y: { duration: 4.6, repeat: Infinity, ease: "easeInOut" },
        }}
        className="absolute -top-4 left-5 z-20 inline-flex -rotate-3 items-center gap-1.5 rounded-full bg-brand-orange px-3.5 py-1.5 text-[11px] font-bold text-white shadow-lg sm:-left-4"
      >
        <Radar className="size-3" aria-hidden />
        {sources.length > 0
          ? `${nbSourcesActives}/${sources.length} sources actives`
          : isLoading ? "Chargement…" : "Aucune source"}
      </motion.span>
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.05, duration: 0.4 }}
        className="absolute -top-3 right-6 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-600 shadow-soft"
      >
        <ShieldCheck className="size-3" aria-hidden />
        0 doublon
      </motion.span>

      <div className="relative overflow-hidden rounded-2xl border border-outline-variant/40 bg-white shadow-[0_24px_48px_-16px_rgba(15,45,77,0.22)]">
        {/* En-tête */}
        <div className="flex items-center gap-3 border-b border-outline-variant/40 bg-surface-container-low/60 px-5 py-4">
          <span className="relative flex size-2.5 shrink-0" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm font-bold text-brand-navy">Radar de collecte</p>
            <p className="text-[11px] text-muted-foreground">
              {dateFr} · dernier passage 06h02
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-navy px-2.5 py-1 text-[10px] font-bold text-white">
            <Zap className="size-3 text-brand-orange" aria-hidden />
            100 % auto
          </span>
        </div>

        {/* Panneau radar — skeleton dédié */}
        {isLoading ? (
          <div className="relative bg-brand-navy px-5 py-6" aria-busy="true">
            <span className="sr-only" role="status">Chargement du radar…</span>
            <div className="relative mx-auto aspect-square w-full max-w-65">
              <div className="absolute inset-0 rounded-full border border-white/12" />
              <div className="absolute inset-[17%] rounded-full border border-white/10" />
              <div className="absolute inset-[34%] rounded-full border border-white/8" />
              {Array.from({ length: 4 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${POSITIONS_RADAR[i].x}%`,
                    top: `${POSITIONS_RADAR[i].y}%`,
                  }}
                >
                  <Skeleton className="size-4 rounded-full bg-white/20" />
                </span>
              ))}
            </div>
          </div>
        ) : hasError ? (
          <div className="bg-brand-navy px-5 py-10 text-center text-white">
            <p className="text-sm text-white/70">
              Radar indisponible — les statistiques sources n'ont pas pu être chargées.
            </p>
            <button
              type="button"
              onClick={() => statsQuery.refetch()}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-white/25 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/10"
            >
              Recharger
            </button>
          </div>
        ) : (
          <div className="relative overflow-hidden bg-brand-navy px-5 py-6">
            <div className="pointer-events-none absolute inset-0 bg-pattern opacity-15" aria-hidden />
            <div className="relative mx-auto aspect-square w-full max-w-65">
              <div className="absolute inset-0 rounded-full border border-white/12" />
              <div className="absolute inset-[17%] rounded-full border border-white/10" />
              <div className="absolute inset-[34%] rounded-full border border-white/8" />
              <div className="absolute left-1/2 top-0 h-full w-px bg-white/6" aria-hidden />
              <div className="absolute top-1/2 left-0 h-px w-full bg-white/6" aria-hidden />
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "conic-gradient(from 0deg, rgba(245,166,35,0.45) 0deg, rgba(245,166,35,0.08) 45deg, transparent 75deg)",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                aria-hidden
              />
              {sources.map((s, i) => {
                const pos = POSITIONS_RADAR[i % POSITIONS_RADAR.length]
                return (
                  <Tooltip key={s.rawCode}>
                    <TooltipTrigger asChild>
                      <span
                        className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-default"
                        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                      >
                        <span className="relative flex size-3">
                          <motion.span
                            className="absolute inline-flex size-full rounded-full opacity-60"
                            style={{ backgroundColor: s.hex }}
                            animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
                            transition={{
                              duration: 2.4,
                              repeat: Infinity,
                              delay: i * 0.8,
                              ease: "easeInOut",
                            }}
                          />
                          <span
                            className="relative inline-flex size-3 rounded-full border-2 border-white/80"
                            style={{ backgroundColor: s.hex }}
                          />
                        </span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-center">
                      {s.code} · +{s.nouveaux} offre{s.nouveaux > 1 ? "s" : ""} ce matin
                    </TooltipContent>
                  </Tooltip>
                )
              })}
              <span
                className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-orange shadow-[0_0_12px_rgba(245,166,35,0.8)]"
                aria-hidden
              />
            </div>
          </div>
        )}

        {/* Liste des sources */}
        <ul className="divide-y divide-outline-variant/30 px-3" role="list">
          {isLoading && sources.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg px-2 py-3" aria-hidden>
                  <Skeleton className="size-9 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-4 w-6" />
                </li>
              ))
            : sources.map((s, i) => (
                <HoverCard key={s.rawCode} openDelay={150}>
                  <HoverCardTrigger asChild>
                    <motion.li
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.4,
                        delay: 0.55 + i * 0.12,
                        ease: "easeOut",
                      }}
                      className="flex cursor-default items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-surface-container-low/60"
                    >
                      <SourceLogo code={s.code} className="size-9 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-on-surface">
                          {s.code}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Passage à {s.passage}
                          {s.duree ? ` · ${s.duree}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 font-heading text-sm font-extrabold text-brand-navy">
                        +{s.nouveaux}
                      </span>
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
                        <Check className="size-3" strokeWidth={4} aria-hidden />
                      </span>
                    </motion.li>
                  </HoverCardTrigger>
                  <HoverCardContent align="start" className="w-60">
                    <p className="font-heading text-sm font-semibold">{s.code}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.nouveaux} offre{s.nouveaux > 1 ? "s" : ""} extraite{s.nouveaux > 1 ? "s" : ""} ce matin.
                      {" "}{s.total} offre{s.total > 1 ? "s" : ""} active{s.total > 1 ? "s" : ""} au total.
                    </p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                      <ShieldCheck className="size-3.5" aria-hidden />
                      Source opérationnelle
                    </p>
                  </HoverCardContent>
                </HoverCard>
              ))}
        </ul>

        {/* Pied : prochain scan */}
        <div className="flex items-center justify-between gap-3 border-t border-outline-variant/40 bg-brand-navy px-5 py-3.5 text-white">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/70">
            <Clock className="size-3.5 text-brand-orange" aria-hidden />
            Prochain scan dans
          </p>
          <CompteReboursScan />
        </div>
      </div>
    </motion.div>
  )
}

export default ConsoleScan