import { Link } from "react-router-dom"
import { ArrowUpRight } from "lucide-react"
import { cn } from "cn"
import CountUp from "@/components/shared/CountUp"

/* ─────────────────────────────────────────────────────────────────────
   Carte compteur cliquable du dashboard (6 compteurs de l'overview).
   Réutilise CountUp du shared existant (animation d'entrée chiffrée).
   Lien conditionnel : les cartes "offres actives" et "abonnés actifs"
   portent une query de filtre pré-appliquée (doc v3 §2 : clic → page
   détaillée filtrée, ex. /admin/offres?status=active).
   ───────────────────────────────────────────────────────────────────── */

const CarteCompteur = ({
  label,
  valeur,
  href = null,
  query = null,
  suffixe = "",
  chargement = false,
}) => {
  const conteneur = cn(
    "group rounded-xl border border-border bg-card p-4 transition-all duration-200",
    href && "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm",
    chargement && "animate-pulse"
  )

  const contenu = (
    <>
      <p className="text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase">
        {label}
      </p>
      <p className="mt-2 flex items-baseline gap-1 font-heading text-2xl font-bold tabular-nums">
        {chargement ? (
          <span className="inline-block h-7 w-14 animate-pulse rounded bg-muted align-middle" />
        ) : (
          <>
            <CountUp to={valeur ?? 0} />
            {suffixe && <span className="text-sm font-semibold text-muted-foreground">{suffixe}</span>}
          </>
        )}
      </p>
      {href && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-muted-foreground/0 transition-colors group-hover:text-muted-foreground">
          Voir <ArrowUpRight className="size-3" aria-hidden />
        </p>
      )}
    </>
  )

  if (!href || chargement) {
    return <div className={conteneur}>{contenu}</div>
  }

  return (
    <Link
      to={{ pathname: href, search: query || "" }}
      className={conteneur}
      aria-label={`${label} : ${valeur}. Ouvrir la page détaillée`}
    >
      {contenu}
    </Link>
  )
}

export default CarteCompteur