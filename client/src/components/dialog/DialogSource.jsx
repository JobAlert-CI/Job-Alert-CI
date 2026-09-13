import { useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { cn } from "cn"
import { useNotify } from "@/contexts/Notify.context"
import { messageErreurSource } from "@/features/admin-sources.tools"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { teinteProtection } from "../../Pages/Admin/Sources/components/protection"

/* ─────────────────────────────────────────────────────────────────────
   Modale création/édition d'une source (doc v3 §13).
   Refonte :
   • Montée EN PERMANENCE et pilotée par la prop `open` (animations
     d'entrée/sortie Radix préservées) ; formulaire resynchronisé par
     useEffect à chaque ouverture.
   • react-hook-form + zodResolver → champs non contrôlés, saisie fluide.
   • PASTILLE D'ERREUR sur chaque onglet : si une erreur zod se trouve
     dans un onglet inactif, un point rouge l'indique au lieu d'un
     blocage silencieux de la soumission.
   • Champ couleur : pastille de prévisualisation (damier si vide) +
     <input type="color"> natif superposé + saisie hex.
   • Anti-scraping : valeur colorée vert → orange → rouge selon la
     sévérité (protection.js) + libellé explicite.
   • Bouton de soumission : Loader2 animé pendant l'enregistrement.
   • 3 onglets en forceMount : champs toujours enregistrés, erreurs
     visibles après un changement d'onglet.
   ───────────────────────────────────────────────────────────────────── */

const sourceSchema = z.object({
  code: z.string().min(1, "Le code est requis").max(80, "80 caractères max"),
  name: z.string().min(1, "Le nom est requis").max(255, "255 caractères max"),
  slug: z.string().max(255).optional().or(z.literal("")),
  base_url: z.string().min(1, "L'URL de base est requise").url("URL invalide"),
  jobs_url: z.string().url("URL invalide").or(z.literal("")).optional(),
  color_hex: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Hex invalide (ex. #F5A623)")
    .or(z.literal(""))
    .optional(),
  short_code: z.string().max(10).optional().or(z.literal("")),
  priority: z.coerce.number().int().min(0, "≥ 0").max(1000, "≤ 1000"),
  anti_scraping_level: z.coerce.number().int().min(0, "≥ 0").max(5, "≤ 5"),
  supports_scraping: z.boolean(),
  is_primary: z.boolean(),
  description: z.string().max(1000).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
})

/* Répartition des champs par onglet — détecte les erreurs « cachées »
   dans un onglet inactif pour allumer la pastille correspondante. */
const CHAMPS_PAR_ONGLET = {
  general: ["name", "code", "slug", "base_url", "jobs_url"],
  scraping: ["priority", "anti_scraping_level", "supports_scraping", "is_primary"],
  meta: ["color_hex", "short_code", "description", "notes"],
}

const REGEX_HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/* L'input type="color" natif n'accepte que le format #RRGGBB : les
   formes courtes (#RGB) sont expandées, le reste replie sur le navy. */
const normaliserHex = (valeur) => {
  const v = (valeur ?? "").trim()
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v
  if (/^#[0-9a-fA-F]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  return "#0F2D4D"
}

/* Champ texte avec label + erreur temps réel. */
const Champ = ({ id, label, error, required, children, className }) => (
  <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
    <Label htmlFor={id}>
      {label} {required && <span className="text-destructive">*</span>}
    </Label>
    {children}
    {error && <p className="text-xs font-medium text-destructive">{error.message}</p>}
  </div>
)

/* Carte d'option booléenne (réglage important, pas un simple champ). */
const CarteOption = ({ checked, onChange, titre, description }) => (
  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-accent">
    <Checkbox checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    <span className="flex flex-col gap-0.5">
      <span className="text-sm font-medium">{titre}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </span>
  </label>
)

/* Déclencheur d'onglet avec pastille d'erreur dynamique. */
const DeclencheurOnglet = ({ valeur, libelle, enErreur }) => (
  <TabsTrigger value={valeur} className="relative">
    {libelle}
    {enErreur && (
      <>
        <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-destructive" aria-hidden="true" />
        <span className="sr-only"> (contient des erreurs)</span>
      </>
    )}
  </TabsTrigger>
)

const DialogSource = ({ open, source, mutation, onFermer }) => {
  const notify = useNotify()
  const edit = !!source
  const {
    register, handleSubmit, control, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(sourceSchema),
    defaultValues: {
      code: "", name: "", slug: "", base_url: "", jobs_url: "", color_hex: "",
      short_code: "", priority: 100, anti_scraping_level: 0,
      supports_scraping: true, is_primary: false, description: "", notes: "",
    },
    mode: "onChange",
  })

  /* Le dialog reste monté : formulaire resynchronisé (et erreurs
     purgées) à chaque ouverture. */
  useEffect(() => {
    if (!open) return
    reset({
      code: source?.code ?? "",
      name: source?.name ?? "",
      slug: source?.slug ?? "",
      base_url: source?.base_url ?? "",
      jobs_url: source?.jobs_url ?? "",
      color_hex: source?.color_hex ?? "",
      short_code: source?.short_code ?? "",
      priority: source?.priority ?? 100,
      anti_scraping_level: source?.anti_scraping_level ?? 0,
      supports_scraping: source?.supports_scraping ?? true,
      is_primary: source?.is_primary ?? false,
      description: source?.description ?? "",
      notes: source?.notes ?? "",
    })
  }, [open, source, reset])

  // eslint-disable-next-line react-hooks/incompatible-library
  const couleur = watch("color_hex")
  const couleurValide = REGEX_HEX.test((couleur ?? "").trim())
  const teinte = teinteProtection(Number(watch("anti_scraping_level")) || 0)
  const ongletEnErreur = (onglet) => CHAMPS_PAR_ONGLET[onglet]?.some((champ) => errors[champ])

  const soumettre = handleSubmit(async (data) => {
    try {
      if (edit) await mutation.mutateAsync({ id: source.id, data })
      else await mutation.mutateAsync(data)
      notify(edit ? "Source mise à jour" : "Source créée", "success")
      onFermer()
    } catch (err) {
      notify(messageErreurSource(err) || "Enregistrement impossible", "error")
    }
  })

  const enCours = isSubmitting || mutation.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onFermer()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{edit ? `Modifier « ${source.name} »` : "Nouvelle source"}</DialogTitle>
          <DialogDescription>
            {edit
              ? "Le code identifie la source dans la planification — il n'est pas modifiable."
              : "Ajoutez un site à scraper. Le code doit être unique."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={soumettre} className="flex flex-col gap-4">
          <Tabs defaultValue="general">
            <TabsList className="grid w-full grid-cols-3">
              <DeclencheurOnglet valeur="general" libelle="Général" enErreur={ongletEnErreur("general")} />
              <DeclencheurOnglet valeur="scraping" libelle="Scraping" enErreur={ongletEnErreur("scraping")} />
              <DeclencheurOnglet valeur="meta" libelle="Notes & Meta" enErreur={ongletEnErreur("meta")} />
            </TabsList>
            {/* ── Onglet Général : Nom, Codes, URLs ── */}
            <TabsContent value="general" forceMount className="mt-4 data-[state=inactive]:hidden">
              <div className="grid gap-4 sm:grid-cols-2">
                <Champ id="src-name" label="Nom" required error={errors.name} className="sm:col-span-2">
                  <Input id="src-name" {...register("name")} placeholder="Ex. GoAfrica" />
                </Champ>
                <Champ id="src-code" label="Code" required error={errors.code}>
                  <Input id="src-code" {...register("code")} disabled={edit} placeholder="goafrica" className="font-mono" />
                </Champ>
                <Champ id="src-slug" label="Slug" error={errors.slug}>
                  <Input id="src-slug" {...register("slug")} placeholder="goafrica" className="font-mono" />
                </Champ>
                <Champ id="src-base-url" label="URL de base" required error={errors.base_url} className="sm:col-span-2">
                  <Input id="src-base-url" type="url" {...register("base_url")} placeholder="https://goafricajobs.com" />
                </Champ>
                <Champ id="src-jobs-url" label="URL des offres (optionnel)" error={errors.jobs_url} className="sm:col-span-2">
                  <Input id="src-jobs-url" type="url" {...register("jobs_url")} placeholder="https://goafricajobs.com/offres" />
                </Champ>
              </div>
            </TabsContent>
            {/* ── Onglet Scraping : Priorité, Anti-scraping, Booléens ── */}
            <TabsContent value="scraping" forceMount className="mt-4 data-[state=inactive]:hidden">
              <div className="flex flex-col gap-4">
                <Champ id="src-priority" label="Priorité (ordre de scraping)" error={errors.priority}>
                  <Input id="src-priority" type="number" min={0} max={1000} {...register("priority")} />
                </Champ>
                {/* Niveau anti-scraping : Slider + valeur colorée selon la sévérité. */}
                <div className="flex flex-col gap-1.5">
                  <Label>Niveau anti-scraping</Label>
                  <Controller
                    name="anti_scraping_level"
                    control={control}
                    render={({ field }) => (
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[field.value]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          min={0}
                          max={5}
                          step={1}
                          aria-label="Niveau anti-scraping (0 à 5)"
                          className="flex-1"
                        />
                        <span className={cn("flex w-20 items-center justify-end gap-1.5 text-sm font-semibold tabular-nums", teinte.texte)}>
                          <span className={cn("size-2 shrink-0 rounded-full", teinte.fond)} aria-hidden="true" />
                          {field.value}/5
                        </span>
                      </div>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    0 = aucune protection, 5 = protection maximale — niveau actuel :{" "}
                    <span className={cn("font-semibold", teinte.texte)}>{teinte.libelle.toLowerCase()}</span>.
                  </p>
                  {errors.anti_scraping_level && (
                    <p className="text-xs font-medium text-destructive">{errors.anti_scraping_level.message}</p>
                  )}
                </div>
                <Controller
                  name="supports_scraping"
                  control={control}
                  render={({ field }) => (
                    <CarteOption
                      checked={field.value}
                      onChange={field.onChange}
                      titre="Source scrapable"
                      description="La collecte automatique est supportée pour cette source."
                    />
                  )}
                />
                <Controller
                  name="is_primary"
                  control={control}
                  render={({ field }) => (
                    <CarteOption
                      checked={field.value}
                      onChange={field.onChange}
                      titre="Source principale"
                      description="Source de référence pour les offres collectées."
                    />
                  )}
                />
              </div>
            </TabsContent>
            {/* ── Onglet Notes & Meta : Couleur, Description, Notes ── */}
            <TabsContent value="meta" forceMount className="mt-4 data-[state=inactive]:hidden">
              <div className="grid gap-4 sm:grid-cols-2">
                <Champ id="src-color" label="Couleur (hex)" error={errors.color_hex}>
                  <div className="flex items-center gap-2">
                    {/* Pastille : damier si vide/invalide, couleur sinon ; le
                        sélecteur natif (invisible) est superposé à la pastille. */}
                    <span
                      className="relative size-9 shrink-0 overflow-hidden rounded-md border border-border"
                      style={{
                        backgroundImage: "repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%)",
                        backgroundSize: "10px 10px",
                      }}
                    >
                      <span
                        className="absolute inset-0"
                        style={{ backgroundColor: couleurValide ? normaliserHex(couleur) : "transparent" }}
                        aria-hidden="true"
                      />
                      <input
                        type="color"
                        value={normaliserHex(couleur)}
                        onChange={(e) => setValue("color_hex", e.target.value.toUpperCase(), { shouldValidate: true, shouldDirty: true })}
                        aria-label="Choisir la couleur visuellement"
                        className="absolute inset-0 size-full cursor-pointer opacity-0"
                      />
                    </span>
                    <Input id="src-color" {...register("color_hex")} placeholder="#F5A623" className="font-mono" />
                  </div>
                </Champ>
                <Champ id="src-short-code" label="Code court" error={errors.short_code}>
                  <Input id="src-short-code" {...register("short_code")} placeholder="GA" className="font-mono" />
                </Champ>
                <Champ id="src-description" label="Description" error={errors.description} className="sm:col-span-2">
                  <Textarea id="src-description" {...register("description")} rows={3} placeholder="Description de la source…" />
                </Champ>
                <Champ id="src-notes" label="Notes internes" error={errors.notes} className="sm:col-span-2">
                  <Textarea id="src-notes" {...register("notes")} rows={3} placeholder="Notes internes…" />
                </Champ>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onFermer}>Annuler</Button>
            <Button type="submit" disabled={enCours}>
              {enCours ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Enregistrement…
                </>
              ) : edit ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default DialogSource