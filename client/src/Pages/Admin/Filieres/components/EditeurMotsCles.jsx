import { useState } from "react"
import { FlaskConical, Info, Plus, Save, Trash2, X } from "lucide-react"
import { cn } from "cn"
import { useNotify } from "@/contexts/Notify.context"
import {
  useSimulateFiliere, messageErreurReferentiel,
} from "@/features/admin-filieres.tools"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"

/* ─────────────────────────────────────────────────────────────────────
   Éditeur de mots-clés d'une filière (doc v3 §12) — composant central
   de la page Filières.

   Garde-fous (vérifiés serveur + live) :
   - PUT keywords REMPLACE toute la liste → initialisation UNE fois
     depuis l'existant chargé (useState initializer, jamais d'effet) ;
   - poids bornés 1-100 (le serveur borne aussi, on valide avant
     envoi pour éviter les surprises) ;
   - confirmation AVANT sauvegarde si la liste rétrécit beaucoup
     (> 50 % de mots-clés en moins) — doc v3 §12 point d'attention ;
   - « Tester l'impact » = POST /simulate SANS écriture — affiche le
     résultat du live ({offers_affected_7_days, message, counts}) ;
   - avertissements permanents : effet au PROCHAIN scraping seulement,
     JAMAIS rétroactif (rappelé dans le résultat de simulation aussi).
   ───────────────────────────────────────────────────────────────────── */

const SEUIL_RETRERCISSEMENT = 0.5

