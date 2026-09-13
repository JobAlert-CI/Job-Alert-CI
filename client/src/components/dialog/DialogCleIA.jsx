import { useState } from "react"
import { messageErreurIa } from "@/features/admin-ia.tools"
import { useNotify } from "@/contexts/Notify.context"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"


const FOURNISSEURS = [
  { valeur: "openai_compatible", libelle: "OpenAI-compatible" },
  { valeur: "openai", libelle: "OpenAI" },
  { valeur: "mistral", libelle: "Mistral" },
  { valeur: "groq", libelle: "Groq" },
  { valeur: "anthropic", libelle: "Anthropic" },
  { valeur: "google_gemini", libelle: "Google Gemini" },
  { valeur: "ollama", libelle: "Ollama (local)" },
  { valeur: "mock", libelle: "Mock (démo/tests)" },
]

/* Sous-titre de groupe du formulaire — discret mais structurant. */
const TitreGroupe = ({ children }) => (
  <p className="border-t border-border pt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 first:border-t-0 first:pt-0">
    {children}
  </p>
)


const DialogCleIA = ({ cle, mutation, onFermer }) => {
  const notify = useNotify()
  const edit = !!cle
  // Le champ api_key démarre TOUJOURS vide : le serveur ne renvoie jamais
  // la clé — seul un masque ****ab12 est affichable.
  const [valeurs, setValeurs] = useState(() => ({
    name: cle?.name ?? "",
    provider_type: cle?.provider_type ?? "openai_compatible",
    base_url: cle?.base_url ?? "",
    models: cle?.models ?? "",
    api_key: "",
    priority: cle?.priority ?? 100,
    is_active: cle?.is_active ?? true,
    max_concurrent_requests: cle?.max_concurrent_requests ?? 1,
    timeout_seconds: cle?.timeout_seconds ?? 60,
    max_retries: cle?.max_retries ?? 2,
    retry_backoff_seconds: cle?.retry_backoff_seconds ?? 5,
    rate_limit_per_minute: cle?.rate_limit_per_minute ?? "",
    notes: cle?.notes ?? "",
  }))

  const modelsTexte = Array.isArray(valeurs.models)
    ? valeurs.models.join(", ")
    : typeof valeurs.models === "string" ? valeurs.models : ""

  const enregistrer = () => {
    const base = {
      name: valeurs.name.trim(),
      provider_type: valeurs.provider_type,
      base_url: valeurs.base_url.trim() || null,
      priority: Number(valeurs.priority) || 0,
      is_active: valeurs.is_active,
      max_concurrent_requests: Number(valeurs.max_concurrent_requests) || 1,
      timeout_seconds: Number(valeurs.timeout_seconds) || 60,
      max_retries: Number(valeurs.max_retries) || 0,
      retry_backoff_seconds: Number(valeurs.retry_backoff_seconds) || 0,
      rate_limit_per_minute: valeurs.rate_limit_per_minute === "" ? null : Number(valeurs.rate_limit_per_minute),
      notes: valeurs.notes.trim() || null,
    }
    // models : liste texte → array (vide = null, inchangé en PATCH si null).
    const liste = modelsTexte.split(",").map((m) => m.trim()).filter(Boolean)
    const models = liste.length ? { models: liste } : {}
    // Clé : en création OBLIGATOIRE ; en édition OPTIONNELLE (vide = inchangée).
    const cleChamp = !edit || valeurs.api_key.trim() ? { api_key: valeurs.api_key.trim() } : {}

    if (edit && !valeurs.name.trim()) return notify("Le nom est obligatoire", "error")
    if (!edit && !valeurs.api_key.trim()) return notify("La clé API est obligatoire en création", "error")

    const payload = { ...base, ...models, ...cleChamp }
    mutation.mutate(
      edit ? { cleId: cle.id, data: payload } : payload,
      {
        onSuccess: () => {
          notify(edit ? `Clé « ${valeurs.name} » mise à jour` : `Clé « ${valeurs.name} » créée`, "success")
          onFermer()
        },
        onError: (err) => notify(messageErreurIa(err), "error"),
      }
    )
  }

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{edit ? `Modifier « ${cle.name} »` : "Nouvelle clé API IA"}</DialogTitle>
          <DialogDescription>
            {edit
              ? "La clé elle-même n'est jamais relue : laissez le champ vide pour conserver la clé actuelle."
              : "La clé est chiffrée à la création — seul le suffixe ****abcd restera affichable."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {/* ── Informations générales ── */}
          <TitreGroupe>Informations générales</TitreGroupe>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cle-nom">Nom</Label>
              <Input
                id="cle-nom"
                value={valeurs.name}
                onChange={(e) => setValeurs((v) => ({ ...v, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cle-fournisseur">Fournisseur</Label>
              <select
                id="cle-fournisseur"
                value={valeurs.provider_type}
                onChange={(e) => setValeurs((v) => ({ ...v, provider_type: e.target.value }))}
                className="h-9 rounded-md border border-input bg-input/20 px-2 text-xs"
              >
                {FOURNISSEURS.map((f) => <option key={f.valeur} value={f.valeur}>{f.libelle}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cle-active">Active</Label>
              <select
                id="cle-active"
                value={valeurs.is_active ? "1" : "0"}
                onChange={(e) => setValeurs((v) => ({ ...v, is_active: e.target.value === "1" }))}
                className="h-9 rounded-md border border-input bg-input/20 px-2 text-xs"
              >
                <option value="1">Oui — utilisée</option>
                <option value="0">Non — désactivée</option>
              </select>
            </div>
          </div>

          {/* ── Clé & connexion ── */}
          <TitreGroupe>Clé & connexion</TitreGroupe>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cle-api">
              Clé API {edit && <span className="font-normal text-muted-foreground">(vide = inchangée)</span>}
            </Label>
            <Input
              id="cle-api"
              type="password"
              value={valeurs.api_key}
              autoComplete="new-password"
              placeholder={edit ? "Laisser vide pour conserver la clé actuelle" : "sk-…"}
              onChange={(e) => setValeurs((v) => ({ ...v, api_key: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cle-base-url">Base URL (optionnel)</Label>
              <Input
                id="cle-base-url"
                value={valeurs.base_url}
                placeholder="https://api.openai.com/v1"
                onChange={(e) => setValeurs((v) => ({ ...v, base_url: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cle-models">Modèles (optionnel, virgules)</Label>
              <Input
                id="cle-models"
                value={modelsTexte}
                placeholder="gpt-4o-mini, gpt-4.1"
                onChange={(e) => setValeurs((v) => ({ ...v, models: e.target.value }))}
              />
            </div>
          </div>

          {/* ── Limites & comportement ── */}
          <TitreGroupe>Limites & comportement</TitreGroupe>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cle-priorite">Priorité</Label>
              <Input id="cle-priorite" type="number" min={0} value={valeurs.priority}
                onChange={(e) => setValeurs((v) => ({ ...v, priority: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cle-concurrent">Requêtes //</Label>
              <Input id="cle-concurrent" type="number" min={1} value={valeurs.max_concurrent_requests}
                onChange={(e) => setValeurs((v) => ({ ...v, max_concurrent_requests: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cle-timeout">Timeout (s)</Label>
              <Input id="cle-timeout" type="number" min={1} value={valeurs.timeout_seconds}
                onChange={(e) => setValeurs((v) => ({ ...v, timeout_seconds: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cle-retries">Retries</Label>
              <Input id="cle-retries" type="number" min={0} value={valeurs.max_retries}
                onChange={(e) => setValeurs((v) => ({ ...v, max_retries: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cle-backoff">Backoff (s)</Label>
              <Input id="cle-backoff" type="number" min={0} value={valeurs.retry_backoff_seconds}
                onChange={(e) => setValeurs((v) => ({ ...v, retry_backoff_seconds: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cle-rate">Rate limit /min</Label>
              <Input id="cle-rate" type="number" min={1} value={valeurs.rate_limit_per_minute} placeholder="illimité"
                onChange={(e) => setValeurs((v) => ({ ...v, rate_limit_per_minute: e.target.value }))} />
            </div>
          </div>

          {/* ── Notes ── */}
          <TitreGroupe>Notes</TitreGroupe>
          <Textarea
            id="cle-notes"
            rows={2}
            value={valeurs.notes}
            onChange={(e) => setValeurs((v) => ({ ...v, notes: e.target.value }))}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={enregistrer} disabled={mutation.isPending}>
            {mutation.isPending ? "Enregistrement…" : edit ? "Enregistrer" : "Créer la clé"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DialogCleIA