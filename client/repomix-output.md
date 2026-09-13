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
import { useMemo, useState } from "react"
import {
  ChevronUp, ChevronDown, Plus, Trash2, X, Save, ListOrdered, Quote, Hash, FileText,
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import { SectionErreur, SectionVide } from "./EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Éditeur d'article complet (doc v3 §14.1) — Sheet plein écran.

   Panneaux :
   1. Métadonnées — titre, slug, extrait, catégorie, lecture, SEO,
      citation, tags, à la une (PUT /articles/{id}) ;
   2. Sections structurées — ajout/édition/suppression + blocs de
      contenu (texte | quote | image) + réordonnancement par FLÈCHES
      (PUT /sections/reorder : liste complète d'IDs, astuce positions
      négatives côté serveur — transparent ici) ;
   3. Points clés (takeaways) + chiffres clés (key-figures) — routes
      créées cycle 14 : ajout fin de liste ou à position, suppression,
      recompactage serveur.

   Sauvegarde des métadonnées EXPLICITE (bouton) ; sections/blocs/
   takeaways/key-figures = mutations immédiates (une action = un appel,
   l'article revient à jour via invalidation).
   ⚠️ Un nouvel article doit d'abord être créé via le formulaire de
   création minimal (title/slug requis serveur) — ce Sheet édite un
   article EXISTANT ; le cas création affiche le formulaire minimal
   puis bascule en édition complète.
   ───────────────────────────────────────────────────────────────────── */

const TYPES_BLOC = [
  { valeur: "text", libelle: "Texte" },
  { valeur: "quote", libelle: "Citation" },
  { valeur: "image", libelle: "Image (URL)" },
]

const LibelleTypeBloc = { text: "Texte", quote: "Citation", image: "Image" }

const EditeurArticle = ({ articleId, onFermer }) => {
  if (!articleId) {
    return <FormulaireCreation onFermer={onFermer} />
  }
  return <EditeurExistant key={articleId} articleId={articleId} onFermer={onFermer} />
}

/* ─── Création minimale (title + slug requis serveur) ─── */

const FormulaireCreation = ({ onFermer }) => {
  const notify = useNotify()
  const [titre, setTitre] = useState("")
  const [slug, setSlug] = useState("")
  const creerMutation = useCreateArticle()

  const creer = () => {
    if (!titre.trim() || !slug.trim()) {
      notify("Titre et slug sont requis pour créer l'article.", "error")
      return
    }
    creerMutation.mutate(
      { title: titre.trim(), slug: slug.trim() },
      {
        onSuccess: () => {
          notify("Article créé en brouillon — ouvrez-le depuis la liste pour l'éditer", "success")
          onFermer()
        },
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )
  }

  return (
    <Sheet open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Nouvel article</SheetTitle>
          <SheetDescription>
            Création minimale (brouillon) — l'éditeur complet s'ouvre ensuite depuis la liste.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="art-titre">Titre</Label>
            <Input id="art-titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="art-slug">Slug</Label>
            <Input id="art-slug" value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono" placeholder="mon-article" />
          </div>
          <Button onClick={creer} disabled={creerMutation.isPending}>
            {creerMutation.isPending ? "Création…" : "Créer le brouillon"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* ─── Éditeur complet (article existant) ─── */

const EditeurExistant = ({ articleId, onFermer }) => {
  const { data: article, isLoading, isError, refetch } = useAdminArticleQuery(articleId)

  return (
    <Sheet open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" aria-hidden />
            {article?.title ?? "Éditeur"}
          </SheetTitle>
          <SheetDescription>
            Métadonnées, sections structurées, points clés et chiffres clés.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-8">
          {isError ? (
            <SectionErreur onRetry={refetch} message="Impossible de charger l'article." />
          ) : isLoading || !article ? (
            <div className="flex flex-col gap-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : (
            <FormulaireArticle key={`${article.id}-${article.updated_at ?? ""}`} article={article} articleId={articleId} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* Sous-composant : article CHARGÉ → le useState s'initialise une fois
   au montage (pattern cycle 4, jamais de setState-in-render ; la clé
   {id}-{updated_at} force le remontage si l'article est re-sérialisé). */
const FormulaireArticle = ({ article, articleId }) => {
  const notify = useNotify()
  const { data: categories } = useAdminCategoriesQuery()

  const [meta, setMeta] = useState(() => ({
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
    featured_order: article.featured_order ?? "",
  }))

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

  const sections = useMemo(() => [...(article?.sections ?? [])].sort((a, b) => a.position - b.position), [article])

  const setChamp = (champ, valeur) => setMeta((m) => ({ ...m, [champ]: valeur }))

  const enregistrerMeta = () => {
    metaMutation.mutate(
      {
        id: articleId,
        data: {
          title: meta.title.trim(),
          slug: meta.slug.trim(),
          excerpt: meta.excerpt.trim() || null,
          category_id: meta.category_id || null,
          reading_minutes: Number(meta.reading_minutes) || 5,
          seo_title: meta.seo_title.trim() || null,
          seo_description: meta.seo_description.trim() || null,
          quote_text: meta.quote_text.trim() || null,
          quote_author: meta.quote_author.trim() || null,
          tags: meta.tags ? meta.tags.split(",").map((t) => t.trim()).filter(Boolean) : null,
          is_featured: meta.is_featured,
          featured_order: meta.is_featured ? Number(meta.featured_order) || undefined : null,
        },
      },
      {
        onSuccess: () => notify("Métadonnées enregistrées", "success"),
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )
  }

  const deplacerSection = (index) => {
    const ids = sections.map((s) => s.id)
    const cible = index - 1
    ;[ids[index], ids[cible]] = [ids[cible], ids[index]]
    reorderMutation.mutate(
      { articleId, sectionIds: ids },
      { onError: (err) => notify(messageErreurContenu(err), "error") }
    )
  }

  const ajouterSection = () => {
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
  }

  const modifierSection = (sectionId, champ, valeur) =>
    sectionMutation.mutate(
      { id: sectionId, data: { [champ]: valeur } },
      { onError: (err) => notify(messageErreurContenu(err), "error") }
    )

  const ajouterBloc = (sectionId) => {
    ajouterBlocMutation.mutate(
      { sectionId, data: { position: 999, block_type: "text", content: "Nouveau bloc — cliquez pour éditer." } },
      {
        onSuccess: () => notify("Bloc ajouté", "success"),
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )
  }

  return (
    <>
      {/* ── 1. Métadonnées ── */}
      <section aria-label="Métadonnées" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Métadonnées</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="ed-titre">Titre</Label>
                    <Input id="ed-titre" value={meta.title} onChange={(e) => setChamp("title", e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ed-slug">Slug</Label>
                    <Input id="ed-slug" value={meta.slug} onChange={(e) => setChamp("slug", e.target.value)} className="font-mono" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ed-categorie">Catégorie</Label>
                    <Select value={meta.category_id} onValueChange={(v) => setChamp("category_id", v)}>
                      <SelectTrigger id="ed-categorie" className="w-full">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Aucune</SelectItem>
                        {(categories ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="ed-extrait">Extrait</Label>
                    <Textarea id="ed-extrait" value={meta.excerpt} onChange={(e) => setChamp("excerpt", e.target.value)} rows={2} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ed-lecture">Lecture (min)</Label>
                    <Input id="ed-lecture" type="number" min={1} value={meta.reading_minutes} onChange={(e) => setChamp("reading_minutes", e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ed-une">À la une</Label>
                    <Select value={meta.is_featured ? "1" : "0"} onValueChange={(v) => setChamp("is_featured", v === "1")}>
                      <SelectTrigger id="ed-une" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Oui</SelectItem>
                        <SelectItem value="0">Non</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {meta.is_featured && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ed-une-ordre">Ordre à la une</Label>
                      <Input id="ed-une-ordre" type="number" min={1} value={meta.featured_order} onChange={(e) => setChamp("featured_order", e.target.value)} />
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ed-seo-titre">Titre SEO</Label>
                    <Input id="ed-seo-titre" value={meta.seo_title} onChange={(e) => setChamp("seo_title", e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ed-seo-desc">Description SEO</Label>
                    <Input id="ed-seo-desc" value={meta.seo_description} onChange={(e) => setChamp("seo_description", e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ed-citation">Citation</Label>
                    <Input id="ed-citation" value={meta.quote_text} onChange={(e) => setChamp("quote_text", e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ed-citation-auteur">Auteur citation</Label>
                    <Input id="ed-citation-auteur" value={meta.quote_author} onChange={(e) => setChamp("quote_author", e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="ed-tags">Tags (séparés par des virgules)</Label>
                    <Input id="ed-tags" value={meta.tags} onChange={(e) => setChamp("tags", e.target.value)} placeholder="cv, entretien, carrière" />
                  </div>
                </div>
                <Button size="sm" onClick={enregistrerMeta} disabled={metaMutation.isPending} className="w-fit">
                  <Save aria-hidden /> {metaMutation.isPending ? "Enregistrement…" : "Enregistrer les métadonnées"}
                </Button>
              </section>

              {/* ── 2. Sections ── */}
              <section aria-label="Sections de l'article" className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    <ListOrdered className="size-4" aria-hidden /> Sections ({sections.length})
                  </h3>
                  <Button variant="outline" size="sm" onClick={ajouterSection} disabled={ajouterSectionMutation.isPending}>
                    <Plus aria-hidden /> Section
                  </Button>
                </div>

                {!sections.length ? (
                  <SectionVide message="Aucune section — l'article public n'affichera que l'extrait." />
                ) : (
                  <div className="flex flex-col gap-3">
                    {sections.map((section, i) => (
                      <CarteSection
                        key={section.id}
                        section={section}
                        premier={i === 0}
                        dernier={i === sections.length - 1}
                        onMonter={() => deplacerSection(i)}
                        onDescendre={() => deplacerSection(i + 1)}
                        onModifier={modifierSection}
                        onSupprimer={() =>
                          supprimerSectionMutation.mutate(section.id, {
                            onSuccess: () => notify("Section supprimée", "success"),
                            onError: (err) => notify(messageErreurContenu(err), "error"),
                          })
                        }
                        onAjouterBloc={() => ajouterBloc(section.id)}
                        blocMutation={blocMutation}
                        supprimerBlocMutation={supprimerBlocMutation}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* ── 3. Points clés + chiffres clés ── */}
              <div className="grid gap-4 xl:grid-cols-2">
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
    </>
  )
}

/* ─── Carte d'une section (blocs enfants) ─── */

const CarteSection = ({
  section, premier, dernier, onMonter, onDescendre, onModifier, onSupprimer,
  onAjouterBloc, blocMutation, supprimerBlocMutation,
}) => {
  const notify = useNotify()
  const [ouvert, setOuvert] = useState(false)
  const [titreLocal, setTitreLocal] = useState(section.title)

  const blocs = [...(section.blocks ?? [])].sort((a, b) => a.position - b.position)

  return (
    <article className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
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
        <input
          value={titreLocal}
          onChange={(e) => setTitreLocal(e.target.value)}
          onBlur={() => titreLocal !== section.title && onModifier(section.id, "title", titreLocal)}
          aria-label={`Titre de la section ${section.position}`}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-medium outline-none transition-colors hover:border-input focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <Button variant="ghost" size="sm" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}>
          {ouvert ? "Replier" : "Blocs"} ({blocs.length})
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onSupprimer} aria-label="Supprimer la section">
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
    </article>
  )
}

/* ─── Un bloc de contenu (texte / citation / image) ─── */

const BlocContenu = ({ bloc, mutation, onSupprimer }) => {
  const [contenuLocal, setContenuLocal] = useState(bloc.content)
  const [typeOuvert, setTypeOuvert] = useState(false)

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-2">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
          {bloc.block_type === "quote" ? <Quote className="size-3" aria-hidden /> : null}
          {LibelleTypeBloc[bloc.block_type] ?? bloc.block_type}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <select
            value={bloc.block_type}
            onChange={(e) => mutation.mutate({ id: bloc.id, data: { block_type: e.target.value } }, {})}
            onFocus={() => setTypeOuvert(true)}
            onBlur={() => setTypeOuvert(false)}
            aria-label="Type du bloc"
            className={cn(
              "h-6 rounded-md border border-input bg-input/20 px-1.5 text-[10px]",
              typeOuvert && "ring-2 ring-ring/30"
            )}
          >
            {TYPES_BLOC.map((t) => (
              <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
            ))}
          </select>
          <Button variant="ghost" size="icon-sm" onClick={onSupprimer} aria-label="Supprimer le bloc">
            <X aria-hidden />
          </Button>
        </div>
      </div>
      <Textarea
        value={contenuLocal}
        onChange={(e) => setContenuLocal(e.target.value)}
        onBlur={() => contenuLocal !== bloc.content && mutation.mutate({ id: bloc.id, data: { content: contenuLocal } }, {})}
        aria-label="Contenu du bloc"
        rows={bloc.block_type === "text" ? 3 : 2}
        className="text-xs"
      />
      {bloc.block_type === "quote" && (
        <p className="text-[10px] text-muted-foreground">Attribution possible via l'API (champ attribution).</p>
      )}
    </div>
  )
}

/* ─── Points clés (takeaways) ─── */

const ListeTakeaways = ({ articleId, takeaways, ajouterMutation, supprimerMutation }) => {
  const notify = useNotify()
  const [texte, setTexte] = useState("")

  const ajouter = () => {
    if (!texte.trim()) return
    ajouterMutation.mutate(
      { articleId, data: { text: texte.trim() } },
      {
        onSuccess: () => { setTexte(""); notify("Point clé ajouté", "success") },
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )
  }

  return (
    <section aria-label="Points clés" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
        <ListOrdered className="size-4" aria-hidden /> Points clés ({takeaways.length})
      </h3>
      <ul className="flex flex-col gap-1.5">
        {takeaways.map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="font-mono">{t.position}</Badge>
            <span className="min-w-0 flex-1">{t.text}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                supprimerMutation.mutate(t.id, {
                  onError: (err) => notify(messageErreurContenu(err), "error"),
                })
              }
              aria-label={`Supprimer le point clé ${t.position}`}
            >
              <Trash2 aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ajouter()}
          placeholder="Nouveau point clé…"
          aria-label="Nouveau point clé"
          className="text-xs"
        />
        <Button size="sm" onClick={ajouter} disabled={ajouterMutation.isPending} aria-label="Ajouter le point clé">
          <Plus aria-hidden />
        </Button>
      </div>
    </section>
  )
}

/* ─── Chiffres clés (key-figures) ─── */

const ListeKeyFigures = ({ articleId, figures, ajouterMutation, supprimerMutation }) => {
  const notify = useNotify()
  const [valeur, setValeur] = useState("")
  const [libelle, setLibelle] = useState("")
  const [suffixe, setSuffixe] = useState("")

  const ajouter = () => {
    if (!valeur.trim() || !libelle.trim()) {
      notify("Valeur et libellé requis pour un chiffre clé.", "error")
      return
    }
    ajouterMutation.mutate(
      {
        articleId,
        data: { value: Number(valeur), label: libelle.trim(), suffix: suffixe.trim() || null },
      },
      {
        onSuccess: () => {
          setValeur(""); setLibelle(""); setSuffixe("")
          notify("Chiffre clé ajouté", "success")
        },
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )
  }

  return (
    <section aria-label="Chiffres clés" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
        <Hash className="size-4" aria-hidden /> Chiffres clés ({figures.length})
      </h3>
      <ul className="flex flex-col gap-1.5">
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
              onClick={() =>
                supprimerMutation.mutate(f.id, {
                  onError: (err) => notify(messageErreurContenu(err), "error"),
                })
              }
              aria-label={`Supprimer le chiffre clé ${f.label}`}
            >
              <Trash2 aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-[5rem_1fr_4rem_2rem] items-center gap-1.5">
        <Input value={valeur} onChange={(e) => setValeur(e.target.value)} type="number" step="any" placeholder="42" aria-label="Valeur du chiffre" className="text-xs" />
        <Input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="des recruteurs…" aria-label="Libellé du chiffre" className="text-xs" />
        <Input value={suffixe} onChange={(e) => setSuffixe(e.target.value)} placeholder="%" maxLength={10} aria-label="Suffixe (optionnel)" className="text-xs" />
        <Button size="sm" onClick={ajouter} disabled={ajouterMutation.isPending} aria-label="Ajouter le chiffre clé">
          <Plus aria-hidden />
        </Button>
      </div>
    </section>
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
import { useState } from "react"
import { Plus, Pencil, Trash2, Star, Eye } from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminArticlesQuery, useChangerStatutArticle, useMettreALaUne,
  useDeleteArticle, messageErreurContenu,
} from "@/features/admin-contenu.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useAdminCategoriesQuery } from "@/features/admin-contenu.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { SectionErreur, SectionVide, SectionAucunResultat } from "../components/EtatsSection"
import EditeurArticle from "../components/EditeurArticle"

/* ─────────────────────────────────────────────────────────────────────
   Onglet 14.1 — Articles : liste filtrable (statut, catégorie, recherche
   titre) + actions rapides (publier/dépublier, à la une, suppression) +
   éditeur complet (composant dédié EditeurArticle).
   ───────────────────────────────────────────────────────────────────── */

const STATUTS_ARTICLE = [
  { valeur: "draft", libelle: "Brouillon" },
  { valeur: "published", libelle: "Publié" },
  { valeur: "archived", libelle: "Archivé" },
]

const VARIANTE_STATUT = { draft: "outline", published: "secondary", archived: "outline" }
const LIBELLE_STATUT = { draft: "Brouillon", published: "Publié", archived: "Archivé" }

const dateCourte = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) : "—"

const OngletArticles = () => {
  const notify = useNotify()
  const [recherche, setRecherche] = useState("")
  const [statut, setStatut] = useState("")
  const [categorieId, setCategorieId] = useState("")
  const [editeurOuvert, setEditeurOuvert] = useState(null)   // null fermé ; {} création ; id = édition
  const [suppression, setSuppression] = useState(null)

  const params = { q: recherche || undefined, status: statut || undefined, category_id: categorieId || undefined }
  const { data: articles, isLoading, isError, refetch } = useAdminArticlesQuery(params)
  const { data: categories } = useAdminCategoriesQuery()

  const statutMutation = useChangerStatutArticle()
  const featuredMutation = useMettreALaUne()
  const supprimerMutation = useDeleteArticle()

  // Compteurs dérivés de la fenêtre affichée (liste plafonnée à la
  // limite serveur — comptage honnête « au moins », pas de total inventé).
  const listeBrute = articles ?? []
  const nbPublies = listeBrute.filter((a) => a.status === "published").length
  const nbBrouillons = listeBrute.filter((a) => a.status === "draft").length
  const nbALaUne = listeBrute.filter((a) => a.is_featured).length

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

  const nbFiltres = [recherche, statut, categorieId].filter(Boolean).length

  return (
    <div className="flex flex-col gap-3">
      {/* Compteurs (cycle 14, sélection utilisateur) — dérivés de la liste */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CarteCompteur label="Articles" valeur={listeBrute.length} chargement={isLoading} />
        <CarteCompteur label="Publiés" valeur={nbPublies} chargement={isLoading} />
        <CarteCompteur label="Brouillons" valeur={nbBrouillons} chargement={isLoading} />
        <CarteCompteur label="À la une" valeur={nbALaUne} chargement={isLoading} />
      </div>

      {/* Barre filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher par titre…"
          aria-label="Rechercher un article par titre"
          className="min-w-52 flex-1"
        />
        <Select value={statut} onValueChange={setStatut}>
          <SelectTrigger className="h-7 w-36" aria-label="Filtrer par statut">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tous</SelectItem>
            {STATUTS_ARTICLE.map((s) => (
              <SelectItem key={s.valeur} value={s.valeur}>{s.libelle}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categorieId} onValueChange={setCategorieId}>
          <SelectTrigger className="h-7 w-44" aria-label="Filtrer par catégorie">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Toutes</SelectItem>
            {(categories ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {nbFiltres > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setRecherche(""); setStatut(""); setCategorieId("") }}>
            Réinitialiser ({nbFiltres})
          </Button>
        )}
        <Button size="sm" onClick={() => setEditeurOuvert({})}>
          <Plus aria-hidden /> Nouvel article
        </Button>
      </div>

      {/* Table */}
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les articles." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
        </div>
      ) : !articles?.length ? (
        nbFiltres > 0 ? (
          <SectionAucunResultat
            message="Aucun article ne correspond à ces filtres."
            onReset={() => { setRecherche(""); setStatut(""); setCategorieId("") }}
          />
        ) : (
          <SectionVide message="Aucun article pour le moment." />
        )
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden md:table-cell">Catégorie</TableHead>
                <TableHead className="hidden text-right md:table-cell">Vues</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Publié le</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.map((article) => (
                <TableRow key={article.id}>
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
                        render={<Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${article.title ?? article.slug}`} />}
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
                        <DropdownMenuItem onClick={() => setSuppression(article)} className="cursor-pointer text-destructive">
                          <Trash2 className="size-3.5" aria-hidden /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
import { useState } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminCategoriesQuery, useAdminArticlesQuery, useCreateCategory, useUpdateCategory,
  useDeleteCategory, messageErreurContenu,
} from "@/features/admin-contenu.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet 14.2a — Catégories d'articles : CRUD simple.
   ───────────────────────────────────────────────────────────────────── */

const OngletCategories = () => {
  const notify = useNotify()
  const { data: categories, isLoading, isError, refetch } = useAdminCategoriesQuery()
  const { data: articles } = useAdminArticlesQuery({ limit: 100 })

  const [edition, setEdition] = useState(null)  // null fermé ; {} création ; catégorie = édition
  const [suppression, setSuppression] = useState(null)

  const creerMutation = useCreateCategory()
  const modifierMutation = useUpdateCategory()
  const supprimerMutation = useDeleteCategory()

  // Compteurs : vides = aucune catégorie_id d'article ne pointe dessus
  // (croisement local listes catégories × articles, 0 appel en plus).
  const idsUtilisees = new Set((articles ?? []).map((a) => a.category_id).filter(Boolean))
  const nbActives = (categories ?? []).filter((c) => c.is_active).length
  const nbVides = (categories ?? []).filter((c) => !idsUtilisees.has(c.id)).length

  return (
    <div className="flex flex-col gap-3">
      {/* Compteurs (cycle 14, sélection utilisateur) */}
      <div className="grid grid-cols-3 gap-3">
        <CarteCompteur label="Catégories" valeur={categories?.length ?? 0} chargement={isLoading} />
        <CarteCompteur label="Actives" valeur={nbActives} chargement={isLoading} />
        <CarteCompteur label="Sans article" valeur={nbVides} chargement={isLoading} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Catégories d'articles — utilisées dans les filtres publics et l'onglet Articles.
        </p>
        <Button size="sm" onClick={() => setEdition({})}>
          <Plus aria-hidden /> Nouvelle catégorie
        </Button>
      </div>

      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les catégories." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      ) : !categories?.length ? (
        <SectionVide message="Aucune catégorie." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Catégorie</TableHead>
                <TableHead className="hidden font-mono text-[10px] md:table-cell">Code</TableHead>
                <TableHead className="text-right">Ordre</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id}>
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
                      <Button variant="ghost" size="icon-sm" onClick={() => setSuppression(cat)} aria-label={`Supprimer ${cat.label}`}>
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
import { useState } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminDailyTipsQuery, useCreateDailyTip, useUpdateDailyTip,
  useDeleteDailyTip, messageErreurContenu,
} from "@/features/admin-contenu.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet 14.3 — Conseils du jour : CRUD + créneau de rotation.

   MIGRATION 0015 (feu vert cycle 14) : PLUSIEURS conseils peuvent
   partager un créneau (409 supprimé). Le site public choisit
   déterministement dans le créneau (day_of_year % nb) — chaque tip
   finit par tourner. La table regroupe par jour, le dialog montre
   combien de tips occupent chaque créneau.
   ───────────────────────────────────────────────────────────────────── */

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]

const OngletConseils = () => {
  const notify = useNotify()
  const { data: conseils, isLoading, isError, refetch } = useAdminDailyTipsQuery()

  const [edition, setEdition] = useState(null)
  const [suppression, setSuppression] = useState(null)

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

  return (
    <div className="flex flex-col gap-3">
      {/* Compteurs (cycle 14, sélection utilisateur) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CarteCompteur label="Conseils" valeur={conseils?.length ?? 0} chargement={isLoading} />
        <CarteCompteur label="Actifs" valeur={nbActifs} chargement={isLoading} />
        <CarteCompteur
          label="Jours occupés"
          valeur={nbJoursOccupes}
          texte={`${nbJoursOccupes}/7`}
          chargement={isLoading}
        />
        <CarteCompteur
          label="Semaine complète"
          valeur={nbJoursOccupes}
          texte={nbJoursOccupes === 7 ? "Oui" : "Non"}
          chargement={isLoading}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Plusieurs conseils peuvent partager un jour — le site public les fait tourner
          déterministement au fil des jours.
        </p>
        <Button size="sm" onClick={() => setEdition({})}>
          <Plus aria-hidden /> Nouveau conseil
        </Button>
      </div>

      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les conseils." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      ) : !conseils?.length ? (
        <SectionVide message="Aucun conseil pour le moment." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jour</TableHead>
                <TableHead>Conseil</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...conseils].sort((a, b) => a.rotation_order - b.rotation_order).map((tip) => (
                <TableRow key={tip.id}>
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
                      <Button variant="ghost" size="icon-sm" onClick={() => setSuppression(tip)} aria-label="Supprimer le conseil">
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
            <select
              id="tip-actif"
              value={valeurs.is_active ? "1" : "0"}
              onChange={(e) => set("is_active", e.target.value === "1")}
              className="h-7 rounded-md border border-input bg-input/20 px-2 text-xs"
            >
              <option value="1">Oui — affiché</option>
              <option value="0">Non — masqué</option>
            </select>
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
import { useState } from "react"
import { Plus, Pencil, Trash2, FileText } from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminPagesQuery, useCreatePage, useUpdatePage,
  useChangerStatutPage, useDeletePage, messageErreurContenu,
} from "@/features/admin-contenu.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet 14.4 — Pages statiques : CRUD (mentions légales, etc.).

   Routes créées/typées ce cycle (ContentPageCreate/Update + PATCH
   status, 8 tests pytest) : création en draft, publication avec
   published_at FIGÉ à la première (même règle que les articles),
   slug/type immuables après création.
   ───────────────────────────────────────────────────────────────────── */

const VARIANTE_STATUT = { draft: "outline", published: "secondary", archived: "outline" }
const LIBELLE_STATUT = { draft: "Brouillon", published: "Publiée", archived: "Archivée" }

const TYPES_PAGE = [
  { valeur: "legal_page", libelle: "Page légale (mentions, confidentialité…)" },
  { valeur: "static_page", libelle: "Page statique" },
]

const OngletPages = () => {
  const notify = useNotify()
  const { data: pages, isLoading, isError, refetch } = useAdminPagesQuery()

  const [edition, setEdition] = useState(null)
  const [suppression, setSuppression] = useState(null)

  const creerMutation = useCreatePage()
  const modifierMutation = useUpdatePage()
  const statutMutation = useChangerStatutPage()
  const supprimerMutation = useDeletePage()

  // Compteurs (cycle 14, sélection utilisateur) — liste complète par nature.
  const nbPubliees = (pages ?? []).filter((p) => p.status === "published").length
  const nbBrouillons = (pages ?? []).filter((p) => p.status === "draft").length

  const changerStatut = (page, status) =>
    statutMutation.mutate(
      { id: page.id, status },
      {
        onSuccess: () => notify(`Page ${status === "published" ? "publiée" : status === "draft" ? "dépubliée" : "archivée"}`, "success"),
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )

  return (
    <div className="flex flex-col gap-3">
      {/* Compteurs (cycle 14, sélection utilisateur) */}
      <div className="grid grid-cols-3 gap-3">
        <CarteCompteur label="Pages" valeur={pages?.length ?? 0} chargement={isLoading} />
        <CarteCompteur label="Publiées" valeur={nbPubliees} chargement={isLoading} />
        <CarteCompteur label="Brouillons" valeur={nbBrouillons} chargement={isLoading} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Mentions légales, politique de confidentialité et pages institutionnelles.
        </p>
        <Button size="sm" onClick={() => setEdition({})}>
          <Plus aria-hidden /> Nouvelle page
        </Button>
      </div>

      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les pages." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      ) : !pages?.length ? (
        <SectionVide message="Aucune page statique — créez les mentions légales et la politique de confidentialité." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page) => (
                <TableRow key={page.id}>
                  <TableCell>
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="size-3.5 text-muted-foreground" aria-hidden />
                      {page.title}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-muted-foreground">/{page.slug}</span>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                    {page.content_type === "legal_page" ? "Légale" : "Statique"}
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
                      <Button variant="ghost" size="icon-sm" onClick={() => setSuppression(page)} aria-label={`Supprimer ${page.title}`}>
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
            <Input id="page-extrait" value={valeurs.extrait ?? valeurs.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
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
import { useState } from "react"
import { Plus, Pencil, Trash2, ListOrdered } from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminSeriesQuery, useAdminArticlesQuery, useCreateSeries,
  useUpdateSeries, useDeleteSeries, useUpdateSeriesArticles, messageErreurContenu,
} from "@/features/admin-contenu.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet 14.2b — Séries : CRUD + composition.
   ⚠️ PUT /series/{id}/articles REMPLACE intégralement la composition
   (même logique que les mots-clés de filière) : on envoie toujours la
   liste COMPLÈTE des IDs d'articles, jamais un delta.
   ⚠️ L'API série ne renvoie PAS sa composition actuelle (ArticleSeriesRead
   = métadonnées seules, vérifié serveur) : la composition part d'une
   sélection vide à chaque ouverture — le dialog prévient explicitement
   avant de remplacer.
   ───────────────────────────────────────────────────────────────────── */

const OngletSeries = () => {
  const notify = useNotify()
  const { data: series, isLoading, isError, refetch } = useAdminSeriesQuery()
  const { data: articles } = useAdminArticlesQuery({ limit: 100 })

  const [edition, setEdition] = useState(null)
  const [composition, setComposition] = useState(null)   // série dont on édite la composition
  const [suppression, setSuppression] = useState(null)

  const creerMutation = useCreateSeries()
  const modifierMutation = useUpdateSeries()
  const supprimerMutation = useDeleteSeries()

  const nbActives = (series ?? []).filter((s) => s.is_active).length

  return (
    <div className="flex flex-col gap-3">
      {/* Compteurs (cycle 14, sélection utilisateur) — le nombre
          d'articles DANS les séries n'est pas exposé par l'API
          (ArticleSeriesRead = métadonnées seules) : on affiche le total
          d'articles disponibles pour composition, honnête. */}
      <div className="grid grid-cols-3 gap-3">
        <CarteCompteur label="Séries" valeur={series?.length ?? 0} chargement={isLoading} />
        <CarteCompteur label="Actives" valeur={nbActives} chargement={isLoading} />
        <CarteCompteur label="Articles disponibles" valeur={articles?.length ?? 0} chargement={isLoading} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Séries éditoriales — collections d'articles (guides, dossiers…).
        </p>
        <Button size="sm" onClick={() => setEdition({})}>
          <Plus aria-hidden /> Nouvelle série
        </Button>
      </div>

      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les séries." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      ) : !series?.length ? (
        <SectionVide message="Aucune série pour le moment." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Série</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead className="text-right">Ordre</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {series.map((s) => (
                <TableRow key={s.id}>
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
                      <Button variant="ghost" size="icon-sm" onClick={() => setSuppression(s)} aria-label={`Supprimer ${s.title}`}>
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
import { Newspaper } from "lucide-react"
import { ErrorBoundary } from "react-error-boundary"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import OngletArticles from "./sections/OngletArticles"
import OngletCategories from "./sections/OngletCategories"
import OngletSeries from "./sections/OngletSeries"
import OngletConseils from "./sections/OngletConseils"
import OngletPages from "./sections/OngletPages"
import { VARIANTS_PAGE } from "@/components/admin/Bloc"
import HeroAdmin from "@/components/admin/HeroAdmin"
import { cn } from "cn"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion du contenu — /admin/contenu (super_admin + moderateur,
   guard par route — doc v3 §14).

   5 onglets (chacun porte son ErrorBoundary — un onglet qui plante
   n'emporte pas la page) :
   1. Articles     — liste filtrable + éditeur complet (sections/blocs/
                     takeaways/key-figures, réordonnancement flèches) ;
   2. Catégories   — CRUD simple ;
   3. Séries       — CRUD + composition (remplacement total) ;
   4. Conseils     — CRUD + créneau de rotation 0-6 unique (409) ;
   5. Pages        — CRUD complet (routes créées cycle 14 côté serveur).

   L'onglet FAQ n'existe pas (aucune route admin — doc v3 §14.5).
   ───────────────────────────────────────────────────────────────────── */

const ONGLETS = [
  { valeur: "articles", libelle: "Articles", Icone: Newspaper },
  { valeur: "categories", libelle: "Catégories", Icone: Newspaper },
  { valeur: "series", libelle: "Séries", Icone: Newspaper },
  { valeur: "conseils", libelle: "Conseils du jour", Icone: Newspaper },
  { valeur: "pages", libelle: "Pages statiques", Icone: Newspaper },
]

const ContenuPage = () => (
  <motion.div
    variants={VARIANTS_PAGE}
    initial="cache"
    animate="visible"
    className="mx-auto flex w-full max-w-6xl flex-col gap-6"
  >
    <HeroAdmin
      title="Gestion du contenu"
      description="Articles, catégories, séries, conseils du jour et pages statiques du site public."
      icon={Newspaper}
      titleBdge="Contenu & sécurité"
    />

    <Tabs defaultValue="articles">
      
      <TabsList className="flex-wrap">
        <TabsTrigger value="articles">Articles</TabsTrigger>
        <TabsTrigger value="categories">Catégories</TabsTrigger>
        <TabsTrigger value="series">Séries</TabsTrigger>
        <TabsTrigger value="conseils">Conseils du jour</TabsTrigger>
        <TabsTrigger value="pages">Pages statiques</TabsTrigger>
      </TabsList>

      <TabsContent value="articles" className="mt-4">
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <OngletArticles />
        </ErrorBoundary>
      </TabsContent>

      <TabsContent value="categories" className="mt-4">
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <OngletCategories />
        </ErrorBoundary>
      </TabsContent>

      <TabsContent value="series" className="mt-4">
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <OngletSeries />
        </ErrorBoundary>
      </TabsContent>

      <TabsContent value="conseils" className="mt-4">
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <OngletConseils />
        </ErrorBoundary>
      </TabsContent>

      <TabsContent value="pages" className="mt-4">
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <OngletPages />
        </ErrorBoundary>
      </TabsContent>
    </Tabs>
  </motion.div>
)

export default ContenuPage
```
