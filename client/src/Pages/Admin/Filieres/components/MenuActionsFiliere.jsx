import { KeyRound, MoreVertical, Pencil, Trash2, } from "lucide-react"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import BtnAction from "@/components/admin/BtnAction"

/* ─── Menu « ⋯ » mutualisé desktop + mobile ──────────────────────── */
const MenuActionsFiliere = ({ filiere, onEtendre, onEditer, onSupprimer }) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={
        <BtnAction variant="ghost" size="xs" aria-label={`Actions pour ${filiere.label}`}>
          <MoreVertical aria-hidden />
        </BtnAction>
      }
    />
    <DropdownMenuContent align="end" className="min-w-44">
      <DropdownMenuGroup>
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
      </DropdownMenuGroup>
      <DropdownMenuItem onClick={onEtendre} className="cursor-pointer">
        <KeyRound className="size-3.5" aria-hidden /> Mots-clés
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onEditer} className="cursor-pointer">
        <Pencil className="size-3.5" aria-hidden /> Modifier
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onSupprimer} className="cursor-pointer text-destructive">
        <Trash2 className="size-3.5" aria-hidden /> Supprimer
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)

export default MenuActionsFiliere