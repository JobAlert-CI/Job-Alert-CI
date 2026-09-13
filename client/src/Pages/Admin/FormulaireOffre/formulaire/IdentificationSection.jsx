import { Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

/* Bloc Identification — champs requis du contrat serveur.
   `control` reçu en prop (pas de useFormContext → aucun risque de
   contexte null). */
const IdentificationSection = ({ sources, control }) => (
  <fieldset className="rounded-xl border border-border bg-card p-4">
    <legend className="px-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">
      Identification
    </legend>
    <p className="mb-4 text-xs text-muted-foreground">
      Les informations principales de l'offre.
    </p>

    <div className="flex flex-col gap-4">
      {/* Titre — pleine largeur */}
      <Controller
        name="title"
        control={control}
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1.5" data-champ="title">
            <Label htmlFor={field.name}>Titre *</Label>
            <Input
              {...field}
              id={field.name}
              aria-invalid={fieldState.invalid}
              aria-describedby={fieldState.invalid ? `${field.name}-erreur` : undefined}
              placeholder="Ex. Développeur Full Stack React/Node"
              autoComplete="off"
            />
            {fieldState.invalid && fieldState.error && (
              <p id={`${field.name}-erreur`} role="alert" className="text-xs font-medium text-destructive">
                {fieldState.error.message}
              </p>
            )}
          </div>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Entreprise */}
        <Controller
          name="company_name"
          control={control}
          render={({ field, fieldState }) => (
            <div className="flex flex-col gap-1.5" data-champ="company_name">
              <Label htmlFor={field.name}>Entreprise *</Label>
              <Input
                {...field}
                id={field.name}
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.invalid ? `${field.name}-erreur` : undefined}
                placeholder="Ex. Abidjan Digital Labs"
                autoComplete="off"
              />
              {fieldState.invalid && fieldState.error ? (
                <p id={`${field.name}-erreur`} role="alert" className="text-xs font-medium text-destructive">
                  {fieldState.error.message}
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Texte libre — l'entreprise est créée ou réutilisée automatiquement.
                </p>
              )}
            </div>
          )}
        />

        {/* Source (requis, pas de bouton clear) */}
        <Controller
          name="source_code"
          control={control}
          render={({ field, fieldState }) => (
            <div className="flex flex-col gap-1.5" data-champ="source_code">
              <Label htmlFor={field.name}>Source *</Label>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Choisir une source" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((s) => (
                    <SelectItem key={s.code} value={s.code}>{s.label ?? s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid && fieldState.error && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {fieldState.error.message}
                </p>
              )}
            </div>
          )}
        />
      </div>

      {/* URL de l'offre */}
      <Controller
        name="source_url"
        control={control}
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1.5" data-champ="source_url">
            <Label htmlFor={field.name}>URL de l'offre *</Label>
            <Input
              {...field}
              id={field.name}
              type="url"
              aria-invalid={fieldState.invalid}
              aria-describedby={fieldState.invalid ? `${field.name}-erreur` : undefined}
              placeholder="https://…"
              autoComplete="off"
            />
            {fieldState.invalid && fieldState.error && (
              <p id={`${field.name}-erreur`} role="alert" className="text-xs font-medium text-destructive">
                {fieldState.error.message}
              </p>
            )}
          </div>
        )}
      />

      {/* Référence source (optionnel) */}
      <Controller
        name="source_reference"
        control={control}
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1.5" data-champ="source_reference">
            <Label htmlFor={field.name}>Référence source (optionnel)</Label>
            <Input
              {...field}
              id={field.name}
              aria-invalid={fieldState.invalid}
              aria-describedby={fieldState.invalid ? `${field.name}-erreur` : undefined}
              placeholder="Ex. offre-154816"
              autoComplete="off"
            />
            {fieldState.invalid && fieldState.error ? (
              <p id={`${field.name}-erreur`} role="alert" className="text-xs font-medium text-destructive">
                {fieldState.error.message}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Utilisée par le dédoublonnage : deux offres avec la même référence sont considérées identiques.
              </p>
            )}
          </div>
        )}
      />
    </div>
  </fieldset>
)

export default IdentificationSection