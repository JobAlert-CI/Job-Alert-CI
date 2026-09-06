import { useState } from "react"
import { Building2, Save } from "lucide-react"
import { useModifierEntreprise, messageErreurCompany } from "@/features/admin-entreprises.tools"
import { useReferentialsQuery } from "@/lib/referentiels-query"
import { useNotify } from "@/contexts/Notify.context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

/* ─────────────────────────────────────────────────────────────────────
   Dialog d'édition d'une fiche entreprise.

   Contrat PUT /companies/{id} (CompanyUpdate, TOUT optionnel — on
   n'envoie que les champs soumis) : name, website_url, logo_url,
   description, primary_filiere_id (UUID cette fois, pas un code —
   cf. schemas/companies.py). Le slug/normalized_name sont recalculés
   serveur si le nom change.

   La clé `key={entreprise?.id}` au montage parent remonte l'état du
   formulaire à chaque changement d'entreprise (pattern du repo, zéro
   setState dans un effect).
   ───────────────────────────────────────────────────────────────────── */

const SELECT_VIDE = "__vide__"

const DialogEditionEntreprise = ({ ouvert, entreprise, onFermer }) => {
  const notify = useNotify()
  const { data: referentiels } = useReferentialsQuery()
  const modifierMutation = useModifierEntreprise()

  // Initialisation UNE fois : le parent passe key={entreprise?.id} →
  // changement d'entreprise = remontage, pas de setState dans un effect.
  const [valeurs, setValeurs] = useState(() => ({
    name: entreprise?.name ?? "",
    website_url: entreprise?.website_url ?? "",
    logo_url: entreprise?.logo_url ?? "",
    description: entreprise?.description ?? "",
    primary_filiere_id: entreprise?.primary_filiere_id ?? "",
  }))

  const set = (champ) => (v) => setValeurs((prev) => ({ ...prev, [champ]: v }))

  const filieres = referentiels?.filieres ?? []

  const soumettre = async (e) => {
    e.preventDefault()
    const payload = {
      name: valeurs.name.trim(),
      website_url: valeurs.website_url.trim() || null,
      logo_url: valeurs.logo_url.trim() || null,
      description: valeurs.description.trim() || null,
      primary_filiere_id: valeurs.primary_filiere_id || null,
    }
    try {
      await modifierMutation.mutateAsync({ companyId: entreprise.id, data: payload })
      notify("Fiche entreprise mise à jour", "success")
      onFermer()
    } catch (err) {
      notify(messageErreurCompany(err) || "Enregistrement impossible", "error")
    }
  }

  return (
    <Dialog open={ouvert} onOpenChange={(o) => !o && onFermer()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-4" aria-hidden /> Modifier l'entreprise
          </DialogTitle>
          <DialogDescription>
            {entreprise?.name} — {entreprise?.active_offers_count ?? 0} offre(s) active(s).
            Le nom normalisé et le slug sont recalculés automatiquement si vous renommez.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={soumettre} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ent-nom">Nom *</Label>
            <Input
              id="ent-nom"
              value={valeurs.name}
              onChange={(e) => set("name")(e.target.value)}
              required
              maxLength={255}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ent-site">Site web</Label>
            <Input
              id="ent-site"
              type="url"
              value={valeurs.website_url}
              onChange={(e) => set("website_url")(e.target.value)}
              placeholder="https://…"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ent-logo">Logo (URL)</Label>
            <Input
              id="ent-logo"
              type="url"
              value={valeurs.logo_url}
              onChange={(e) => set("logo_url")(e.target.value)}
              placeholder="https://cdn…/logo.png"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Filière principale</Label>
            <Select value={valeurs.primary_filiere_id} onValueChange={set("primary_filiere_id")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choisir une filière" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_VIDE}>— Aucune —</SelectItem>
                {filieres.map((f) => (
                  <SelectItem key={f.id ?? f.code} value={f.id ?? f.code}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Utilisée pour l'affichage public du classement par filière.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ent-description">Description</Label>
            <Textarea
              id="ent-description"
              rows={3}
              value={valeurs.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="Présentation courte de l'entreprise…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onFermer}>
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={modifierMutation.isPending || !valeurs.name.trim()}>
              {modifierMutation.isPending ? <Spinner /> : <Save aria-hidden />}
              {modifierMutation.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default DialogEditionEntreprise
