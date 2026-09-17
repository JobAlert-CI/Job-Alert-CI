This file is a merged representation of a subset of the codebase, containing specifically included files, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of a subset of the repository's contents that is considered the most important context.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Only files matching these patterns are included: src/Pages/Admin/Contenu/**/*
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
src/
  Pages/
    Admin/
      Contenu/
        components/
          EditeurArticle.jsx
          EtatsSection.jsx
        sections/
          OngletArticles.jsx
          OngletCategories.jsx
          OngletConseils.jsx
          OngletPages.jsx
          OngletSeries.jsx
        index.jsx
```

# Files

## File: src/Pages/Admin/Contenu/components/EditeurArticle.jsx
```javascript
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  ChevronDown, ChevronUp, ExternalLink, FileText, Hash, Info, ListOrdered,
  Plus, Quote, Save, Trash2, X,
} from "lucide-react"
import { cn } from "cn"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminArticleQuery, useAdminCategoriesQuery, useCreateArticle,
  useUpdateArticle, useCreateSection, useUpdateSection, useDeleteSection,
  useCreateBlock, useUpdateBlock, useDeleteBlock, useReorderSections,
  useCreateTakeaway, useDeleteTakeaway, useCreateKeyFigure, useDeleteKeyFigure,
  messageErreurContenu,
} from "@/features/admin-contenu.tools"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SectionErreur, SectionVide } from "./EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Éditeur d'article complet (doc v3 §14.1) — Sheet plein écran.
   Refonte :
   • VALIDATION zod + react-hook-form sur tous les formulaires :
     création (titre + slug), métadonnées (12 champs), blocs, titres de
     section, points clés et chiffres clés. Les erreurs s'affichent par
     champ et bloquent la soumission.
   • react-router : bouton « Voir sur le site » (articles publiés) vers
     /actualites/:slug.
   • Composants shadcn : Tabs (3 panneaux en forceMount), Card (sections),
     Switch (« à la une »), Select (type de bloc), AlertDialog
     (suppression de section), Badge (statut/slug), Alert (création).
   • Création minimale (title/slug requis serveur) puis BASCULE
     AUTOMATIQUE dans l'éditeur complet du nouvel article (avant : il
     fallait fermer puis retrouver l'article dans la liste).
   • Slug auto-généré depuis le titre tant qu'il n'est pas modifié à la
     main.
   • Sauvegarde : EXPLICITE pour les métadonnées (bouton) ; IMMÉDIATE
     pour sections/blocs/takeaways/chiffres (une action = un appel,
     invalidation TanStack).
   ⚠️ Panneaux en forceMount : les champs restent montés pour que les
   valeurs et erreurs survivent au changement d'onglet.
   ───────────────────────────────────────────────────────────────────── */

/* ─── Schémas zod ─── */
const REGEX_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Titre → slug : minuscules, sans accents, séparateurs tirets. */
const slugifier = (texte) =>
  (texte ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200)

