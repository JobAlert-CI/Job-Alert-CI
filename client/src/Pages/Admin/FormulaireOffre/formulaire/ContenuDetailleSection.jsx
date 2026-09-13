import { Controller } from "react-hook-form"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import ListeDynamique from "@/components/admin/ListeDynamique"

/* Bloc Contenu détaillé — intro + listes dynamiques.
   ListeDynamique gère sa propre UI (label inclus) ; on l'enveloppe dans
   un conteneur pour la cohérence et la gestion d'erreurs.
   `control` reçu en prop (pas de useFormContext). */
const ContenuDetailleSection = ({ control }) => {
  const listes = [
    { name: "missions", label: "Missions", placeholder: "Ex. Développer le front office…" },
    { name: "profile_requirements", label: "Profil recherché", placeholder: "Ex. 3 ans d'expérience React…" },
    { name: "benefits", label: "Avantages", placeholder: "Ex. Mutuelle prise en charge…" },
    { name: "tags", label: "Tags", placeholder: "Ex. remote" },
  ]

  return (
    <fieldset className="rounded-xl border border-border bg-card p-4">
      <legend className="px-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">
        Contenu détaillé
      </legend>
      <p className="mb-4 text-xs text-muted-foreground">
        Description, missions, profil et avantages.
      </p>

      <div className="flex flex-col gap-4">
        {/* Intro */}
        <Controller
          name="intro"
          control={control}
          render={({ field, fieldState }) => (
            <div className="flex flex-col gap-1.5" data-champ="intro">
              <Label htmlFor={field.name}>Intro</Label>
              <Textarea
                {...field}
                id={field.name}
                rows={3}
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.invalid ? `${field.name}-erreur` : undefined}
                placeholder="Présentation courte de l'offre…"
                className="resize-none"
              />
              {fieldState.invalid && fieldState.error && (
                <p id={`${field.name}-erreur`} role="alert" className="text-xs font-medium text-destructive">
                  {fieldState.error.message}
                </p>
              )}
            </div>
          )}
        />

        {/* Listes dynamiques */}
        <div className="grid gap-4 lg:grid-cols-2">
          {listes.map(({ name, label, placeholder }) => (
            <Controller
              key={name}
              name={name}
              control={control}
              render={({ field, fieldState }) => (
                <div className="flex flex-col gap-1.5">
                  <ListeDynamique
                    label={label}
                    valeurs={field.value}
                    onChange={field.onChange}
                    placeholder={placeholder}
                  />
                  {fieldState.invalid && fieldState.error && (
                    <p role="alert" className="text-xs font-medium text-destructive">
                      {fieldState.error.message}
                    </p>
                  )}
                </div>
              )}
            />
          ))}
        </div>
      </div>
    </fieldset>
  )
}

export default ContenuDetailleSection