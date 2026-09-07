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
import { SectionErreur, SectionVide } from "./components/EtatsSection"

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
