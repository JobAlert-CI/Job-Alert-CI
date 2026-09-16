import { memo } from "react"
import { Pencil, Trash2, KeyRound, Power, MoreHorizontal, Loader2 } from "lucide-react"
import { cn } from "cn"
import { ROLE_LABELS } from "@/features/admin-auth.tools"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import { TableCell, TableRow } from "@/components/ui/table"
import BtnAction from "@/components/admin/BtnAction"

const dateCourte = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—"

const VARIANTE_ROLE = {
  super_admin: "secondary",
  gestionnaire_offres: "secondary",
  gestionnaire_utilisateurs: "outline",
  moderateur: "outline",
}

/** Bloc skeleton avec délai décalé (cascade ligne par ligne). */
const Bloc = ({ className, delay = 0 }) => (
  <Skeleton className={className} style={delay ? { animationDelay: `${delay}ms` } : undefined} />
)

/* ─── Skeleton desktop : une ligne aux largeurs des vraies colonnes ─── */
export const SkeletonLigneAdmin = ({ delay = 0 }) => (
  <TableRow className="hover:bg-transparent">
    <TableCell>
      <div className="flex flex-col gap-1.5 py-0.5">
        <Bloc className="h-3.5 w-40" delay={delay} />
        <Bloc className="h-2.5 w-52" delay={delay} />
      </div>
    </TableCell>
    <TableCell><Bloc className="h-5 w-28 rounded-full" delay={delay} /></TableCell>
    <TableCell><Bloc className="h-5 w-16 rounded-full" delay={delay} /></TableCell>
    <TableCell className="hidden md:table-cell"><Bloc className="h-3 w-24" delay={delay} /></TableCell>
    <TableCell className="hidden xl:table-cell"><Bloc className="h-3 w-24" delay={delay} /></TableCell>
    <TableCell>
      <div className="flex items-center justify-end gap-1">
        <Bloc className="size-7 rounded-md" delay={delay} />
        <Bloc className="size-7 rounded-md" delay={delay} />
      </div>
    </TableCell>
  </TableRow>
)

/* ─── Carte mobile : miroir exact de SkeletonCarteAdminMobile ──────── */
export const SkeletonCarteAdminMobile = ({ delay = 0 }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-soft" aria-hidden="true">
    {/* En-tête : nom + email / menu */}
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Bloc className="h-3.5 w-36" delay={delay} />
        <Bloc className="h-2.5 w-48" delay={delay} />
      </div>
      <Bloc className="size-7 shrink-0 rounded-md" delay={delay} />
    </div>
    {/* Badges rôle + statut */}
    <div className="mt-2 flex items-center gap-1.5">
      <Bloc className="h-5 w-28 rounded-full" delay={delay} />
      <Bloc className="h-5 w-16 rounded-full" delay={delay} />
    </div>
    {/* Dates : 2 tuiles */}
    <div className="mt-3 grid grid-cols-2 gap-2">
      {[
        { dt: "w-24", dd: "w-16" },
        { dt: "w-14", dd: "w-16" },
      ].map(({ dt, dd }, k) => (
        <div key={k} className="rounded-lg bg-muted/40 px-2 py-1.5">
          <Bloc className={cn("h-2", dt)} delay={delay} />
          <Bloc className={cn("mt-1 h-3.5", dd)} delay={delay} />
        </div>
      ))}
    </div>
    {/* Pied : bouton de bascule */}
    <div className="mt-3 flex justify-end border-t border-border pt-2">
      <Bloc className="h-7 w-28 rounded-md" delay={delay} />
    </div>
  </div>
)

/* ─── Menu « ⋯ » mutualisé desktop + mobile ──────────────────────── */
export const MenuActionsAdmin = ({ admin, soi, onEditer, onChangerRole, onSupprimer }) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={
        <BtnAction variant="ghost" size="xs" aria-label={`Actions pour ${admin.full_name}`}>
          <MoreHorizontal className="size-4" aria-hidden />
        </BtnAction>
      }
    />
    <DropdownMenuContent align="end" className="min-w-48">
      <DropdownMenuGroup>
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
      </DropdownMenuGroup>
      <DropdownMenuItem onClick={() => onEditer(admin)} className="cursor-pointer">
        <Pencil className="size-3.5" aria-hidden /> Modifier
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onChangerRole(admin)} className="cursor-pointer">
        <KeyRound className="size-3.5" aria-hidden /> Changer le rôle
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {/* Garde-fou : jamais de suppression de son propre compte. */}
      <DropdownMenuItem
        onClick={() => onSupprimer(admin)}
        disabled={soi}
        className={cn("cursor-pointer text-destructive", soi && "opacity-50")}
        title={soi ? "Impossible de supprimer votre propre compte" : undefined}
      >
        <Trash2 className="size-3.5" aria-hidden /> Supprimer
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)

