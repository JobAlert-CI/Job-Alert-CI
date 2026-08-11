// src/pages/comment-ca-marche/components/SourcesBand.jsx
import { Link } from "react-router-dom"
import { AlertCircle, ArrowRight } from "lucide-react"
import { SourceLogo } from "@/components/shared"
import { Skeleton } from "@/components/ui/skeleton"
import { useSources } from "@/tools/ccm.tools"

/* Early returns : un état = un rendu. */
const BandChips = () => {
  const { data: sources, isPending, isError } = useSources()

  if (isPending) {
    return Array.from({ length: 4 }).map((_, index) => (
      <div
        key={index}
        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5"
      >
        <Skeleton className="size-5 shrink-0 rounded-full bg-white/20" />
        <Skeleton className="h-4 w-16 bg-white/20" />
      </div>
    ))
  }

  if (isError) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-error/30 bg-error/10 px-3.5 py-1.5 text-[13px] font-semibold text-error">
        <AlertCircle className="size-4" />
        Erreur de chargement
      </div>
    )
  }

  return (
    <>
      {sources?.slice(0, 4)?.map((source) => (
        <a
          href={source.base_url}
          target="_blank"
          rel="noopener noreferrer"
          key={source.id || source.code}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/20"
        >
          <SourceLogo code={source.code || source.name} className="size-5" />
          {source.name}
        </a>
      ))}
      {sources?.length > 4 && (
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-white">
          + {sources.length - 4}
        </span>
      )}
    </>
  )
}

const SourcesBand = () => (
  <section className="relative overflow-hidden bg-brand-navy py-10">
    <div
      className="pointer-events-none absolute inset-0 bg-pattern opacity-20"
      aria-hidden
    />
    <div className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-12 max-md:px-6">
      <div>
        <p className="font-heading text-lg font-bold text-white">
          Elles alimentent votre récapitulatif
        </p>
        <p className="mt-0.5 text-sm text-white/60">
          Scannées chaque matin à 6h00, dans cet ordre.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <BandChips />
        <Link
          to="/sources"
          className="group inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold text-brand-orange transition-colors hover:text-white"
        >
          Notre méthode de collecte
          <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  </section>
)

export default SourcesBand