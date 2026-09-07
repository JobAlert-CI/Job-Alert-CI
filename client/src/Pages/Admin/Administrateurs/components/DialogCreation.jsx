import { useState } from "react"
import { Mail, MailWarning } from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import { messageErreurAdmin } from "@/features/admin-administrateurs.tools"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { ROLES } from "./roles"

/* ─────────────────────────────────────────────────────────────────────
   Dialog création d'un administrateur (doc v3 §15 + cycle 15).

   Le champ mot de passe est OPTIONNEL : vide → le serveur génère un
   TEMPORAIRE (16 car., sans caractères ambigus), le renvoie UNE seule
   fois (201.temporary_password) et marque must_change_password=true —
   changement obligatoire à la première connexion. Le parent affiche le
   temporaire dans un dialog dédié à copier immédiatement.

   Champs = AdminCreate : email (5-320), password? (8-128), full_name
   (2-180), role (defaut moderateur — AdminRoleLiteral).
   ───────────────────────────────────────────────────────────────────── */

const DialogCreation = ({ mutation, onFermer, onCree }) => {
  const [email, setEmail] = useState("")
  const [nom, setNom] = useState("")
  const [role, setRole] = useState("moderateur")
  const [avecMotDePasse, setAvecMotDePasse] = useState(false)
  const [motDePasse, setMotDePasse] = useState("")
  const [erreur, setErreur] = useState(null)

  const soumettre = (e) => {
    e?.preventDefault?.()
    setErreur(null)

    const data = { email: email.trim().toLowerCase(), full_name: nom.trim(), role }
    if (avecMotDePasse) {
      if (motDePasse.length < 8) {
        setErreur("Le mot de passe doit contenir au moins 8 caractères.")
        return
      }
      data.password = motDePasse
    }
    // La réponse (avec temporary_password éventuel) remonte au parent :
    // c'est lui qui affiche le temporaire UNE seule fois puis ferme.
    mutation.mutate(data, {
      onSuccess: (reponse) => onCree?.(reponse),
      onError: (err) => setErreur(messageErreurAdmin(err)),
    })
  }

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvel administrateur</DialogTitle>
          <DialogDescription>
            Le compte sera actif immédiatement. Sans mot de passe saisi, un
            temporaire sera généré et à changer à la première connexion.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={soumettre} className="grid gap-3">
          {erreur && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {erreur}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              required
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@jobalert.ci"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-nom">Nom complet</Label>
            <Input
              id="admin-nom"
              required
              minLength={2}
              maxLength={180}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Prénom Nom"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-role">Rôle</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="admin-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.valeur} value={r.valeur}>{r.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Le rôle détermine les pages accessibles dans le back-office.
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
            <label className="flex cursor-pointer items-start gap-2 text-xs" htmlFor="admin-mdp">
              <Checkbox
                id="admin-mdp"
                className="mt-0.5"
                checked={avecMotDePasse}
                onCheckedChange={(v) => setAvecMotDePasse(!!v)}
              />
              <span>
                Définir moi-même le mot de passe initial
                <span className="block text-[10px] text-muted-foreground">
                  Décoché : un mot de passe temporaire sécurisé sera généré, affiché une
                  seule fois et envoyé automatiquement par email au nouvel admin,
                  à changer obligatoirement à la première connexion.
                </span>
              </span>
            </label>
            {avecMotDePasse && (
              <Input
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                placeholder="8 caractères minimum"
                aria-label="Mot de passe initial"
              />
            )}
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onFermer}>Annuler</Button>
          <Button
            type="button"
            disabled={mutation.isPending || !email.trim() || nom.trim().length < 2 || (avecMotDePasse && motDePasse.length < 8)}
            onClick={soumettre}
          >
            {mutation.isPending ? "Création…" : "Créer l'administrateur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   Affichage unique du mot de passe temporaire (réponse 201).
   ⚠️ Le temporaire ne sera PLUS jamais accessible après fermeture :
   le copier maintenant (canal sûr hors de l'application).

   Cycle 15 (option B) : la réponse porte welcome_email_sent — l'email
   de bienvenue AVEC le temporaire est parti automatiquement (badge
   vert) ou non (bandeau orange : transmettez-le vous-même).
   ───────────────────────────────────────────────────────────────────── */

export const DialogMotDePasseTemporaire = ({ reponse, onFermer }) => {
  const notify = useNotify()
  const emailParti = !!reponse?.welcome_email_sent

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(reponse.temporary_password)
      notify("Mot de passe copié", "success")
    } catch {
      notify("Copie impossible — sélectionnez le texte manuellement", "warning")
    }
  }

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compte créé — mot de passe temporaire</DialogTitle>
          <DialogDescription>
            {reponse.full_name} ({reponse.email}) devra définir son propre mot de passe
            à sa première connexion. Ce temporaire ne sera plus jamais affiché.
          </DialogDescription>
        </DialogHeader>

        {emailParti ? (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
            <Mail className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            <p>
              Un email de bienvenue contenant le mot de passe temporaire a été
              envoyé automatiquement à <strong>{reponse.email}</strong>.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
            <MailWarning className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
            <p>
              L'email automatique n'a pas pu être envoyé (fournisseur non configuré
              ou refusé). Communiquez le mot de passe ci-dessous à{" "}
              <strong>{reponse.email}</strong> par un canal sûr.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
            <code className="flex-1 font-mono text-base font-semibold break-all select-all">
              {reponse.temporary_password}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={copier}>
              Copier
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            À la première connexion, l'administrateur sera automatiquement dirigé vers
            l'écran de changement de mot de passe.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onFermer}>J'ai terminé</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DialogCreation
