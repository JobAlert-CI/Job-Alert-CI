import { useState } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminDailyTipsQuery, useCreateDailyTip, useUpdateDailyTip,
  useDeleteDailyTip, messageErreurContenu,
} from "@/features/admin-contenu.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { SectionErreur, SectionVide } from "./components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet 14.3 — Conseils du jour : CRUD + créneau de rotation.

   MIGRATION 0015 (feu vert cycle 14) : PLUSIEURS conseils peuvent
   partager un créneau (409 supprimé). Le site public choisit
   déterministement dans le créneau (day_of_year % nb) — chaque tip
   finit par tourner. La table regroupe par jour, le dialog montre
   combien de tips occupent chaque créneau.
   ───────────────────────────────────────────────────────────────────── */

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]

const OngletConseils = () => {
  const notify = useNotify()
  const { data: conseils, isLoading, isError, refetch } = useAdminDailyTipsQuery()

  const [edition, setEdition] = useState(null)
  const [suppression, setSuppression] = useState(null)

  const creerMutation = useCreateDailyTip()
  const modifierMutation = useUpdateDailyTip()
  const supprimerMutation = useDeleteDailyTip()

  // Compte par créneau (affiché en table + dialog) + compteurs onglet.
  const parCreneau = new Map()
  for (const tip of conseils ?? []) {
    parCreneau.set(tip.rotation_order, (parCreneau.get(tip.rotation_order) ?? 0) + 1)
  }
  const nbActifs = (conseils ?? []).filter((t) => t.is_active).length
  const nbJoursOccupes = parCreneau.size

  return (
    <div className="flex flex-col gap-3">
      {/* Compteurs (cycle 14, sélection utilisateur) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CarteCompteur label="Conseils" valeur={conseils?.length ?? 0} chargement={isLoading} />
        <CarteCompteur label="Actifs" valeur={nbActifs} chargement={isLoading} />
        <CarteCompteur
          label="Jours occupés"
          valeur={nbJoursOccupes}
          texte={`${nbJoursOccupes}/7`}
          chargement={isLoading}
        />
        <CarteCompteur
          label="Semaine complète"
          valeur={nbJoursOccupes}
          texte={nbJoursOccupes === 7 ? "Oui" : "Non"}
          chargement={isLoading}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Plusieurs conseils peuvent partager un jour — le site public les fait tourner
          déterministement au fil des jours.
        </p>
        <Button size="sm" onClick={() => setEdition({})}>
          <Plus aria-hidden /> Nouveau conseil
        </Button>
      </div>

      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les conseils." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      ) : !conseils?.length ? (
        <SectionVide message="Aucun conseil pour le moment." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jour</TableHead>
                <TableHead>Conseil</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...conseils].sort((a, b) => a.rotation_order - b.rotation_order).map((tip) => (
                <TableRow key={tip.id}>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant="outline">{JOURS[tip.rotation_order] ?? `#${tip.rotation_order}`}</Badge>
                    {(parCreneau.get(tip.rotation_order) ?? 0) > 1 && (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        ({parCreneau.get(tip.rotation_order)} ce jour)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-96">
                    <span className="block truncate text-xs" title={tip.text}>{tip.text}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tip.is_active ? "secondary" : "outline"}>
                      {tip.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEdition(tip)} aria-label="Modifier le conseil">
                        <Pencil aria-hidden />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setSuppression(tip)} aria-label="Supprimer le conseil">
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

      {/* Dialog création / édition */}
      {edition && (
        <DialogConseil
          conseil={edition.id ? edition : null}
          parCreneau={parCreneau}
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
              <DialogTitle>
                Supprimer ce conseil {JOURS[suppression.rotation_order] ?? ""} ?
              </DialogTitle>
              <DialogDescription>
                {(parCreneau.get(suppression.rotation_order) ?? 0) > 1
                  ? "D'autres conseils restent sur ce créneau — la rotation continue."
                  : "Le créneau redeviendra vide."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
              <Button
                variant="destructive"
                disabled={supprimerMutation.isPending}
                onClick={() =>
                  supprimerMutation.mutate(suppression.id, {
                    onSuccess: () => { notify("Conseil supprimé", "success"); setSuppression(null) },
                    onError: (err) => notify(messageErreurContenu(err), "error"),
                  })
                }
              >
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

const DialogConseil = ({ conseil, parCreneau, creer, modifier, onFermer }) => {
  const notify = useNotify()
  const edit = !!conseil
  const [valeurs, setValeurs] = useState(() => ({
    text: conseil?.text ?? "",
    rotation_order: String(conseil?.rotation_order ?? ""),
    is_active: conseil?.is_active ?? true,
  }))
  const set = (c, v) => setValeurs((p) => ({ ...p, [c]: v }))

  const nbSurCreneau = valeurs.rotation_order !== "" ? (parCreneau.get(Number(valeurs.rotation_order)) ?? 0) : 0

  const enregistrer = () => {
    const data = {
      text: valeurs.text.trim(),
      rotation_order: Number(valeurs.rotation_order),
      is_active: valeurs.is_active,
    }
    const appel = edit
      ? modifier.mutateAsync({ id: conseil.id, data })
      : creer.mutateAsync(data)
    appel
      .then(() => { notify(edit ? "Conseil mis à jour" : "Conseil créé", "success"); onFermer() })
      .catch((err) => notify(messageErreurContenu(err), "error"))
  }

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? `Modifier le conseil ${JOURS[conseil.rotation_order] ?? ""}` : "Nouveau conseil du jour"}</DialogTitle>
          <DialogDescription>
            Plusieurs conseils par jour autorisés — ils tournent automatiquement sur le site public.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tip-texte">Texte du conseil</Label>
            <Textarea id="tip-texte" value={valeurs.text} onChange={(e) => set("text", e.target.value)} rows={3} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tip-creneau">Jour</Label>
            <Select value={valeurs.rotation_order} onValueChange={(v) => set("rotation_order", v)}>
              <SelectTrigger id="tip-creneau" className="w-full">
                <SelectValue placeholder="Choisir un jour…" />
              </SelectTrigger>
              <SelectContent>
                {JOURS.map((jour, i) => {
                  const nb = parCreneau.get(i) ?? 0
                  return (
                    <SelectItem key={i} value={String(i)}>
                      {jour}{nb > 0 ? ` (${nb} conseil${nb > 1 ? "s" : ""})` : ""}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {!edit && nbSurCreneau > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {nbSurCreneau} conseil{nbSurCreneau > 1 ? "s" : ""} occupe{nbSurCreneau > 1 ? "nt" : ""} déjà ce jour —
                ils tourneront automatiquement.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tip-actif">Actif</Label>
            <select
              id="tip-actif"
              value={valeurs.is_active ? "1" : "0"}
              onChange={(e) => set("is_active", e.target.value === "1")}
              className="h-7 rounded-md border border-input bg-input/20 px-2 text-xs"
            >
              <option value="1">Oui — affiché</option>
              <option value="0">Non — masqué</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={enregistrer} disabled={creer.isPending || modifier.isPending || !valeurs.text.trim() || valeurs.rotation_order === ""}>
            {creer.isPending || modifier.isPending ? "Enregistrement…" : edit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default OngletConseils
