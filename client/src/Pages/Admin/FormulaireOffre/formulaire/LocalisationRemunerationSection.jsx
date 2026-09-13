import { Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/* Bloc Localisation & Rémunération — séparé des référentiels métiers.
   `control` reçu en prop (pas de useFormContext). */
const LocalisationRemunerationSection = ({ control }) => (
  <fieldset className="rounded-xl border border-border bg-card p-4">
    <legend className="px-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">
      Localisation & rémunération
    </legend>
    <p className="mb-4 text-xs text-muted-foreground">
      Lieu, salaire et date de publication.
    </p>

    <div className="grid gap-4 sm:grid-cols-2">
      {/* Ville */}
      <Controller
        name="location_label"
        control={control}
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1.5" data-champ="location_label">
            <Label htmlFor={field.name}>Ville</Label>
            <Input
              {...field}
              id={field.name}
              aria-invalid={fieldState.invalid}
              aria-describedby={fieldState.invalid ? `${field.name}-erreur` : undefined}
              placeholder="Ex. Abidjan"
              autoComplete="off"
            />
            {fieldState.invalid && fieldState.error ? (
              <p id={`${field.name}-erreur`} role="alert" className="text-xs font-medium text-destructive">
                {fieldState.error.message}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Texte libre — normalisée puis créée ou réutilisée automatiquement.
              </p>
            )}
          </div>
        )}
      />

      {/* Salaire */}
      <Controller
        name="salary_raw"
        control={control}
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1.5" data-champ="salary_raw">
            <Label htmlFor={field.name}>Salaire</Label>
            <Input
              {...field}
              id={field.name}
              aria-invalid={fieldState.invalid}
              aria-describedby={fieldState.invalid ? `${field.name}-erreur` : undefined}
              placeholder="Ex. 400 000 - 600 000 FCFA"
              autoComplete="off"
            />
            {fieldState.invalid && fieldState.error ? (
              <p id={`${field.name}-erreur`} role="alert" className="text-xs font-medium text-destructive">
                {fieldState.error.message}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Texte libre tel que publié — non structuré.
              </p>
            )}
          </div>
        )}
      />

      {/* Date de publication */}
      <Controller
        name="published_at"
        control={control}
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1.5" data-champ="published_at">
            <Label htmlFor={field.name}>Date de publication</Label>
            <Input
              {...field}
              id={field.name}
              type="date"
              aria-invalid={fieldState.invalid}
              aria-describedby={fieldState.invalid ? `${field.name}-erreur` : undefined}
            />
            {fieldState.invalid && fieldState.error && (
              <p id={`${field.name}-erreur`} role="alert" className="text-xs font-medium text-destructive">
                {fieldState.error.message}
              </p>
            )}
          </div>
        )}
      />
    </div>
  </fieldset>
)

export default LocalisationRemunerationSection