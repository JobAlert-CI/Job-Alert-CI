// src/pages/home/components/EmptyOffers.jsx
import { Link } from "react-router-dom"
import { Bell } from "lucide-react"

export const EmptyOffers = ({ onRetryOffers }) => (
  <li className="rounded-xl border border-dashed border-outline-variant/70 bg-surface-container-low/40 px-6 py-12 text-center">
    <p className="font-heading text-base font-bold text-brand-navy">
      Aucune nouvelle offre pour le moment.
    </p>
    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
      La prochaine collecte arrive à 6h00. Inscrivez-vous pour recevoir votre
      récapitulatif personnalisé à 8h00.
    </p>
    <div className="flex items-center justify-center-safe gap-3">
      <Link
        to="/inscription"
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-orange/90"
      >
        <Bell className="size-4" aria-hidden />
        Créer mon alerte gratuite
      </Link>
      {onRetryOffers && (
        <button
          type="button"
          onClick={onRetryOffers}
          className="mt-5 inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-1.5 font-bold text-amber-900 transition-colors hover:bg-amber-100"
        >
          Réessayer
        </button>
      )}
    </div>
  </li>
)