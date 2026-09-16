import { useState } from "react"
import { ListTree, Plus, Pencil, Trash2 } from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminSpecialitesQuery, useCreateSpecialite, useUpdateSpecialite,
  useDeleteSpecialite,
} from "@/features/admin-filieres.tools"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import { SectionErreur, SectionVide, TransitionEtat } from "@/components/admin/EtatsSection"
import DialogSpecialiteFiliere from "@/components/dialog/DialogSpecialiteFiliere"
import DialogConfirmSupprSpecialiteFiliere from "@/components/dialog/DialogConfirmSupprSpecialiteFiliere"
import BtnAction from "@/components/admin/BtnAction"

/** Bloc skeleton avec délai décalé (cascade ligne par ligne). */
const Bloc = ({ className, delay = 0 }) => (
  <Skeleton className={className} style={delay ? { animationDelay: `${delay}ms` } : undefined} />
);

/**
 * État de chargement de la sous-table des spécialités.
 * Reprend la géométrie exacte du tableau réel :
 *  - même wrapper `overflow-x-auto rounded-lg border` ;
 *  - colonne Code masquée en mobile (`hidden md:table-cell`, mono) ;
 *  - Ordre aligné à droite, badge de statut, deux boutons d'action.
 * `nbLignes` : les spécialités sont peu nombreuses par filière (2–6).
 */
const SpecialitesTableSkeleton = ({ nbLignes = 4 }) => {
  const lignes = Array.from({ length: nbLignes }, (_, i) => i);
  return (
    <div role="status" aria-label="Chargement des spécialités">
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table aria-hidden="true">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><Bloc className="h-3 w-20" /></TableHead>
              <TableHead className="hidden md:table-cell"><Bloc className="h-3 w-12" /></TableHead>
              <TableHead className="text-right"><Bloc className="ml-auto h-3 w-10" /></TableHead>
              <TableHead><Bloc className="h-3 w-12" /></TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((i) => {
              const delay = i * 70;
              return (
                <TableRow key={i} className="hover:bg-transparent">
                  {/* Spécialité */}
                  <TableCell>
                    <Bloc className="h-3.5 w-28" delay={delay} />
                  </TableCell>
                  {/* Code (masqué en mobile, comme la colonne réelle) */}
                  <TableCell className="hidden md:table-cell">
                    <Bloc className="h-2.5 w-16" delay={delay} />
                  </TableCell>
                  {/* Ordre */}
                  <TableCell className="text-right">
                    <Bloc className="ml-auto h-3 w-6" delay={delay} />
                  </TableCell>
                  {/* Statut : badge Active / Inactive */}
                  <TableCell>
                    <Bloc className="h-5 w-16 rounded-full" delay={delay} />
                  </TableCell>
                  {/* Actions : modifier + supprimer */}
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Bloc className="size-7 rounded-md" delay={delay} />
                      <Bloc className="size-7 rounded-md" delay={delay} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};


const SectionSpecialites = ({ filiereId }) => {
  const notify = useNotify()
  const { data: specialites, isLoading, isError, refetch } = useAdminSpecialitesQuery(filiereId, {
    staleTime: 5 * 60 * 1000, // évite le skeleton à chaque réouverture du panneau
  })
  const creerMutation = useCreateSpecialite(filiereId)
  const modifierMutation = useUpdateSpecialite(filiereId)
  const supprimerMutation = useDeleteSpecialite(filiereId)
  const [edition, setEdition] = useState(null)
  const [suppression, setSuppression] = useState(null)

  const etat = isError ? "error" : isLoading ? "loading" : !specialites?.length ? "vide" : "success"

  return (
    <section aria-label="Spécialités de la filière" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold">
          <ListTree className="size-4 text-primary" aria-hidden />
          Spécialités
        </h2>
        <BtnAction size="sm" onClick={() => setEdition({})}>
          <Plus aria-hidden /> Ajouter
        </BtnAction>
      </div>

      <TransitionEtat etat={etat}>
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger les spécialités." />
        ) : isLoading ? (
          <SpecialitesTableSkeleton nbLignes={4} />
        ) : !specialites?.length ? (
          <SectionVide message="Aucune spécialité rattachée à cette filière." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Spécialité</TableHead>
                  <TableHead className="hidden font-mono text-[10px] md:table-cell">Code</TableHead>
                  <TableHead className="text-right">Ordre</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {specialites.map((spec) => (
                  <TableRow key={spec.id} className="transition-colors hover:bg-muted/50">
                    <TableCell className="text-sm font-medium">{spec.label}</TableCell>
                    <TableCell className="hidden font-mono text-[10px] text-muted-foreground md:table-cell">{spec.code}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{spec.sort_order}</TableCell>
                    <TableCell>
                      <Badge variant={spec.is_active ? "secondary" : "outline"}>
                        {spec.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <BtnAction variant="ghost" size="xs" onClick={() => setEdition(spec)} aria-label={`Modifier ${spec.label}`}>
                          <Pencil aria-hidden />
                        </BtnAction>
                        <BtnAction
                          variant="danger"
                          size="xs"
                          onClick={() => setSuppression(spec)}
                          aria-label={`Supprimer ${spec.label}`}
                        >
                          <Trash2 aria-hidden />
                        </BtnAction>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TransitionEtat>

      {edition && (
        <DialogSpecialiteFiliere
          specialite={edition.id ? edition : null}
          creer={creerMutation}
          modifier={modifierMutation}
          onFermer={() => setEdition(null)}
        />
      )}

      {suppression && (
        <DialogConfirmSupprSpecialiteFiliere
          suppression={suppression}
          setSuppression={setSuppression}
          supprimerMutation={supprimerMutation}
          notify={notify}
        />
      )}
    </section>
  )
}

export default SectionSpecialites