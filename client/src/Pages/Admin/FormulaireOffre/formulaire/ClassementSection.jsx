import { Controller } from "react-hook-form"
import { Label } from "@/components/ui/label"
import SelectReferentiel from "./SelectReferentiel"

/* Bloc Classement — sélecteurs de référentiel par CODE (pas UUID).
   ⚠️ Reçoit bien `referentiels` en prop (le parent passait avant les
   tableaux séparés → les selects restaient vides). */
const ClassementSection = ({ referentiels, control }) => {
  const filieres = referentiels?.filieres ?? []
  const contrats = referentiels?.contrats ?? []
  const experiences = referentiels?.experiences ?? []
  const niveaux = referentiels?.niveaux ?? []

  const champs = [
    { name: "filiere_code", label: "Filière", options: filieres, placeholder: "Choisir une filière" },
    { name: "contract_type_code", label: "Type de contrat", options: contrats, placeholder: "Choisir un contrat" },
    { name: "experience_level_code", label: "Expérience", options: experiences, placeholder: "Choisir un niveau" },
    { name: "education_level_code", label: "Niveau d'études", options: niveaux, placeholder: "Choisir un diplôme" },
  ]

  return (
    <fieldset className="rounded-xl border border-border bg-card p-4">
      <legend className="px-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">
        Classement (codes du référentiel)
      </legend>
      <p className="mb-4 text-xs text-muted-foreground">
        Sélecteurs alimentés par le référentiel public — valeurs par code, pas par UUID.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {champs.map(({ name, label, options, placeholder }) => (
          <Controller
            key={name}
            name={name}
            control={control}
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-1.5" data-champ={name}>
                <Label>{label}</Label>
                <SelectReferentiel
                  value={field.value}
                  onChange={field.onChange}
                  options={options}
                  getValue={(o) => o.code}
                  getLabel={(o) => o.label}
                  placeholder={placeholder}
                  ariaInvalid={fieldState.invalid}
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
    </fieldset>
  )
}

export default ClassementSection