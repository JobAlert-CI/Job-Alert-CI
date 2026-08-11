// src/pages/home/components/RepartitionPanel.jsx
import { motion } from "framer-motion"
import { Bell, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { CountUp, CtaLink } from "@/components/shared"
import { useHomeMetrics } from "../../../tools/home.tools"
import { RepartitionSkeleton } from "./Skeletons"

/** Contenu du panneau : early returns au lieu de ternaires imbriqués. */
const PanelContent = ({ isPending, isError, repartition, bigNumber, onRetry }) => {
  if (isPending) return <RepartitionSkeleton />

  if (isError) {
    return (
      <div className="mt-5 flex flex-1 flex-col">
        <p className="text-sm leading-relaxed text-white/80">
          La répartition du jour est momentanément indisponible.
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 w-fit rounded-md border border-white/25 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10"
          >
            Recharger les statistiques
          </button>
        )}
      </div>
    )
  }

  if (repartition.items.length === 0) {
    return (
      <div className="mt-5 flex flex-1 flex-col">
        <p className="font-heading text-4xl font-black leading-none">0</p>
        <p className="mt-2 text-sm text-white/70">
          Aucune statistique par filière n'est disponible pour le moment.
        </p>
      </div>
    )
  }

  return (
    <>
      <p className="mt-5 font-heading text-5xl font-black leading-none">
        <CountUp to={Math.max(bigNumber ?? 0, 0)} />
      </p>
      <p className="mt-1.5 text-sm text-white/70">
        {repartition.mode === "new"
          ? "nouvelles offres ce matin, réparties ainsi :"
          : "offres actives, réparties ainsi :"}
      </p>
      <div className="mt-6 space-y-3.5">
        {repartition.items.map((item, index) => (
          <div key={item.id ?? item.label}>
            <div className="flex items-baseline justify-between gap-3 text-[11px] font-semibold">
              <span className="truncate text-white/80">{item.label}</span>
              <span className="shrink-0 text-white/50">{item.count}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${item.pct}%` }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.9,
                  delay: 0.3 + index * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={cn("h-full rounded-full", item.color)}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export const RepartitionPanel = () => {
  const { repartition, bigNumber, filieresQuery, refetchFilieres } = useHomeMetrics()

  return (
    <motion.aside
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex flex-col overflow-hidden rounded-xl bg-brand-navy p-6 text-white"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-pattern opacity-20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,166,35,0.16),transparent_55%)]"
        aria-hidden
      />
      <div className="relative flex flex-1 flex-col">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/90">
          <Zap className="size-3 text-brand-orange" aria-hidden />
          Run du jour · terminé
        </span>

        <PanelContent
          isPending={filieresQuery.isPending}
          isError={filieresQuery.isError}
          repartition={repartition}
          bigNumber={bigNumber}
          onRetry={refetchFilieres}
        />

        <p className="mt-6 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-white/50">
          Vous ne recevez que vos filières. Jamais le reste.
        </p>
        <CtaLink
          to="/inscription"
          size="md"
          icon={Bell}
          animateIcon
          className="mt-4 w-full"
        >
          Recevoir ma sélection à 8h00
        </CtaLink>
      </div>
    </motion.aside>
  )
}