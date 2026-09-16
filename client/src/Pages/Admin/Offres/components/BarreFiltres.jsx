import { motion, AnimatePresence } from "framer-motion"
import { Filter, RotateCcw, Search } from "lucide-react"
import { useFiltresOffresAdmin } from "@/contexts/FiltresOffresAdmin.context"
import { STATUTS_OFFRE, ORIGINES_OFFRE } from "@/features/admin-offres.tools"
import { useRechercheDebouncee } from "@/hooks/use-recherche-debouncee"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import BtnAction from "@/components/admin/BtnAction"


const FILTRES_VISIBLES = [
  { cle: "status", libelle: "Statut", options: STATUTS_OFFRE },
  { cle: "origin", libelle: "Origine", options: ORIGINES_OFFRE },
]

const BarreFiltres = ({ chargement = false }) => {
  const {
    query, status, origin, visible,
    setQuery, setStatus, setOrigin, setVisible, reinitialiser,
  } = useFiltresOffresAdmin()

  const { valeurLocale, setValeurLocale } = useRechercheDebouncee({
    valeurUrl: query,
    setScalar: setQuery,
    cle: "query",
  })

  const nbFiltresActifs = [status, origin, visible].filter(Boolean).length + (query ? 1 : 0)

  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* ─── Recherche : Spinner tant que la requête est en cours ─── */}
        <div className="relative min-w-52 flex-1">
          {chargement ? (
            <Spinner
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-primary"
              aria-label="Recherche en cours"
            />
          ) : (
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
          )}
          <Input
            type="search"
            value={valeurLocale}
            onChange={(e) => setValeurLocale(e.target.value)}
            placeholder="Rechercher un titre…"
            aria-label="Rechercher une offre par titre"
            className="h-8 pl-8 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTRES_VISIBLES.map(({ cle, libelle, options }) => {
            const valeur = cle === "status" ? status : origin
            const setValeur = cle === "status" ? setStatus : setOrigin
            return (
              <Select key={cle} value={valeur} onValueChange={setValeur}>
                <SelectTrigger className="h-8 w-36 text-xs" aria-label={`Filtrer par ${libelle}`}>
                  <SelectValue placeholder={libelle} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous</SelectItem>
                  {options.map((o) => (
                    <SelectItem key={o.valeur} value={o.valeur}>{o.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          })}

          <Select value={visible} onValueChange={setVisible}>
            <SelectTrigger className="h-8 w-40 text-xs" aria-label="Filtrer par visibilité">
              <SelectValue placeholder="Visibilité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Toutes</SelectItem>
              <SelectItem value="true">Visibles</SelectItem>
              <SelectItem value="false">Masquées</SelectItem>
            </SelectContent>
          </Select>

          {/* ─── Badge + reset : apparition animée (scale + fondu) ─── */}
          <AnimatePresence initial={false}>
            {nbFiltresActifs > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="flex items-center gap-2 motion-reduce:transition-none"
              >
                <Badge variant="secondary" className="gap-1 tabular-nums">
                  <Filter aria-hidden className="size-3" /> {nbFiltresActifs} filtre{nbFiltresActifs > 1 ? "s" : ""}
                </Badge>
                <BtnAction variant="outline" size="xs" onClick={reinitialiser}>
                  <RotateCcw aria-hidden className="size-3" /> Réinitialiser
                </BtnAction>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default BarreFiltres