const schemaCreation = z.object({
  title: z.string().trim().min(3, "Titre requis (3 caractères min)").max(255, "255 caractères max"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug requis")
    .max(255, "255 caractères max")
    .regex(REGEX_SLUG, "Minuscules, chiffres et tirets uniquement"),
})

const schemaMetadonnees = z
  .object({
    title: z.string().trim().min(3, "Titre requis (3 caractères min)").max(255, "255 caractères max"),
    slug: z
      .string()
      .trim()
      .min(1, "Slug requis")
      .max(255, "255 caractères max")
      .regex(REGEX_SLUG, "Minuscules, chiffres et tirets uniquement"),
    excerpt: z.string().trim().max(500, "500 caractères max").optional().or(z.literal("")),
    category_id: z.string().optional().or(z.literal("")),
    reading_minutes: z.coerce.number().int().min(1, "≥ 1").max(120, "≤ 120"),
    seo_title: z.string().trim().max(70, "70 caractères max (recommandation SEO)").optional().or(z.literal("")),
    seo_description: z.string().trim().max(160, "160 caractères max (recommandation SEO)").optional().or(z.literal("")),
    quote_text: z.string().trim().max(500, "500 caractères max").optional().or(z.literal("")),
    quote_author: z.string().trim().max(120, "120 caractères max").optional().or(z.literal("")),
    tags: z.string().trim().max(500, "500 caractères max").optional().or(z.literal("")),
    is_featured: z.boolean(),
    featured_order: z.string().regex(/^\d{0,3}$/, "Nombre entier entre 1 et 100").optional(),
  })
  .superRefine((valeurs, ctx) => {
    if (valeurs.is_featured && !valeurs.featured_order) {
      ctx.addIssue({
        code: "custom",
        path: ["featured_order"],
        message: "Ordre requis pour un article à la une",
      })
    }
  })

const schemaTitreSection = z.string().trim().min(1, "Titre requis").max(200, "200 caractères max")

const TYPES_BLOC = [
  { valeur: "text", libelle: "Texte" },
  { valeur: "quote", libelle: "Citation" },
  { valeur: "image", libelle: "Image (URL)" },
]
const LIBELLE_TYPE_BLOC = { text: "Texte", quote: "Citation", image: "Image" }

const schemaBloc = z
  .object({
    block_type: z.enum(["text", "quote", "image"]),
    content: z.string().trim().min(1, "Contenu requis").max(10000, "10 000 caractères max"),
  })
  .superRefine((bloc, ctx) => {
    if (bloc.block_type === "image" && !/^https?:\/\//.test(bloc.content)) {
      ctx.addIssue({ code: "custom", path: ["content"], message: "L'image doit être une URL http(s)" })
    }
  })

const schemaTakeaway = z.object({
  text: z.string().trim().min(1, "Texte requis").max(300, "300 caractères max"),
})

const schemaChiffre = z.object({
  value: z.string().trim().min(1, "Requis").regex(/^-?\d+(?:[.,]\d+)?$/, "Nombre requis"),
  label: z.string().trim().min(1, "Libellé requis").max(120, "120 caractères max"),
  suffix: z.string().trim().max(10, "10 caractères max").optional().or(z.literal("")),
})

const STATUT_ARTICLE = {
  draft: { libelle: "Brouillon", variante: "outline" },
  published: { libelle: "Publié", variante: "secondary" },
  archived: { libelle: "Archivé", variante: "outline" },
}

/* Champ avec label + aide + erreur temps réel. */
const Champ = ({ id, label, error, required, aide, children, className }) => (
  <div className={cn("flex flex-col gap-1.5", className)}>
    <Label htmlFor={id}>
      {label} {required && <span className="text-destructive">*</span>}
    </Label>
    {children}
    {aide && !error && <p className="text-[10px] text-muted-foreground">{aide}</p>}
    {error && <p className="text-xs font-medium text-destructive">{error.message}</p>}
  </div>
)

/* ─── Point d'entrée : création OU édition (bascule interne après le POST) ─── */
const EditeurArticle = ({ articleId, onFermer }) => {
  /* Après la création minimale, on BASCULE directement dans l'éditeur
     complet du nouvel article (plus besoin de fermer puis de retrouver
     l'article dans la liste). */
  const [idCourant, setIdCourant] = useState(articleId)
  if (!idCourant) {
    return (
      <FormulaireCreation
        onFermer={onFermer}
        onCree={(id) => (id ? setIdCourant(id) : onFermer())}
      />
    )
  }
  return <EditeurExistant key={idCourant} articleId={idCourant} onFermer={onFermer} />
}

/* ─── Création minimale (title + slug requis serveur) ─── */
const FormulaireCreation = ({ onFermer, onCree }) => {
  const notify = useNotify()
  const creerMutation = useCreateArticle()
  const slugModifie = useRef(false)
  const {
    register, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schemaCreation),
    defaultValues: { title: "", slug: "" },
    mode: "onBlur",
  })

  /* Slug auto-généré depuis le titre tant que le champ slug n'a pas été
     modifié à la main. */
  const titre = watch("title")
  useEffect(() => {
    if (!slugModifie.current) setValue("slug", slugifier(titre))
  }, [titre, setValue])

  const creer = handleSubmit((valeurs) => {
    creerMutation.mutate(
      { title: valeurs.title, slug: valeurs.slug },
      {
        onSuccess: (articleCree) => {
          notify("Article créé en brouillon — éditeur complet ouvert", "success")
          onCree(articleCree?.id)
        },
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )
  })

  return (
    <Sheet open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Nouvel article</SheetTitle>
          <SheetDescription>
            Création minimale (titre + slug requis côté serveur) — l'éditeur complet
            s'ouvre immédiatement après.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={creer} className="flex flex-col gap-3 px-4 pb-6">
          <Champ id="creer-titre" label="Titre" required error={errors.title}>
            <Input id="creer-titre" {...register("title")} placeholder="Ex. Réussir son entretien d'embauche" />
          </Champ>
          <Champ
            id="creer-slug"
            label="Slug"
            required
            error={errors.slug}
            aide="Généré automatiquement depuis le titre — modifiable."
          >
            <Input
              id="creer-slug"
              {...register("slug", { onChange: () => { slugModifie.current = true } })}
              className="font-mono"
              placeholder="reussir-son-entretien"
            />
          </Champ>
          <Alert>
            <Info aria-hidden className="size-4" />
            <AlertTitle>Brouillon</AlertTitle>
            <AlertDescription>
              L'article est créé en brouillon : il n'apparaît pas sur le site public
              tant qu'il n'est pas publié depuis la liste.
            </AlertDescription>
          </Alert>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onFermer}>Annuler</Button>
            <Button type="submit" disabled={creerMutation.isPending}>
              {creerMutation.isPending ? "Création…" : "Créer le brouillon"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

/* ─── Éditeur complet (article existant) ─── */
const EditeurExistant = ({ articleId, onFermer }) => {
  const navigate = useNavigate()
  const { data: article, isLoading, isError, refetch } = useAdminArticleQuery(articleId)
  const statutConf = STATUT_ARTICLE[article?.status] ?? null

  return (
    <Sheet open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            <FileText className="size-4 text-primary" aria-hidden />
            <span className="min-w-0 truncate">{article?.title ?? "Éditeur d'article"}</span>
            {article?.slug && (
              <Badge variant="outline" className="font-mono text-[10px]">/{article.slug}</Badge>
            )}
            {statutConf && <Badge variant={statutConf.variante}>{statutConf.libelle}</Badge>}
          </SheetTitle>
          <SheetDescription>
            Métadonnées (sauvegarde explicite), sections, points clés et chiffres clés
            (sauvegarde immédiate à chaque action).
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-8">
          {isError ? (
            <SectionErreur onRetry={refetch} message="Impossible de charger l'article." />
          ) : isLoading || !article ? (
            <div className="flex flex-col gap-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : (
            <>
              {/* react-router : aperçu public de l'article publié. */}
              {article.status === "published" && (
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/actualites/${article.slug}`)}>
                    <ExternalLink aria-hidden /> Voir sur le site
                  </Button>
                </div>
              )}
              <FormulaireArticle key={article.id} article={article} articleId={articleId} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* ─── Corps de l'éditeur : 3 onglets ─── */
const FormulaireArticle = ({ article, articleId }) => {
  const notify = useNotify()
  const { data: categories } = useAdminCategoriesQuery()
  const metaMutation = useUpdateArticle()
  const sectionMutation = useUpdateSection()
  const ajouterSectionMutation = useCreateSection()
  const supprimerSectionMutation = useDeleteSection()
  const blocMutation = useUpdateBlock()
  const ajouterBlocMutation = useCreateBlock()
  const supprimerBlocMutation = useDeleteBlock()
  const reorderMutation = useReorderSections()
  const ajouterTakeawayMutation = useCreateTakeaway()
  const supprimerTakeawayMutation = useDeleteTakeaway()
  const ajouterFigureMutation = useCreateKeyFigure()
  const supprimerFigureMutation = useDeleteKeyFigure()

  const sections = useMemo(
    () => [...(article?.sections ?? [])].sort((a, b) => a.position - b.position),
    [article]
  )

  /* Formulaire métadonnées — champs non contrôlés (RHF), validation zod. */
  const {
    register, handleSubmit, control, watch, reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(schemaMetadonnees),
    defaultValues: {
      title: article.title ?? "",
      slug: article.slug ?? "",
      excerpt: article.excerpt ?? "",
      category_id: article.category_id ?? "",
      reading_minutes: article.reading_minutes ?? 5,
      seo_title: article.seo_title ?? "",
      seo_description: article.seo_description ?? "",
      quote_text: article.quote_text ?? "",
      quote_author: article.quote_author ?? "",
      tags: (article.tags ?? []).join(", "),
      is_featured: article.is_featured ?? false,
      featured_order: article.featured_order != null ? String(article.featured_order) : "",
    },
    mode: "onBlur",
  })
  const aLaUne = watch("is_featured")

  const enregistrerMeta = handleSubmit((valeurs) => {
    const tags = valeurs.tags
      ? [...new Set(valeurs.tags.split(",").map((t) => t.trim()).filter(Boolean))]
      : null
    metaMutation.mutate(
      {
        id: articleId,
        data: {
          title: valeurs.title,
          slug: valeurs.slug,
          excerpt: valeurs.excerpt?.trim() || null,
          category_id: valeurs.category_id || null,
          reading_minutes: valeurs.reading_minutes,
          seo_title: valeurs.seo_title?.trim() || null,
          seo_description: valeurs.seo_description?.trim() || null,
          quote_text: valeurs.quote_text?.trim() || null,
          quote_author: valeurs.quote_author?.trim() || null,
          tags,
          is_featured: valeurs.is_featured,
          featured_order: valeurs.is_featured && valeurs.featured_order ? Number(valeurs.featured_order) : null,
        },
      },
      {
        onSuccess: () => {
          // Rebase du formulaire : isDirty repasse à false après sauvegarde.
          reset(valeurs)
          notify("Métadonnées enregistrées", "success")
        },
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )
  })

  /* Réordonnancement : PUT /sections/reorder avec la liste COMPLÈTE des IDs. */
  const deplacerSection = (index) => {
    const ids = sections.map((s) => s.id)
    const cible = index - 1
    ;[ids[index], ids[cible]] = [ids[cible], ids[index]]
    reorderMutation.mutate(
      { articleId, sectionIds: ids },
      { onError: (err) => notify(messageErreurContenu(err), "error") }
    )
  }

  const ajouterSection = () =>
    ajouterSectionMutation.mutate(
      {
        articleId,
        data: {
          position: sections.length + 1,
          anchor: `section-${sections.length + 1}`,
          title: "Nouvelle section",
        },
      },
      {
        onSuccess: () => notify("Section ajoutée", "success"),
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )

  const ajouterBloc = (sectionId) =>
    ajouterBlocMutation.mutate(
      { sectionId, data: { position: 999, block_type: "text", content: "Nouveau bloc — cliquez pour éditer." } },
      {
        onSuccess: () => notify("Bloc ajouté", "success"),
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )

  const supprimerSection = (sectionId) =>
    supprimerSectionMutation.mutate(sectionId, {
      onSuccess: () => notify("Section supprimée", "success"),
      onError: (err) => notify(messageErreurContenu(err), "error"),
    })

  return (
    <Tabs defaultValue="metadonnees">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="metadonnees">Métadonnées</TabsTrigger>
        <TabsTrigger value="sections">Sections ({sections.length})</TabsTrigger>
        <TabsTrigger value="points">Points & chiffres</TabsTrigger>
      </TabsList>

      {/* ── Panneau 1 : Métadonnées (sauvegarde explicite) ── */}
      <TabsContent value="metadonnees" forceMount className="mt-4 data-[state=inactive]:hidden">
        <form onSubmit={enregistrerMeta} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Champ id="ed-titre" label="Titre" required error={errors.title} className="sm:col-span-2">
            <Input id="ed-titre" {...register("title")} />
          </Champ>
          <Champ
            id="ed-slug"
            label="Slug"
            required
            error={errors.slug}
            aide="Utilisé dans l'URL publique : /actualites/{slug}"
          >
            <Input id="ed-slug" {...register("slug")} className="font-mono" />
          </Champ>
          <Champ id="ed-categorie" label="Catégorie" error={errors.category_id}>
            <Controller
              name="category_id"
              control={control}
              render={({ field }) => (
                /* Sentinelle « aucune » : Radix refuse la valeur vide. */
                <Select value={field.value || "aucune"} onValueChange={(v) => field.onChange(v === "aucune" ? "" : v)}>
                  <SelectTrigger id="ed-categorie">
                    <SelectValue placeholder="Aucune" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aucune">Aucune</SelectItem>
                    {(categories ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Champ>
          <Champ
            id="ed-extrait"
            label="Extrait"
            error={errors.excerpt}
            className="sm:col-span-2"
            aide="Affiché dans les listes et en tête d'article."
          >
            <Textarea id="ed-extrait" rows={2} {...register("excerpt")} />
          </Champ>
          <Champ id="ed-lecture" label="Lecture (min)" error={errors.reading_minutes}>
            <Input id="ed-lecture" type="number" min={1} max={120} {...register("reading_minutes")} />
          </Champ>
          {/* À la une : Switch + ordre conditionnel */}
          <div className="flex flex-col gap-1.5">
            <Label>À la une</Label>
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Controller
                name="is_featured"
                control={control}
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Mettre l'article à la une" />
                )}
              />
              {aLaUne ? (
                <div className="flex flex-col gap-1">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    placeholder="Ordre"
                    aria-label="Ordre d'affichage à la une"
                    {...register("featured_order")}
                    className="h-8 w-24 text-xs"
                  />
                  {errors.featured_order && (
                    <p className="text-[10px] text-destructive">{errors.featured_order.message}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Article non mis en avant.</p>
              )}
            </div>
          </div>
          <Champ id="ed-citation" label="Citation" error={errors.quote_text}>
            <Input id="ed-citation" {...register("quote_text")} />
          </Champ>
          <Champ id="ed-citation-auteur" label="Auteur de la citation" error={errors.quote_author}>
            <Input id="ed-citation-auteur" {...register("quote_author")} />
          </Champ>
          <Champ
            id="ed-seo-titre"
            label="Titre SEO"
            error={errors.seo_title}
            aide="70 caractères max recommandé."
          >
            <Input id="ed-seo-titre" {...register("seo_title")} />
          </Champ>
          <Champ
            id="ed-seo-desc"
            label="Description SEO"
            error={errors.seo_description}
            aide="160 caractères max recommandé."
          >
            <Input id="ed-seo-desc" {...register("seo_description")} />
          </Champ>
          <Champ
            id="ed-tags"
            label="Tags"
            error={errors.tags}
            className="sm:col-span-2"
            aide="Séparés par des virgules — dédupliqués à la sauvegarde."
          >
            <Input id="ed-tags" {...register("tags")} placeholder="cv, entretien, carrière" />
          </Champ>
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4 sm:col-span-2">
            <Button type="submit" disabled={metaMutation.isPending || !isDirty}>
              <Save aria-hidden />
              {metaMutation.isPending ? "Enregistrement…" : "Enregistrer les métadonnées"}
            </Button>
            {isDirty && !metaMutation.isPending && (
              <p className="text-[10px] text-muted-foreground">Des modifications ne sont pas encore enregistrées.</p>
            )}
          </div>
        </form>
      </TabsContent>

      {/* ── Panneau 2 : Sections structurées (sauvegarde immédiate) ── */}
      <TabsContent value="sections" forceMount className="mt-4 data-[state=inactive]:hidden">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              L'ordre des sections est celui de l'article public — chaque action est
              enregistrée immédiatement.
            </p>
            <Button variant="outline" size="sm" onClick={ajouterSection} disabled={ajouterSectionMutation.isPending}>
              <Plus aria-hidden /> Section
            </Button>
          </div>
          {!sections.length ? (
            <SectionVide message="Aucune section — l'article public n'affichera que l'extrait." />
          ) : (
            sections.map((section, i) => (
              <CarteSection
                key={section.id}
                section={section}
                premier={i === 0}
                dernier={i === sections.length - 1}
                onMonter={() => deplacerSection(i)}
                onDescendre={() => deplacerSection(i + 1)}
                onSupprimer={() => supprimerSection(section.id)}
                supprimerEnCours={supprimerSectionMutation.isPending && supprimerSectionMutation.variables === section.id}
                onAjouterBloc={() => ajouterBloc(section.id)}
                sectionMutation={sectionMutation}
                blocMutation={blocMutation}
                supprimerBlocMutation={supprimerBlocMutation}
              />
            ))
          )}
        </div>
      </TabsContent>

      {/* ── Panneau 3 : Points clés + chiffres clés ── */}
      <TabsContent value="points" forceMount className="mt-4 data-[state=inactive]:hidden">
        <div className="flex flex-col items-center gap-4">
          <ListeTakeaways
            articleId={articleId}
            takeaways={article?.takeaways ?? []}
            ajouterMutation={ajouterTakeawayMutation}
            supprimerMutation={supprimerTakeawayMutation}
          />
          <ListeKeyFigures
            articleId={articleId}
            figures={article?.key_figures ?? []}
            ajouterMutation={ajouterFigureMutation}
            supprimerMutation={supprimerFigureMutation}
          />
        </div>
      </TabsContent>
    </Tabs>
  )
}

/* ─── Carte d'une section : titre inline validé, blocs, suppression confirmée ─── */
const CarteSection = ({
  section, premier, dernier, onMonter, onDescendre, onSupprimer,
  supprimerEnCours, onAjouterBloc, sectionMutation, blocMutation, supprimerBlocMutation,
}) => {
  const notify = useNotify()
  const [ouvert, setOuvert] = useState(false)
  const [confirmation, setConfirmation] = useState(false)
  const [titreLocal, setTitreLocal] = useState(section.title)
  const [erreurTitre, setErreurTitre] = useState(null)

  const blocs = useMemo(
    () => [...(section.blocks ?? [])].sort((a, b) => a.position - b.position),
    [section]
  )

  /* Titre de section : validation zod au blur / Entrée. */
  const enregistrerTitre = () => {
    const resultat = schemaTitreSection.safeParse(titreLocal)
    if (!resultat.success) {
      setErreurTitre(resultat.error.issues[0]?.message ?? "Titre invalide")
      return
    }
    setErreurTitre(null)
    if (titreLocal !== section.title) {
      sectionMutation.mutate(
        { id: section.id, data: { title: titreLocal } },
        { onError: (err) => notify(messageErreurContenu(err), "error") }
      )
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <Button variant="ghost" size="icon-sm" onClick={onMonter} disabled={premier} aria-label="Monter la section">
              <ChevronUp aria-hidden />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onDescendre} disabled={dernier} aria-label="Descendre la section">
              <ChevronDown aria-hidden />
            </Button>
          </div>
          <Badge variant="outline" className="font-mono">{section.position}</Badge>
          <div className="min-w-0 flex-1">
            <input
              value={titreLocal}
              onChange={(e) => setTitreLocal(e.target.value)}
              onBlur={enregistrerTitre}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  enregistrerTitre()
                }
              }}
              aria-label={`Titre de la section ${section.position}`}
              aria-invalid={!!erreurTitre}
              className={cn(
                "w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-medium outline-none transition-colors",
                "hover:border-input focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
                erreurTitre && "border-destructive"
              )}
            />
            {erreurTitre && <p className="mt-0.5 text-[10px] text-destructive" role="alert">{erreurTitre}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}>
            {ouvert ? "Replier" : "Blocs"} ({blocs.length})
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setConfirmation(true)}
            aria-label="Supprimer la section"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
        {ouvert && (
          <div className="flex flex-col gap-2 border-t border-border pt-2">
            {!blocs.length && (
              <p className="text-center text-[10px] text-muted-foreground">Aucun bloc.</p>
            )}
            {blocs.map((bloc) => (
              <BlocContenu
                key={bloc.id}
                bloc={bloc}
                mutation={blocMutation}
                onSupprimer={() =>
                  supprimerBlocMutation.mutate(bloc.id, {
                    onSuccess: () => notify("Bloc supprimé", "success"),
                    onError: (err) => notify(messageErreurContenu(err), "error"),
                  })
                }
              />
            ))}
            <Button variant="outline" size="sm" onClick={onAjouterBloc} className="w-fit">
              <Plus aria-hidden /> Bloc
            </Button>
          </div>
        )}
      </CardContent>

      {/* Confirmation suppression de section (AlertDialog). */}
      <AlertDialog open={confirmation} onOpenChange={setConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la section « {section.title} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              {blocs.length > 0
                ? `Ses ${blocs.length} bloc${blocs.length > 1 ? "s" : ""} de contenu seront également supprimés. Action irréversible.`
                : "Action irréversible."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmation(false)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={supprimerEnCours}
              onClick={() => {
                setConfirmation(false)
                onSupprimer()
              }}
            >
              Supprimer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

/* ─── Un bloc de contenu (texte / citation / image) — validation zod au blur ─── */
const BlocContenu = ({ bloc, mutation, onSupprimer }) => {
  const notify = useNotify()
  const [contenuLocal, setContenuLocal] = useState(bloc.content)
  const [erreur, setErreur] = useState(null)

  const enregistrer = () => {
    const resultat = schemaBloc.safeParse({ block_type: bloc.block_type, content: contenuLocal })
    if (!resultat.success) {
      setErreur(resultat.error.issues[0]?.message ?? "Contenu invalide")
      return
    }
    setErreur(null)
    if (contenuLocal !== bloc.content) {
      mutation.mutate(
        { id: bloc.id, data: { content: contenuLocal } },
        { onError: (err) => notify(messageErreurContenu(err), "error") }
      )
    }
  }

  const changerType = (type) =>
    mutation.mutate(
      { id: bloc.id, data: { block_type: type } },
      { onError: (err) => notify(messageErreurContenu(err), "error") }
    )

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-2">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
          {bloc.block_type === "quote" && <Quote className="size-3" aria-hidden />}
          {LIBELLE_TYPE_BLOC[bloc.block_type] ?? bloc.block_type}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Select value={bloc.block_type} onValueChange={changerType}>
            <SelectTrigger className="h-6 w-36 text-[10px]" aria-label="Type du bloc">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES_BLOC.map((t) => (
                <SelectItem key={t.valeur} value={t.valeur}>{t.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon-sm" onClick={onSupprimer} aria-label="Supprimer le bloc">
            <X aria-hidden />
          </Button>
        </div>
      </div>
      <Textarea
        value={contenuLocal}
        onChange={(e) => setContenuLocal(e.target.value)}
        onBlur={enregistrer}
        aria-label="Contenu du bloc"
        aria-invalid={!!erreur}
        rows={bloc.block_type === "text" ? 3 : 2}
        className={cn("text-xs", erreur && "border-destructive focus-visible:ring-destructive/30")}
      />
      {erreur && <p className="text-[10px] text-destructive" role="alert">{erreur}</p>}
      {bloc.block_type === "image" && !erreur && (
        <p className="text-[10px] text-muted-foreground">URL http(s) d'une image.</p>
      )}
    </div>
  )
}

/* ─── Points clés (takeaways) — formulaire RHF + zod ─── */
const ListeTakeaways = ({ articleId, takeaways, ajouterMutation, supprimerMutation }) => {
  const notify = useNotify()
  const {
    register, handleSubmit, reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schemaTakeaway),
    defaultValues: { text: "" },
    mode: "onBlur",
  })

  const ajouter = handleSubmit((valeurs) => {
    ajouterMutation.mutate(
      { articleId, data: { text: valeurs.text } },
      {
        onSuccess: () => {
          reset()
          notify("Point clé ajouté", "success")
        },
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )
  })

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
          <ListOrdered className="size-4" aria-hidden /> Points clés ({takeaways.length})
        </h3>
        <ul className="flex flex-col gap-1.5">
          {!takeaways.length && (
            <li className="text-center text-[10px] text-muted-foreground">Aucun point clé.</li>
          )}
          {takeaways.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="font-mono">{t.position}</Badge>
              <span className="min-w-0 flex-1">{t.text}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Supprimer le point clé ${t.position}`}
                onClick={() =>
                  supprimerMutation.mutate(t.id, {
                    onError: (err) => notify(messageErreurContenu(err), "error"),
                  })
                }
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <form onSubmit={ajouter} className="flex items-start gap-2">
          <div className="flex-1">
            <Input {...register("text")} placeholder="Nouveau point clé…" aria-label="Nouveau point clé" className="text-xs" />
            {errors.text && <p className="mt-1 text-[10px] text-destructive">{errors.text.message}</p>}
          </div>
          <Button type="submit" size="sm" disabled={ajouterMutation.isPending} aria-label="Ajouter le point clé">
            <Plus aria-hidden />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

/* ─── Chiffres clés (key-figures) — formulaire RHF + zod ─── */
const ListeKeyFigures = ({ articleId, figures, ajouterMutation, supprimerMutation }) => {
  const notify = useNotify()
  const {
    register, handleSubmit, reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schemaChiffre),
    defaultValues: { value: "", label: "", suffix: "" },
    mode: "onBlur",
  })

  const ajouter = handleSubmit((valeurs) => {
    ajouterMutation.mutate(
      {
        articleId,
        data: {
          value: Number(valeurs.value.replace(",", ".")),
          label: valeurs.label,
          suffix: valeurs.suffix?.trim() || null,
        },
      },
      {
        onSuccess: () => {
          reset()
          notify("Chiffre clé ajouté", "success")
        },
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )
  })

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
          <Hash className="size-4" aria-hidden /> Chiffres clés ({figures.length})
        </h3>
        <ul className="flex flex-col gap-1.5">
          {!figures.length && (
            <li className="text-center text-[10px] text-muted-foreground">Aucun chiffre clé.</li>
          )}
          {figures.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="font-mono">{f.position}</Badge>
              <span className="font-heading text-sm font-bold tabular-nums">
                {f.prefix ?? ""}{f.value}{f.suffix ?? ""}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{f.label}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Supprimer le chiffre clé ${f.label}`}
                onClick={() =>
                  supprimerMutation.mutate(f.id, {
                    onError: (err) => notify(messageErreurContenu(err), "error"),
                  })
                }
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <form onSubmit={ajouter}>
          <div className="grid grid-cols-[5rem_1fr_4rem_2rem] items-start gap-1.5">
            <div>
              <Input {...register("value")} placeholder="42" aria-label="Valeur du chiffre" className="text-xs" />
              {errors.value && <p className="mt-1 text-[9px] text-destructive">{errors.value.message}</p>}
            </div>
            <div>
              <Input {...register("label")} placeholder="des recruteurs…" aria-label="Libellé du chiffre" className="text-xs" />
              {errors.label && <p className="mt-1 text-[9px] text-destructive">{errors.label.message}</p>}
            </div>
            <div>
              <Input {...register("suffix")} placeholder="%" maxLength={10} aria-label="Suffixe (optionnel)" className="text-xs" />
              {errors.suffix && <p className="mt-1 text-[9px] text-destructive">{errors.suffix.message}</p>}
            </div>
            <Button type="submit" size="sm" disabled={ajouterMutation.isPending} aria-label="Ajouter le chiffre clé">
              <Plus aria-hidden />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default EditeurArticle
```

## File: src/Pages/Admin/Contenu/components/EtatsSection.jsx
```javascript
import { AlertTriangle, Inbox, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"

/* États de section — page Contenu (même pattern que les autres pages admin). */

export const SectionErreur = ({ onRetry, message = "Chargement impossible." }) => (
  <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
    <AlertTriangle className="size-5 text-destructive" aria-hidden />
    <p className="text-sm font-medium text-destructive">{message}</p>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry}>
        Réessayer
      </Button>
    )}
  </div>
)

export const SectionVide = ({ message = "Aucune donnée pour le moment." }) => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
      <EmptyTitle>Rien à afficher</EmptyTitle>
      <EmptyDescription>{message}</EmptyDescription>
    </EmptyHeader>
  </Empty>
)

export const SectionAucunResultat = ({ message = "Aucun résultat ne correspond aux critères.", onReset }) => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
      <EmptyTitle>Aucun résultat</EmptyTitle>
      <EmptyDescription>{message}</EmptyDescription>
    </EmptyHeader>
    {onReset && (
      <Button variant="outline" size="sm" onClick={onReset}>
        Réinitialiser
      </Button>
    )}
  </Empty>
)
```

## File: src/Pages/Admin/Contenu/sections/OngletArticles.jsx
```javascript
import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  CheckCircle2, Eye, FileEdit, FileText, MoreHorizontal, Pencil, Plus, Search, Star, Trash2, X,
} from "lucide-react"
import { cn } from "cn"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminArticlesQuery, useAdminCategoriesQuery, useChangerStatutArticle,
  useMettreALaUne, useDeleteArticle, messageErreurContenu,
} from "@/features/admin-contenu.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import CarteCompteur from "@/components/admin/CarteCompteur"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { SectionErreur, SectionVide, SectionAucunResultat } from "../components/EtatsSection"
import EditeurArticle from "../components/EditeurArticle"

/* ─────────────────────────────────────────────────────────────────────
   Onglet 14.1 — Articles : compteurs, liste filtrable (statut,
   catégorie, recherche titre) TRIABLE par colonne, actions rapides
   (publier/dépublier, à la une, suppression) + éditeur complet.
   Tri CLIENT sur la liste retournée (le serveur filtre q/status/
   category_id mais ne trie pas).
   ───────────────────────────────────────────────────────────────────── */
const STATUTS_ARTICLE = [
  { valeur: "draft", libelle: "Brouillon" },
  { valeur: "published", libelle: "Publié" },
  { valeur: "archived", libelle: "Archivé" },
]
const VARIANTE_STATUT = { draft: "outline", published: "secondary", archived: "outline" }
const LIBELLE_STATUT = { draft: "Brouillon", published: "Publié", archived: "Archivé" }
const RANG_STATUT = { draft: 1, published: 2, archived: 3 }

/* Sentinelle ISO : les articles SANS date de publication (brouillons)
   restent en fin de liste en desc. */
const JAMAIS = "0000-01-01T00:00:00"

const dateCourte = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) : "—"

/* Tri « français » robuste : nombres, textes, dates ISO ; vides en fin. */
const comparerValeurs = (a, b) => {
  const videA = a === null || a === undefined || a === ""
  const videB = b === null || b === undefined || b === ""
  if (videA && videB) return 0
  if (videA) return 1
  if (videB) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" })
}

/* Colonnes triables — le menu d'actions reste un en-tête simple. */
const COLONNES = [
  { cle: "titre", libelle: "Titre", directionInitiale: "asc", triValeur: (a) => (a.title ?? "").toLowerCase() },
  { cle: "statut", libelle: "Statut", directionInitiale: "asc", triValeur: (a) => RANG_STATUT[a.status] ?? 0 },
  {
    cle: "categorie", libelle: "Catégorie", directionInitiale: "asc",
    className: "hidden md:table-cell",
    triValeur: (a) => (a.category?.label ?? "").toLowerCase(),
  },
  {
    cle: "vues", libelle: "Vues", directionInitiale: "desc",
    className: "hidden text-right md:table-cell",
    triValeur: (a) => a.view_count ?? 0,
  },
  {
    cle: "publie", libelle: "Publié le", directionInitiale: "desc",
    className: "hidden text-right lg:table-cell",
    triValeur: (a) => a.published_at ?? JAMAIS,
  },
]

/* Déclencheur de filtre : surbrillance quand une valeur non défaut est
   sélectionnée. */
const classeDeclencheur = (actif, largeur) =>
  cn(
    "h-8 text-xs transition-colors",
    largeur,
    actif
      ? "border-brand-navy/30 bg-secondary font-semibold text-secondary-foreground"
      : "text-muted-foreground"
  )

/* ─── Skeleton fidèle aux colonnes réelles ─── */
const LigneSkeletonArticle = () => (
  <TableRow className="hover:bg-transparent">
    <TableCell>
      <div className="flex flex-col gap-1.5 py-0.5">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-2.5 w-24" />
      </div>
    </TableCell>
    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
    <TableCell className="hidden md:table-cell"><Skeleton className="h-3 w-24" /></TableCell>
    <TableCell className="hidden md:table-cell"><Skeleton className="ml-auto h-3.5 w-10" /></TableCell>
    <TableCell className="hidden lg:table-cell"><Skeleton className="ml-auto h-3.5 w-16" /></TableCell>
    <TableCell><div className="flex justify-end"><Skeleton className="size-7 rounded-md" /></div></TableCell>
  </TableRow>
)

const OngletArticles = () => {
  const notify = useNotify()
  const [recherche, setRecherche] = useState("")
  const [statut, setStatut] = useState("")
  const [categorieId, setCategorieId] = useState("")
  const [editeurOuvert, setEditeurOuvert] = useState(null)   // null fermé ; {} création ; { id } édition
  const [suppression, setSuppression] = useState(null)
  /* Tri INITIALISÉ : « Publié le » descendant (le plus récent d'abord). */
  const [tri, setTri] = useState({ cle: "publie", direction: "desc" })

  const params = { q: recherche || undefined, status: statut || undefined, category_id: categorieId || undefined }
  const { data: articles, isLoading, isError, refetch } = useAdminArticlesQuery(params)
  const { data: categories } = useAdminCategoriesQuery()
  const statutMutation = useChangerStatutArticle()
  const featuredMutation = useMettreALaUne()
  const supprimerMutation = useDeleteArticle()

  // Compteurs dérivés de la fenêtre affichée (liste plafonnée à la
  // limite serveur — comptage honnête, pas de total inventé).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const listeBrute = articles ?? []
  const nbPublies = listeBrute.filter((a) => a.status === "published").length
  const nbBrouillons = listeBrute.filter((a) => a.status === "draft").length
  const nbALaUne = listeBrute.filter((a) => a.is_featured).length
  const nbFiltres = [recherche, statut, categorieId].filter(Boolean).length

  const articlesTries = useMemo(() => {
    if (!tri) return listeBrute
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return listeBrute
    const copie = [...listeBrute].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [listeBrute, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  const reinitialiserFiltres = () => {
    setRecherche("")
    setStatut("")
    setCategorieId("")
  }

  const changerStatut = (article, status) =>
    statutMutation.mutate(
      { id: article.id, status },
      {
        onSuccess: () => notify(`Article ${status === "published" ? "publié" : status === "draft" ? "dépublié" : "archivé"}`, "success"),
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )

  const basculerALaUne = (article) =>
    featuredMutation.mutate(
      {
        id: article.id,
        data: { is_featured: !article.is_featured, featured_order: article.is_featured ? null : undefined },
      },
      {
        onSuccess: () => notify(article.is_featured ? "Retiré de la une" : "Mis à la une", "success"),
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )

  /* key = fondu léger du corps à chaque changement de tri / filtres. */
  const cleCorps = `${recherche}-${statut}-${categorieId}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  return (
    <div className="flex flex-col gap-3">
      {/* ─── Compteurs dérivés de la liste ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CarteCompteur label="Articles" valeur={listeBrute.length} icone={FileText} chargement={isLoading} />
        <CarteCompteur label="Publiés" valeur={nbPublies} icone={CheckCircle2} chargement={isLoading} />
        <CarteCompteur label="Brouillons" valeur={nbBrouillons} icone={FileEdit} chargement={isLoading} />
        <CarteCompteur label="À la une" valeur={nbALaUne} icone={Star} chargement={isLoading} />
      </div>

      <SectionCardAdmin
        title="Articles"
        description="Recherche, filtres et tri — l'éditeur complet s'ouvre depuis le titre ou le menu d'actions."
        icon={FileText}
        contentClassName="p-0 sm:p-0"
        action={
          <Button size="sm" onClick={() => setEditeurOuvert({})}>
            <Plus aria-hidden /> Nouvel article
          </Button>
        }
      >
        {/* ─── Barre de filtres (selects shadcn + recherche) ─── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher par titre…"
              aria-label="Rechercher un article par titre"
              className={cn("h-8 pl-8 text-xs", recherche && "pr-8")}
            />
            {recherche && (
              <button
                type="button"
                onClick={() => setRecherche("")}
                aria-label="Effacer la recherche"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
          {/* Sentinelle « tous/toutes » : Radix refuse la valeur vide. */}
          <Select value={statut || "tous"} onValueChange={(v) => setStatut(v === "tous" ? "" : v)}>
            <SelectTrigger className={classeDeclencheur(!!statut, "w-36")} aria-label="Filtrer par statut">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous les statuts</SelectItem>
              {STATUTS_ARTICLE.map((s) => (
                <SelectItem key={s.valeur} value={s.valeur}>{s.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categorieId || "toutes"} onValueChange={(v) => setCategorieId(v === "toutes" ? "" : v)}>
            <SelectTrigger className={classeDeclencheur(!!categorieId, "w-44")} aria-label="Filtrer par catégorie">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toutes">Toutes les catégories</SelectItem>
              {(categories ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {nbFiltres > 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={reinitialiserFiltres}>
              Réinitialiser ({nbFiltres})
            </Button>
          )}
        </div>

        {/* ─── Corps : table triable, skeleton fidèle ─── */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${recherche}-${statut}-${categorieId}-${isLoading ? "chargement" : isError ? "erreur" : "donnees"}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les articles." />
              </div>
            ) : !articles?.length && !isLoading ? (
              <div className="p-4">
                {nbFiltres > 0 ? (
                  <SectionAucunResultat
                    message="Aucun article ne correspond à ces filtres."
                    onReset={reinitialiserFiltres}
                  />
                ) : (
                  <SectionVide message="Aucun article pour le moment." />
                )}
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "titre")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "statut")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "categorie")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "vues")} tri={tri} onTri={basculerTri} aligneDroite />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "publie")} tri={tri} onTri={basculerTri} aligneDroite />
                      <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                    {isLoading ? (
                      [...Array(4)].map((_, i) => <LigneSkeletonArticle key={i} />)
                    ) : (
                      articlesTries.map((article) => (
                        <TableRow key={article.id} className="transition-colors hover:bg-muted/50">
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => setEditeurOuvert({ id: article.id })}
                              className="block max-w-72 truncate text-left text-sm font-medium text-primary underline-offset-4 hover:underline"
                              title={article.title}
                            >
                              {article.title ?? article.slug}
                            </button>
                            <span className="block truncate font-mono text-[10px] text-muted-foreground">
                              /{article.slug}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={VARIANTE_STATUT[article.status] ?? "outline"}>
                              {LIBELLE_STATUT[article.status] ?? article.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                            {article.category?.label ?? "—"}
                          </TableCell>
                          <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                            {article.view_count ?? 0}
                          </TableCell>
                          <TableCell className="hidden text-right tabular-nums text-muted-foreground lg:table-cell">
                            {dateCourte(article.published_at)}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${article.title ?? article.slug}`}>
                                    <MoreHorizontal className="size-4" aria-hidden />
                                  </Button>
                                }
                              />
                              <DropdownMenuContent align="end" className="min-w-48">
                                <DropdownMenuGroup>
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                </DropdownMenuGroup>
                                <DropdownMenuItem onClick={() => setEditeurOuvert({ id: article.id })} className="cursor-pointer">
                                  <Pencil className="size-3.5" aria-hidden /> Éditer
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => changerStatut(article, article.status === "published" ? "draft" : "published")}
                                  className="cursor-pointer"
                                >
                                  <Eye className="size-3.5" aria-hidden />
                                  {article.status === "published" ? "Dépublier" : "Publier"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => basculerALaUne(article)} className="cursor-pointer">
                                  <Star className="size-3.5" aria-hidden />
                                  {article.is_featured ? "Retirer de la une" : "Mettre à la une"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => changerStatut(article, "archived")}
                                  disabled={article.status === "archived"}
                                  className="cursor-pointer"
                                >
                                  Archiver
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setSuppression(article)}
                                  className="cursor-pointer text-destructive"
                                >
                                  <Trash2 className="size-3.5" aria-hidden /> Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </SectionCardAdmin>

      {/* Éditeur complet (gros composant dédié) */}
      {editeurOuvert && (
        <EditeurArticle
          articleId={editeurOuvert.id ?? null}
          onFermer={() => setEditeurOuvert(null)}
        />
      )}

      {/* Confirmation suppression */}
      {suppression && (
        <Dialog open onOpenChange={(ouvert) => !ouvert && setSuppression(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Supprimer « {suppression.title ?? suppression.slug} » ?</DialogTitle>
              <DialogDescription>
                Sections, blocs, points clés et chiffres seront supprimés en cascade. Action irréversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
              <Button
                variant="destructive"
                disabled={supprimerMutation.isPending}
                onClick={() =>
                  supprimerMutation.mutate(suppression.id, {
                    onSuccess: () => {
                      notify("Article supprimé", "success")
                      setSuppression(null)
                    },
                    onError: (err) => notify(messageErreurContenu(err), "error"),
                  })
                }
              >
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default OngletArticles
```

## File: src/Pages/Admin/Contenu/sections/OngletCategories.jsx
```javascript
import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, FolderTree, Pencil, Plus, Tag, Trash2 } from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminCategoriesQuery, useAdminArticlesQuery, useCreateCategory, useUpdateCategory,
  useDeleteCategory, messageErreurContenu,
} from "@/features/admin-contenu.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet 14.2a — Catégories d'articles : CRUD simple + tri par colonne.
   ───────────────────────────────────────────────────────────────────── */

/* Tri « français » robuste : nombres, textes, dates ISO ; vides en fin. */
const comparerValeurs = (a, b) => {
  const videA = a === null || a === undefined || a === ""
  const videB = b === null || b === undefined || b === ""
  if (videA && videB) return 0
  if (videA) return 1
  if (videB) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" })
}

/* Colonnes triables — le menu d'actions reste un en-tête simple. */
const COLONNES = [
  { cle: "label", libelle: "Catégorie", directionInitiale: "asc", triValeur: (c) => (c.label ?? "").toLowerCase() },
  {
    cle: "code", libelle: "Code", directionInitiale: "asc",
    className: "hidden font-mono text-[10px] md:table-cell",
    triValeur: (c) => c.code ?? "",
  },
  { cle: "ordre", libelle: "Ordre", directionInitiale: "asc", className: "text-right", triValeur: (c) => c.sort_order ?? 0 },
  { cle: "statut", libelle: "Statut", directionInitiale: "desc", triValeur: (c) => (c.is_active ? 1 : 0) },
]

const LigneSkeletonCategorie = () => (
  <TableRow className="hover:bg-transparent">
    <TableCell><Skeleton className="h-3.5 w-40" /></TableCell>
    <TableCell className="hidden md:table-cell"><Skeleton className="h-3 w-20" /></TableCell>
    <TableCell className="text-right"><Skeleton className="ml-auto h-3.5 w-8" /></TableCell>
    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
    <TableCell>
      <div className="flex justify-end gap-1">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
      </div>
    </TableCell>
  </TableRow>
)

const OngletCategories = () => {
  const notify = useNotify()
  const { data: categories, isLoading, isError, refetch } = useAdminCategoriesQuery()
  const { data: articles } = useAdminArticlesQuery({ limit: 100 })
  const [edition, setEdition] = useState(null)  // null fermé ; {} création ; catégorie = édition
  const [suppression, setSuppression] = useState(null)
  /* Tri INITIALISÉ : « Ordre » ascendant = ordre serveur d'affichage. */
  const [tri, setTri] = useState({ cle: "ordre", direction: "asc" })

  const creerMutation = useCreateCategory()
  const modifierMutation = useUpdateCategory()
  const supprimerMutation = useDeleteCategory()

  // Compteurs : vides = aucune catégorie_id d'article ne pointe dessus
  // (croisement local listes catégories × articles, 0 appel en plus).
  const idsUtilisees = new Set((articles ?? []).map((a) => a.category_id).filter(Boolean))
  const nbActives = (categories ?? []).filter((c) => c.is_active).length
  const nbVides = (categories ?? []).filter((c) => !idsUtilisees.has(c.id)).length

  const categoriesTriees = useMemo(() => {
    const base = categories ?? []
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [categories, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  /* key = fondu léger du corps à chaque changement de tri. */
  const cleCorps = `${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  return (
    <div className="flex flex-col gap-3">
      {/* ─── Compteurs ─── */}
      <div className="grid grid-cols-3 gap-3">
        <CarteCompteur label="Catégories" valeur={categories?.length ?? 0} icone={FolderTree} chargement={isLoading} />
        <CarteCompteur label="Actives" valeur={nbActives} icone={CheckCircle2} chargement={isLoading} />
        <CarteCompteur label="Sans article" valeur={nbVides} icone={Tag} chargement={isLoading} />
      </div>

      <SectionCardAdmin
        title="Catégories"
        description="Catégories d'articles — utilisées dans les filtres publics et l'onglet Articles. Tri par colonne."
        icon={FolderTree}
        contentClassName="p-0 sm:p-0"
        action={
          <Button size="sm" onClick={() => setEdition({})}>
            <Plus aria-hidden /> Nouvelle catégorie
          </Button>
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={isLoading ? "chargement" : isError ? "erreur" : "donnees"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les catégories." />
              </div>
            ) : isLoading ? (
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableBody>
                    {[...Array(3)].map((_, i) => <LigneSkeletonCategorie key={i} />)}
                  </TableBody>
                </Table>
              </div>
            ) : !categories?.length ? (
              <div className="p-4">
                <SectionVide message="Aucune catégorie." />
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "label")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "code")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "ordre")} tri={tri} onTri={basculerTri} aligneDroite />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "statut")} tri={tri} onTri={basculerTri} />
                      <TableHead className="w-20"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                    {categoriesTriees.map((cat) => (
                      <TableRow key={cat.id} className="transition-colors hover:bg-muted/50">
                        <TableCell className="text-sm font-medium">{cat.label}</TableCell>
                        <TableCell className="hidden font-mono text-[10px] text-muted-foreground md:table-cell">{cat.code}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{cat.sort_order}</TableCell>
                        <TableCell>
                          <Badge variant={cat.is_active ? "secondary" : "outline"}>
                            {cat.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => setEdition(cat)} aria-label={`Modifier ${cat.label}`}>
                              <Pencil aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setSuppression(cat)}
                              aria-label={`Supprimer ${cat.label}`}
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </SectionCardAdmin>

      {/* Dialog création / édition */}
      {edition && (
        <DialogCategorie
          categorie={edition.id ? edition : null}
          creer={creerMutation}
          modifier={modifierMutation}
          onFermer={() => setEdition(null)}
        />
      )}

      {/* Confirmation suppression */}
      {suppression && (
        <Dialog open onOpenChange={(ouvert) => !ouvert && setSuppression(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Supprimer « {suppression.label} » ?</DialogTitle>
              <DialogDescription>
                Les articles rattachés perdront leur catégorie. Action irréversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
              <Button
                variant="destructive"
                disabled={supprimerMutation.isPending}
                onClick={() =>
                  supprimerMutation.mutate(suppression.id, {
                    onSuccess: () => { notify("Catégorie supprimée", "success"); setSuppression(null) },
                    onError: (err) => notify(messageErreurContenu(err), "error"),
                  })
                }
              >
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

const DialogCategorie = ({ categorie, creer, modifier, onFermer }) => {
  const notify = useNotify()
  const edit = !!categorie
  const [valeurs, setValeurs] = useState(() => ({
    code: categorie?.code ?? "",
    label: categorie?.label ?? "",
    sort_order: categorie?.sort_order ?? 100,
    is_active: categorie?.is_active ?? true,
  }))
  const set = (c, v) => setValeurs((p) => ({ ...p, [c]: v }))
  const enregistrer = () => {
    const data = { label: valeurs.label.trim(), sort_order: Number(valeurs.sort_order) || 0, is_active: valeurs.is_active }
    const appel = edit
      ? modifier.mutateAsync({ id: categorie.id, data })
      : creer.mutateAsync({ ...data, code: valeurs.code.trim(), slug: valeurs.code.trim() })
    appel
      .then(() => { notify(edit ? "Catégorie mise à jour" : "Catégorie créée", "success"); onFermer() })
      .catch((err) => notify(messageErreurContenu(err), "error"))
  }
  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? `Modifier « ${categorie.label} »` : "Nouvelle catégorie"}</DialogTitle>
          <DialogDescription>Catégorie d'article (filtres publics).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-code">Code</Label>
            <Input id="cat-code" value={valeurs.code} onChange={(e) => set("code", e.target.value)} disabled={edit} className="font-mono" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-label">Libellé</Label>
            <Input id="cat-label" value={valeurs.label} onChange={(e) => set("label", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-ordre">Ordre d'affichage</Label>
            <Input id="cat-ordre" type="number" min={0} value={valeurs.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={enregistrer} disabled={creer.isPending || modifier.isPending}>
            {creer.isPending || modifier.isPending ? "Enregistrement…" : edit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default OngletCategories
```

## File: src/Pages/Admin/Contenu/sections/OngletConseils.jsx
```javascript
import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CalendarCheck, CalendarDays, CheckCircle2, Lightbulb, Pencil, Plus, Trash2 } from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminDailyTipsQuery, useCreateDailyTip, useUpdateDailyTip,
  useDeleteDailyTip, messageErreurContenu,
} from "@/features/admin-contenu.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet 14.3 — Conseils du jour : CRUD + créneau de rotation + tri.
   MIGRATION 0015 : PLUSIEURS conseils peuvent partager un créneau
   (409 supprimé). Le site public choisit déterministement dans le
   créneau (day_of_year % nb). La table regroupe par jour, le dialog
   montre combien de tips occupent chaque créneau.
   ───────────────────────────────────────────────────────────────────── */
const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]

/* Tri « français » robuste : nombres, textes, dates ISO ; vides en fin. */
const comparerValeurs = (a, b) => {
  const videA = a === null || a === undefined || a === ""
  const videB = b === null || b === undefined || b === ""
  if (videA && videB) return 0
  if (videA) return 1
  if (videB) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" })
}

/* Colonnes triables. */
const COLONNES = [
  { cle: "jour", libelle: "Jour", directionInitiale: "asc", triValeur: (t) => t.rotation_order ?? 0 },
  { cle: "conseil", libelle: "Conseil", directionInitiale: "asc", triValeur: (t) => (t.text ?? "").toLowerCase() },
  { cle: "statut", libelle: "Statut", directionInitiale: "desc", triValeur: (t) => (t.is_active ? 1 : 0) },
]

const LigneSkeletonConseil = () => (
  <TableRow className="hover:bg-transparent">
    <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
    <TableCell><Skeleton className="h-3.5 w-72" /></TableCell>
    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
    <TableCell>
      <div className="flex justify-end gap-1">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
      </div>
    </TableCell>
  </TableRow>
)

const OngletConseils = () => {
  const notify = useNotify()
  const { data: conseils, isLoading, isError, refetch } = useAdminDailyTipsQuery()
  const [edition, setEdition] = useState(null)
  const [suppression, setSuppression] = useState(null)
  /* Tri INITIALISÉ : « Jour » ascendant = ordre de la semaine. */
  const [tri, setTri] = useState({ cle: "jour", direction: "asc" })

  const creerMutation = useCreateDailyTip()
  const modifierMutation = useUpdateDailyTip()
  const supprimerMutation = useDeleteDailyTip()

  // Compte par créneau (affiché en table + dialog) + compteurs onglet.
  const parCreneau = new Map()
  for (const tip of conseils ?? []) {
    parCreneau.set(tip.rotation_order, (parCreneau.get(tip.rotation_order) ?? 0) + 1)
  }
  const nbActifs = (conseils ?? []).filter((t) => t.is_active).length
  const nbJoursOccupes = parCreneau.size

  const conseilsTries = useMemo(() => {
    const base = conseils ?? []
    if (!tri) return [...base].sort((a, b) => a.rotation_order - b.rotation_order)
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [conseils, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun. */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  /* key = fondu léger du corps à chaque changement de tri. */
  const cleCorps = `${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  return (
    <div className="flex flex-col gap-3">
      {/* ─── Compteurs ─── */}
      <div className="grid grid-cols-3 gap-3">
        <CarteCompteur label="Conseils" valeur={conseils?.length ?? 0} icone={Lightbulb} />
        <CarteCompteur label="Actifs" valeur={nbActifs} icone={CheckCircle2} />
        <CarteCompteur
          label="Jours occupés"
          valeur={nbJoursOccupes}
          suffixe="/7"
          icone={CalendarDays}
        />
      </div>

      <SectionCardAdmin
        title="Conseils du jour"
        description="Plusieurs conseils peuvent partager un jour — le site public les fait tourner déterministement. Tri par colonne."
        icon={Lightbulb}
        contentClassName="p-0 sm:p-0"
        action={
          <Button size="sm" onClick={() => setEdition({})}>
            <Plus aria-hidden /> Nouveau conseil
          </Button>
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={isLoading ? "chargement" : isError ? "erreur" : "donnees"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les conseils." />
              </div>
            ) : isLoading ? (
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableBody>
                    {[...Array(5)].map((_, i) => <LigneSkeletonConseil key={i} />)}
                  </TableBody>
                </Table>
              </div>
            ) : !conseils?.length ? (
              <div className="p-4">
                <SectionVide message="Aucun conseil pour le moment." />
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "jour")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "conseil")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "statut")} tri={tri} onTri={basculerTri} />
                      <TableHead className="w-20"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                    {conseilsTries.map((tip) => (
                      <TableRow key={tip.id} className="transition-colors hover:bg-muted/50">
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline">{JOURS[tip.rotation_order] ?? `#${tip.rotation_order}`}</Badge>
                          {(parCreneau.get(tip.rotation_order) ?? 0) > 1 && (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              ({parCreneau.get(tip.rotation_order)} ce jour)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-96">
                          <span className="block truncate text-xs" title={tip.text}>{tip.text}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={tip.is_active ? "secondary" : "outline"}>
                            {tip.is_active ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => setEdition(tip)} aria-label="Modifier le conseil">
                              <Pencil aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setSuppression(tip)}
                              aria-label="Supprimer le conseil"
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </SectionCardAdmin>

      {/* Dialog création / édition */}
      {edition && (
        <DialogConseil
          conseil={edition.id ? edition : null}
          parCreneau={parCreneau}
          creer={creerMutation}
          modifier={modifierMutation}
          onFermer={() => setEdition(null)}
        />
      )}

      {/* Confirmation suppression */}
      {suppression && (
        <Dialog open onOpenChange={(ouvert) => !ouvert && setSuppression(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Supprimer ce conseil {JOURS[suppression.rotation_order] ?? ""} ?
              </DialogTitle>
              <DialogDescription>
                {(parCreneau.get(suppression.rotation_order) ?? 0) > 1
                  ? "D'autres conseils restent sur ce créneau — la rotation continue."
                  : "Le créneau redeviendra vide."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
              <Button
                variant="destructive"
                disabled={supprimerMutation.isPending}
                onClick={() =>
                  supprimerMutation.mutate(suppression.id, {
                    onSuccess: () => { notify("Conseil supprimé", "success"); setSuppression(null) },
                    onError: (err) => notify(messageErreurContenu(err), "error"),
                  })
                }
              >
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

const DialogConseil = ({ conseil, parCreneau, creer, modifier, onFermer }) => {
  const notify = useNotify()
  const edit = !!conseil
  const [valeurs, setValeurs] = useState(() => ({
    text: conseil?.text ?? "",
    rotation_order: String(conseil?.rotation_order ?? ""),
    is_active: conseil?.is_active ?? true,
  }))
  const set = (c, v) => setValeurs((p) => ({ ...p, [c]: v }))
  const nbSurCreneau = valeurs.rotation_order !== "" ? (parCreneau.get(Number(valeurs.rotation_order)) ?? 0) : 0

  const enregistrer = () => {
    const data = {
      text: valeurs.text.trim(),
      rotation_order: Number(valeurs.rotation_order),
      is_active: valeurs.is_active,
    }
    const appel = edit
      ? modifier.mutateAsync({ id: conseil.id, data })
      : creer.mutateAsync(data)
    appel
      .then(() => { notify(edit ? "Conseil mis à jour" : "Conseil créé", "success"); onFermer() })
      .catch((err) => notify(messageErreurContenu(err), "error"))
  }

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? `Modifier le conseil ${JOURS[conseil.rotation_order] ?? ""}` : "Nouveau conseil du jour"}</DialogTitle>
          <DialogDescription>
            Plusieurs conseils par jour autorisés — ils tournent automatiquement sur le site public.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tip-texte">Texte du conseil</Label>
            <Textarea id="tip-texte" value={valeurs.text} onChange={(e) => set("text", e.target.value)} rows={3} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tip-creneau">Jour</Label>
            <Select value={valeurs.rotation_order} onValueChange={(v) => set("rotation_order", v)}>
              <SelectTrigger id="tip-creneau" className="w-full">
                <SelectValue placeholder="Choisir un jour…" />
              </SelectTrigger>
              <SelectContent>
                {JOURS.map((jour, i) => {
                  const nb = parCreneau.get(i) ?? 0
                  return (
                    <SelectItem key={i} value={String(i)}>
                      {jour}{nb > 0 ? ` (${nb} conseil${nb > 1 ? "s" : ""})` : ""}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {!edit && nbSurCreneau > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {nbSurCreneau} conseil{nbSurCreneau > 1 ? "s" : ""} occupe{nbSurCreneau > 1 ? "nt" : ""} déjà ce jour —
                ils tourneront automatiquement.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tip-actif">Actif</Label>
            <Select value={valeurs.is_active ? "1" : "0"} onValueChange={(v) => set("is_active", v === "1")}>
              <SelectTrigger id="tip-actif" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Oui — affiché</SelectItem>
                <SelectItem value="0">Non — masqué</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={enregistrer} disabled={creer.isPending || modifier.isPending || !valeurs.text.trim() || valeurs.rotation_order === ""}>
            {creer.isPending || modifier.isPending ? "Enregistrement…" : edit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default OngletConseils
```

## File: src/Pages/Admin/Contenu/sections/OngletPages.jsx
```javascript
import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, FileEdit, FileText, Globe, Pencil, Plus, Trash2 } from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminPagesQuery, useCreatePage, useUpdatePage,
  useChangerStatutPage, useDeletePage, messageErreurContenu,
} from "@/features/admin-contenu.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet 14.4 — Pages statiques : CRUD + tri par colonne.
   Routes créées/typées au cycle 14 (ContentPageCreate/Update + PATCH
   status) : création en draft, publication avec published_at FIGÉ à la
   première (même règle que les articles), slug/type immuables après
   création.
   ───────────────────────────────────────────────────────────────────── */
const VARIANTE_STATUT = { draft: "outline", published: "secondary", archived: "outline" }
const LIBELLE_STATUT = { draft: "Brouillon", published: "Publiée", archived: "Archivée" }
const LIBELLE_TYPE = { legal_page: "Légale", static_page: "Statique" }
const RANG_STATUT = { draft: 1, published: 2, archived: 3 }

const TYPES_PAGE = [
  { valeur: "legal_page", libelle: "Page légale (mentions, confidentialité…)" },
  { valeur: "static_page", libelle: "Page statique" },
]

/* Tri « français » robuste : nombres, textes, dates ISO ; vides en fin. */
const comparerValeurs = (a, b) => {
  const videA = a === null || a === undefined || a === ""
  const videB = b === null || b === undefined || b === ""
  if (videA && videB) return 0
  if (videA) return 1
  if (videB) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" })
}

/* Colonnes triables. */
const COLONNES = [
  { cle: "titre", libelle: "Page", directionInitiale: "asc", triValeur: (p) => (p.title ?? "").toLowerCase() },
  {
    cle: "type", libelle: "Type", directionInitiale: "asc",
    className: "hidden md:table-cell",
    triValeur: (p) => LIBELLE_TYPE[p.content_type] ?? p.content_type ?? "",
  },
  { cle: "statut", libelle: "Statut", directionInitiale: "asc", triValeur: (p) => RANG_STATUT[p.status] ?? 0 },
]

const LigneSkeletonPage = () => (
  <TableRow className="hover:bg-transparent">
    <TableCell>
      <div className="flex flex-col gap-1.5 py-0.5">
        <Skeleton className="h-3.5 w-44" />
        <Skeleton className="h-2.5 w-24" />
      </div>
    </TableCell>
    <TableCell className="hidden md:table-cell"><Skeleton className="h-3 w-16" /></TableCell>
    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
    <TableCell>
      <div className="flex justify-end gap-1">
        <Skeleton className="h-7 w-20 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
      </div>
    </TableCell>
  </TableRow>
)

const OngletPages = () => {
  const notify = useNotify()
  const { data: pages, isLoading, isError, refetch } = useAdminPagesQuery()
  const [edition, setEdition] = useState(null)
  const [suppression, setSuppression] = useState(null)
  /* Tri INITIALISÉ : « Page » ascendante (alphabétique). */
  const [tri, setTri] = useState({ cle: "titre", direction: "asc" })

  const creerMutation = useCreatePage()
  const modifierMutation = useUpdatePage()
  const statutMutation = useChangerStatutPage()
  const supprimerMutation = useDeletePage()

  // Compteurs — liste complète par nature.
  const nbPubliees = (pages ?? []).filter((p) => p.status === "published").length
  const nbBrouillons = (pages ?? []).filter((p) => p.status === "draft").length

  const pagesTriees = useMemo(() => {
    const base = pages ?? []
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [pages, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  const changerStatut = (page, status) =>
    statutMutation.mutate(
      { id: page.id, status },
      {
        onSuccess: () => notify(`Page ${status === "published" ? "publiée" : status === "draft" ? "dépubliée" : "archivée"}`, "success"),
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )

  /* key = fondu léger du corps à chaque changement de tri. */
  const cleCorps = `${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  return (
    <div className="flex flex-col gap-3">
      {/* ─── Compteurs ─── */}
      <div className="grid grid-cols-3 gap-3">
        <CarteCompteur label="Pages" valeur={pages?.length ?? 0} icone={FileText} chargement={isLoading} />
        <CarteCompteur label="Publiées" valeur={nbPubliees} icone={CheckCircle2} chargement={isLoading} />
        <CarteCompteur label="Brouillons" valeur={nbBrouillons} icone={FileEdit} chargement={isLoading} />
      </div>

      <SectionCardAdmin
        title="Pages statiques"
        description="Mentions légales, politique de confidentialité et pages institutionnelles. Tri par colonne."
        icon={Globe}
        contentClassName="p-0 sm:p-0"
        action={
          <Button size="sm" onClick={() => setEdition({})}>
            <Plus aria-hidden /> Nouvelle page
          </Button>
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={isLoading ? "chargement" : isError ? "erreur" : "donnees"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les pages." />
              </div>
            ) : isLoading ? (
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableBody>
                    {[...Array(3)].map((_, i) => <LigneSkeletonPage key={i} />)}
                  </TableBody>
                </Table>
              </div>
            ) : !pages?.length ? (
              <div className="p-4">
                <SectionVide message="Aucune page statique — créez les mentions légales et la politique de confidentialité." />
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "titre")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "type")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "statut")} tri={tri} onTri={basculerTri} />
                      <TableHead className="w-28"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                    {pagesTriees.map((page) => (
                      <TableRow key={page.id} className="transition-colors hover:bg-muted/50">
                        <TableCell>
                          <span className="flex items-center gap-2 text-sm font-medium">
                            <FileText className="size-3.5 text-muted-foreground" aria-hidden />
                            {page.title}
                          </span>
                          <span className="block truncate font-mono text-[10px] text-muted-foreground">/{page.slug}</span>
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                          {LIBELLE_TYPE[page.content_type] ?? page.content_type}
                        </TableCell>
                        <TableCell>
                          <Badge variant={VARIANTE_STATUT[page.status] ?? "outline"}>
                            {LIBELLE_STATUT[page.status] ?? page.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => changerStatut(page, page.status === "published" ? "draft" : "published")}
                              disabled={statutMutation.isPending}
                              aria-label={page.status === "published" ? "Dépublier" : "Publier"}
                            >
                              {page.status === "published" ? "Dépublier" : "Publier"}
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => setEdition(page)} aria-label={`Modifier ${page.title}`}>
                              <Pencil aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setSuppression(page)}
                              aria-label={`Supprimer ${page.title}`}
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </SectionCardAdmin>

      {/* Dialog création / édition */}
      {edition && (
        <DialogPage
          page={edition.id ? edition : null}
          creer={creerMutation}
          modifier={modifierMutation}
          onFermer={() => setEdition(null)}
        />
      )}

      {/* Confirmation suppression */}
      {suppression && (
        <Dialog open onOpenChange={(ouvert) => !ouvert && setSuppression(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Supprimer « {suppression.title} » ?</DialogTitle>
              <DialogDescription>
                Une page légale supprimée rend son URL publique morte (404). Action irréversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
              <Button
                variant="destructive"
                disabled={supprimerMutation.isPending}
                onClick={() =>
                  supprimerMutation.mutate(suppression.id, {
                    onSuccess: () => { notify("Page supprimée", "success"); setSuppression(null) },
                    onError: (err) => notify(messageErreurContenu(err), "error"),
                  })
                }
              >
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

/* ─── Dialog page (body = JSON structuré — le site public le rend tel quel) ─── */
const DialogPage = ({ page, creer, modifier, onFermer }) => {
  const notify = useNotify()
  const edit = !!page
  const [valeurs, setValeurs] = useState(() => ({
    content_type: page?.content_type === "legal_page" ? "legal_page" : "static_page",
    slug: page?.slug ?? "",
    title: page?.title ?? "",
    excerpt: page?.excerpt ?? "",
    bodyJson: page?.body ? JSON.stringify(page.body, null, 2) : "",
    seo_title: page?.seo_title ?? "",
    seo_description: page?.seo_description ?? "",
  }))
  const set = (c, v) => setValeurs((p) => ({ ...p, [c]: v }))

  const enregistrer = () => {
    let body = null
    if (valeurs.bodyJson.trim()) {
      try {
        body = JSON.parse(valeurs.bodyJson)
      } catch {
        notify("Le corps n'est pas un JSON valide — corrigez la syntaxe.", "error")
        return
      }
    }
    const data = {
      title: valeurs.title.trim(),
      excerpt: valeurs.excerpt.trim() || null,
      body,
      seo_title: valeurs.seo_title.trim() || null,
      seo_description: valeurs.seo_description.trim() || null,
    }
    const appel = edit
      ? modifier.mutateAsync({ id: page.id, data })
      : creer.mutateAsync({
          ...data,
          content_type: valeurs.content_type,
          slug: valeurs.slug.trim(),
        })
    appel
      .then(() => { notify(edit ? "Page mise à jour" : "Page créée en brouillon", "success"); onFermer() })
      .catch((err) => notify(messageErreurContenu(err), "error"))
  }

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{edit ? `Modifier « ${page.title} »` : "Nouvelle page statique"}</DialogTitle>
          <DialogDescription>
            {edit
              ? "Slug et type immuables. Publication via le bouton de la liste."
              : "Créée en brouillon — publiez-la ensuite depuis la liste."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {!edit && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="page-type">Type de page</Label>
                <Select value={valeurs.content_type} onValueChange={(v) => set("content_type", v)}>
                  <SelectTrigger id="page-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES_PAGE.map((t) => (
                      <SelectItem key={t.valeur} value={t.valeur}>{t.libelle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="page-slug">Slug</Label>
                <Input id="page-slug" value={valeurs.slug} onChange={(e) => set("slug", e.target.value)} className="font-mono" placeholder="mentions-legales" />
              </div>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page-titre">Titre</Label>
            <Input id="page-titre" value={valeurs.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page-extrait">Extrait</Label>
            <Input id="page-extrait" value={valeurs.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page-body">Corps (JSON structuré)</Label>
            <Textarea
              id="page-body"
              value={valeurs.bodyJson}
              onChange={(e) => set("bodyJson", e.target.value)}
              rows={8}
              className="font-mono text-[11px]"
              placeholder={'{\n  "paragraphs": ["Premier paragraphe…"]\n}'}
              aria-describedby="page-body-aide"
            />
            <p id="page-body-aide" className="text-[10px] text-muted-foreground">
              JSON libre (paragraphes, sections… selon le rendu attendu par le site public).
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="page-seo-titre">Titre SEO</Label>
              <Input id="page-seo-titre" value={valeurs.seo_title} onChange={(e) => set("seo_title", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="page-seo-desc">Description SEO</Label>
              <Input id="page-seo-desc" value={valeurs.seo_description} onChange={(e) => set("seo_description", e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={enregistrer} disabled={creer.isPending || modifier.isPending}>
            {creer.isPending || modifier.isPending ? "Enregistrement…" : edit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default OngletPages
```

## File: src/Pages/Admin/Contenu/sections/OngletSeries.jsx
```javascript
import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, FileText, Layers, ListOrdered, Pencil, Plus, Trash2 } from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminSeriesQuery, useAdminArticlesQuery, useCreateSeries,
  useUpdateSeries, useDeleteSeries, useUpdateSeriesArticles, messageErreurContenu,
} from "@/features/admin-contenu.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet 14.2b — Séries : CRUD + composition + tri par colonne.
   ⚠️ PUT /series/{id}/articles REMPLACE intégralement la composition
   (même logique que les mots-clés de filière) : on envoie toujours la
   liste COMPLÈTE des IDs d'articles, jamais un delta.
   ⚠️ L'API série ne renvoie PAS sa composition actuelle : la
   composition part d'une sélection vide à chaque ouverture — le dialog
   prévient explicitement avant de remplacer.
   ───────────────────────────────────────────────────────────────────── */

/* Tri « français » robuste : nombres, textes, dates ISO ; vides en fin. */
const comparerValeurs = (a, b) => {
  const videA = a === null || a === undefined || a === ""
  const videB = b === null || b === undefined || b === ""
  if (videA && videB) return 0
  if (videA) return 1
  if (videB) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" })
}

/* Colonnes triables — « Description » (texte long) et les actions
   restent des en-têtes simples. */
const COLONNES = [
  { cle: "titre", libelle: "Série", directionInitiale: "asc", triValeur: (s) => (s.title ?? "").toLowerCase() },
  { cle: "ordre", libelle: "Ordre", directionInitiale: "asc", className: "text-right", triValeur: (s) => s.sort_order ?? 0 },
  { cle: "statut", libelle: "Statut", directionInitiale: "desc", triValeur: (s) => (s.is_active ? 1 : 0) },
]

const LigneSkeletonSerie = () => (
  <TableRow className="hover:bg-transparent">
    <TableCell><Skeleton className="h-3.5 w-44" /></TableCell>
    <TableCell className="hidden md:table-cell"><Skeleton className="h-3 w-56" /></TableCell>
    <TableCell className="text-right"><Skeleton className="ml-auto h-3.5 w-8" /></TableCell>
    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
    <TableCell>
      <div className="flex justify-end gap-1">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
      </div>
    </TableCell>
  </TableRow>
)

const OngletSeries = () => {
  const notify = useNotify()
  const { data: series, isLoading, isError, refetch } = useAdminSeriesQuery()
  const { data: articles } = useAdminArticlesQuery({ limit: 100 })
  const [edition, setEdition] = useState(null)
  const [composition, setComposition] = useState(null)   // série dont on édite la composition
  const [suppression, setSuppression] = useState(null)
  /* Tri INITIALISÉ : « Ordre » ascendant = ordre serveur d'affichage. */
  const [tri, setTri] = useState({ cle: "ordre", direction: "asc" })

  const creerMutation = useCreateSeries()
  const modifierMutation = useUpdateSeries()
  const supprimerMutation = useDeleteSeries()
  const nbActives = (series ?? []).filter((s) => s.is_active).length

  const seriesTriees = useMemo(() => {
    const base = series ?? []
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [series, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  /* key = fondu léger du corps à chaque changement de tri. */
  const cleCorps = `${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  return (
    <div className="flex flex-col gap-3">
      {/* ─── Compteurs — le nombre d'articles DANS les séries n'est pas
          exposé par l'API : on affiche le total d'articles disponibles
          pour composition, honnête. ─── */}
      <div className="grid grid-cols-3 gap-3">
        <CarteCompteur label="Séries" valeur={series?.length ?? 0} icone={Layers} chargement={isLoading} />
        <CarteCompteur label="Actives" valeur={nbActives} icone={CheckCircle2} chargement={isLoading} />
        <CarteCompteur label="Articles disponibles" valeur={articles?.length ?? 0} icone={FileText} chargement={isLoading} />
      </div>

      <SectionCardAdmin
        title="Séries"
        description="Séries éditoriales — collections d'articles (guides, dossiers…). Tri par colonne."
        icon={Layers}
        contentClassName="p-0 sm:p-0"
        action={
          <Button size="sm" onClick={() => setEdition({})}>
            <Plus aria-hidden /> Nouvelle série
          </Button>
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={isLoading ? "chargement" : isError ? "erreur" : "donnees"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les séries." />
              </div>
            ) : isLoading ? (
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableBody>
                    {[...Array(3)].map((_, i) => <LigneSkeletonSerie key={i} />)}
                  </TableBody>
                </Table>
              </div>
            ) : !series?.length ? (
              <div className="p-4">
                <SectionVide message="Aucune série pour le moment." />
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "titre")} tri={tri} onTri={basculerTri} />
                      <TableHead className="hidden md:table-cell">Description</TableHead>
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "ordre")} tri={tri} onTri={basculerTri} aligneDroite />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "statut")} tri={tri} onTri={basculerTri} />
                      <TableHead className="w-28"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                    {seriesTriees.map((s) => (
                      <TableRow key={s.id} className="transition-colors hover:bg-muted/50">
                        <TableCell className="text-sm font-medium">{s.title}</TableCell>
                        <TableCell className="hidden max-w-64 truncate text-xs text-muted-foreground md:table-cell" title={s.description ?? ""}>
                          {s.description ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{s.sort_order}</TableCell>
                        <TableCell>
                          <Badge variant={s.is_active ? "secondary" : "outline"}>
                            {s.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => setComposition(s)} aria-label={`Composition de ${s.title}`} title="Composer la série">
                              <ListOrdered aria-hidden />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => setEdition(s)} aria-label={`Modifier ${s.title}`}>
                              <Pencil aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setSuppression(s)}
                              aria-label={`Supprimer ${s.title}`}
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </SectionCardAdmin>

      {/* Dialog CRUD */}
      {edition && (
        <DialogSerie
          serie={edition.id ? edition : null}
          creer={creerMutation}
          modifier={modifierMutation}
          onFermer={() => setEdition(null)}
        />
      )}

      {/* Dialog composition */}
      {composition && (
        <DialogComposition serie={composition} onFermer={() => setComposition(null)} />
      )}

      {/* Confirmation suppression */}
      {suppression && (
        <Dialog open onOpenChange={(ouvert) => !ouvert && setSuppression(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Supprimer « {suppression.title} » ?</DialogTitle>
              <DialogDescription>
                La composition sera supprimée ; les articles eux-mêmes restent intacts.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
              <Button
                variant="destructive"
                disabled={supprimerMutation.isPending}
                onClick={() =>
                  supprimerMutation.mutate(suppression.id, {
                    onSuccess: () => { notify("Série supprimée", "success"); setSuppression(null) },
                    onError: (err) => notify(messageErreurContenu(err), "error"),
                  })
                }
              >
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

/* ─── CRUD série ─── */
const DialogSerie = ({ serie, creer, modifier, onFermer }) => {
  const notify = useNotify()
  const edit = !!serie
  const [valeurs, setValeurs] = useState(() => ({
    title: serie?.title ?? "",
    slug: serie?.slug ?? "",
    description: serie?.description ?? "",
    sort_order: serie?.sort_order ?? 100,
    is_active: serie?.is_active ?? true,
  }))
  const set = (c, v) => setValeurs((p) => ({ ...p, [c]: v }))
  const enregistrer = () => {
    const data = {
      title: valeurs.title.trim(),
      description: valeurs.description.trim() || null,
      sort_order: Number(valeurs.sort_order) || 0,
      is_active: valeurs.is_active,
    }
    const appel = edit
      ? modifier.mutateAsync({ id: serie.id, data })
      : creer.mutateAsync({ ...data, slug: valeurs.slug.trim() })
    appel
      .then(() => { notify(edit ? "Série mise à jour" : "Série créée", "success"); onFermer() })
      .catch((err) => notify(messageErreurContenu(err), "error"))
  }
  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? `Modifier « ${serie.title} »` : "Nouvelle série"}</DialogTitle>
          <DialogDescription>Collection d'articles affichée publiquement.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serie-titre">Titre</Label>
            <Input id="serie-titre" value={valeurs.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serie-slug">Slug</Label>
            <Input id="serie-slug" value={valeurs.slug} onChange={(e) => set("slug", e.target.value)} disabled={edit} className="font-mono" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serie-desc">Description</Label>
            <Textarea id="serie-desc" value={valeurs.description} onChange={(e) => set("description", e.target.value)} rows={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serie-ordre">Ordre d'affichage</Label>
            <Input id="serie-ordre" type="number" min={0} value={valeurs.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={enregistrer} disabled={creer.isPending || modifier.isPending}>
            {creer.isPending || modifier.isPending ? "Enregistrement…" : edit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Composition (remplacement total) ─── */
const DialogComposition = ({ serie, onFermer }) => {
  const notify = useNotify()
  const { data: articles } = useAdminArticlesQuery({ limit: 100 })
  const [selection, setSelection] = useState(() => new Set())
  const [confirmee, setConfirmee] = useState(false)
  const mutation = useUpdateSeriesArticles()

  const basculer = (id) =>
    setSelection((prec) => {
      const suivant = new Set(prec)
      suivant.has(id) ? suivant.delete(id) : suivant.add(id)
      return suivant
    })

  const monter = (id) =>
    setSelection((prec) => {
      const ordre = [...prec]
      const i = ordre.indexOf(id)
      if (i > 0) { [ordre[i - 1], ordre[i]] = [ordre[i], ordre[i - 1]] }
      return new Set(ordre)
    })

  const descendre = (id) =>
    setSelection((prec) => {
      const ordre = [...prec]
      const i = ordre.indexOf(id)
      if (i < ordre.length - 1 && i >= 0) { [ordre[i + 1], ordre[i]] = [ordre[i], ordre[i + 1]] }
      return new Set(ordre)
    })

  const enregistrer = () => {
    mutation.mutate(
      { id: serie.id, articleIds: [...selection] },
      {
        onSuccess: () => {
          notify("Composition enregistrée (remplacée intégralement)", "success")
          onFermer()
        },
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )
  }

  const articlesSelectionnes = [...selection]
    .map((id) => (articles ?? []).find((a) => a.id === id))
    .filter(Boolean)

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Composer « {serie.title} »</DialogTitle>
          <DialogDescription>
            ⚠️ La sauvegarde REMPLACE intégralement la composition de la série
            (l'API ne renvoie pas la composition actuelle — la sélection repart de zéro).
          </DialogDescription>
        </DialogHeader>
        {/* Sélection actuelle, ordonnée */}
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <p className="text-xs font-semibold">Composition ({selection.size})</p>
          {!articlesSelectionnes.length && (
            <p className="text-[10px] text-muted-foreground">Aucun article sélectionné — la série sera vidée.</p>
          )}
          {articlesSelectionnes.map((a, i) => (
            <div key={a.id} className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="font-mono">{i + 1}</Badge>
              <span className="min-w-0 flex-1 truncate">{a.title ?? a.slug}</span>
              <Button variant="ghost" size="icon-sm" onClick={() => monter(a.id)} disabled={i === 0} aria-label="Monter">
                ↑
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => descendre(a.id)} disabled={i === articlesSelectionnes.length - 1} aria-label="Descendre">
                ↓
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => basculer(a.id)} aria-label="Retirer">
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            </div>
          ))}
        </div>
        {/* Choix des articles (tous statuts) */}
        <div className="flex flex-col gap-1.5">
          <Label>Ajouter un article</Label>
          <Select value="" onValueChange={(id) => !selection.has(id) && basculer(id)}>
            <SelectTrigger className="w-full" aria-label="Ajouter un article à la série">
              <SelectValue placeholder="Choisir un article…" />
            </SelectTrigger>
            <SelectContent>
              {(articles ?? [])
                .filter((a) => !selection.has(a.id))
                .map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.title ?? a.slug}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          {!confirmee ? (
            <Button onClick={() => setConfirmee(true)}>Enregistrer la composition</Button>
          ) : (
            <Button variant="destructive" onClick={enregistrer} disabled={mutation.isPending}>
              {mutation.isPending ? "Enregistrement…" : `Confirmer le remplacement (${selection.size})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default OngletSeries
```

## File: src/Pages/Admin/Contenu/index.jsx
```javascript
import { motion, AnimatePresence } from "framer-motion"
import { FileText, FolderTree, Globe, Layers, Lightbulb, Newspaper } from "lucide-react"
import { ErrorBoundary } from "react-error-boundary"
import { cn } from "cn"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import { useFiltresContenuAdmin, FiltresContenuAdminProvider } from "@/contexts/FiltresContenuAdmin.context"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import OngletArticles from "./sections/OngletArticles"
import OngletCategories from "./sections/OngletCategories"
import OngletSeries from "./sections/OngletSeries"
import OngletConseils from "./sections/OngletConseils"
import OngletPages from "./sections/OngletPages"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"
import HeroAdmin from "@/components/admin/HeroAdmin"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion du contenu — /admin/contenu (super_admin + moderateur,
   doc v3 §14).
   Refonte complète — même gestion d'onglets que la page IA :
   • Onglet actif synchronisé en URL via FiltresContenuAdminProvider
     (deep-link / rechargement conservé).
   • Barre d'onglets horizontale défilante (scrollbar masquée),
     onglet actif sur fond orange + texte navy (contraste AA).
   • Fondu enchaîné entre onglets (AnimatePresence mode="wait") +
     cascade des sections internes (VARIANTS_PANNEAU).
   • Un icône distinct par onglet (avant : 5 fois Newspaper).
   5 onglets (chacun porte son ErrorBoundary — un onglet qui plante
   n'emporte pas la page) :
   1. Articles     — liste filtrable + TRI + éditeur complet ;
   2. Catégories   — CRUD + tri ;
   3. Séries       — CRUD + composition + tri ;
   4. Conseils     — CRUD + créneau de rotation + tri ;
   5. Pages        — CRUD + tri.
   L'onglet FAQ n'existe pas (aucune route admin — doc v3 §14.5).
   ───────────────────────────────────────────────────────────────────── */
const ONGLETS = [
  { valeur: "articles", libelle: "Articles", Icone: FileText },
  { valeur: "categories", libelle: "Catégories", Icone: FolderTree },
  { valeur: "series", libelle: "Séries", Icone: Layers },
  { valeur: "conseils", libelle: "Conseils du jour", Icone: Lightbulb },
  { valeur: "pages", libelle: "Pages statiques", Icone: Globe },
]

const VARIANTS_PANNEAU = {
  cache: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.07, delayChildren: 0.05 },
  },
}

const ContenuAdmin = () => {
  const { onglet, setOnglet } = useFiltresContenuAdmin()
  const ongletActif = ONGLETS.find((o) => o.valeur === onglet)

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* ─── En-tête ─── */}
      <Bloc>
        <HeroAdmin
          title="Gestion du contenu"
          titleBdge="Contenu & sécurité"
          icon={Newspaper}
          description="Articles, catégories, séries, conseils du jour et pages statiques du site public."
        />
      </Bloc>

      {/* ─── Onglets (synchronisés URL, pattern page IA) ─── */}
      <Tabs value={onglet} onValueChange={setOnglet} className="mt-1 w-full">
        <TabsList
          className={cn(
            "flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border border-border bg-muted/20 p-1",
            "scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          )}
        >
          {ONGLETS.map(({ valeur, libelle, Icone }) => (
            <TabsTrigger
              key={valeur}
              value={valeur}
              className={cn(
                "gap-1.5 whitespace-nowrap rounded-md px-4 py-2 text-xs font-semibold transition-colors",
                onglet === valeur
                  ? "bg-brand-orange text-brand-navy shadow-soft" /* navy sur orange : 6.3:1 AA */
                  : "text-muted-foreground hover:bg-card hover:text-foreground"
              )}
            >
              <Icone className="size-3.5" aria-hidden="true" />
              {libelle}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ─── Fondu enchaîné entre onglets + cascade des sections ─── */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={onglet}
            role="tabpanel"
            aria-label={ongletActif?.libelle}
            variants={VARIANTS_PANNEAU}
            initial="cache"
            animate="visible"
            exit="cache"
            className="mt-4"
          >
            <Bloc>
              <ErrorBoundary FallbackComponent={AdminSectionFallback}>
                {onglet === "articles" && <OngletArticles />}
                {onglet === "categories" && <OngletCategories />}
                {onglet === "series" && <OngletSeries />}
                {onglet === "conseils" && <OngletConseils />}
                {onglet === "pages" && <OngletPages />}
              </ErrorBoundary>
            </Bloc>
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </motion.div>
  )
}

const PageContenu = () => (
  <FiltresContenuAdminProvider>
    <ContenuAdmin />
  </FiltresContenuAdminProvider>
)

export default PageContenu
```
