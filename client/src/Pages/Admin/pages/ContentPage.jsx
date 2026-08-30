import { useState } from "react"
import { BookOpen, FileMinus, FilePlus, FileText, HelpCircle, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "../components/PageHeader"
import { Tabs } from "../components/Tabs"
import { DataTable } from "../components/DataTable"
import { GenericStatusBadge } from "../components/StatusBadge"
import {
  CONTENT_STATUS_LABELS,
} from "@/api/admin/types"
import { extractErrorMessage } from "@/api/admin/adminAxios"
import {
  useAdminMutations,
  useArticlesSafe,
  useCategoriesSafe,
  useDailyTipsSafe,
  usePagesSafe,
  useSeriesSafe,
} from "./adminHooks"

/**
 * Page 16 — /admin/contenu (super_admin + moderateur) — 4 onglets :
 * Articles (+ catégories & séries), Conseils du jour, Pages statiques, FAQ.
 */
export const ContentPage = () => {
  const [tab, setTab] = useState("articles")

  return (
    <>
      <PageHeader
        title="Contenu éditorial"
        description="Articles, conseils du jour et pages statiques affichés sur le site public."
        crumbs={[{ label: "Accueil", to: "/admin" }, { label: "Contenu" }]}
      />
      <Tabs
        tabs={[
          { key: "articles", label: "Articles", icon: FileText },
          { key: "tips", label: "Conseils du jour", icon: BookOpen },
          { key: "pages", label: "Pages statiques", icon: FileText },
          { key: "faq", label: "FAQ", icon: HelpCircle },
        ]}
        activeKey={tab}
        onChange={setTab}
      />
      {tab === "articles" && <ArticlesTab />}
      {tab === "tips" && <TipsTab />}
      {tab === "pages" && <PagesTab />}
      {tab === "faq" && <FaqPlaceholder />}
    </>
  )
}

/* ═══════════ Onglet Articles ═══════════ */
const ArticlesTab = () => {
  const [offset, setOffset] = useState(0)
  const LIMIT = 15
  const articlesQuery = useArticlesSafe({ limit: LIMIT, offset })
  const categoriesQuery = useCategoriesSafe()
  const seriesQuery = useSeriesSafe()
  const m = useAdminMutations()
  const rows = articlesQuery.data || []

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingArticle, setEditingArticle] = useState(null) // null | {_isNew} | article
  const [draft, setDraft] = useState(null)

  const openEditor = (article) => {
    setEditingArticle(article)
    setDraft({
      title: article.title ?? "",
      slug: article.slug ?? "",
      excerpt: article.excerpt ?? "",
      category_id: article.category_id ?? "",
      reading_minutes: article.reading_minutes ?? 5,
    })
    setEditorOpen(true)
  }

  const handleSave = async (event) => {
    event.preventDefault()
    try {
      const payload = {
        title: draft.title.trim(),
        slug: draft.slug.trim() || draft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        excerpt: draft.excerpt || null,
        category_id: draft.category_id || null,
        reading_minutes: Number(draft.reading_minutes) || 5,
      }
      if (editingArticle?._isNew) {
        await m.articleMutations.create.mutateAsync(payload)
        toast.success("Article créé", `${payload.title} — brouillon prêt.`)
      } else {
        await m.articleMutations.update.mutateAsync({ id: editingArticle.id, data: payload })
        toast.success("Article enregistré", payload.title)
      }
      setEditorOpen(false)
    } catch (error) {
      toast.error("Enregistrement impossible", extractErrorMessage(error))
    }
  }

  const toggleStatus = async (article) => {
    const status = article.status === "published" ? "draft" : "published"
    try {
      await m.articleMutations.updateStatus.mutateAsync({ id: article.id, status })
      toast.success("Statut modifié", `${article.title} → ${CONTENT_STATUS_LABELS[status]}`)
    } catch (error) {
      toast.error("Changement impossible", extractErrorMessage(error))
    }
  }

  const toggleFeatured = async (article) => {
    try {
      await m.articleMutations.toggleFeatured.mutateAsync({ id: article.id, isFeatured: !article.is_featured })
      toast.success(article.is_featured ? "Retiré de la une" : "Ajouté à la une", article.title)
    } catch (error) {
      toast.error("Action impossible", extractErrorMessage(error))
    }
  }

  const removeArticle = async (article) => {
    if (!window.confirm(`Supprimer (logiquement) l'article « ${article.title} » ?`)) return
    try {
      await m.articleMutations.remove.mutateAsync(article.id)
      toast.success("Article supprimé", article.title)
    } catch (error) {
      toast.error("Suppression impossible", extractErrorMessage(error))
    }
  }

  const columns = [
    {
      key: "title",
      header: "Article",
      render: (a) => (
        <div className="min-w-0 max-w-sm">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
            {a.title}
            {a.is_featured && <Star className="size-3.5 shrink-0 fill-[var(--primary)] text-primary" />}
          </p>
          <p className="truncate text-xs text-muted-foreground">/{a.slug}</p>
        </div>
      ),
    },
    { key: "category_label", header: "Catégorie", className: "hidden md:table-cell", render: (a) => a.category?.label ?? "—" },
    { key: "status_badge", header: "Statut", render: (a) => <GenericStatusBadge status={a.status} labels={CONTENT_STATUS_LABELS} /> },
    {
      key: "view_count",
      header: "Vues",
      className: "hidden sm:table-cell text-right tabular-nums",
      render: (a) => a.view_count?.toLocaleString("fr-FR") ?? "0",
    },
  ]

  /* Menu contextuel de ligne — toutes les actions articles (mobile & desktop) */
  const rowActions = (a) => [
    {
      key: "toggle-status",
      label: a.status === "published" ? "Dépublier (brouillon)" : "Publier",
      icon: a.status === "published" ? FileMinus : FilePlus,
      onClick: () => toggleStatus(a),
    },
    {
      key: "featured",
      label: a.is_featured ? "Retirer de la une" : "Ajouter à la une",
      icon: Star,
      onClick: () => toggleFeatured(a),
    },
    { key: "edit", label: "Éditer l'article", icon: Pencil, onClick: () => openEditor(a) },
    { key: "delete", label: "Supprimer (logique)", icon: Trash2, danger: true, onClick: () => removeArticle(a) },
  ]

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
          L'éditeur de sections (blocs texte/citation/image, réordonnancement via PUT /sections/reorder,
          takeaways et key figures) s'appuie sur les routes <code>/content/articles/&#123;id&#125;/sections</code>.
        </p>
        <button type="button" className="adm-btn-primary adm-btn-sm" onClick={() => openEditor({ _isNew: true })}>
          <Plus className="size-3.5" /> Nouvel article
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowActions={rowActions}
        loading={articlesQuery.isLoading}
        error={articlesQuery.error}
        onRetry={() => articlesQuery.refetch()}
        emptyLabel="Aucun article"
        emptyHint="Créez votre premier article carrière."
        limit={LIMIT}
        offset={offset}
        onOffsetChange={setOffset}
      />

      {/* Éditeur d'article (métadonnées) */}
      {editorOpen && draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 backdrop-blur-[2px] sm:p-4" role="dialog" aria-modal="true" onClick={() => setEditorOpen(false)}>
          <form
            className="adm-card max-h-[85vh] w-full max-w-lg overflow-y-auto p-4 shadow-hover sm:p-6"
            onSubmit={handleSave}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-base font-bold">{editingArticle?._isNew ? "Nouvel article" : "Éditer l'article"}</h3>
            <div className="mt-4 grid gap-3">
              <div>
                <label htmlFor="art-title" className="adm-label">Titre *</label>
                <input id="art-title" required minLength={2} className="adm-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div>
                <label htmlFor="art-slug" className="adm-label">Slug</label>
                <input id="art-slug" className="adm-input font-mono text-xs" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder="généré depuis le titre si vide" />
              </div>
              <div>
                <label htmlFor="art-excerpt" className="adm-label">Extrait</label>
                <textarea id="art-excerpt" rows={2} maxLength={500} className="adm-input" value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="art-cat" className="adm-label">Catégorie</label>
                  <select id="art-cat" className="adm-input" value={draft.category_id ?? ""} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}>
                    <option value="">— Aucune —</option>
                    {(categoriesQuery.data || []).map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="art-min" className="adm-label">Lecture (min)</label>
                  <input id="art-min" type="number" min={1} className="adm-input" value={draft.reading_minutes} onChange={(e) => setDraft({ ...draft, reading_minutes: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="adm-btn-outline" onClick={() => setEditorOpen(false)}>Annuler</button>
              <button type="submit" className="adm-btn-primary" disabled={m.articleMutations.create.isPending || m.articleMutations.update.isPending}>
                {(m.articleMutations.create.isPending || m.articleMutations.update.isPending) && <Loader2 className="size-4 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Catégories & séries */}
      <div className="mt-6 flex flex-col gap-4 lg:grid lg:grid-cols-2">
        <CategoriesPanel query={categoriesQuery} mutations={m.categoryMutations} />
        <SeriesPanel query={seriesQuery} mutations={m.seriesMutations} />
      </div>
    </>
  )
}

/* ═══════════ Panneau catégories ═══════════ */
const CategoriesPanel = ({ query, mutations }) => {
  const [newLabel, setNewLabel] = useState("")
  const categories = query.data || []

  const handleCreate = async () => {
    if (!newLabel.trim()) return
    const slug = newLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    try {
      await mutations.create.mutateAsync({ code: slug, label: newLabel.trim(), slug })
      toast.success("Catégorie créée", newLabel)
      setNewLabel("")
    } catch (error) {
      toast.error("Création impossible", extractErrorMessage(error))
    }
  }

  const handleDelete = async (category) => {
    if (!window.confirm(`Supprimer la catégorie « ${category.label} » ?`)) return
    try {
      await mutations.remove.mutateAsync(category.id)
      toast.success("Catégorie supprimée")
    } catch (error) {
      toast.error("Suppression impossible", extractErrorMessage(error))
    }
  }

  return (
    <section className="adm-card p-5">
      <h3 className="text-sm font-bold">Catégories d'articles</h3>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          className="adm-input h-9 min-w-[8rem] flex-1 text-sm"
          placeholder="Nouvelle catégorie…"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleCreate()
            }
          }}
        />
        <button type="button" className="adm-btn-outline !h-9 shrink-0 px-2.5" onClick={handleCreate} aria-label="Ajouter la catégorie">
          <Plus className="size-4" />
        </button>
      </div>
      <ul className="mt-3 divide-y divide-border/70">
        {categories.map((category) => (
          <li key={category.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium">{category.label}</span>
            <span className="flex shrink-0 items-center gap-2 !ml-auto">
              <code className="max-w-[9rem] truncate text-[10px] text-muted-foreground">{category.code}</code>
              <button type="button" className="adm-btn-danger !h-6 shrink-0 px-1.5" onClick={() => handleDelete(category)} aria-label={`Supprimer ${category.label}`}>
                <Trash2 className="size-3" />
              </button>
            </span>
          </li>
        ))}
        {categories.length === 0 && <li className="py-3 text-xs text-muted-foreground">Aucune catégorie.</li>}
      </ul>
    </section>
  )
}

/* ═══════════ Panneau séries ═══════════ */
const SeriesPanel = ({ query, mutations }) => {
  const [newTitle, setNewTitle] = useState("")
  const series = query.data || []

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    try {
      await mutations.create.mutateAsync({
        title: newTitle.trim(),
        slug: newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      })
      toast.success("Série créée", newTitle)
      setNewTitle("")
    } catch (error) {
      toast.error("Création impossible", extractErrorMessage(error))
    }
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`Supprimer la série « ${item.title} » ?`)) return
    try {
      await mutations.remove.mutateAsync(item.id)
      toast.success("Série supprimée")
    } catch (error) {
      toast.error("Suppression impossible", extractErrorMessage(error))
    }
  }

  return (
    <section className="adm-card p-5">
      <h3 className="text-sm font-bold">Séries d'articles</h3>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          className="adm-input h-9 min-w-[8rem] flex-1 text-sm"
          placeholder="Nouvelle série…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleCreate()
            }
          }}
        />
        <button type="button" className="adm-btn-outline !h-9 shrink-0 px-2.5" onClick={handleCreate} aria-label="Ajouter la série">
          <Plus className="size-4" />
        </button>
      </div>
      <ul className="mt-3 divide-y divide-border/70">
        {series.map((item) => (
          <li key={item.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{item.title}</span>
              {item.description && <span className="block truncate text-xs text-muted-foreground">{item.description}</span>}
            </span>
            <button type="button" className="adm-btn-danger !ml-auto !h-6 shrink-0 px-1.5" onClick={() => handleDelete(item)} aria-label={`Supprimer ${item.title}`}>
              <Trash2 className="size-3" />
            </button>
          </li>
        ))}
        {series.length === 0 && <li className="py-3 text-xs text-muted-foreground">Aucune série.</li>}
      </ul>
    </section>
  )
}

