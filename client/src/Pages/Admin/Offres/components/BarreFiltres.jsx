import { Filter, Plus, RotateCcw, Upload, FileDown, Search } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useFiltresOffresAdmin } from "@/contexts/FiltresOffresAdmin.context"
import { STATUTS_OFFRE, ORIGINES_OFFRE } from "@/features/admin-offres.tools"
import { useRechercheDebouncee } from "@/hooks/use-recherche-debouncee"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"

/* ─────────────────────────────────────────────────────────────────────
   Barre de filtres de la liste offres.

   Filtres serveur réels (offers.js JSDoc) : q (titre), status,
   origin, visible_site, filiere_id, source_id — tous dans l'URL.
   Filières/sources : filtre par ID serveur (UUID), consommé depuis
   le cache public referentials (même pattern que la page publique,
   route /referentials publique — accessible tous rôles).
   ───────────────────────────────────────────────────────────────────── */

const FILTRES_VISIBLES = [
  { cle: "status", libelle: "Statut", options: STATUTS_OFFRE },
  { cle: "origin", libelle: "Origine", options: ORIGINES_OFFRE },
]

const BarreFiltres = ({ onImport, onExport, exportEnCours }) => {
  const navigate = useNavigate()
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
    <div className="flex flex-col gap-3">
      {/* Ligne 1 : recherche + actions principales */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={valeurLocale}
            onChange={(e) => setValeurLocale(e.target.value)}
            placeholder="Rechercher un titre…"
            aria-label="Rechercher une offre par titre"
            className="pl-8"
          />
        </div>

        <Button size="sm" onClick={() => navigate("/admin/offres/nouvelle")}>
          <Plus aria-hidden /> Nouvelle offre
        </Button>

        <Button size="sm" variant="outline" onClick={onImport}>
          <Upload aria-hidden /> Importer un fichier
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="sm" variant="outline" disabled={exportEnCours}>
                {exportEnCours ? <Spinner /> : <FileDown aria-hidden />}
                Exporter
              </Button>
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

      {/* Ligne 2 : filtres */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTRES_VISIBLES.map(({ cle, libelle, options }) => {
          const valeur = cle === "status" ? status : origin
          const setValeur = cle === "status" ? setStatus : setOrigin
          return (
            <Select key={cle} value={valeur} onValueChange={setValeur}>
              <SelectTrigger className="h-7 w-36" aria-label={`Filtrer par ${libelle}`}>
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
          <SelectTrigger className="h-7 w-40" aria-label="Filtrer par visibilité">
            <SelectValue placeholder="Visibilité" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Toutes</SelectItem>
            <SelectItem value="true">Visibles</SelectItem>
            <SelectItem value="false">Masquées</SelectItem>
          </SelectContent>
        </Select>

        {nbFiltresActifs > 0 && (
          <>
            <Badge variant="secondary" className="gap-1">
              <Filter aria-hidden /> {nbFiltresActifs} filtre{nbFiltresActifs > 1 ? "s" : ""}
            </Badge>
            <Button variant="ghost" size="sm" onClick={reinitialiser}>
              <RotateCcw aria-hidden /> Réinitialiser
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default BarreFiltres
