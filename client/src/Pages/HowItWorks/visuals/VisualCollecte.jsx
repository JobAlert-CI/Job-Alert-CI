// src/pages/comment-ca-marche/visuals/VisualCollecte.jsx
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Database, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { SourceLogo, VisualFrame } from "@/components/shared"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useSources,
  getActiveSources,
  getSourceStatus,
  getTotalNewOffers,
} from "@/tools/ccm.tools"

const SkeletonRow = () => (
  <li className="flex items-center gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3.5 py-2.5">
    <Skeleton className="size-2 shrink-0 rounded-full" />
    <Skeleton className="h-4 flex-1 max-w-35" />
    <Skeleton className="size-5 shrink-0 rounded-full" />
    <Skeleton className="h-3 w-10 shrink-0" />
    <Skeleton className="h-5 w-12 shrink-0 rounded-full" />
  </li>
)

const ErrorRow = ({ onRetry }) => (
  <li className="rounded-lg border border-error/30 bg-error/10 px-3.5 py-3 text-[12px] font-semibold text-error">
    Statut des scrapers momentanément indisponible.
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="ml-2 underline underline-offset-2"
      >
        Recharger
      </button>
    )}
  </li>
)

const VisualCollecte = () => {
  const { data: sources, isPending, isError, refetch } = useSources()
  const activeCount = getActiveSources(sources).length
  const totalNewOffers = getTotalNewOffers(sources)

  return (
    <VisualFrame time="06h00">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Scrapers · statut du jour
        </p>
        {!isPending && !isError && sources?.length > 0 && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            {activeCount}/{sources.length} actifs
          </span>
        )}
      </div>

      <ul className="mt-3.5 space-y-2">
        {isPending ? (
          Array.from({ length: 4 }).map((_, index) => <SkeletonRow key={index} />)
        ) : isError ? (
          <ErrorRow onRetry={refetch} />
        ) : (
          sources?.map((s, i) => {
            const status = getSourceStatus(s)
            return (
              <motion.li
                key={s.id}
                initial={{ opacity: 0, x: -14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.12, ease: "easeOut" }}
                className="flex items-center gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3.5 py-2.5"
              >
                <span className="relative flex size-2 shrink-0">
                  <span
                    className={cn(
                      "absolute inline-flex size-full animate-ping rounded-full opacity-75",
                      status.status === "active" ? "bg-emerald-400" : "bg-error"
                    )}
                  />
                  <span
                    className="relative inline-flex size-2 rounded-full"
                    style={{ background: s.color_hex || "#10b981" }}
                  />
                </span>
                <span className="flex-1 truncate text-[13px] font-semibold text-on-surface">
                  {s.name}
                </span>
                <SourceLogo code={s.code || s.name} />
                <span className="text-[11px] font-medium text-muted-foreground">
                  {s.stats?.new_offers ?? 0} nouvelles
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    status.status === "active"
                      ? "text-emerald-700 bg-emerald-500/10"
                      : "text-error bg-error/10"
                  )}
                >
                  {status.label}
                </span>
              </motion.li>
            )
          })
        )}
      </ul>

      {/* Flux vers la base */}
      <div className="flex justify-center py-2.5" aria-hidden>
        <div className="flex flex-col items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1 animate-pulse rounded-full bg-brand-orange"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg bg-brand-navy px-4 py-3 text-white">
        <Database className="size-4 shrink-0 text-brand-orange" />
        <p className="text-[13px] font-semibold">Base offres</p>
        <p className="ml-auto text-[11px] text-white/60">
          <strong className="font-heading text-brand-orange">
            +{totalNewOffers}
          </strong>{" "}
          aujourd'hui
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 pt-3 max-md:flex-col">
        <p className="mt-3.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldAlert className="size-3.5 shrink-0 text-brand-orange" />
          Chaque échec est journalisé avec horodatage
        </p>
        <Link
          to="/sources"
          className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-bold bg-primary text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]"
        >
          Voir nos sources
        </Link>
      </div>
    </VisualFrame>
  )
}

export default VisualCollecte