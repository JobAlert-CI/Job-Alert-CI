import { Plus, Upload, FileDown } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Spinner } from "@/components/ui/spinner"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import BtnAction from "@/components/admin/BtnAction"

/* Actions principales du hero Offres : créer, importer, exporter. */
const ActionHeroOffre = ({ onImport, onExport, exportEnCours }) => {
  const navigate = useNavigate()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <BtnAction size="xs" onClick={() => navigate("/admin/offres/nouvelle")}>
        <Plus aria-hidden className="size-4" /> Nouvelle offre
      </BtnAction>
      <BtnAction size="xs" variant="outline" onClick={onImport}>
        <Upload aria-hidden className="size-4" /> Importer un fichier
      </BtnAction>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <BtnAction size="xs" variant="outline" disabled={exportEnCours}>
              {exportEnCours ? <Spinner className="size-4" /> : <FileDown aria-hidden className="size-4" />}
              Exporter
            </BtnAction>
          }
        />
        <DropdownMenuContent align="end" className="min-w-44">
          {/* base-ui : un label de groupe vit TOUJOURS dans <DropdownMenuGroup>. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel>Format</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onExport?.("csv")} className="cursor-pointer">CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport?.("json")} className="cursor-pointer">JSON</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default ActionHeroOffre