import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"

/* ─────────────────────────────────────────────────────────────────────
PaginationListe — pagination des listes admin.
Deux modes :
• HEURISTIQUE (listes plates sans total — pattern historique) :
  `pagePleine` (len == limit) active « Suivant ». Affichage honnête :
  « Page N », jamais de numérotation inventée.
• TOTAL SERVI (endpoint qui renvoie {items, total}) : passer `total`
  et `totalPages` → « N éléments · Page X sur Y », bornes exactes :
  « Suivant » désactivé sur la dernière page. Le mode total rend
  l'heuristique `pagePleine` inutile (rétrocompatibilité conservée).
Refonte :
• Ne disparaît PLUS quand page > 1 : dépasser la fin d'une liste plate
  menait à une page vide SANS bouton pour revenir — « Précédent »
  reste désormais toujours utilisable (le composant n'est masqué que
  sur une page unique).
• `chargement` désactive les deux boutons pendant le fetch (pas de
  double-clic qui empile les offsets).
• Garde-fous : page non numérique / < 1 ramenée à 1 ; onPageChange
  reçoit toujours un entier ≥ 1.
• aria-live : le changement de page est annoncé aux lecteurs d'écran.
───────────────────────────────────────────────────────────────────── */
const formatNombre = (v) => (v ?? 0).toLocaleString("fr-FR")

const PaginationListe = ({
  page,
  pagePleine,
  total,       // optionnel — nombre total d'éléments (mode « total servi »)
  totalPages,  // optionnel — nombre de pages (mode « total servi »)
  chargement = false,
  onPageChange,
  libelle = "élément",
  className = "",
}) => {
  const pageSure = Math.max(1, Math.trunc(Number(page)) || 1)
  const modeTotal = typeof totalPages === "number" && totalPages >= 1
  const pagesTotales = modeTotal ? Math.max(1, Math.trunc(totalPages)) : null

  const surPremierePage = pageSure <= 1
  const surDernierePage = modeTotal ? pageSure >= pagesTotales : !pagePleine

  /* Une seule page ET on y est → rien à paginer. JAMAIS masqué dès que
     page > 1 : il faut toujours pouvoir REVENIR d'une page vide située
     au-delà de la fin d'une liste plate. */
  if (surPremierePage && surDernierePage) return null

  const allerA = (nouvellePage) => onPageChange(Math.max(1, nouvellePage))

  return (
    <nav
      aria-label="Pagination"
      aria-busy={chargement || undefined}
      className={cn("flex flex-wrap items-center justify-between gap-2", className)}
      data-testid="pagination-liste"
    >
      <p aria-live="polite" className="text-xs text-muted-foreground tabular-nums">
        {typeof total === "number" && (
          <>
            {formatNombre(total)} {libelle}
            {total > 1 ? "s" : ""} ·{" "}
          </>
        )}
        Page <span className="font-semibold text-foreground">{pageSure}</span>
        {pagesTotales && (
          <> sur <span className="font-semibold text-foreground">{pagesTotales}</span></>
        )}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => allerA(pageSure - 1)}
          disabled={chargement || surPremierePage}
          aria-label="Page précédente"
        >
          <ChevronLeft aria-hidden /> Précédent
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => allerA(pageSure + 1)}
          disabled={chargement || surDernierePage}
          aria-label="Page suivante"
        >
          Suivant <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  )
}

export default PaginationListe