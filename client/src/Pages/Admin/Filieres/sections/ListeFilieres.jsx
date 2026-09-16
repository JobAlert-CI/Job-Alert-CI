import { useMemo, useState } from "react"
import { KeyRound} from "lucide-react"
import EnteteTriable from "@/components/admin/EnteteTriable"
import {
  useAdminFilieresQuery, useDeleteFiliere, useUpdateFiliereKeywords,
  useStatsOffresParFiliere, useStatsAbonnesParFiliere, useUpdateFiliere, useCreateFiliere,
} from "@/features/admin-filieres.tools"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import {
  Table, TableHeader, TableBody, TableHead, TableRow,
} from "@/components/ui/table"
import { SectionErreur, SectionVide, TransitionEtat } from "@/components/admin/EtatsSection"
import DialogFiliere from "@/components/dialog/DialogFiliere"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import DialogSupprFiliere from "@/components/dialog/DialogSupprFiliere"
import FilieresSkeleton from "../components/FilieresSkeleton"
import { CarteFiliereMobile } from "../components/CarteFiliereMobile"
import LigneFiliere from "../components/LigneFiliere"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion des filières — /admin/filieres (super_admin).
   Mobile (< md) : cartes avec panneau d'expansion intégré + tri par
   Select (les en-têtes cliquables sont masqués). Desktop : table.
───────────────────────────────────────────────────────────────────── */


/* Tri « français » robuste : nombres, textes, dates ; vides en fin. */
const comparerValeurs = (a, b) => {
  const videA = a === null || a === undefined || a === ""
  const videB = b === null || b === undefined || b === ""
  if (videA && videB) return 0
  if (videA) return 1
  if (videB) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" })
}


