import { Link } from "react-router-dom"
import { ArrowUpRight, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "cn"
import CountUp from "@/components/shared/CountUp"

/* ─────────────────────────────────────────────────────────────────────
  CarteCompteur — tuile de métrique cliquable (dashboard + page Offres).

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
    - tone         : signal sémantique de la carte
                      "normal"   (défaut) — carte neutre, bordure standard
                      "info"     — information mise en avant (navy)
                      "success"  — métrique positive (emerald)
                      "warning"  — point d'attention (amber)
                      "critical" — problème à traiter (red/destructive)
                      "dark"     — surface navy pleine (accent marketing)
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

/* ─────────────────────────────────────────────────────────────────────
  Déclinaisons par ton.

  • Signal = bordure latérale gauche de 3px (convention CarteSource)
    + fond très légèrement teinté (opacité faible, reste lisible).
  • Les textes conservent les couleurs par défaut — seul le cadre
    change pour attirer l'œil sans surcharger la lecture.
  • La flèche de lien et le filigrane héritent de la couleur du ton
    pour une cohérence visuelle totale.
  • "dark" = surface navy pleine (pas un mode sombre système —
    cf. index.css : thème light-only).
───────────────────────────────────────────────────────────────────── */
const STYLES_TON = {
  normal: {
    carte: "border-border bg-card",
    /* Pas de bordure latérale colorée */
    label: "text-muted-foreground/80",
    valeur: "text-foreground",
    affixe: "text-muted-foreground",
    pied: "text-muted-foreground",
    skeleton: "bg-muted",
    filigrane:
      "text-primary opacity-[0.06] group-hover:opacity-70 group-hover:text-brand-orange",
    fleche: "bg-brand-navy text-brand-orange",
  },
  info: {
    carte: "border-blue-200 bg-blue-50/40 border-l-[3px] border-l-blue-500",
    label: "text-blue-900/70",
    valeur: "text-blue-950",
    affixe: "text-blue-700",
    pied: "text-blue-900/70",
    skeleton: "bg-blue-100",
    filigrane:
      "text-blue-500 opacity-[0.08] group-hover:opacity-70 group-hover:text-blue-700",
    fleche: "bg-blue-600 text-white",
  },
  success: {
    carte: "border-emerald-200 bg-emerald-50/40 border-l-[3px] border-l-emerald-500",
    label: "text-emerald-900/70",
    valeur: "text-emerald-950",
    affixe: "text-emerald-700",
    pied: "text-emerald-900/70",
    skeleton: "bg-emerald-100",
    filigrane:
      "text-emerald-500 opacity-[0.08] group-hover:opacity-70 group-hover:text-emerald-700",
    fleche: "bg-emerald-600 text-white",
  },
  warning: {
    carte: "border-amber-200 bg-amber-50/40 border-l-[3px] border-l-amber-500",
    label: "text-amber-900/70",
    valeur: "text-amber-950",
    affixe: "text-amber-700",
    pied: "text-amber-900/70",
    skeleton: "bg-amber-100",
    filigrane:
      "text-amber-500 opacity-[0.08] group-hover:opacity-70 group-hover:text-amber-700",
    fleche: "bg-amber-500 text-white",
  },
  critical: {
    carte: "border-red-200 bg-red-50/40 border-l-[3px] border-l-red-500",
    label: "text-red-900/70",
    valeur: "text-red-950",
    affixe: "text-red-700",
    pied: "text-red-900/70",
    skeleton: "bg-red-100",
    filigrane:
      "text-red-500 opacity-[0.08] group-hover:opacity-70 group-hover:text-red-700",
    fleche: "bg-red-600 text-white",
  },
  dark: {
    carte: "border-white/10 bg-brand-navy",
    label: "text-white/60",
    valeur: "text-white",
    affixe: "text-white/70",
    pied: "text-white/70",
    skeleton: "bg-white/10",
    filigrane:
      "text-brand-orange opacity-[0.14] group-hover:opacity-70",
    fleche: "bg-brand-orange text-brand-navy",
  },
}

/**
 * 
 * @param {string} label 
 * @param {number} valeur 
 * @param {string} texte 
 * @param {string} prefixe 
 * @param {string} suffixe 
 * @param {string} icone 
 * @param {string} tendance 
 * @param {string} description 
 * @param {string} href 
 * @param {string} query 
 * @param {boolean} chargement 
 * @param {string} tone # "normal" | "info" | "success" | "warning" | "critical"
 * @param {string} className
 * @returns 
 */

const CarteCompteur = ({
  label,
  valeur,
  texte,
  prefixe = null,
  suffixe = null,
  icone: Icone = null,
  tendance = null,
  description = null,
  href = null,
  query = null,
  chargement = false,
  tone = "normal",
  className = null,
}) => {
  const ton = STYLES_TON[tone] ?? STYLES_TON.normal
  const estUnLien = Boolean(href) && !chargement
  const aUnPiedDePage = Boolean(tendance) || Boolean(description)

  /* Valeur lisible exposée aux lecteurs d'écran via aria-label. */
  const valeurAria =
    typeof texte === "string"
      ? texte
      : `${prefixe ?? ""}${Number(valeur) || 0}${suffixe ?? ""}`.trim()

  const conteneur = cn(
    "group relative flex flex-col overflow-hidden rounded-xl border p-4 text-left",
    "transition-all duration-300 ease-out shadow-soft",
    "motion-reduce:transition-none motion-reduce:transform-none",
    ton.carte,
    estUnLien &&
      "hover:-translate-y-0.5 hover:border-brand-orange hover:shadow-hover " +
      "active:translate-y-0 active:scale-[0.98] focus-visible:border-primary/40",
    chargement && "cursor-default",
    className
  )

  const contenu = (
    <span aria-hidden={estUnLien || undefined} className="relative z-1 block">
      {/* Label */}
      <p className={cn("text-[10px] font-bold uppercase tracking-wider", ton.label)}>
        {chargement ? (
          <span
            className={cn(
              "inline-block h-2.5 w-16 animate-pulse rounded align-middle",
              ton.skeleton
            )}
          />
        ) : (
          label
        )}
      </p>

      {/* Valeur : préfixe + CountUp + suffixe, ou texte littéral */}
      <p className={cn("mt-2 flex items-baseline gap-1 font-heading text-2xl font-bold tabular-nums", ton.valeur)}>
        {chargement ? (
          <span
            className={cn(
              "inline-block h-7 w-24 animate-pulse rounded align-middle",
              ton.skeleton
            )}
          />
        ) : typeof texte === "string" ? (
          <span aria-label={valeurAria} className="text-sm">{texte}</span>
        ) : (
          <>
            {prefixe && (
              <span className={cn("text-lg font-semibold", ton.affixe)}>{prefixe}</span>
            )}
            <CountUp to={Number(valeur) || 0} />
            {suffixe && (
              <span className={cn("text-lg font-semibold", ton.affixe)}>{suffixe}</span>
            )}
          </>
        )}
      </p>

      {/* Pied de page : tendance + légende */}
      {aUnPiedDePage && (
        <p className={cn("mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-medium", ton.pied)}>
          {chargement ? (
            <span
              className={cn(
                "inline-block h-4 w-20 animate-pulse rounded-full align-middle",
                ton.skeleton
              )}
            />
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

  const enveloppe = (
    <>
      {/* Icône filigrane (bas-droite), décorative. */}
      {Icone && !chargement && (
        <Icone
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -bottom-3 -right-3 z-0 size-20 transition-all duration-300",
            ton.filigrane
          )}
        />
      )}

      {/* Flèche "lien" (haut-droite) : glisse + fondu à l'arrivée. */}
      {estUnLien && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute right-3.5 top-3.5 z-2 flex size-6 items-center justify-center rounded-full",
            "opacity-0 -translate-y-1 scale-90",
            "transition-all duration-300 ease-out",
            "group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100",
            "group-focus-visible:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:scale-100",
            "motion-reduce:transition-none motion-reduce:translate-y-0 motion-reduce:scale-100",
            ton.fleche
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