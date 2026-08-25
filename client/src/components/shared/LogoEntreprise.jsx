import { useState } from "react"
import { cn } from "@/lib/utils"
import { getInitials } from "@/tools/offre-detail.tools"

/* Logo de l'entreprise avec fallback sur les initiales navy
   si l'image est absente ou en erreur (Cf. Audit.md — Pilier 6). */
const LogoEntreprise = ({ entreprise, logoUrl, className }) => {
  const [failed, setFailed] = useState(false)
  const showLogo = logoUrl && !failed

  return showLogo ? (
    <img
      src={logoUrl}
      alt={`Logo ${entreprise}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("shrink-0 rounded-lg object-contain bg-white p-1", className)}
    />
  ) : (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-lg bg-brand-navy font-heading font-extrabold text-white",
        className,
      )}
    >
      {getInitials(entreprise)}
    </span>
  )
}

export default LogoEntreprise
