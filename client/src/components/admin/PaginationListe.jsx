import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

/* ─────────────────────────────────────────────────────────────────────
   Pagination admin pour les listes PLATES sans total (pattern Offres /
   Entreprises : l'API renvoie une liste, jamais de total).

   Affichage honnête : « Page N » + Précédent/Suivant, « Suivant »
   actif seulement si la page courante semble pleine (len == limite —
   heuristique documentée, jamais de numérotation inventée).

   Si un total réel est connu (endpoint dédié), le prop `total`
   l'affiche en plus : « X éléments · Page N ».
   ───────────────────────────────────────────────────────────────────── */

const PaginationListe = ({ page, pagePleine, total, onPageChange }) => {
  if (page <= 1 && !pagePleine) return null

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-2"
      data-testid="pagination-liste"
    >
      <p className="text-xs text-muted-foreground tabular-nums">
        {typeof total === "number"
          ? `${total} élément${total > 1 ? "s" : ""} · `
          : ""}
        Page {page}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Page précédente"
        >
          <ChevronLeft aria-hidden /> Précédent
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!pagePleine}
          aria-label="Page suivante"
        >
          Suivant <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  )
}

export default PaginationListe
