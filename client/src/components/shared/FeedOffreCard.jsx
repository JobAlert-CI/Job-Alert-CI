import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowUpRight, MapPin, Building2, Briefcase } from "lucide-react"
import { cn } from "@/lib/utils"
import { ChipSource } from "./SourceBadge"
import { paletteDepuisHex } from "@/lib/hues"

/** 
 * offre : { id, title, company, location, location_raw, contract_type, source, primary_filiere } 
 */
const FeedOffreCard = ({ offre, index = 0, to, className }) => {
  const palette = paletteDepuisHex(offre.primary_filiere?.color_hex)

  const style = {
    ...palette.style,
    '--hover-border-color': palette.hex,
    borderLeft: `3px solid ${palette.hex}`,
  };

  return (
    <motion.li
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className="group"
    >
      <Link
        to={to ?? `/offres/${offre.id}`}
        className={cn(
          "relative flex items-center gap-4 overflow-hidden rounded-xl border border-outline-variant/40 bg-card p-4 transition-all duration-300",
          "hover:-translate-y-0.5 hover:border-(--hover-border-color) hover:shadow-hover",
          className
        )}
        style={style}
      >
        {/* 1. Icône de filière */}
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-105", palette.tile, palette.tileHover)}>
          <Briefcase className="size-5" strokeWidth={2} />
        </span>

        {/* 2. Contenu principal (Titre + Métadonnées) */}
        <div className="min-w-0 flex-1 flex flex-col gap-2">
          {/* Filière */}
          <span
            className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-orange"
            style={{ color: palette.hex }}
          >
            {offre.primary_filiere.label}
          </span>

          {/* Titre */}
          <h3 className="truncate font-heading text-[15px] font-bold text-brand-navy transition-colors duration-300 group-hover/card:text-brand-orange">
            {offre.title}
          </h3>

          {/* Métadonnées avec icônes génériques */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            {/* Entreprise */}
            <span className="inline-flex items-center gap-1.5 font-medium text-on-surface-variant">
              <Building2 className="size-3.5 text-outline" strokeWidth={2} />
              {offre.company?.name ?? "N/A"}
            </span>

            {/* Séparateur visuel subtil */}
            <span className="hidden sm:inline-block size-1 rounded-full bg-outline-variant/60" aria-hidden="true" />

            {/* Localisation */}
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5 text-outline" strokeWidth={2} />
              {offre?.location_raw ?? offre.location?.city ?? "N/A"}
            </span>

            {/* Séparateur visuel subtil */}
            <span className="hidden sm:inline-block size-1 rounded-full bg-outline-variant/60" aria-hidden="true" />

            {/* Contrat */}
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="size-3.5 text-outline" strokeWidth={2} />
              {offre.contract_type?.label ?? "N/A"}
            </span>
          </div>
        </div>

        {/* 3. Côté droit (Source + Flèche) */}
        <div className="flex items-center gap-3">
          <ChipSource
            source={offre.source.code}
            title={offre.source.name}
            tooltip={`Collectée sur ${offre.source.name}`}
            className="hidden md:inline-flex"
          />

          <div className={cn(
            "flex size-8 items-center justify-center rounded-lg transition-all duration-300",
            "bg-surface-container-low text-outline-variant group-hover/card:bg-brand-orange/10 group-hover/card:text-brand-orange group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5"
          )}>
            <ArrowUpRight className="size-4" strokeWidth={2.5} />
          </div>
        </div>
      </Link>
    </motion.li>
  )
}

export default FeedOffreCard