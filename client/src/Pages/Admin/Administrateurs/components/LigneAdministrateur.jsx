import { memo } from "react"
import {
  Pencil, Trash2, KeyRound, Power, MoreHorizontal, Loader2
} from "lucide-react"
import { cn } from "cn"
import { ROLE_LABELS } from "@/features/admin-auth.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import { TableCell, TableRow } from "@/components/ui/table"

const dateCourte = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) : "—"

const VARIANTE_ROLE = {
  super_admin: "secondary",
  gestionnaire_offres: "secondary",
  gestionnaire_utilisateurs: "outline",
  moderateur: "outline",
}

/* ─── Skeleton réaliste : une ligne aux largeurs des vraies colonnes
   (pattern SkeletonLigneFiliere) ─── */
export const SkeletonLigneAdmin = () => (
  <TableRow className="hover:bg-transparent">
    <TableCell>
      <div className="flex flex-col gap-1.5 py-0.5">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-2.5 w-52" />
      </div>
    </TableCell>
    <TableCell><Skeleton className="h-5 w-28 rounded-full" /></TableCell>
    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
    <TableCell className="hidden md:table-cell"><Skeleton className="h-3 w-24" /></TableCell>
    <TableCell className="hidden xl:table-cell"><Skeleton className="h-3 w-24" /></TableCell>
    <TableCell>
      <div className="flex items-center justify-end gap-1">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
      </div>
    </TableCell>
  </TableRow>
)

export const LigneAdministrateur = memo(function LigneAdministrateur({
  admin, soi, statutEnCours, onBasculer, onEditer, onChangerRole, onSupprimer,
}) {
  return (
    <TableRow className="transition-colors hover:bg-muted/50">
      <TableCell>
        <span className="flex items-center gap-2 text-sm font-medium">
          {admin.full_name}
          {soi && (
            <Badge variant="outline" className="text-[9px]">vous</Badge>
          )}
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
        {admin.last_login_at
          ? dateCourte(admin.last_login_at)
          : <span title="Compte créé mais jamais utilisé">jamais</span>}
      </TableCell>
      <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
        {dateCourte(admin.created_at)}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {/* Bascule rapide active/inactive — garde-fou n°3 : jamais sur soi. */}
          <Button
            variant="ghost"
            size="icon-sm"
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
              <Power className={cn("size-3.5", admin.is_active ? "text-emerald-600" : "text-muted-foreground")} aria-hidden />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${admin.full_name}`}>
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
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
        </div>
      </TableCell>
    </TableRow>
  )
})