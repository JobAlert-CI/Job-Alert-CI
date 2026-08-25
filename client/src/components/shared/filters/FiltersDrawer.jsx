
import { ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer"
import { SORTS } from "@/lib/referentiels"
import FilterGroup from "./FilterGroup"

/**
 * children → les <OfferFilterGroups> (ou FilterGroup custom)
 * ctaClassName → couleur du bouton « Voir N offres » (ex : hue.solid)
 */
const FiltersDrawer = ({
  open, onOpenChange,
  title = "Filtres", description, resultCount = 0,
  sorts = SORTS, sort, onSort, onReset,
  ctaClassName = "bg-brand-orange",
  children,
}) => (
  <Drawer open={open} onOpenChange={onOpenChange}>
    <DrawerContent className="max-h-[88vh]">
      <DrawerHeader className="border-b border-outline-variant/40 px-5 pb-4 pt-2">
        <DrawerTitle className="font-heading text-base font-bold text-brand-navy">{title}</DrawerTitle>
        <DrawerDescription className="text-xs text-muted-foreground">
          {description ?? `${resultCount} offre${resultCount > 1 ? "s" : ""} correspondante${resultCount > 1 ? "s" : ""} — mise à jour en direct`}
        </DrawerDescription>
      </DrawerHeader>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {children}
        {sorts && (
          <div className="mt-6 border-t border-outline-variant/40 pt-5">
            <FilterGroup title="Trier par" icon={ArrowUpDown}>
              <div className="grid grid-cols-2 gap-2 px-1">
                {sorts.map((s) => (
                  <button
                    key={s.k}
                    onClick={() => onSort?.(s.k)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-xs font-bold transition-all",
                      sort === s.k
                        ? "border-brand-navy bg-brand-navy text-white shadow-soft"
                        : "border-outline-variant/60 bg-card text-on-surface-variant hover:border-brand-navy/40 hover:text-brand-navy"
                    )}
                  >
                    {s.l}
                  </button>
                ))}
              </div>
            </FilterGroup>
          </div>
        )}
      </div>
      <DrawerFooter className="border-t border-outline-variant/40 px-5 py-4">
        <div className="flex items-center gap-3">
          <button onClick={onReset} className="text-[13px] font-bold text-muted-foreground transition-colors hover:text-brand-navy">
            Réinitialiser
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className={cn("flex-1 rounded-lg py-3 text-sm font-bold text-white shadow-soft transition-all hover:brightness-110 active:scale-[0.98]", ctaClassName)}
          >
            Voir {resultCount} offre{resultCount > 1 ? "s" : ""}
          </button>
        </div>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
)
export default FiltersDrawer