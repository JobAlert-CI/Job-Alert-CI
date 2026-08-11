
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowUpRight, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { ChipSource } from "./SourceBadge"
import getFiliereTheme from "@/lib/filiere-theme"

/** offre : { id, titre, entreprise, ville, contrat, source, fresh, icon, tile, hover } */
const FeedOffreCard = ({ offre, index = 0, to, className }) => {
  const theme = getFiliereTheme(offre.primary_filiere?.code)
  const Icon = theme.icon
  return (
    <motion.li
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        to={to ?? `/offres/${offre.id}`}
        className={cn(
          "group flex items-center gap-4 rounded-xl border border-outline-variant/40 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-orange/50 hover:shadow-hover",
          theme.hover,
          className
        )}
      >
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg transition-all duration-500", theme.tile)}>
          <Icon className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-heading text-[15px] font-bold text-brand-navy transition-colors duration-300 group-hover:text-brand-orange">
              {offre.title}
            </h3>
            {/* {offre.fresh && <BadgeNouveau variant="solid" />} */}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted-foreground">
            <span className="font-medium text-on-surface-variant">{offre.company?.name}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{offre.location?.city}</span>
            <span aria-hidden>·</span>
            <span>{offre.contract_type?.label}</span>
          </p>
        </div>
        <ChipSource
          source={offre.source.code}
          tooltip={`Collectée sur ${offre.source.code} à 6h02`}
          className="hidden md:inline-flex"
        />
        <ArrowUpRight className="size-4 shrink-0 text-outline-variant transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-orange" />
      </Link>
    </motion.li>
  )
}
export default FeedOffreCard