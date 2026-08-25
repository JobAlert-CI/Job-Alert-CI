
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowUpRight, Bookmark, BookmarkCheck, Briefcase, Clock, GraduationCap, MapPin,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { HUES, paletteDepuisHex } from "@/lib/hues"
import { FILIERES_META } from "@/lib/referentiels"
import { addDays, publieLabel } from "@/lib/dates"
import BadgeNouveau from "./BadgeNouveau"
import CompanyHover from "./CompanyHover"
import { ChipSource } from "./SourceBadge"

/**
 * hue              → optionnel : dérivé automatiquement de offre.filiere
 * showFiliereChip  → chip filière cliquable (page /offres)
 * showSpecialite   → chip spécialité (page /filieres/:code)
 * getDetailLink    → (offre) => url de la fiche (défaut : /offres/:id)
 */
const OfferCard = ({
  offre, index = 0, view = "list",
  hue: hueProp, showFiliereChip = true, showSpecialite = false,
  saved = false, onToggleSave, getDetailLink, entrepriseTotal, className,
}) => {
  const meta = FILIERES_META.find((f) => f.code === offre.filiere)
  const hue = hueProp
    ?? (offre.filiereColorHex ? paletteDepuisHex(offre.filiereColorHex) : null)
    ?? (meta ? HUES[meta.hue] : HUES.amber)
  const isNew = offre.jours === 0
  const d = addDays(new Date(), -offre.jours)
  const detailLink = getDetailLink ? getDetailLink(offre) : `/offres/${offre.id}`
  const saveId = offre.uid ?? offre.id

  const bookmark = (
    <motion.button
      whileTap={{ scale: 0.75 }}
      onClick={() => onToggleSave?.(saveId)}
      aria-label="Enregistrer l'offre"
      className="shrink-0 rounded-lg border border-outline-variant/50 bg-white p-2 text-muted-foreground transition-colors hover:border-brand-orange/50 hover:text-brand-orange"
    >
      {saved ? <BookmarkCheck className="size-4 text-brand-orange" /> : <Bookmark className="size-4" />}
    </motion.button>
  )

  const metaChips = (
    <div className="flex flex-wrap items-center gap-1.5">
      {showFiliereChip && meta && (
        <Link
          to={`/filieres/${meta.code}`}
          className="inline-flex items-center gap-1.5 rounded-md bg-surface-container-low px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-brand-navy"
        >
          <span className={cn("size-1.5 rounded-full", hue.dot)} />
          {meta.label}
        </Link>
      )}
      {offre.niveau && (
        <span className="inline-flex items-center gap-1 rounded-md bg-surface-container-low px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
          <GraduationCap className="size-3" />{offre.niveau}
        </span>
      )}
      {offre.experience && (
        <span className="inline-flex items-center gap-1 rounded-md bg-surface-container-low px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
          <Briefcase className="size-3" />{offre.experience}
        </span>
      )}
      {showSpecialite && offre.specialite && (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-container-low px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
          <span className={cn("size-1.5 rounded-full", hue.dot)} />
          {offre.specialite}
        </span>
      )}
    </div>
  )

  const actions = (
    <div className="flex items-center gap-1.5">
      <Link
        to={detailLink}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md px-3.5 text-xs font-bold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]",
          hue.solid
        )}
      >
        Voir l'offre
      </Link>
      <a
        href={offre.lien || "#offre"}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => offre.lien ? undefined : e.preventDefault()}
        className="inline-flex h-8 items-center gap-1 px-2.5 font-heading text-xs font-bold text-[#B45309] transition-colors hover:underline"
      >
        Postuler
        <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </a>
    </div>
  )

  /* ── Vue grille ── */
  if (view === "grid") {
    return (
      <motion.article
        layout
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-30px" }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.45, delay: (index % 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
        className={cn("group flex flex-col rounded-xl border border-outline-variant/40 bg-white p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-hover", className)}
        style={{ borderTop: `3px solid ${hue.hex}`, ...hue.style }}
      >
        <div className="flex items-center justify-between gap-2">
          <ChipSource source={offre.source} title={offre.sourceLabel}  />
          <div className="flex items-center gap-2">{isNew && <BadgeNouveau />}{bookmark}</div>
        </div>
        <Link to={detailLink} className="mt-3 font-heading text-base font-bold leading-snug text-brand-navy transition-colors hover:text-brand-orange">
          {offre.titre}
        </Link>
        <div className="mt-1.5"><CompanyHover offre={offre} totalOffres={entrepriseTotal} /></div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md bg-surface-container-low px-2 py-0.5">
            <MapPin className="size-3" />{offre.ville}
          </span>
          <span className="rounded-md bg-surface-container-low px-2 py-0.5 font-semibold">{offre.contrat}</span>
        </div>
        <div className="mt-3">{metaChips}</div>
        <div className="mt-4 flex items-center justify-between border-t border-outline-variant/40 pt-3 text-xs text-muted-foreground">
          <span className={cn("font-semibold", isNew && "text-brand-orange")}>{publieLabel(offre.jours)}</span>
          {actions}
        </div>
      </motion.article>
    )
  }

  /* ── Vue liste ── */
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.45, delay: (index % 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className={cn("group rounded-xl border border-outline-variant/40 bg-white shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-hover", className)}
      style={{ borderLeft: `3px solid ${hue.hex}`, ...hue.style }}
    >
      <div className="flex gap-4 p-4 sm:p-5">
        {/* Rail date */}
        <div className="hidden w-14 max-h-38 shrink-0 flex-col items-center justify-center rounded-lg border border-outline-variant/40 bg-surface-container-low/70 sm:flex">
          {isNew ? (
            <>
              <span className="font-heading text-sm font-extrabold text-brand-orange">AUJ</span>
              <Clock className="mt-1 size-3.5 text-brand-orange" />
            </>
          ) : (
            <>
              <span className="font-heading text-xl font-extrabold leading-none text-brand-navy">{d.getDate()}</span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}
              </span>
            </>
          )}
        </div>
        {/* Contenu */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={detailLink} className="font-heading text-base font-bold leading-snug text-brand-navy transition-colors hover:text-brand-orange sm:text-lg">
                  {offre.titre}
                </Link>
                {isNew && <BadgeNouveau />}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <CompanyHover offre={offre} totalOffres={entrepriseTotal} />
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" />{offre.ville}
                </span>
                <span className="rounded-md border border-outline-variant/60 px-2 py-0.5 text-xs font-semibold text-on-surface-variant">
                  {offre.contrat}
                </span>
              </div>
            </div>
            {bookmark}
          </div>
          <div className="mt-3">{metaChips}</div>
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ChipSource source={offre.source} title={offre.sourceLabel} />
              <span className={cn("text-xs font-semibold", isNew ? "text-brand-orange" : "text-muted-foreground")}>
                {publieLabel(offre.jours)}
              </span>
            </div>
            {actions}
          </div>
        </div>
      </div>
    </motion.article>
  )
}
export default OfferCard