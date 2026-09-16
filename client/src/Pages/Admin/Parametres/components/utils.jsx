import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useNotify } from "@/contexts/Notify.context"
import {
  CLES_NUMERIQUES, messageErreurParametres, normaliserValeur, typeCle, useSauvegarderParametre,
} from "@/features/admin-parametres.tools"
import { Skeleton } from "@/components/ui/skeleton"


/* ─── Logique de sauvegarde unitaire partagée ligne / carte ──────── */
// eslint-disable-next-line react-refresh/only-export-components
export const useSauvegardeLigne = ({ parametre, valeurBrouillon, erreur, setBrouillon }) => {
  const notify = useNotify()
  const sauvegarder = useSauvegarderParametre()
  const valeurServeur = parametre.value
  const modifie = valeurBrouillon !== undefined && valeurBrouillon !== valeurServeur
  const enCours = sauvegarder.isPending && sauvegarder.variables?.cle === parametre.key

  const confirmer = () => {
    if (erreur) return
    sauvegarder.mutate(
      { cle: parametre.key, valeur: normaliserValeur(parametre.key, valeurBrouillon) },
      {
        onSuccess: () => {
          setBrouillon(parametre.key, undefined) // quitte le mode édition
          notify(`« ${parametre.key} » enregistré`, "success")
        },
        onError: (err) => notify(messageErreurParametres(err) || "Enregistrement impossible", "error"),
      }
    )
  }

  return { modifie, enCours, confirmer }
}

/* ─── Éditeur de valeur par type — partagé ligne desktop / carte
      mobile. `etendu` : pleine largeur (carte mobile). ─── */
export const EditeurValeur = ({ parametre, valeur, enCours, erreur, onChange, etendu = false }) => {
  const type = typeCle(parametre.key)
  const valeurAffichee = valeur ?? parametre.value

  if (type === "booleen") {
    const actif = String(valeurAffichee).toLowerCase() === "true"
    return (
      <div className="flex items-center gap-2">
        <Switch
          checked={actif}
          disabled={enCours}
          onCheckedChange={(coche) => onChange(coche ? "true" : "false")}
          aria-label={`Paramètre ${parametre.key}`}
        />
        <Badge variant={actif ? "outline" : "secondary"}>
          {actif ? "Activé" : "Désactivé"}
        </Badge>
      </div>
    )
  }

  return (
    <>
      {type === "nombre" ? (
        <Input
          type="number"
          className={cn("h-8 text-xs", etendu ? "w-full" : "w-24")}
          min={CLES_NUMERIQUES[parametre.key]?.min}
          max={CLES_NUMERIQUES[parametre.key]?.max}
          value={valeurAffichee}
          disabled={enCours}
          aria-label={`Valeur de ${parametre.key}`}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          type="text"
          className={cn("h-8 text-xs", etendu ? "w-full" : "max-w-64")}
          value={valeurAffichee}
          disabled={enCours}
          aria-label={`Valeur de ${parametre.key}`}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {erreur && <p className="mt-1 text-[10px] text-destructive" role="alert">{erreur}</p>}
    </>
  )
}

export const BlocSkel = ({ className, delay = 0 }) => (
  <Skeleton className={className} style={delay ? { animationDelay: `${delay}ms` } : undefined} />
)