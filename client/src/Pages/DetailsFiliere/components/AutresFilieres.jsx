// src/pages/filieres/detail/components/AutresFilieres.jsx
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { HUES, BRAND_HUE } from "@/lib/hues"
import { useFilieresListeQuery, adaptFiliere } from "@/tools/filiere-detail.tools"
import { useFiliereDetail } from "@/contexts/DetailsFiliere.context"
import { useMemo } from "react"

/* Autres filières — clé de cache identique à la page /filieres :
   si la liste est déjà connue, ce bloc s'affiche instantanément. */
const AutresFilieres = () => {
  const { slug } = useFiliereDetail()
  const { data: rawFilieres, isPending } = useFilieresListeQuery()

  const autres = useMemo(
    () =>
      (Array.isArray(rawFilieres) ? rawFilieres : [])
        .map(adaptFiliere)
        .filter((f) => f && f.code !== slug && f.is_active !== false),
    [rawFilieres, slug]
  )

  return (
    <section className="bg-surface-container-lowest pb-20">
      <div className="mx-auto max-w-7xl px-12 max-md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-between gap-4 border-t border-outline-variant/40 pt-10"
        >
          <h2 className="font-heading text-xl font-bold text-brand-navy max-sm:text-lg">
            Explorer les autres filières
          </h2>
          <Link
            to="/filieres"
            className="group inline-flex items-center gap-1 rounded-sm text-sm font-bold text-brand-navy transition-colors hover:text-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Tout voir
            <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
          </Link>
        </motion.div>

        {isPending ? (
          <div className="mt-6 grid grid-cols-4 gap-3 max-xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={`filiere-skeleton-${i}`} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : (
          /* Desktop-first : 4 colonnes en base, repli 3 / 2 / 1 */
          <div className="mt-6 grid grid-cols-4 gap-3 max-xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {autres.slice(0, 8).map((f, i) => {
              const h = HUES[f.hue] || BRAND_HUE
              return (
                <motion.div
                  key={f.code}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: (i % 8) * 0.05, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Link
                    to={`/filieres/${f.code}`}
                    className="group flex items-center gap-3.5 rounded-xl border border-outline-variant/50 bg-white p-4 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-brand-navy/25 hover:shadow-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-105", h.tile)}>
                      <f.icon className="size-5" strokeWidth={2} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-heading text-sm font-bold text-brand-navy">{f.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {f.actives} offres actives · {f.abonnes.toLocaleString("fr-FR")} abonnés
                      </p>
                    </div>
                    <ArrowUpRight className="size-4 shrink-0 text-outline-variant transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-orange" aria-hidden />
                  </Link>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export default AutresFilieres