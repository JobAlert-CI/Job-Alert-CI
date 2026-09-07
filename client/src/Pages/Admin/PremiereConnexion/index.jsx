import { useState } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { Eye, EyeOff, KeyRound, ShieldAlert } from "lucide-react"
import { changePassword } from "@/api/admin/auth"
import { formatApiError } from "@/api/errors"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { useNotify } from "@/contexts/Notify.context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"

/* ─────────────────────────────────────────────────────────────────────
   Page Changement de mot de passe obligatoire — /admin/premiere-connexion
   (cycle 15, flux « mot de passe temporaire »).

   Quand un admin est créé sans mot de passe, le serveur génère un
   temporaire (renvoyé UNE seule fois au super_admin créateur) et marque
   le compte must_change_password=true. Au login, TokenRead porte le
   flag : le front redirige ICI avant toute autre navigation. La sortie
   ne se fait qu'en changeant effectivement le mot de passe (PUT
   /me/password vérifie l'ancien = le temporaire, applique le nouveau
   et remet le flag à false).

   Données : PUT /api/admin/auth/me/password
   { current_password (le temporaire), new_password (>= 8) }.
   Le serveur révoque ensuite toutes les sessions existantes (défense
   en profondeur) : la page redirige vers la connexion une fois fait.
   ───────────────────────────────────────────────────────────────────── */

const PremiereConnexion = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const notify = useNotify()
  const { status, profile, logout } = useAdminAuth()

  const [ancien, setAncien] = useState("")
  const [nouveau, setNouveau] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [ancienVisible, setAncienVisible] = useState(false)
  const [nouveauVisible, setNouveauVisible] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  // Pas de session → connexion (le flag vit dans /me ET TokenRead).
  if (status === "unauthenticated") {
    return <Navigate to="/admin/connexion" replace />
  }

  const nouveauValide = nouveau.length >= 8
  const confirmationValide = confirmation.length > 0 && nouveau === confirmation
  const different = ancien.length > 0 && nouveau.length > 0 && ancien === nouveau

  const soumettre = async (e) => {
    e.preventDefault()
    if (enCours) return
    setErreur(null)

    if (!ancien.trim()) {
      setErreur("Saisissez le mot de passe temporaire qui vous a été communiqué.")
      return
    }
    if (nouveau.length < 8) {
      setErreur("Le nouveau mot de passe doit contenir au moins 8 caractères.")
      return
    }
    if (different) {
      setErreur("Le nouveau mot de passe doit être différent du temporaire.")
      return
    }
    if (nouveau !== confirmation) {
      setErreur("La confirmation ne correspond pas au nouveau mot de passe.")
      return
    }

    setEnCours(true)
    try {
      await changePassword({ current_password: ancien, new_password: nouveau })
      // Le serveur a révoqué la famille de refresh (défense en profondeur) :
      // l'access token survit encore quelques minutes mais il ne faut PAS
      // tenter de continuer la session avec lui (le layout re-redirigerait
      // ici — must_change_password reste vrai dans le /me en cache). La
      // sortie propre : déconnexion locale (tokens purgés, cache vidé)
      // puis reconnexion avec le NOUVEAU mot de passe — ce qui valide le
      // changement de bout en bout.
      try {
        await logout()
      } catch {
        // Refresh déjà révoqué serveur : les tokens sont purgés par la
        // mutation (onMutate), la déconnexion locale suffit.
      }
      notify("Mot de passe défini — reconnectez-vous avec le nouveau.", "success")
      navigate("/admin/connexion", {
        replace: true,
        state: { from: location.state?.from },
      })
    } catch (err) {
      setErreur(formatApiError(err) || "Changement impossible. Vérifiez le mot de passe temporaire.")
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="grid min-h-svh place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* En-tête */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <KeyRound className="size-8 text-primary" aria-hidden />
          <Badge variant="outline">Première connexion</Badge>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-1">
            <h1 className="font-heading text-base font-semibold">
              Définissez votre mot de passe
            </h1>
            <p className="text-xs/relaxed text-muted-foreground">
              {profile?.full_name || "Votre compte"} a été créé avec un mot de passe
              temporaire. Par sécurité, vous devez le remplacer avant d'accéder au
              back-office — il vous sera demandé à chaque connexion.
            </p>
          </div>

          {erreur && (
            <div role="alert" className="mb-4">
              <Alert variant="destructive">
                <ShieldAlert />
                <AlertTitle>Changement refusé</AlertTitle>
                <AlertDescription>{erreur}</AlertDescription>
              </Alert>
            </div>
          )}

          <form onSubmit={soumettre} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tmp-ancien">Mot de passe temporaire</Label>
              <div className="relative">
                <Input
                  id="tmp-ancien"
                  type={ancienVisible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={ancien}
                  onChange={(e) => setAncien(e.target.value)}
                  placeholder="Celui communiqué par votre super admin"
                  className="pr-9"
                  aria-invalid={!!erreur}
                />
                <button
                  type="button"
                  onClick={() => setAncienVisible((v) => !v)}
                  aria-label={ancienVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  {ancienVisible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tmp-nouveau">Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="tmp-nouveau"
                  type={nouveauVisible ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={nouveau}
                  onChange={(e) => setNouveau(e.target.value)}
                  placeholder="8 caractères minimum"
                  className="pr-9"
                  aria-invalid={!!erreur}
                />
                <button
                  type="button"
                  onClick={() => setNouveauVisible((v) => !v)}
                  aria-label={nouveauVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  {nouveauVisible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tmp-confirm">Confirmer le nouveau mot de passe</Label>
              <Input
                id="tmp-confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="Ressaisissez le nouveau mot de passe"
                aria-invalid={!!(confirmation && nouveau !== confirmation)}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={enCours || !ancien.trim() || !nouveauValide || !confirmationValide}
              className="w-full"
            >
              {enCours ? <Spinner /> : <KeyRound aria-hidden />}
              {enCours ? "Enregistrement…" : "Définir et continuer"}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-[10px] text-muted-foreground">
          Toutes les sessions existantes sont fermées après un changement de mot de passe.
        </p>
      </div>
    </div>
  )
}

export default PremiereConnexion
