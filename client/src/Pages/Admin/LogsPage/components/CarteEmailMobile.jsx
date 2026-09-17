import { memo } from "react"
import { Link } from "react-router-dom"
import { Eye, User } from "lucide-react"
import { dateHeure } from "@/lib/dates"
import { VARIANTE_STATUT_EMAIL, libelleMotif, libelleStatutEmail } from "@/features/admin-logs.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

/* ─── Carte mobile (miroir de la ligne desktop) ─────────────────────
   Toutes les actions restent accessibles : badge statut, erreur inline,
   lien abonné, bouton détail (Dialog). */
const CarteEmailMobile = memo(function CarteEmailMobile({ email, onDetail }) {
  return (
    <article
      aria-label={`Email à ${email.to_email}`}
      className="rounded-xl border border-border bg-card p-4 shadow-soft"
    >
      {/* En-tête : date + badge statut + détail */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {dateHeure(email.created_at)}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={VARIANTE_STATUT_EMAIL[email.status] ?? "outline"}>
            {libelleStatutEmail(email.status)}
          </Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDetail(email)}
            aria-label={`Détails de l'email à ${email.to_email}`}
          >
            <Eye className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Destinataire + lien abonné */}
      <div className="mt-2">
        <p className="truncate text-sm font-medium" title={email.to_email}>
          {email.to_email}
        </p>
        {email.subscriber_id && (
          <Link
            to={`/admin/utilisateurs/${email.subscriber_id}`}
            className="inline-flex items-center gap-1 text-[10px] text-primary underline-offset-2 hover:underline"
          >
            <User className="size-3" aria-hidden /> Fiche abonné
          </Link>
        )}
      </div>

      {/* Motif */}
      <p className="mt-1.5 text-xs text-muted-foreground">
        {libelleMotif(email.purpose)}
      </p>

      {/* Erreur (si failed) */}
      {email.status === "failed" && email.last_error && (
        <p className="mt-1.5 line-clamp-2 rounded-md bg-destructive/10 p-1.5 font-mono text-[10px] text-destructive" title={email.last_error}>
          {email.last_error}
        </p>
      )}

      {/* Pied : tentatives */}
      <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {email.attempts} tentative{email.attempts > 1 ? "s" : ""}
        </span>
      </div>
    </article>
  )
})

export default CarteEmailMobile