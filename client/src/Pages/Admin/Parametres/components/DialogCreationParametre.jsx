import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useNotify } from "@/contexts/Notify.context"
import {
  messageErreurParametres, useParametresQuery, useSauvegarderParametre, validerValeur,
} from "@/features/admin-parametres.tools"

/* ─────────────────────────────────────────────────────────────────────
   Dialog de création d'une nouvelle clé (cycle 18, doc v3 §18).

   PUT /{key} est un UPSERT transparent : le front ne distingue jamais
   « créer » et « modifier ». On PREVIENT toutefois si la clé existe
   déjà (l'admin pense créer, il va en fait écraser une valeur) —
   honnêteté sans bloquer (l'upsert reste légitime).

   Validation locale miroir serveur : clé ≤ 100 car., description
   ≤ 500, valeur ≤ 10 000 (422 sinon — formatApiError gère l'affichage).
   ───────────────────────────────────────────────────────────────────── */

const DialogCreationParametre = ({ ouverte, onFermer }) => {
  const notify = useNotify()
  const { data: parametres } = useParametresQuery()
  const sauvegarder = useSauvegarderParametre()

  const [cle, setCle] = useState("")
  const [valeur, setValeur] = useState("")
  const [description, setDescription] = useState("")

  // La clé existe déjà ? (upsert = écrasement, on prévient).
  const existeDeja = (parametres ?? []).some((p) => p.key === cle.trim())
  const cleValide = cle.trim().length >= 1 && cle.trim().length <= 100
  const erreurValeur = cle.trim() ? validerValeur(cle.trim(), valeur) : null

  const peutSoumettre = cleValide && !erreurValeur && valeur.length > 0 && !sauvegarder.isPending

  const soumettre = () => {
    sauvegarder.mutate(
      { cle: cle.trim(), valeur, description: description.trim() || undefined },
      {
        onSuccess: () => {
          notify(`Paramètre « ${cle.trim()} » créé`, "success")
          onFermer()
        },
        onError: (err) => notify(messageErreurParametres(err) || "Création impossible", "error"),
      }
    )
  }

  return (
    <Dialog open={ouverte} onOpenChange={(ouvert) => { if (!ouvert) onFermer() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle clé de paramètre</DialogTitle>
          <DialogDescription>
            La clé est créée par upsert (PUT) — si elle existe déjà, sa valeur sera remplacée.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nouvelle-cle" className="text-xs font-medium">Clé</label>
            <Input
              id="nouvelle-cle"
              value={cle}
              onChange={(e) => setCle(e.target.value)}
              placeholder="ex. site_maintenance_message"
              className="h-9 font-mono text-xs"
              aria-invalid={!cleValide}
              maxLength={100}
            />
            {cle.trim() && !cleValide && (
              <p className="text-[10px] text-destructive">Entre 1 et 100 caractères.</p>
            )}
            {existeDeja && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                Cette clé existe déjà — sa valeur sera écrasée.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nouvelle-valeur" className="text-xs font-medium">Valeur</label>
            <Input
              id="nouvelle-valeur"
              value={valeur}
              onChange={(e) => setValeur(e.target.value)}
              placeholder="Valeur textuelle (le type est déduit de la clé si connue)"
              className="h-9 text-xs"
              maxLength={10000}
            />
            {erreurValeur && <p className="text-[10px] text-destructive">{erreurValeur}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nouvelle-description" className="text-xs font-medium">Description (optionnelle)</label>
            <Input
              id="nouvelle-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="À quoi sert ce paramètre ?"
              className="h-9 text-xs"
              maxLength={500}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Les clés inconnues du runtime restent stockées mais non consommées par les
            services — seules les clés documentées pilotent le site.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onFermer}>Annuler</Button>
          <Button size="sm" onClick={soumettre} disabled={!peutSoumettre}>
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DialogCreationParametre
