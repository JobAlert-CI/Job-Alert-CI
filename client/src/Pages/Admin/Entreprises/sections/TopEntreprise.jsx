import { motion } from "framer-motion"
import { Trophy } from "lucide-react"
import { cn } from "cn"
import { useAdminTopRecruteursQuery } from "@/features/admin-entreprises.tools"
import { Skeleton } from "@/components/ui/skeleton"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { SectionErreur, SectionVide, TransitionEtat } from "@/components/admin/EtatsSection"
import Bloc from "@/components/admin/Bloc"
import { formatNombre } from "@/lib/utils"

/* ─────────────────────────────────────────────────────────────────────
   Widget Top recruteurs — dashboard admin.
   Skeleton fidèle + transition d'état (TransitionEtat).
───────────────────────────────────────────────────────────────────── */

const VARIANTS_LISTE = {
  cache: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
}
const VARIANTS_LIGNE = {
  cache: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
}

/* Podium : or, argent, bronze — le reste en neutre. */
const STYLE_PODIUM = [
  "bg-amber-400 text-amber-950",
  "bg-slate-300 text-slate-800",
  "bg-orange-300 text-orange-950",
]
const styleRang = (i) => STYLE_PODIUM[i] ?? "bg-muted text-muted-foreground"

/* ── Skeleton fidèle à la ligne réelle ─────────────────────────────
   Géométrie exacte du motion.li : pastille de rang (size-5), nom
   tronqué (flex-1), compteur aligné à droite — mêmes gap/padding. */
const BlocSkel = ({ className, delay = 0 }) => (
  <Skeleton className={className} style={delay ? { animationDelay: `${delay}ms` } : undefined} />
)

const SkeletonLigneTop = ({ delay = 0 }) => (
  <div className="flex items-center gap-2 rounded-md px-1 py-0.5" aria-hidden="true">
    <BlocSkel className="size-5 shrink-0 rounded-full" delay={delay} />
    <BlocSkel className="h-3 min-w-0 flex-1" delay={delay} />
    <BlocSkel className="ml-auto h-3 w-8 shrink-0" delay={delay} />
  </div>
)

const TopEntreprise = () => {
  const { data: top, isLoading, isError, refetch } = useAdminTopRecruteursQuery({ limit: 20 })

  /* Clé d'état de la transition : chargement / erreur / vide / données. */
  const etat = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !top?.length
        ? "vide"
        : "donnees"

  return (
    <SectionCardAdmin
      title="Top recruteurs"
      description="Classement par offres actives."
      icon={Trophy}
    >
      <Bloc>
        <TransitionEtat etat={etat} className="animate-in fade-in duration-200 motion-reduce:animate-none">
          {isError ? (
            <div className="p-4">
              <SectionErreur onRetry={refetch} message="Impossible de charger le top des recruteurs." />
            </div>
          ) : isLoading ? (
            <div
              role="status"
              aria-label="Chargement du classement des recruteurs"
              className="flex flex-col gap-1.5"
            >
              {Array.from({ length: 10 }, (_, i) => (
                <SkeletonLigneTop key={i} delay={i * 70} />
              ))}
            </div>
          ) : !top?.length ? (
            <div className="p-4">
              <SectionVide message="Aucune entreprise avec offres actives." />
            </div>
          ) : (
            <motion.ol
              variants={VARIANTS_LISTE}
              initial="cache"
              animate="visible"
              className="flex flex-col gap-1.5"
              aria-label="Top 5 des recruteurs"
            >
              {top.map((entreprise, i) => (
                <motion.li
                  key={entreprise.id}
                  variants={VARIANTS_LIGNE}
                  className="flex items-center gap-2 rounded-md px-1 py-0.5 text-xs transition-colors hover:bg-muted/50"
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
                      styleRang(i)
                    )}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span className="truncate" title={entreprise.name}>{entreprise.name}</span>
                  <span className="ml-auto shrink-0 font-semibold tabular-nums text-muted-foreground">
                    {formatNombre(entreprise.active_offers_count)}
                  </span>
                </motion.li>
              ))}
            </motion.ol>
          )}
        </TransitionEtat>
      </Bloc>
    </SectionCardAdmin>
  )
}

export default TopEntreprise