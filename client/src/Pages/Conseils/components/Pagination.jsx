// src/pages/conseils/components/Pagination.jsx
import { memo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { pagesAvecEllipses } from "@/tools/conseils.tools"

const Pagination = memo(function Pagination({
  page, totalPages, depart, nbVisibles, total, onChange,
}) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Pagination des conseils" className="mt-10 flex flex-col items-center gap-2.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          aria-label="Page précédente"
          className="grid size-9 place-items-center rounded-lg border border-outline-variant/60 bg-white text-on-surface-variant shadow-soft transition-all duration-200 enabled:hover:-translate-x-0.5 enabled:hover:border-brand-navy/40 enabled:hover:text-brand-navy enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        {pagesAvecEllipses(page, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`points-${i}`} aria-hidden className="px-0.5 text-sm font-bold text-muted-foreground/60">
              …
            </span>
          ) : (
            <button
              type="button"
              key={p}
              onClick={() => onChange(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "size-9 rounded-lg text-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                p === page
                  ? "bg-brand-navy text-white shadow-hover"
                  : "border border-outline-variant/60 bg-white text-on-surface-variant shadow-soft hover:border-brand-navy/40 hover:text-brand-navy active:scale-95"
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Page suivante"
          className="grid size-9 place-items-center rounded-lg border border-outline-variant/60 bg-white text-on-surface-variant shadow-soft transition-all duration-200 enabled:hover:translate-x-0.5 enabled:hover:border-brand-navy/40 enabled:hover:text-brand-navy enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        Conseils{" "}
        <strong className="font-heading font-bold text-brand-navy">
          {depart + 1}–{depart + nbVisibles}
        </strong>{" "}
        sur <strong className="font-heading font-bold text-brand-navy">{total}</strong> · page {page}/{totalPages}
      </p>
    </nav>
  )
})

export default Pagination