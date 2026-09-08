import { useState } from "react"
import { KeyRound, Plug, Plus, Trash2 } from "lucide-react"
import {
  messageErreurIa, useClesIaQuery, useCreerCleIa, useModifierCleIa,
  useSupprimerCleIa, useTesterCleIa,
} from "@/features/admin-ia.tools"
import { useNotify } from "@/contexts/Notify.context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Section Clés API (cycle 19, doc v3 §19) — CRUD complet.

   ⚠️ Le champ clé n'est JAMAIS pré-rempli en édition (le serveur ne
   renvoie que api_key_last4 → masque ****ab12) : PATCH sans api_key =
   clé inchangée. Test de connexion : résultat INLINE par ligne. Delete
   grisé si DERNIÈRE clé active (garde serveur 400 « Impossible de
   supprimer la derniere cle IA active » — on évite le clic inutile).
   ───────────────────────────────────────────────────────────────────── */

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

const libelleFournisseur = (v) => FOURNISSEURS.find((f) => f.valeur === v)?.libelle ?? v

const dateHeure = (iso) => {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

/* ─── Dialog création / édition (champ clé JAMAIS pré-rempli) ─── */

const DialogCle = ({ cle, mutation, onFermer }) => {
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cle-nom">Nom</Label>
              <Input id="cle-nom" value={valeurs.name}
                onChange={(e) => setValeurs((v) => ({ ...v, name: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cle-fournisseur">Fournisseur</Label>
              <select id="cle-fournisseur" value={valeurs.provider_type}
                onChange={(e) => setValeurs((v) => ({ ...v, provider_type: e.target.value }))}
                className="h-9 rounded-md border border-input bg-input/20 px-2 text-xs">
                {FOURNISSEURS.map((f) => <option key={f.valeur} value={f.valeur}>{f.libelle}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cle-api">Clé API {edit && <span className="font-normal text-muted-foreground">(vide = inchangée)</span>}</Label>
            <Input id="cle-api" type="password" value={valeurs.api_key} autoComplete="new-password"
              placeholder={edit ? "Laisser vide pour conserver la clé actuelle" : "sk-…"}
              onChange={(e) => setValeurs((v) => ({ ...v, api_key: e.target.value }))} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cle-base-url">Base URL (optionnel)</Label>
              <Input id="cle-base-url" value={valeurs.base_url} placeholder="https://api.openai.com/v1"
                onChange={(e) => setValeurs((v) => ({ ...v, base_url: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cle-models">Modèles (optionnel, virgules)</Label>
              <Input id="cle-models" value={modelsTexte} placeholder="gpt-4o-mini, gpt-4.1"
                onChange={(e) => setValeurs((v) => ({ ...v, models: e.target.value }))} />
            </div>
          </div>

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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cle-backoff">Backoff (s)</Label>
              <Input id="cle-backoff" type="number" min={0} value={valeurs.retry_backoff_seconds}
                onChange={(e) => setValeurs((v) => ({ ...v, retry_backoff_seconds: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cle-rate">Rate limit /min</Label>
              <Input id="cle-rate" type="number" min={1} value={valeurs.rate_limit_per_minute}
                placeholder="illimité"
                onChange={(e) => setValeurs((v) => ({ ...v, rate_limit_per_minute: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cle-active">Active</Label>
              <select id="cle-active" value={valeurs.is_active ? "1" : "0"}
                onChange={(e) => setValeurs((v) => ({ ...v, is_active: e.target.value === "1" }))}
                className="h-9 rounded-md border border-input bg-input/20 px-2 text-xs">
                <option value="1">Oui — utilisée par le pipeline</option>
                <option value="0">Non — désactivée</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cle-notes">Notes (optionnel)</Label>
            <Textarea id="cle-notes" rows={2} value={valeurs.notes}
              onChange={(e) => setValeurs((v) => ({ ...v, notes: e.target.value }))} />
          </div>
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

/* ─── Section ─── */

const SectionCles = () => {
  const notify = useNotify()
  const { data: cles, isLoading, isError, refetch } = useClesIaQuery()
  const creer = useCreerCleIa()
  const modifier = useModifierCleIa()
  const supprimer = useSupprimerCleIa()
  const tester = useTesterCleIa()

  const [edition, setEdition] = useState(null)          // null | {} (création) | cle
  const [confirmation, setConfirmation] = useState(null) // cle à supprimer
  // Résultats de test inline : { [cleId]: { ok, model?, message?, enCours } }
  const [tests, setTests] = useState({})

  const nbActives = (cles ?? []).filter((c) => c.is_active).length

  const testerCle = (cle) => {
    setTests((t) => ({ ...t, [cle.id]: { enCours: true } }))
    tester.mutate(cle.id, {
      onSuccess: (resultat) => setTests((t) => ({ ...t, [cle.id]: resultat })),
      onError: (err) => setTests((t) => ({ ...t, [cle.id]: { ok: false, message: messageErreurIa(err) } })),
    })
  }

  const supprimerCle = (cle) => {
    supprimer.mutate(cle.id, {
      onSuccess: () => {
        notify(`Clé « ${cle.name} » supprimée`, "success")
        setConfirmation(null)
      },
      onError: (err) => notify(messageErreurIa(err), "error"),
    })
  }

  return (
    <section aria-label="Clés API IA" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <KeyRound className="size-4 text-primary" aria-hidden /> Clés API
          </h2>
          <p className="text-xs text-muted-foreground">
            {cles?.length ?? "…"} clé{(cles?.length ?? 0) > 1 ? "s" : ""} configurée{(cles?.length ?? 0) > 1 ? "s" : ""} — {nbActives} active{nbActives > 1 ? "s" : ""}.
            Le pipeline refuse de tourner sans clé active.
          </p>
        </div>
        <Button size="sm" onClick={() => setEdition({})}>
          <Plus aria-hidden /> Nouvelle clé
        </Button>
      </div>

      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les clés." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
        </div>
      ) : !cles?.length ? (
        <SectionVide message="Aucune clé API configurée — le pipeline IA ne peut pas tourner. Créez-en une pour activer la normalisation." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead className="text-right">Priorité</TableHead>
                <TableHead className="hidden text-right md:table-cell">Quotas</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden lg:table-cell">Dernière activité</TableHead>
                <TableHead>Connexion</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cles.map((cle) => {
                const test = tests[cle.id]
                const derniereActive = cle.is_active && nbActives <= 1
                return (
                  <TableRow key={cle.id}>
                    <TableCell>
                      <span className="block text-xs font-medium">{cle.name}</span>
                      {cle.api_key_masked && (
                        <span className="block font-mono text-[10px] text-muted-foreground">{cle.api_key_masked}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{libelleFournisseur(cle.provider_type)}</TableCell>
                    <TableCell className="text-right tabular-nums">{cle.priority}</TableCell>
                    <TableCell className="hidden text-[11px] text-muted-foreground md:table-cell">
                      {cle.max_concurrent_requests}// · {cle.timeout_seconds}s · {cle.max_retries}r
                      {cle.rate_limit_per_minute ? ` · ${cle.rate_limit_per_minute}/min` : ""}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cle.is_active ? "secondary" : "outline"}>
                        {cle.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-[11px] text-muted-foreground lg:table-cell">
                      <span className="block">util. {dateHeure(cle.last_used_at)}</span>
                      <span className="block">err. {dateHeure(cle.last_error_at)}</span>
                    </TableCell>
                    <TableCell>
                      {test?.enCours ? (
                        <span className="text-[11px] text-muted-foreground">Test…</span>
                      ) : test ? (
                        <span className={`flex flex-col text-[11px] ${test.ok ? "text-emerald-600" : "text-destructive"}`}>
                          <span>{test.ok ? `OK${test.model ? ` · ${test.model}` : ""}` : "Échec"}</span>
                          {!test.ok && test.message && (
                            <span className="block max-w-40 truncate text-destructive" title={test.message}>
                              {test.message}
                            </span>
                          )}
                        </span>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => testerCle(cle)}
                          aria-label={`Tester la connexion de ${cle.name}`}>
                          <Plug className="size-3.5" aria-hidden /> Tester
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEdition(cle)}
                          aria-label={`Modifier la clé ${cle.name}`} className="text-xs">
                          Modifier
                        </Button>
                        <Button
                          variant="ghost" size="icon-sm"
                          disabled={derniereActive}
                          title={derniereActive
                            ? "Dernière clé active — le serveur refuse sa suppression (400)"
                            : `Supprimer la clé ${cle.name}`}
                          aria-label={derniereActive
                            ? "Suppression impossible : dernière clé active"
                            : `Supprimer la clé ${cle.name}`}
                          onClick={() => setConfirmation(cle)}>
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog création / édition */}
      {edition && (
        <DialogCle
          cle={edition.id ? edition : null}
          mutation={edition.id ? modifier : creer}
          onFermer={() => setEdition(null)}
        />
      )}

      {/* Confirmation suppression */}
      {confirmation && (
        <Dialog open onOpenChange={(ouvert) => !ouvert && setConfirmation(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Supprimer la clé « {confirmation.name} » ?</DialogTitle>
              <DialogDescription>
                La clé sera retirée du pipeline (suppression douce). Les offres déjà normalisées ne sont pas affectées.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmation(null)}>Annuler</Button>
              <Button variant="destructive" disabled={supprimer.isPending} onClick={() => supprimerCle(confirmation)}>
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  )
}

export default SectionCles
