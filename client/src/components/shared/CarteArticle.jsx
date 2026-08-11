
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowUpRight, Clock, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { HUES } from "@/lib/hues"
import { dateLabel } from "@/lib/dates"
import { fmtVus } from "@/lib/query-helpers"
import BadgeNouveau from "./BadgeNouveau"
import { joursDepuis } from "@/tools/conseils.tools"

const CarteArticle = ({ a, index = 0, large = false }) => {
  const hue = HUES[a.category?.hue] || HUES["sky"]
  // const Icon = a.icon
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.45, delay: (index % 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className={cn(large && "sm:col-span-2")}
    >
      <Link
        to={`/conseils/${a.slug}`}
        className={cn(
          "group relative flex h-full flex-col overflow-hidden rounded-xl border border-outline-variant/40 bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-hover",
          large ? "p-5 sm:flex-row sm:items-stretch sm:gap-6 sm:p-6" : "p-5"
        )}
        style={{ borderTop: `3px solid ${hue.hex}` }}
      >
        <div className={cn("pointer-events-none absolute -right-14 -top-14 size-40 rounded-full blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100", hue.glow)} aria-hidden />
        {large && (
          <div className={cn("relative mb-5 flex shrink-0 flex-col justify-between rounded-lg p-4 sm:mb-0 sm:w-44", hue.tile)}>
            {/* <Icon className="size-7" strokeWidth={1.8} /> */}
            <div>
              <p className="font-heading text-3xl font-black leading-none">{a.reading_minutes}′</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider opacity-80">lecture</p>
            </div>
          </div>
        )}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", hue.tile)}>
              {/* <Icon className="size-3" /> */}
              {a.category?.label}
            </span>
            {joursDepuis(a.published_at) === 0 && <BadgeNouveau />}
          </div>
          <h3 className={cn(
            "mt-3 font-heading font-extrabold leading-snug text-brand-navy transition-colors duration-300 group-hover:text-brand-orange",
            large ? "text-xl sm:text-2xl" : "text-[15px]"
          )}>
            {a.title}
          </h3>
          <p className={cn("mb-4 mt-2 text-[13px] leading-relaxed text-on-surface-variant", large ? "line-clamp-3" : "line-clamp-2")}>
            {a.excerpt}
          </p>
          <div className="mt-auto flex items-center gap-3 border-t border-outline-variant/40 pt-3.5 text-[11px] font-semibold text-muted-foreground">
            <span>{dateLabel(joursDepuis(a.published_at))}</span>
            <span className="inline-flex items-center gap-1"><Clock className="size-3" />{a.reading_minutes} min</span>
            <span className="inline-flex items-center gap-1"><Eye className="size-3" />{fmtVus(a.view_count)}</span>
            <ArrowUpRight className="ml-auto size-4 text-outline-variant transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-orange" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
export default CarteArticle