const ListeFilieres = () => {
  const { data: filieres, isLoading, isError, refetch } = useAdminFilieresQuery()
  const { data: statsOffres } = useStatsOffresParFiliere()
  const { data: statsAbonnes } = useStatsAbonnesParFiliere()
  const creerMutation = useCreateFiliere()
  const modifierMutation = useUpdateFiliere()
  const offresParCode = useMemo(
    () => new Map((statsOffres ?? []).map((f) => [f.code, f.total_offers ?? 0])),
    [statsOffres]
  )
  const abonnesParCode = useMemo(
    () => new Map((statsAbonnes ?? []).map((f) => [f.code, f.subscribers_count ?? 0])),
    [statsAbonnes]
  )
  const [etendue, setEtendue] = useState(null)      // UN SEUL panneau ouvert à la fois
  const [tri, setTri] = useState(null)              // null = ordre naturel (sort_order)
  const [edition, setEdition] = useState(null)      // null fermé | {} création | filière
  const [suppression, setSuppression] = useState(null)
  const supprimerMutation = useDeleteFiliere()
  const keywordsMutation = useUpdateFiliereKeywords()
  const basculerExtension = (id) => setEtendue((prec) => (prec === id ? null : id))


  const COLONNES = useMemo(() => [
    {
      cle: "label", libelle: "Filière", directionInitiale: "asc",
      triValeur: (f) => (f.label ?? "").toLowerCase(),
    },
    {
      cle: "keywords", libelle: "Mots-clés", directionInitiale: "desc",
      triValeur: (f) => f.keywords?.length ?? 0,
    },
    {
      cle: "offres", libelle: "Offres", directionInitiale: "desc",
      triValeur: (f) => offresParCode.get(f.code) ?? 0,
    },
    {
      cle: "abonnes", libelle: "Abonnés", directionInitiale: "desc",
      triValeur: (f) => abonnesParCode.get(f.code) ?? 0,
    },
    {
      cle: "specialites", libelle: "Spécialités", directionInitiale: "desc",
      className: "hidden lg:table-cell",
      triValeur: (f) => f.specialties?.length ?? 0,
    },
    {
      cle: "ordre", libelle: "Ordre", directionInitiale: "asc",
      className: "hidden lg:table-cell",
      triValeur: (f) => f.sort_order ?? 0,
    },
  ], [offresParCode, abonnesParCode])

  /* Cycle de tri : direction initiale → inverse → ordre naturel (null).
     Reçoit désormais l'OBJET colonne (contrat du composant partagé). */
  const cycleTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  const filieresTriees = useMemo(() => {
    const base = [...(filieres ?? [])]
    if (!tri) return base.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = base.sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [filieres, tri, COLONNES])

  /* Tri mobile : un Select (les en-têtes cliquables sont masqués < md).
     Chaque option applique la direction initiale naturelle de la colonne. */
  const trierMobile = (cle) => cycleTri(COLONNES.find((c) => c.cle === cle))

  const etat = isError ? "erreur" : isLoading ? "chargement" : !filieres?.length ? "vide" : "donnees"

  return (
    <>
      <SectionCardAdmin
        title="Filières"
        description="Liste des filières, ordonnées par ordre de priorité."
        icon={KeyRound}
        contentClassName="p-0 sm:p-0"
      >
        <TransitionEtat etat={etat} className="animate-in fade-in duration-200 motion-reduce:animate-none">
          {isError ? (
            <div className="p-4">
              <SectionErreur onRetry={refetch} message="Une erreur s'est produite lors du chargement des données." />
            </div>
          ) : isLoading ? (
            <FilieresSkeleton nbLignes={8} />
          ) : !filieresTriees.length ? (
            <div className="p-4">
              <SectionVide message="Aucune filière configurée — créez la première pour activer le matching." />
            </div>
          ) : (
            <>
              {/* ── Tri — mobile (desktop : en-têtes cliquables) ── */}
              <div className="px-4 pt-3 md:hidden">
                <Select value={tri?.cle} onValueChange={trierMobile}>
                  <SelectTrigger className="h-8 w-full text-xs" aria-label="Trier les filières">
                    <SelectValue placeholder="Trier par…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="label">Filière (A→Z)</SelectItem>
                    <SelectItem value="keywords">Mots-clés (décroissant)</SelectItem>
                    <SelectItem value="offres">Offres (décroissant)</SelectItem>
                    <SelectItem value="abonnes">Abonnés (décroissant)</SelectItem>
                    <SelectItem value="specialites">Spécialités (décroissant)</SelectItem>
                    <SelectItem value="ordre">Ordre (croissant)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ── Mobile : cartes ────────────────────────────── */}
              <ul className="flex flex-col gap-3 px-4 py-3 md:hidden">
                {filieresTriees.map((filiere) => (
                  <li key={filiere.id}>
                    <CarteFiliereMobile
                      filiere={filiere}
                      ouverte={etendue === filiere.id}
                      nbOffres={offresParCode.get(filiere.code) ?? 0}
                      nbAbonnes={abonnesParCode.get(filiere.code) ?? 0}
                      onEtendre={() => basculerExtension(filiere.id)}
                      onFermer={() => setEtendue(null)}
                      onEditer={() => setEdition(filiere)}
                      onSupprimer={() => setSuppression(filiere)}
                      keywordsMutation={keywordsMutation}
                    />
                  </li>
                ))}
              </ul>

              {/* ── Desktop : table ────────────────────────────── */}
              <div className="hidden overflow-x-auto scrollbar-thin md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-8" />
                      {/* Filière — triable (initialisée asc) */}
                      <EnteteTriable
                        colonne={COLONNES.find((c) => c.cle === "label")}
                        tri={tri}
                        onTri={cycleTri}
                      />
                      <TableHead className="hidden text-muted-foreground/80 md:table-cell">Code</TableHead>
                      {/* Colonnes numériques — triables, alignées à droite */}
                      {COLONNES.filter((c) => c.cle !== "label").map((colonne) => (
                        <EnteteTriable
                          key={colonne.cle}
                          colonne={colonne}
                          tri={tri}
                          onTri={cycleTri}
                          aligneDroite
                        />
                      ))}
                      <TableHead className="hidden text-muted-foreground/80 md:table-cell">Statut</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filieresTriees.map((filiere) => (
                      <LigneFiliere
                        key={filiere.id}
                        filiere={filiere}
                        ouverte={etendue === filiere.id}
                        nbOffres={offresParCode.get(filiere.code) ?? 0}
                        nbAbonnes={abonnesParCode.get(filiere.code) ?? 0}
                        onEtendre={() => basculerExtension(filiere.id)}
                        onFermer={() => setEtendue(null)}
                        onEditer={() => setEdition(filiere)}
                        onSupprimer={() => setSuppression(filiere)}
                        keywordsMutation={keywordsMutation}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TransitionEtat>
      </SectionCardAdmin>

      {/* ─── Dialogs (inchangés) ─── */}
      {edition && (
        <DialogFiliere
          key={edition.id ?? "nouvelle"}
          filiere={edition.id ? edition : null}
          mutation={edition.id ? modifierMutation : creerMutation}
          onFermer={() => setEdition(null)}
        />
      )}
      {suppression && (
        <DialogSupprFiliere
          key={suppression.id}
          suppression={suppression}
          setSuppression={setSuppression}
          etendue={etendue}
          setEtendue={setEtendue}
          supprimerMutation={supprimerMutation}
        />
      )}
    </>
  )
}

export default ListeFilieres