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