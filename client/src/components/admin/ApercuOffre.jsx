import { Link } from "react-router-dom"
import { CalendarDays, Eye, MapPin, Pencil, Wallet, Layers, ExternalLink } from "lucide-react"
import { useAdminOfferDetailQuery } from "@/features/admin-offres.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"

/* ─────────────────────────────────────────────────────────────────────
   Aperçu rapide d'une offre (Sheet latéral, lecture seule).

   Objectif : consulter le détail d'une offre SANS passer par la page
   d'édition — depuis la liste (TableOffres) et les paires de doublons
   (CarteDoublon, pour comparer A et B avant de trancher).

   Pattern du repo : un seul Sheet monté, son `offreId` change (clé de
   query ["admin","offers","detail",id]) → rechargement du contenu, pas
   de la structure. useAdminOfferDetailQuery (staleTime 60 s) cache les
   fiches déjà consultées.

   Contrat GET /offers/{id} (vérifié live) : JobOfferRead complet —
   company, source, primary_filiere, contract_type, experience_level,
   education_level, location, detail { intro, missions,
   profile_requirements, benefits, tags }, salary_raw, published_at,
   collected_at, view_count, save_count, source_url…
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

const ListeLabels = ({ titre, items }) =>
  items?.length ? (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase">{titre}</p>
      <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        {items.map((item, i) => (
          <li key={i} className="flex gap-1.5">
            <span aria-hidden className="text-muted-foreground/50">•</span> {item}
          </li>
        ))}
      </ul>
    </div>
  ) : null

export const ApercuOffre = ({ ouvert, onOpenChange, offerId }) => {
  const { data: offre, isLoading, isError, refetch } = useAdminOfferDetailQuery(offerId, {
    enabled: ouvert && !!offerId,
  })

  const detail = offre?.detail

  return (
    <Sheet open={ouvert} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center" role="status">
            <Spinner className="size-5" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm font-medium text-destructive">Impossible de charger cette offre.</p>
            <Button variant="outline" size="sm" onClick={refetch}>Réessayer</Button>
          </div>
        ) : offre ? (
          <>
            <SheetHeader className="flex-row items-start justify-between gap-2 border-b border-border">
              <div className="flex flex-col gap-1">
                <SheetTitle className="text-left text-base leading-snug">{offre.title}</SheetTitle>
                <SheetDescription className="text-left text-xs">
                  {offre.company?.name} · {offre.source?.name}
                </SheetDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                render={<Link to={`/admin/offres/${offre.id}`} />}
                className="shrink-0"
              >
                <Pencil aria-hidden /> Modifier
              </Button>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-4 p-4">
              {/* Badges de classement */}
              <div className="flex flex-wrap gap-1.5">
                {offre.primary_filiere && (
                  <Badge variant="secondary">{offre.primary_filiere.label}</Badge>
                )}
                {offre.contract_type && <Badge variant="outline">{offre.contract_type.label}</Badge>}
                {offre.experience_level && <Badge variant="outline">{offre.experience_level.label}</Badge>}
                {offre.education_level && <Badge variant="outline">{offre.education_level.label}</Badge>}
                {offre.location && (
                  <Badge variant="outline">
                    <MapPin aria-hidden /> {offre.location.label}
                  </Badge>
                )}
              </div>

              {/* Infos essentielles */}
              <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/20 p-3">
                <LigneInfo icone={Wallet} libelle="Salaire :">{offre.salary_raw}</LigneInfo>
                <LigneInfo icone={CalendarDays} libelle="Publiée le :">{dateFr(offre.published_at)}</LigneInfo>
                <LigneInfo icone={CalendarDays} libelle="Collectée le :">{dateFr(offre.collected_at)}</LigneInfo>
                <LigneInfo icone={Eye} libelle="Vues :">
                  {offre.view_count != null ? `${offre.view_count} · ${offre.save_count ?? 0} enregistrées` : null}
                </LigneInfo>
                <LigneInfo icone={Layers} libelle="Origine :">
                  {offre.origin === "scraping" ? "Scraping" : offre.origin === "manual" ? "Manuelle" : "Import"}
                </LigneInfo>
                {offre.source_url && (
                  <a
                    href={offre.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs font-medium text-primary underline-offset-4 hover:underline"
                  >
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                    Voir l'annonce d'origine
                  </a>
                )}
              </div>

              <Separator />

              {/* Contenu détaillé */}
              {detail?.intro && (
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase">Intro</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{detail.intro}</p>
                </div>
              )}
              <ListeLabels titre="Missions" items={detail?.missions} />
              <ListeLabels titre="Profil recherché" items={detail?.profile_requirements} />
              <ListeLabels titre="Avantages" items={detail?.benefits} />
              <ListeLabels titre="Tags" items={detail?.tags} />
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Aucune offre sélectionnée.
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** Petit bouton icône (œil) qui ouvre l'aperçu — usage table/liste. */
export const BoutonApercu = ({ onClick, libelle = "Aperçu" }) => (
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
    <Eye className="size-3.5" />
  </button>
)

export default ApercuOffre
