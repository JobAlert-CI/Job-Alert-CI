import { useState } from "react"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { AnimatePresence, motion } from "framer-motion"
import { FlaskConical, Info, Plus, Save, Trash2, X } from "lucide-react"
import { cn } from "cn"
import { useNotify } from "@/contexts/Notify.context"
import { useSimulateFiliere, messageErreurReferentiel } from "@/features/admin-filieres.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

/* ─────────────────────────────────────────────────────────────────────
  Éditeur de mots-clés d'une filière (doc v3 §12).
───────────────────────────────────────────────────────────────────── */

const SEUIL_RETRERCISSEMENT = 0.5

const schemaLignes = z.object({
  lignes: z.array(
    z.object({
      keyword: z.string().trim().min(1, "Mot-clé requis"),
      weight: z.number().min(1, "Poids ≥ 1").max(100, "Max 100"),
    })
  ),
})

const EditeurMotsCles = ({ filiere, mutation, onFermer, compact = false }) => {
  const notify = useNotify()
  const simulateMutation = useSimulateFiliere()
  const [resultat, setResultat] = useState(null)
  const [confirmation, setConfirmation] = useState(false)

  const nbInitial = filiere?.keywords?.length ?? 0

  const { control, getValues, trigger } = useForm({
    resolver: zodResolver(schemaLignes),
    defaultValues: {
      lignes: (filiere?.keywords ?? []).map((k) => ({ keyword: k.keyword, weight: k.weight })),
    },
    mode: "onBlur",
  })
  const { fields, append, remove } = useFieldArray({ control, name: "lignes" })

  /* Lecture ponctuelle (pas de `watch` → zéro re-rendu global à la frappe). */
  const lignesValides = () =>
    (getValues().lignes ?? []).filter(
      (l) => l?.keyword?.trim() && Number(l.weight) >= 1 && Number(l.weight) <= 100
    )

  const testerImpact = async () => {
    await trigger() // révèle les erreurs sur toutes les lignes
    const valides = lignesValides()
    if (!valides.length) {
      notify("Ajoutez au moins un mot-clé valide (poids ≥ 1) pour simuler.", "error")
      return
    }
    simulateMutation.mutate(
      {
        filiere_code: filiere.code,
        keywords: valides.map((l) => ({ keyword: l.keyword.trim(), weight: Number(l.weight) })),
      },
      {
        onSuccess: (res) => setResultat(res),
        onError: (err) => notify(messageErreurReferentiel(err), "error"),
      }
    )
  }

  const sauvegarder = () => {
    setConfirmation(false)
    const valides = lignesValides()
    // Aucune modification ? (comparaison à la volée, pas de watch)
    const identique =
      valides.length === nbInitial &&
      valides.every((l, i) => l.keyword.trim() === filiere.keywords[i].keyword && Number(l.weight) === filiere.keywords[i].weight)
    if (identique) {
      notify("Aucune modification à enregistrer.", "info")
      return
    }
    mutation.mutate(
      {
        id: filiere.id,
        keywords: valides.map((l) => ({ keyword: l.keyword.trim(), weight: Number(l.weight) })),
      },
      {
        onSuccess: (res) => {
          notify(res?.message || "Mots-clés mis à jour — effet au prochain scraping", "success")
          onFermer()
        },
        onError: (err) => notify(messageErreurReferentiel(err), "error"),
      }
    )
  }

  /* Garde-fous (doc v3 §12) : vidage ou rétrécissement > 50 % → confirmation. */
  const demanderSauvegarde = async () => {
    await trigger()
    const nbValides = lignesValides().length
    if (nbValides === 0 || (nbInitial > 0 && nbValides <= nbInitial * SEUIL_RETRERCISSEMENT)) {
      setConfirmation(true)
      return
    }
    sauvegarder()
  }

  if (!filiere) return null

  return (
    <section
      aria-label={`Mots-clés de ${filiere.label}`}
      className={cn(
        "flex flex-col gap-3",
        compact
          ? "rounded-xl border border-border bg-card p-3 shadow-soft" /* détaché du fond muted/30 de la ligne d'expansion */
          : "rounded-xl border border-border bg-card p-4"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold">
          Mots-clés — <span className="text-primary">{filiere.label}</span>
          <Badge variant="outline" className="font-mono">{filiere.code}</Badge>
        </h2>
        <Button variant="ghost" size="sm" onClick={onFermer}>
          <X aria-hidden /> Fermer
        </Button>
      </div>

      {/* Avertissement permanent (doc v3 §12) */}
      <Alert>
        <Info aria-hidden />
        <AlertTitle>Effet au prochain scraping uniquement</AlertTitle>
        <AlertDescription>
          Ces mots-clés s'appliqueront au <strong>prochain</strong> passage de scraping —
          jamais rétroactivement aux offres déjà collectées.
        </AlertDescription>
      </Alert>

      {/* ─── Liste dynamique keyword + poids ─── */}
      <div className="flex flex-col gap-2">
        {fields.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            Aucun mot-clé — la filière n'est détectée par aucun matcher automatique.
          </p>
        )}
        <AnimatePresence initial={false}>
          {fields.map((ligne, index) => (
            <motion.div
              key={ligne.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="flex items-start gap-2"
            >
              {/* Mot-clé */}
              <Controller
                name={`lignes.${index}.keyword`}
                control={control}
                render={({ field, fieldState }) => (
                  <div className="flex-1">
                    <Input
                      {...field}
                      placeholder="Mot-clé (ex. supply chain)"
                      aria-label={`Mot-clé ${index + 1}`}
                      aria-invalid={fieldState.invalid}
                      className={cn(fieldState.invalid && "border-destructive focus-visible:ring-destructive/30")}
                    />
                    {fieldState.invalid && (
                      <p className="mt-0.5 text-[10px] text-destructive" role="alert">
                        {fieldState.error?.message}
                      </p>
                    )}
                  </div>
                )}
              />

              {/* Poids : Slider + input numérique synchronisés */}
              <Controller
                name={`lignes.${index}.weight`}
                control={control}
                render={({ field, fieldState }) => (
                  <div className="flex w-60 items-center gap-2 pt-1.5">
                    <Slider
                      value={field.value}
                      onValueChange={(v) => field.onChange(typeof v === "number" ? v : v[0])}
                      min={1}
                      max={100}
                      step={1}
                      aria-label={`Poids du mot-clé ${index + 1} (1 à 100)`}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                      aria-label={`Poids numérique du mot-clé ${index + 1}`}
                      aria-invalid={fieldState.invalid}
                      className={cn("w-16 tabular-nums", fieldState.invalid && "border-destructive")}
                    />
                  </div>
                )}
              />

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(index)}
                aria-label={`Supprimer le mot-clé ${index + 1}`}
              >
                <Trash2 aria-hidden />
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Résultat de simulation (live, sans écriture) */}
      {resultat && (
        <Alert className="border-l-2 border-l-primary" role="status">
          <FlaskConical aria-hidden />
          <AlertTitle>
            Simulation — {resultat.offers_affected_7_days} offre(s) des 7 derniers jours seraient affectées
          </AlertTitle>
          <AlertDescription>
            {resultat.message} — {resultat.current_keyword_count} mot(s)-clé(s) actuel(s) vs{" "}
            {resultat.proposed_keyword_count} proposé(s).
            <br />
            <strong>Rappel : simulation sans écriture</strong> — même après sauvegarde, les offres déjà
            collectées ne sont pas re-taguées (seul le prochain scraping en tiendra compte).
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => append({ keyword: "", weight: 50 })}>
          <Plus aria-hidden /> Ajouter un mot-clé
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={testerImpact}
            disabled={simulateMutation.isPending}
          >
            <FlaskConical aria-hidden /> {simulateMutation.isPending ? "Simulation…" : "Tester l'impact"}
          </Button>
          <Button size="sm" onClick={demanderSauvegarde} disabled={mutation.isPending}>
            <Save aria-hidden /> {mutation.isPending ? "Enregistrement…" : "Enregistrer la liste"}
          </Button>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        La sauvegarde remplace l'intégralité de la liste ({fields.length} ligne{fields.length > 1 ? "s" : ""} saisie{fields.length > 1 ? "s" : ""} sur {nbInitial} existant{nbInitial > 1 ? "s" : ""}).
      </p>

      {/* Confirmation vidage / rétrécissement */}
      <Dialog open={confirmation} onOpenChange={setConfirmation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer le remplacement de la liste</DialogTitle>
            <DialogDescription>
              {nbInitial > 0
                ? `La liste passerait de ${nbInitial} à ${lignesValides().length} mot(s)-clé(s) valide(s). La sauvegarde REMPLACE l'intégralité de la liste actuelle.`
                : "Vous êtes sur le point de vider tous les mots-clés de cette filière."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmation(false)}>Annuler</Button>
            <Button onClick={sauvegarder} disabled={mutation.isPending}>
              {mutation.isPending ? "Enregistrement…" : "Confirmer et enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export default EditeurMotsCles