/* ═══════════ Onglet Conseils du jour ═══════════ */
const TipsTab = () => {
  const tipsQuery = useDailyTipsSafe()
  const m = useAdminMutations()
  const tips = [...(tipsQuery.data || [])].sort((a, b) => a.rotation_order - b.rotation_order)
  const [newText, setNewText] = useState("")

  const handleCreate = async () => {
    if (newText.trim().length < 5) return
    try {
      await m.tipMutations.create.mutateAsync({ text: newText.trim(), rotation_order: tips.length % 7 })
      toast.success("Conseil ajouté")
      setNewText("")
    } catch (error) {
      toast.error("Ajout impossible", extractErrorMessage(error, "Un conseil existe peut-être déjà pour cet ordre."))
    }
  }

  const toggleActive = async (tip) => {
    try {
      await m.tipMutations.update.mutateAsync({ id: tip.id, data: { is_active: !tip.is_active } })
      toast.success(tip.is_active ? "Conseil désactivé" : "Conseil activé")
    } catch (error) {
      toast.error("Action impossible", extractErrorMessage(error))
    }
  }

  const removeTip = async (tip) => {
    if (!window.confirm("Supprimer ce conseil ?")) return
    try {
      await m.tipMutations.remove.mutateAsync(tip.id)
      toast.success("Conseil supprimé")
    } catch (error) {
      toast.error("Suppression impossible", extractErrorMessage(error))
    }
  }

  return (
    <section className="adm-card max-w-3xl p-5">
      <h3 className="text-sm font-bold">Conseils affichés dans le digest quotidien</h3>
      <p className="mt-1 text-xs text-muted-foreground">Rotation par ordre croissant (0–6, soit un par jour de semaine).</p>

      <div className="mt-4 flex items-center gap-2">
        <input
          className="adm-input h-9 flex-1 text-sm"
          placeholder="Ex : Relisez votre CV à voix haute avant de l'envoyer…"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleCreate()
            }
          }}
        />
        <button type="button" className="adm-btn-primary !h-9 px-3" onClick={handleCreate} disabled={m.tipMutations.create.isPending}>
          {m.tipMutations.create.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Ajouter
        </button>
      </div>

      {tipsQuery.isLoading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="adm-skeleton-line h-8 w-full" />
          ))}
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border/70">
          {tips.map((tip) => (
            <li key={tip.id} className={`flex items-center gap-3 py-2.5 ${tip.is_active ? "" : "opacity-50"}`}>
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground">
                {tip.rotation_order}
              </span>
              <p className="min-w-0 flex-1 text-sm">{tip.text}</p>
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
                <input type="checkbox" checked={tip.is_active} onChange={() => toggleActive(tip)} className="size-3.5 accent-[var(--primary)]" />
                actif
              </label>
              <button type="button" className="adm-btn-danger !h-6 px-1.5" onClick={() => removeTip(tip)} aria-label="Supprimer le conseil">
                <Trash2 className="size-3" />
              </button>
            </li>
          ))}
          {tips.length === 0 && <li className="py-4 text-center text-xs text-muted-foreground">Aucun conseil enregistré.</li>}
        </ul>
      )}
    </section>
  )
}