/* ─── Ligne desktop (menu extrait, reste inchangé) ───────────────── */
export const LigneAdministrateur = memo(function LigneAdministrateur({
  admin, soi, statutEnCours, onBasculer, onEditer, onChangerRole, onSupprimer,
}) {
  return (
    <TableRow className="transition-colors hover:bg-muted/50">
      <TableCell>
        <span className="flex items-center gap-2 text-sm font-medium">
          {admin.full_name}
          {soi && <Badge variant="outline" className="text-[9px]">vous</Badge>}
          {admin.must_change_password && (
            <Badge variant="outline" className="text-[9px]" title="Changement de mot de passe obligatoire à la prochaine connexion">
              temporaire
            </Badge>
          )}
        </span>
        <span className="block truncate text-[10px] text-muted-foreground" title={admin.email}>
          {admin.email}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant={VARIANTE_ROLE[admin.role] ?? "outline"}>
          {ROLE_LABELS[admin.role] ?? admin.role}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={admin.is_active ? "secondary" : "destructive"}>
          {admin.is_active ? "Actif" : "Inactif"}
        </Badge>
      </TableCell>
      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
        {admin.last_login_at ? dateCourte(admin.last_login_at) : <span title="Compte créé mais jamais utilisé">jamais</span>}
      </TableCell>
      <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
        {dateCourte(admin.created_at)}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {/* Bascule rapide active/inactive — garde-fou n°3 : jamais sur soi. */}
          <BtnAction
            variant="ghost"
            size="xs"
            disabled={soi || statutEnCours}
            aria-busy={statutEnCours || undefined}
            onClick={() => onBasculer(admin)}
            aria-label={
              soi
                ? "Changer son propre statut est interdit"
                : admin.is_active
                  ? `Désactiver ${admin.full_name}`
                  : `Réactiver ${admin.full_name}`
            }
            title={soi ? "Interdit sur votre propre compte" : admin.is_active ? "Désactiver" : "Réactiver"}
          >
            {statutEnCours ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Power className={cn("size-3.5", admin.is_active ? "text-emerald-600" : "text-destructive")} aria-hidden />
            )}
          </BtnAction>
          <MenuActionsAdmin
            admin={admin}
            soi={soi}
            onEditer={onEditer}
            onChangerRole={onChangerRole}
            onSupprimer={onSupprimer}
          />
        </div>
      </TableCell>
    </TableRow>
  )
})

/* ─── Carte mobile (miroir de la ligne desktop) ─────────────────────
   La table masque « Dernière connexion » (< md) et « Créé le » (< xl) :
   la carte les expose en tuiles pour ne perdre aucune information. */
export const CarteAdminMobile = memo(function CarteAdminMobile({
  admin, soi, statutEnCours, onBasculer, onEditer, onChangerRole, onSupprimer,
}) {
  return (
    <article
      aria-label={`Administrateur ${admin.full_name}`}
      className="rounded-xl border border-border bg-card p-4 shadow-soft"
    >
      {/* En-tête : identité + badges « vous »/« temporaire » + menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            {admin.full_name}
            {soi && <Badge variant="outline" className="text-[9px]">vous</Badge>}
            {admin.must_change_password && (
              <Badge variant="outline" className="text-[9px]" title="Changement de mot de passe obligatoire à la prochaine connexion">
                temporaire
              </Badge>
            )}
          </p>
          <p className="truncate text-[10px] text-muted-foreground" title={admin.email}>{admin.email}</p>
        </div>
        <MenuActionsAdmin
          admin={admin}
          soi={soi}
          onEditer={onEditer}
          onChangerRole={onChangerRole}
          onSupprimer={onSupprimer}
        />
      </div>

      {/* Rôle + statut */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant={VARIANTE_ROLE[admin.role] ?? "outline"}>
          {ROLE_LABELS[admin.role] ?? admin.role}
        </Badge>
        <Badge variant={admin.is_active ? "secondary" : "destructive"}>
          {admin.is_active ? "Actif" : "Inactif"}
        </Badge>
      </div>

      {/* Dates — masquées dans la table mobile, exposées ici */}
      <dl className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/40 px-2 py-1.5">
          <dt className="truncate text-[10px] text-muted-foreground">Dernière connexion</dt>
          <dd className="text-sm font-medium tabular-nums">
            {admin.last_login_at ? dateCourte(admin.last_login_at) : "jamais"}
          </dd>
        </div>
        <div className="rounded-lg bg-muted/40 px-2 py-1.5">
          <dt className="truncate text-[10px] text-muted-foreground">Créé le</dt>
          <dd className="text-sm font-medium tabular-nums">{dateCourte(admin.created_at)}</dd>
        </div>
      </dl>

      {/* Pied : bascule actif/inactif (jamais sur soi, garde-fou n°3) */}
      <div className="mt-3 flex items-center justify-end border-t border-border pt-2">
        <BtnAction
          variant="outline"
          size="xs"
          disabled={soi || statutEnCours}
          aria-busy={statutEnCours || undefined}
          onClick={() => onBasculer(admin)}
          aria-label={
            soi
              ? "Changer son propre statut est interdit"
              : admin.is_active
                ? `Désactiver ${admin.full_name}`
                : `Réactiver ${admin.full_name}`
          }
          title={soi ? "Interdit sur votre propre compte" : admin.is_active ? "Désactiver" : "Réactiver"}
        >
          {statutEnCours ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Power className={cn("size-3.5", admin.is_active ? "text-emerald-600" : "text-destructive")} aria-hidden />
          )}
          {admin.is_active ? "Désactiver" : "Réactiver"}
        </BtnAction>
      </div>
    </article>
  )
})