const EditeurMotsCles = ({ filiere, mutation, onFermer, compact = false }) => {
  const notify = useNotify()
  const simulateMutation = useSimulateFiliere()

  // Initialisation UNE fois depuis l'existant (pattern cycle 4 : le
  // parent remonte ce composant à chaque ouverture de panneau).
  const [lignes, setLignes] = useState(() =>
    (filiere?.keywords ?? []).map((k) => ({ keyword: k.keyword, weight: k.weight }))
  )
  const [resultat, setResultat] = useState(null)
  const [confirmation, setConfirmation] = useState(false)

  const nbInitial = filiere?.keywords?.length ?? 0
  const lignesValides = lignes.filter((l) => l.keyword.trim() && Number(l.weight) >= 1)
  const aRetreci = nbInitial > 0 && lignes.length <= nbInitial * (1 - SEUIL_RETRERCISSEMENT)
  const modifie = JSON.stringify(lignes.map(({ keyword, weight }) => [keyword.trim(), Number(weight)])) !==
    JSON.stringify((filiere?.keywords ?? []).map((k) => [k.keyword, k.weight]))

  const ajouterLigne = () =>
    setLignes((prec) => [...prec, { keyword: "", weight: 50 }])

  const modifierLigne = (i, champ, valeur) =>
    setLignes((prec) => prec.map((l, j) => (j === i ? { ...l, [champ]: valeur } : l)))

  const supprimerLigne = (i) => setLignes((prec) => prec.filter((_, j) => j !== i))

  const testerImpact = () => {
    if (!lignesValides.length) {
      notify("Ajoutez au moins un mot-clé valide (poids ≥ 1) pour simuler.", "error")
      return
    }
    simulateMutation.mutate(
      {
        filiere_code: filiere.code,
        // Payload dict {keyword, weight} — vérifié live (le JSDoc dit
        // string[] à tort).
        keywords: lignesValides.map((l) => ({ keyword: l.keyword.trim(), weight: Number(l.weight) })),
      },
      {
        onSuccess: (res) => setResultat(res),
        onError: (err) => notify(messageErreurReferentiel(err), "error"),
      }
    )
  }

  const demanderSauvegarde = () => {
    if (!modifie) {
      notify("Aucune modification à enregistrer.", "info")
      return
    }
    if (!lignesValides.length) {
      notify("La liste est vide : tous les mots-clés seraient supprimés — confirmez explicitement.", "error")
      setConfirmation(true)
      return
    }
    if (aRetreci) {
      setConfirmation(true) // rétrécissement important → confirmation (doc v3 §12)
      return
    }
    sauvegarder()
  }

  const sauvegarder = () => {
    setConfirmation(false)
    mutation.mutate(
      {
        id: filiere.id,
        keywords: lignesValides.map((l) => ({ keyword: l.keyword.trim(), weight: Number(l.weight) })),
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

  if (!filiere) return null

  return (
    <section
      aria-label={`Mots-clés de ${filiere.label}`}
      className={cn(
        "flex flex-col gap-3",
        compact ? "rounded-lg bg-background/60 p-3" : "rounded-xl border border-border bg-card p-4"
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

      {/* Avertissement permanent (doc v3 §12 : pas d'opération à l'aveugle) */}
      <Alert>
        <Info aria-hidden />
        <AlertTitle>Effet au prochain scraping uniquement</AlertTitle>
        <AlertDescription>
          Ces mots-clés s'appliqueront au <strong>prochain</strong> passage de scraping —
          jamais rétroactivement aux offres déjà collectées.
        </AlertDescription>
      </Alert>

      {/* Liste dynamique keyword + poids */}
      <div className="flex flex-col gap-2">
        {lignes.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            Aucun mot-clé — la filière n'est détectée par aucun matcher automatique.
          </p>
        )}
        {lignes.map((ligne, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={ligne.keyword}
              onChange={(e) => modifierLigne(i, "keyword", e.target.value)}
              placeholder="Mot-clé (ex. supply chain)"
              aria-label={`Mot-clé ${i + 1}`}
              className="flex-1"
            />
            <div className="relative w-24">
              <Input
                type="number"
                min={1}
                max={100}
                value={ligne.weight}
                onChange={(e) => modifierLigne(i, "weight", e.target.value)}
                aria-label={`Poids du mot-clé ${i + 1} (1 à 100)`}
                className={cn("pr-7 tabular-nums", (Number(ligne.weight) < 1 || Number(ligne.weight) > 100) && "aria-invalid:border-destructive")}
              />
              <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-muted-foreground">/100</span>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => supprimerLigne(i)}
              aria-label={`Supprimer le mot-clé ${ligne.keyword || i + 1}`}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
      </div>

      {/* Résultat de simulation (live : offers_affected_7_days, message) */}
      {resultat && (
        <Alert className="border-l-2 border-l-primary" role="status">
          <FlaskConical aria-hidden />
          <AlertTitle>Simulation — {resultat.offers_affected_7_days} offre(s) des 7 derniers jours seraient affectées</AlertTitle>
          <AlertDescription>
            {resultat.message} — {resultat.current_keyword_count} mot(s)-clé(s) actuel(s) vs {resultat.proposed_keyword_count} proposé(s).
            <br />
            <strong>Rappel : simulation sans écriture</strong> — même après sauvegarde, les offres déjà
            collectées ne sont pas re-taguées (seul le prochain scraping en tiendra compte).
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={ajouterLigne}>
          <Plus aria-hidden /> Ajouter un mot-clé
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={testerImpact}
            disabled={simulateMutation.isPending || !lignesValides.length}
          >
            <FlaskConical aria-hidden /> {simulateMutation.isPending ? "Simulation…" : "Tester l'impact"}
          </Button>
          <Button size="sm" onClick={demanderSauvegarde} disabled={mutation.isPending || !modifie}>
            <Save aria-hidden /> {mutation.isPending ? "Enregistrement…" : "Enregistrer la liste"}
          </Button>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        La sauvegarde remplace l'intégralité de la liste ({lignesValides.length} mot(s)-clé(s) envoyé(s) sur {nbInitial} existant(s)).
      </p>

      {/* Confirmation si rétrécissement / vidage */}
      <Dialog open={confirmation} onOpenChange={setConfirmation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer le remplacement de la liste</DialogTitle>
            <DialogDescription>
              {nbInitial > 0
                ? `La liste passerait de ${nbInitial} à ${lignes.length} mot(s)-clé(s). La sauvegarde REMPLACE l'intégralité de la liste actuelle.`
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
