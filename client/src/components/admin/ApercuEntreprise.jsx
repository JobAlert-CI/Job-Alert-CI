import { Building2, CalendarDays, ExternalLink, Globe, ImageIcon, Layers, MapPin, Pencil, Briefcase } from "lucide-react"
import { useReferentialsQuery } from "@/lib/referentiels-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"

/* ─────────────────────────────────────────────────────────────────────
   Aperçu détaillé d'une entreprise (Sheet latéral, lecture seule).

   Objectif : consulter la fiche complète SANS passer par le dialog
   d'édition — cohérent avec l'aperçu offre du cycle 5.

   Données : l'objet CompanyAdminRead est fourni par le parent (déjà
   chargé dans la liste — zéro requête supplémentaire). La filière
   principale est résolue depuis le référentiel public (cache partagé)
   via primary_filiere_id (UUID).

   Champ `active_offers_count` : compteur agrégé serveur (GROUP BY,
   cycle 6 — le bug du 0-partout a été corrigé côté backend).
   ───────────────────────────────────────────────────────────────────── */

const dateFr = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—"

const LigneInfo = ({ icone: Icone, libelle, children }) =>
  children ? (
    <div className="flex items-center gap-2 text-xs">
      <Icone className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="font-medium text-muted-foreground">{libelle}</span>
      <span className="truncate">{children}</span>
    </div>
  ) : null

export const ApercuEntreprise = ({ ouverte, onOpenChange, entreprise, onModifier }) => {
  const { data: referentiels } = useReferentialsQuery()

  // Filière principale par UUID depuis le référentiel (cache public).
  const filiere = referentiels?.filieres?.find(
    (f) => f.id === entreprise?.primary_filiere_id
  )

  if (!entreprise) return null

  return (
    <Sheet open={ouverte} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="flex-row items-start justify-between gap-2 border-b border-border">
          <div className="flex flex-col gap-1">
            <SheetTitle className="text-left text-base leading-snug">{entreprise.name}</SheetTitle>
            <SheetDescription className="text-left text-xs">
              Référentiel entreprise — fiche en lecture seule
            </SheetDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => {
              onOpenChange?.(false)
              onModifier?.(entreprise)
            }}
          >
            <Pencil aria-hidden /> Modifier
          </Button>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 p-4">
          {/* Identité */}
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden>
              {entreprise.logo_url ? (
                <img
                  src={entreprise.logo_url}
                  alt=""
                  className="size-full rounded-lg object-cover"
                  onError={(e) => { e.currentTarget.style.display = "none" }}
                />
              ) : (
                <Building2 className="size-5" />
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <Badge variant="secondary" className="w-fit tabular-nums">
                <Briefcase aria-hidden /> {entreprise.active_offers_count ?? 0} offre{((entreprise.active_offers_count ?? 0) > 1) ? "s" : ""} active{((entreprise.active_offers_count ?? 0) > 1) ? "s" : ""}
              </Badge>
              {filiere && (
                <Badge variant="outline" className="w-fit">
                  <Layers aria-hidden /> {filiere.label}
                </Badge>
              )}
            </div>
          </div>

          {/* Description */}
          {entreprise.description && (
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase">Description</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{entreprise.description}</p>
            </div>
          )}

          <Separator />

          {/* Fiche technique */}
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/20 p-3">
            <LigneInfo icone={Globe} libelle="Site :">
              {entreprise.website_url ? (
                <a
                  href={entreprise.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                >
                  {entreprise.website_url} <ExternalLink className="size-3 shrink-0" aria-hidden />
                </a>
              ) : null}
            </LigneInfo>
            <LigneInfo icone={ImageIcon} libelle="Logo :">{entreprise.logo_url}</LigneInfo>
            <LigneInfo icone={CalendarDays} libelle="Créée le :">{dateFr(entreprise.created_at)}</LigneInfo>
            <LigneInfo icone={CalendarDays} libelle="Mise à jour :">{dateFr(entreprise.updated_at)}</LigneInfo>
            <LigneInfo icone={Building2} libelle="Nom normalisé :">
              <span className="font-mono text-[10px]">{entreprise.normalized_name}</span>
            </LigneInfo>
            <LigneInfo icone={MapPin} libelle="Slug :">
              <span className="font-mono text-[10px]">{entreprise.slug}</span>
            </LigneInfo>
          </div>

          {/* Lien vers les offres de cette entreprise */}
          <p className="text-[10px] text-muted-foreground">
            Pour voir les offres de cette entreprise, utilisez la recherche de la page Offres.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Bouton icône (œil bâtiment) qui ouvre l'aperçu — usage liste. */
export const BoutonApercuEntreprise = ({ onClick, libelle = "Aperçu" }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation()
      onClick?.()
    }}
    aria-label={libelle}
    title={libelle}
    className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
  >
    <Building2 className="size-3.5" />
  </button>
)

export default ApercuEntreprise
