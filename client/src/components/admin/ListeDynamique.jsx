import { useId } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/* ─────────────────────────────────────────────────────────────────────
   Champ de liste dynamique (missions, profil recherché, avantages,
   tags) : ajout/suppression de lignes, valeur = string[].

   Doc v3 §4 : « champs de liste dynamiques pour missions / profil /
   avantages / tags (ajout/suppression de lignes) ».
   ───────────────────────────────────────────────────────────────────── */

const ListeDynamique = ({
  label,
  valeurs,                 // string[]
  onChange,                // (nouvellesValeurs: string[]) => void
  placeholder = "Ajouter une entrée…",
  ajouterLibelle = "Ajouter",
  videMessage = "Aucune entrée — ajoutez-en une.",
}) => {
  const idChamp = useId()

  const ajouter = () => onChange([...valeurs, ""])
  const supprimer = (i) => onChange(valeurs.filter((_, index) => index !== i))
  const modifier = (i, v) => onChange(valeurs.map((val, index) => (index === i ? v : val)))

  // Empêche d'empiler des lignes vides : le bouton "Ajouter" est
  // désactivé seulement si la DERNIÈRE ligne existe et est encore vide.
  const derniereLigneVide = valeurs.length > 0 && valeurs[valeurs.length - 1] === ""

  return (
    <div className="flex flex-col gap-1.5">
      <Label id={idChamp} className="text-xs font-medium">{label}</Label>
      <div className="flex flex-col gap-1.5" aria-labelledby={idChamp}>
        {valeurs.length === 0 && (
          <p className="text-xs text-muted-foreground">{videMessage}</p>
        )}
        {valeurs.map((valeur, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              value={valeur}
              onChange={(e) => modifier(i, e.target.value)}
              placeholder={placeholder}
              aria-label={`${label} ${i + 1}`}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => supprimer(i)}
              aria-label={`Supprimer ${label} ${i + 1}`}
            >
              <X aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={ajouter}
          className="w-fit"
          disabled={derniereLigneVide}
        >
          <Plus aria-hidden /> {ajouterLibelle}
        </Button>
      </div>
    </div>
  )
}

export default ListeDynamique