/* ═══════════ Onglet Pages statiques ═══════════ */
const PagesTab = () => {
  const pagesQuery = usePagesSafe()
  const pages = pagesQuery.data || []

  if (!pagesQuery.isLoading && pages.length === 0) {
    return (
      <div className="adm-card max-w-3xl p-8 text-center">
        <FileText className="mx-auto size-8 text-muted-foreground" />
        <h3 className="mt-3 text-sm font-bold">Aucune page statique</h3>
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
          ⚠ Chantier bloqué côté backend : les routes <code>POST/PUT /content/pages</code> utilisent encore le schéma
          de lecture (<code>ContentPageRead</code>) au lieu des correctifs dédiés{" "}
          <code>ContentPageCreate/Update</code>. La création et l'édition seront activées dès la correction appliquée.
        </p>
      </div>
    )
  }

  return (
    <ul className="adm-card max-w-3xl divide-y divide-border/70">
      {pages.map((page) => (
        <li key={page.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
          <span className="min-w-0">
            <span className="block truncate font-semibold">{page.title}</span>
            <span className="block truncate text-xs text-muted-foreground">/{page.slug}</span>
          </span>
          <GenericStatusBadge status={page.status} labels={CONTENT_STATUS_LABELS} />
        </li>
      ))}
    </ul>
  )
}

/* ═══════════ Onglet FAQ (routes admin absentes) ═══════════ */
const FaqPlaceholder = () => (
  <div className="adm-card max-w-3xl p-8 text-center">
    <HelpCircle className="mx-auto size-8 text-muted-foreground" />
    <h3 className="mt-3 text-sm font-bold">Gestion FAQ — indisponible</h3>
    <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
      ⚠ Les routes admin <code>/content/faqs</code> sont absentes du backend (décision ouverte du cahier des charges).
      Le contenu FAQ reste géré directement en base jusqu'à l'ajout des endpoints CRUD.
    </p>
  </div>
)