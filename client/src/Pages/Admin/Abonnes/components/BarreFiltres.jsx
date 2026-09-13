import { motion, AnimatePresence } from "framer-motion"
import { RotateCcw, Search } from "lucide-react"
import { cn } from "cn"
import {STATUTS_ABONNE, useAdminSubscribersQuery} from "@/features/admin-abonnes.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useFiltresAbonnesAdmin } from "@/contexts/FiltresAbonnesAdmin.context"
import { useReferentialsQuery } from "@/lib/referentiels-query"
import { useRechercheDebouncee } from "@/hooks/use-recherche-debouncee"


const BarreFiltres = () => {
    const {
      query, status, filiereId, paramsApi,
      setQuery, setStatus, setFiliereId, reinitialiser,
    } = useFiltresAbonnesAdmin()
    const { data: referentiels } = useReferentialsQuery()
    const filieres = referentiels?.filieres ?? []  
    const { isFetching } = useAdminSubscribersQuery(paramsApi)

  
    const { valeurLocale, setValeurLocale } = useRechercheDebouncee({
      valeurUrl: query,
      setScalar: setQuery,
      cle: "query",
    })
  
    const nbFiltresActifs = [status, filiereId].filter(Boolean).length + (query ? 1 : 0)  

  return (
    <div className="flex flex-wrap gap-3 border-b border-border px-4 py-3">
      <div className="relative min-w-52 flex-1">
        {isFetching ? (
          <span
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-primary border-t-transparent"
            aria-label="Recherche en cours"
          />
        ) : (
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        )}
        <Input
          type="search"
          value={valeurLocale}
          onChange={(e) => setValeurLocale(e.target.value)}
          placeholder="Rechercher par email ou nom…"
          aria-label="Rechercher un abonné par email ou nom"
          className="h-8 pl-8 text-xs"
        />
      </div>

      {/* Statut — VOCABULAIRE API (bouncing, jamais bounced) */}
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger
          className={cn("h-8 w-40 text-xs", status && "border-primary/40 bg-primary/5")}
          aria-label="Filtrer par statut"
        >
          <SelectValue placeholder="Statut" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Tous</SelectItem>
          {STATUTS_ABONNE.map((s) => <SelectItem key={s.valeur} value={s.valeur}>{s.libelle}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Filière (UUID référentiel public) */}
      <Select value={filiereId} onValueChange={setFiliereId}>
        <SelectTrigger
          className={cn("h-8 w-40 text-xs", filiereId && "border-primary/40 bg-primary/5")}
          aria-label="Filtrer par filière"
        >
          <SelectValue placeholder="Filière" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Toutes</SelectItem>
          {filieres.map((f) => <SelectItem key={f.id ?? f.code} value={f.id ?? f.code}>{f.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Chip filtres actifs : apparition animée */}
      <AnimatePresence initial={false}>
        {nbFiltresActifs > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex items-center gap-2 motion-reduce:transition-none"
          >
            <Badge variant="secondary" className="gap-1 tabular-nums">{nbFiltresActifs} filtre{nbFiltresActifs > 1 ? "s" : ""}</Badge>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={reinitialiser}>
              <RotateCcw aria-hidden="true" className="size-3" /> Réinitialiser
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default BarreFiltres