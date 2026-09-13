import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

/* ─────────────────────────────────────────────────────────────────────
  Dialog création / édition d'une filière.
───────────────────────────────────────────────────────────────────── */

const TitreSection = ({ children }) => (
  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
    {children}
  </p>
)

const DialogFiliere = ({ filiere, mutation, onFermer }) => {
  const edit = !!filiere
  const [valeurs, setValeurs] = useState(() => ({
    code: filiere?.code ?? "",
    label: filiere?.label ?? "",
    slug: filiere?.slug ?? "",
    tagline: filiere?.tagline ?? "",
    description: filiere?.description ?? "",
    sort_order: filiere?.sort_order ?? 100,
    is_active: filiere?.is_active ?? true,
  }))

  const enregistrer = () => {
    if (edit) {
      mutation.mutate(
        {
          id: filiere.id,
          data: {
            label: valeurs.label,
            slug: valeurs.slug,
            tagline: valeurs.tagline || null,
            description: valeurs.description || null,
            sort_order: Number(valeurs.sort_order) || 0,
            is_active: valeurs.is_active,
          },
        },
        {
          onSuccess: () => onFermer(),
          onError: () => {},
        }
      )
    } else {
      mutation.mutate(
        {
          code: valeurs.code.trim(),
          label: valeurs.label.trim(),
          slug: valeurs.slug.trim(),
          tagline: valeurs.tagline.trim() || null,
          description: valeurs.description.trim() || null,
          sort_order: Number(valeurs.sort_order) || 100,
          is_active: valeurs.is_active,
        },
        {
          onSuccess: () => onFermer(),
          onError: () => {},
        }
      )
    }
  }

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{edit ? `Modifier « ${filiere.label} »` : "Nouvelle filière"}</DialogTitle>
          <DialogDescription>
            Le code et le libellé servent au matching et aux filtres publics.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* ── Section 1 : Identifiants ── */}
          <div className="flex flex-col gap-3">
            <TitreSection>Identifiants</TitreSection>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filiere-code">Code</Label>
              <Input
                id="filiere-code"
                value={valeurs.code}
                onChange={(e) => setValeurs((v) => ({ ...v, code: e.target.value }))}
                disabled={edit}
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Clé d'API unique (ex. tech-dev) — non modifiable après création.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filiere-label">Libellé</Label>
              <Input
                id="filiere-label"
                value={valeurs.label}
                onChange={(e) => setValeurs((v) => ({ ...v, label: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filiere-slug">Slug</Label>
              <Input
                id="filiere-slug"
                value={valeurs.slug}
                onChange={(e) => setValeurs((v) => ({ ...v, slug: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground">Segment d'URL public.</p>
            </div>
          </div>

          <Separator />

          {/* ── Section 2 : Paramètres d'affichage ── */}
          <div className="flex flex-col gap-3">
            <TitreSection>Paramètres d'affichage</TitreSection>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filiere-tagline">Accroche (optionnel)</Label>
              <Input
                id="filiere-tagline"
                value={valeurs.tagline}
                onChange={(e) => setValeurs((v) => ({ ...v, tagline: e.target.value }))}
                placeholder="Ex. Opportunités quotidiennes dans…"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filiere-description">Description (optionnel)</Label>
              <Textarea
                id="filiere-description"
                value={valeurs.description}
                onChange={(e) => setValeurs((v) => ({ ...v, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filiere-ordre">Ordre d'affichage</Label>
                <Input
                  id="filiere-ordre"
                  type="number"
                  min={0}
                  value={valeurs.sort_order}
                  onChange={(e) => setValeurs((v) => ({ ...v, sort_order: e.target.value }))}
                />
              </div>
              {/* Switch au lieu du <select> natif */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filiere-active">Active</Label>
                <div className="flex h-9 items-center justify-between rounded-md border border-input px-3">
                  <span className="text-xs text-muted-foreground">
                    {valeurs.is_active ? "Visible publiquement" : "Masquée"}
                  </span>
                  <Switch
                    id="filiere-active"
                    checked={valeurs.is_active}
                    onCheckedChange={(v) => setValeurs((prev) => ({ ...prev, is_active: v }))}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={enregistrer} disabled={mutation.isPending}>
            {mutation.isPending ? "Enregistrement…" : edit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DialogFiliere