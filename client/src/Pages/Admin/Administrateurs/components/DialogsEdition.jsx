import { useState } from "react"
import { useNotify } from "@/contexts/Notify.context"
import { messageErreurAdmin } from "@/features/admin-administrateurs.tools"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { ROLES } from "./roles"

/* ─────────────────────────────────────────────────────────────────────
   Dialogs d'édition / changement de rôle / confirmation de suppression
   (doc v3 §15, cycle 15).

   Garde-fous (les 4 « 400 serveur ») : sur SA PROPRE ligne, le front
   grise déjà les actions (boutons disabled) — ces dialogs ne s'ouvrent
   donc jamais pour soi-même. Les messages serveur restent affichés
   tels quels en cas de course.

   Édition = AdminUpdate { email?, full_name?, is_active? } —
   exclude_unset : on n'envoie QUE les champs modifiés (null = inchangé,
   jamais « effacer »).
   ───────────────────────────────────────────────────────────────────── */

/** Édition email / nom / statut actif. */
export const DialogEdition = ({ admin, moiMeme, mutation, onFermer }) => {
  const notify = useNotify()

  const [email, setEmail] = useState(admin.email)
  const [nom, setNom] = useState(admin.full_name)
  const [actif, setActif] = useState(admin.is_active)
  const [erreur, setErreur] = useState(null)

  const soumettre = (e) => {
    e.preventDefault()
    setErreur(null)

    // exclude_unset : n'envoyer que ce qui a changé.
    const data = {}
    if (email.trim().toLowerCase() !== admin.email) data.email = email.trim().toLowerCase()
    if (nom.trim() !== admin.full_name) data.full_name = nom.trim()
    if (actif !== admin.is_active) data.is_active = actif

    if (!Object.keys(data).length) {
      onFermer()
      return
    }

    mutation.mutate(
      { id: admin.id, data, moiMeme },
      {
        onSuccess: () => {
          notify("Administrateur mis à jour", "success")
          onFermer()
        },
        onError: (err) => setErreur(messageErreurAdmin(err)),
      }
    )
  }

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier « {admin.full_name} »</DialogTitle>
          <DialogDescription>
            {moiMeme
              ? "Votre propre compte — la désactivation est bloquée serveur (grisée)."
              : "Seuls les champs modifiés sont envoyés."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={soumettre} className="grid gap-3">
          {erreur && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {erreur}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-email">Email</Label>
            <Input id="edit-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-nom">Nom complet</Label>
            <Input id="edit-nom" required minLength={2} maxLength={180} value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>

          {/* Garde-fou n°1 : désactivation de soi-même impossible (400 serveur). */}
          <label
            className={`flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs ${moiMeme ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            htmlFor="edit-actif"
          >
            <Checkbox
              id="edit-actif"
              className="mt-0.5"
              checked={actif}
              disabled={moiMeme}
              onCheckedChange={(v) => setActif(!!v)}
            />
            <span>
              Compte actif
              <span className="block text-[10px] text-muted-foreground">
                Un compte inactif ne peut plus se connecter au back-office.
                {moiMeme && " Vous ne pouvez pas désactiver votre propre compte."}
              </span>
            </span>
          </label>
        </form>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onFermer}>Annuler</Button>
          <Button
            type="submit"
            disabled={mutation.isPending || !email.trim() || nom.trim().length < 2}
            onClick={soumettre}
          >
            {mutation.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Changement de rôle (garde-fou n°2 : retrait de son propre super_admin interdit). */
export const DialogRole = ({ admin, moiMeme, mutation, onFermer }) => {
  const notify = useNotify()
  const [role, setRole] = useState(admin.role)
  const [erreur, setErreur] = useState(null)

  const appliquer = () => {
    setErreur(null)
    if (role === admin.role) {
      onFermer()
      return
    }
    mutation.mutate(
      { id: admin.id, role, moiMeme },
      {
        onSuccess: () => {
          notify(`Rôle de « ${admin.full_name} » mis à jour`, "success")
          onFermer()
        },
        onError: (err) => setErreur(messageErreurAdmin(err)),
      }
    )
  }

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Changer le rôle de « {admin.full_name} »</DialogTitle>
          <DialogDescription>
            Le rôle conditionne l'accès aux pages du back-office.
            {moiMeme && " ⚠️ Vous ne pouvez pas retirer votre propre rôle super_admin (grisé)."}
          </DialogDescription>
        </DialogHeader>

        {erreur && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {erreur}
          </p>
        )}

        <Select value={role} onValueChange={setRole}>
          <SelectTrigger aria-label="Rôle">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem
                key={r.valeur}
                value={r.valeur}
                disabled={moiMeme && r.valeur !== "super_admin"}
              >
                {r.libelle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onFermer}>Annuler</Button>
          <Button type="button" disabled={mutation.isPending || role === admin.role} onClick={appliquer}>
            {mutation.isPending ? "Application…" : "Appliquer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Confirmation suppression — définitive, mais journal PRÉSERVÉ (cycle 15). */
export const DialogSuppression = ({ admin, mutation, onFermer }) => {
  const notify = useNotify()

  const supprimer = () =>
    mutation.mutate(admin.id, {
      onSuccess: () => {
        notify(`« ${admin.full_name} » supprimé`, "success")
        onFermer()
      },
      onError: (err) => notify(messageErreurAdmin(err), "error"),
    })

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer « {admin.full_name} » ?</DialogTitle>
          <DialogDescription>
            Action définitive. L'administrateur perd immédiatement l'accès et ses
            sessions actives deviennent inutilisables.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertTitle>Le journal d'activité est préservé</AlertTitle>
          <AlertDescription>
            Les actions passées de cet administrateur restent visibles dans le journal
            (l'auteur apparaît comme « supprimé ») — rien n'est effacé de l'historique.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onFermer}>Annuler</Button>
          <Button type="button" variant="destructive" disabled={mutation.isPending} onClick={supprimer}>
            {mutation.isPending ? "Suppression…" : "Supprimer définitivement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
