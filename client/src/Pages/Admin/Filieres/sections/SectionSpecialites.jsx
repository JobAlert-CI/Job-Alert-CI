import { useState } from "react"
import { ListTree, Plus, Pencil, Trash2 } from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminSpecialitesQuery, useCreateSpecialite, useUpdateSpecialite,
  useDeleteSpecialite, messageErreurReferentiel,
} from "@/features/admin-filieres.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Section Spécialités d'une filière (doc v3 §12 : sous-table).

   CRUD /filieres/{id}/specialites + /specialites/{id} — chargée
   seulement quand une filière est dépliée (useAdminSpecialitesQuery,
   enabled par filiereId présent).
   ───────────────────────────────────────────────────────────────────── */

const SectionSpecialites = ({ filiereId }) => {
  const notify = useNotify()
  const { data: specialites, isLoading, isError, refetch } = useAdminSpecialitesQuery(filiereId)

  const creerMutation = useCreateSpecialite(filiereId)
  const modifierMutation = useUpdateSpecialite(filiereId)
  const supprimerMutation = useDeleteSpecialite(filiereId)

  const [edition, setEdition] = useState(null)     // null fermé, {} création, spécialité existante
  const [suppression, setSuppression] = useState(null)

  return (
    <section aria-label="Spécialités de la filière" className="flex flex-col gap-3 rounded-lg bg-background/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold">
          <ListTree className="size-4 text-primary" aria-hidden />
          Spécialités
        </h2>
        <Button variant="outline" size="sm" onClick={() => setEdition({})}>
          <Plus aria-hidden /> Ajouter
        </Button>
      </div>

      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les spécialités." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
        </div>
      ) : !specialites?.length ? (
        <SectionVide message="Aucune spécialité rattachée à cette filière." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Spécialité</TableHead>
                <TableHead className="hidden font-mono text-[10px] md:table-cell">Code</TableHead>
                <TableHead className="text-right">Ordre</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {specialites.map((spec) => (
                <TableRow key={spec.id}>
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
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEdition(spec)}
                        aria-label={`Modifier ${spec.label}`}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setSuppression(spec)}
                        aria-label={`Supprimer ${spec.label}`}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog création / édition spécialité */}
      {edition && (
        <DialogSpecialite
          specialite={edition.id ? edition : null}
          creer={creerMutation}
          modifier={modifierMutation}
          onFermer={() => setEdition(null)}
        />
      )}

      {/* Confirmation suppression */}
      {suppression && (
        <Dialog open onOpenChange={(ouvert) => !ouvert && setSuppression(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Supprimer « {suppression.label} » ?</DialogTitle>
              <DialogDescription>La spécialité sera détachée de la filière. Action irréversible.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
              <Button
                variant="destructive"
                disabled={supprimerMutation.isPending}
                onClick={() =>
                  supprimerMutation.mutate(suppression.id, {
                    onSuccess: () => {
                      notify(`Spécialité « ${suppression.label} » supprimée`, "success")
                      setSuppression(null)
                    },
                    onError: (err) => notify(messageErreurReferentiel(err), "error"),
                  })
                }
              >
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  )
}

const DialogSpecialite = ({ specialite, creer, modifier, onFermer }) => {
  const notify = useNotify()
  const edit = !!specialite
  const [valeurs, setValeurs] = useState(() => ({
    code: specialite?.code ?? "",
    label: specialite?.label ?? "",
    sort_order: specialite?.sort_order ?? 100,
    is_active: specialite?.is_active ?? true,
  }))

  const enregistrer = () => {
    const data = {
      code: valeurs.code.trim(),
      label: valeurs.label.trim(),
      sort_order: Number(valeurs.sort_order) || 0,
      is_active: valeurs.is_active,
    }
    const appel = edit
      ? modifier.mutateAsync({ id: specialite.id, data: { label: data.label, sort_order: data.sort_order, is_active: data.is_active } })
      : creer.mutateAsync(data)
    appel
      .then(() => { notify(edit ? "Spécialité mise à jour" : "Spécialité créée", "success"); onFermer() })
      .catch((err) => notify(messageErreurReferentiel(err), "error"))
  }

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? `Modifier « ${specialite.label} »` : "Nouvelle spécialité"}</DialogTitle>
          <DialogDescription>Les spécialités affinent le choix du candidat à l'inscription.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="spec-code">Code</Label>
            <Input
              id="spec-code"
              value={valeurs.code}
              onChange={(e) => setValeurs((v) => ({ ...v, code: e.target.value }))}
              disabled={edit}
              className="font-mono"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="spec-label">Libellé</Label>
            <Input
              id="spec-label"
              value={valeurs.label}
              onChange={(e) => setValeurs((v) => ({ ...v, label: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="spec-ordre">Ordre d'affichage</Label>
            <Input
              id="spec-ordre"
              type="number"
              min={0}
              value={valeurs.sort_order}
              onChange={(e) => setValeurs((v) => ({ ...v, sort_order: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={enregistrer} disabled={creer.isPending || modifier.isPending}>
            {creer.isPending || modifier.isPending ? "Enregistrement…" : edit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SectionSpecialites
