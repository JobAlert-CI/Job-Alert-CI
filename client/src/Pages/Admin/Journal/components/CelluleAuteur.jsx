import { UserX } from "lucide-react";


/* ─── Auteur (desktop + mobile) : null avec admin_id = supprimé ─── */
const CelluleAuteur = ({ entree, auteurResolu }) =>
  entree.admin_id && !auteurResolu ? (
    <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Compte supprimé — entrées préservées (cycle 15)">
      <UserX className="size-3.5" aria-hidden /> Admin supprimé
    </span>
  ) : (
    <span className="text-xs font-medium">
      {auteurResolu?.full_name ?? "—"}
      {auteurResolu && (
        <span className="block truncate text-[10px] text-muted-foreground">{auteurResolu.email}</span>
      )}
    </span>
  )

export default CelluleAuteur