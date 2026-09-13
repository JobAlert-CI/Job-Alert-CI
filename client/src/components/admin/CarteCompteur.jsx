import { Link } from "react-router-dom"
import { ArrowUpRight, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "cn"
import CountUp from "@/components/shared/CountUp"

/* ─────────────────────────────────────────────────────────────────────
  CarteCompteur — tuile de métrique cliquable (dashboard + page Offres).

  Design fluide, moderne et épuré :
    • Animations "GPU-friendly" (opacity + transform uniquement).
    • Retour tactile au clic (active:scale) + élévation au survol.
    • Skeleton fidèle au layout final, sans animate-pulse imbriqué.
    • Icône filigrane (bas-droite) + flèche "lien" (haut-droite).
    • Accessibilité : aria-label sur le lien, contenu masqué (aria-hidden), respect de prefers-reduced-motion.

  Props :
    - label        : libellé de la métrique (uppercase)
    - valeur       : valeur numérique animée via <CountUp/>
    - texte        : affichage littéral (ex. "100+"), prioritaire sur valeur
    - prefixe      : texte avant la valeur (ex. "$", "≈")
    - suffixe      : texte après la valeur (ex. "%", " offres")
    - icone        : composant Lucide en filigrane
    - tendance     : string ("+12%") ou { valeur, sens: "up"|"down"|"flat" }
    - description  : petite légende sous la valeur
    - href / query : rend la carte cliquable (react-router)
    - chargement   : état skeleton
    - className    : surcharge de style externe
───────────────────────────────────────────────────────────────────── */

/* Détecte automatiquement le sens d'une tendance depuis sa valeur. */
const detecterSens = (brut) => {
  if (typeof brut !== "string") return "flat"
  const t = brut.trim()
  if (t.startsWith("+")) return "up"
  if (t.startsWith("-")) return "down"
  const n = parseFloat(t.replace(/[^\d.-]/g, ""))
  if (!Number.isNaN(n)) {
    if (n > 0) return "up"
    if (n < 0) return "down"
  }
  return "flat"
}

const STYLES_TENDANCE = {
  up:   { chip: "bg-emerald-50 text-emerald-700", Icone: TrendingUp },
  down: { chip: "bg-red-50 text-red-600",         Icone: TrendingDown },
  flat: { chip: "bg-muted text-muted-foreground", Icone: Minus },
}

/* Petit badge de tendance (auto-détection du sens si non précisé). */
const BadgeTendance = ({ tendance }) => {
  if (tendance == null) return null
  const estObjet = typeof tendance === "object"
  const valeurAffichee = estObjet ? tendance.valeur : tendance
  if (valeurAffichee == null) return null

  const sens = (estObjet && tendance.sens) || detecterSens(String(valeurAffichee))
  const { chip, Icone } = STYLES_TENDANCE[sens] || STYLES_TENDANCE.flat

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        chip
      )}
    >
      <Icone className="size-3" aria-hidden="true" />
      {valeurAffichee}
    </span>
  )
}

const CarteCompteur = ({
  label,
  valeur,
  texte,                 // affichage littéral, prioritaire sur la valeur animée
  prefixe = null,
  suffixe = null,
  icone: Icone = null,
  tendance = null,
  description = null,
  href = null,
  query = null,
  chargement = false,
  className = null,
}) => {
  const estUnLien = Boolean(href) && !chargement
  const aUnPiedDePage = Boolean(tendance) || Boolean(description)

  /* Valeur lisible exposée aux lecteurs d'écran via aria-label. */
  const valeurAria =
    typeof texte === "string"
      ? texte
      : `${prefixe ?? ""}${Number(valeur) || 0}${suffixe ?? ""}`.trim()

  const conteneur = cn(
    // Base : carte nette, ombre fine teintée navy du projet.
    "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card p-4 text-left",
    "transition-all duration-300 ease-out shadow-soft",
    "motion-reduce:transition-none motion-reduce:transform-none",
    // Interactif : élévation au survol, enfoncement au clic, focus visible.
    estUnLien &&
      "hover:-translate-y-0.5 hover:border-brand-orange hover:shadow-hover " +
      "active:translate-y-0 active:scale-[0.98] focus-visible:border-primary/40",
    chargement && "cursor-default",
    className
  )

  const contenu = (
    /* aria-hidden sur le contenu visuel quand la carte est un lien :
       le lecteur d'écran ne lit que l'aria-label, pas deux fois. */
    <span aria-hidden={estUnLien || undefined} className="relative z-1 block">
      {/* Label */}
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
        {chargement ? (
          <span className="inline-block h-2.5 w-16 animate-pulse rounded bg-muted align-middle" />
        ) : (
          label
        )}
      </p>

      {/* Valeur : préfixe + CountUp + suffixe, ou texte littéral */}
      <p className="mt-2 flex items-baseline gap-1 font-heading text-2xl font-bold tabular-nums text-foreground">
        {chargement ? (
          <span className="inline-block h-7 w-24 animate-pulse rounded bg-muted align-middle" />
        ) : typeof texte === "string" ? (
          <span aria-label={valeurAria} className="text-sm">{texte}</span>          
        ) : (
          <>
            {prefixe && (
              <span className="text-lg font-semibold text-muted-foreground">{prefixe}</span>
            )}
            <CountUp to={Number(valeur) || 0} />
            {suffixe && (
              <span className="text-lg font-semibold text-muted-foreground">{suffixe}</span>
            )}
          </>
        )}
      </p>

      {/* Pied de page : tendance + légende */}
      {aUnPiedDePage && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          {chargement ? (
            <span className="inline-block h-4 w-20 animate-pulse rounded-full bg-muted align-middle" />
          ) : (
            <>
              {tendance && <BadgeTendance tendance={tendance} />}
              {description && <span>{description}</span>}
            </>
          )}
        </p>
      )}
    </span>
  )

  /* Élément cliquable : <Link> si href, sinon <div>. */
  const enveloppe = (
    <>
      {/* Icône filigrane (bas-droite), décorative. */}
      {Icone && !chargement && (
        <Icone
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-3 -right-3 z-0 size-20 text-primary opacity-[0.06] transition-all duration-300 group-hover:opacity-70 group-hover:text-brand-orange"
        />
      )}

      {/* Flèche "lien" (haut-droite) : glisse + fondu à l'arrivée. */}
      {estUnLien && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute right-3.5 top-3.5 z-2 flex size-6 items-center justify-center rounded-full",
            "bg-brand-navy text-brand-orange opacity-0 -translate-y-1 scale-90",
            "transition-all duration-300 ease-out",
            "group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100",
            "group-focus-visible:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:scale-100",
            "motion-reduce:transition-none motion-reduce:translate-y-0 motion-reduce:scale-100"
          )}
        >
          <ArrowUpRight className="size-3.5 stroke-4" aria-hidden="true" />
        </span>
      )}

      {contenu}
    </>
  )

  if (!estUnLien) {
    return (
      <div className={conteneur} aria-busy={chargement || undefined}>
        {enveloppe}
      </div>
    )
  }

  return (
    <Link
      to={{ pathname: href, search: query || "" }}
      className={conteneur}
      aria-label={`${label} : ${valeurAria}. Ouvrir la page détaillée`}
    >
      {enveloppe}
    </Link>
  )
}

export default CarteCompteur