import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronDown, ChevronRight, KeyRound,
} from "lucide-react"
import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import {TableRow, TableCell,} from "@/components/ui/table"
import EditeurMotsCles from "./EditeurMotsCles"
import SectionSpecialites from "./EditeurSpecialites"
import BtnAction from "@/components/admin/BtnAction"
import MenuActionsFiliere from "./MenuActionsFiliere"



/* ─── Ligne desktop + panneau d'expansion (inchangée, menu extrait) ─── */
const LigneFiliere = ({
  filiere, ouverte, nbOffres, nbAbonnes,
  onEtendre, onFermer, onEditer, onSupprimer, keywordsMutation,
}) => (
  <>
    <TableRow className={cn("transition-colors hover:bg-muted/50", ouverte && "bg-muted/40")}>
      <TableCell>
        <BtnAction
          variant="ghost"
          size="xs"
          onClick={onEtendre}
          aria-expanded={ouverte}
          aria-label={ouverte ? `Replier ${filiere.label}` : `Déplier ${filiere.label} (mots-clés et spécialités)`}
        >
          {ouverte ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
        </BtnAction>
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-2 text-sm font-medium">
          {filiere.color_hex && (
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: filiere.color_hex }} aria-hidden />
          )}
          {filiere.label}
        </span>
      </TableCell>
      <TableCell className="hidden font-mono text-[10px] text-muted-foreground md:table-cell">
        {filiere.code}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className="inline-flex items-center gap-1">
          <KeyRound className="size-3 text-muted-foreground" aria-hidden />
          {filiere.keywords?.length ?? 0}
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">{nbOffres}</TableCell>
      <TableCell className="text-right tabular-nums">{nbAbonnes}</TableCell>
      <TableCell className="hidden text-right tabular-nums text-muted-foreground lg:table-cell">
        {filiere.specialties?.length ?? 0}
      </TableCell>
      <TableCell className="hidden text-right tabular-nums text-muted-foreground lg:table-cell">
        {filiere.sort_order}
      </TableCell>
      <TableCell>
        <Badge variant={filiere.is_active ? "secondary" : "outline"}>
          {filiere.is_active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell>
        <MenuActionsFiliere
          filiere={filiere}
          onEtendre={onEtendre}
          onEditer={onEditer}
          onSupprimer={onSupprimer}
        />
      </TableCell>
    </TableRow>
    {/* Panneau d'expansion : déploiement height 0 → auto (AnimatePresence). */}
    <AnimatePresence initial={false}>
      {ouverte && (
        <motion.tr
          key="panneau"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-b border-border bg-muted/30"
        >
          <TableCell colSpan={10} className="p-0">
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden motion-reduce:transition-none"
            >
              <div className="flex flex-col gap-3 p-3">
                <EditeurMotsCles
                  filiere={filiere}
                  mutation={keywordsMutation}
                  onFermer={onFermer}
                  compact
                />
                <SectionSpecialites filiereId={filiere.id} />
              </div>
            </motion.div>
          </TableCell>
        </motion.tr>
      )}
    </AnimatePresence>
  </>
)

export default LigneFiliere