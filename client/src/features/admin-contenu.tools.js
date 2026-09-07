import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getArticles, getArticle, createArticle, updateArticle,
  updateArticleStatus, updateArticleFeatured, deleteArticle,
  createSection, updateSection, deleteSection,
  createBlock, updateBlock, deleteBlock, reorderSections,
  getCategories, createCategory, updateCategory, deleteCategory,
  getDailyTips, createDailyTip, updateDailyTip, deleteDailyTip,
  getSeries, createSeries, updateSeries, deleteSeries, updateSeriesArticles,
  getPages, deletePage,
} from "@/api/admin/content"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion du contenu (/admin/contenu) — hooks TanStack.

   Router /api/admin/content : super_admin + moderateur (vérifié
   serveur require_roles).

   ⚠️ Api client (content.js) à compléter au cycle 14 : les routes
   takeaways/key-figures/pages-status sont NOUVELLES (créées ce cycle,
   vérifiées live + 8 tests pytest) :
   - POST /articles/{id}/takeaways {text, position?} → ArticleRead
   - DELETE /takeaways/{id} → 204 (positions recompactées serveur)
   - POST /articles/{id}/key-figures {value, label, prefix?, suffix?, position?}
   - DELETE /key-figures/{id} → 204
   - PATCH /pages/{id}/status {status} (published_at figé à la 1re)
   Volatilité :
   - articles/listes : 5 min (contenu éditorial peu volatile) ;
   - détail article : 60 s (fenêtre d'édition courte — un autre admin
     peut modifier en parallèle, invalidation agressive après chaque
     mutation de section/bloc/takeaway) ;
   - référentiels (catégories/séries) : 10 min.
   Invalidation : TOUT l'arbre content après mutation (les listes,
   le détail et le site public partagent les mêmes tables).
   ───────────────────────────────────────────────────────────────────── */

export const adminContenuKeys = {
  root: ["admin", "content"],
  articles: (params) => ["admin", "content", "articles", params],
  article: (id) => ["admin", "content", "article", id],
  categories: ["admin", "content", "categories"],
  dailyTips: ["admin", "content", "daily-tips"],
  series: ["admin", "content", "series"],
  pages: ["admin", "content", "pages"],
}

/** Erreur → message lisible. */
export const messageErreurContenu = (err) =>
  err?.response?.data?.detail
    ? (typeof err.response.data.detail === "string"
        ? err.response.data.detail
        : "Champs invalides — vérifiez le formulaire.")
    : err?.message || "Action impossible"

const useInvalidateContenu = () => {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: adminContenuKeys.root })
}

/* ─── Articles ──────────────────────────────────────────────────────── */

export const useAdminArticlesQuery = (params = {}) =>
  useQuery({
    queryKey: adminContenuKeys.articles(params),
    queryFn: ({ signal }) => getArticles(params, { signal }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

export const useAdminArticleQuery = (articleId, { enabled = true } = {}) =>
  useQuery({
    queryKey: adminContenuKeys.article(articleId),
    queryFn: ({ signal }) => getArticle(articleId, { signal }),
    enabled: !!articleId && enabled,
    staleTime: 60 * 1000,
    retry: 1,
  })

export const useCreateArticle = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({ mutationFn: (data) => createArticle(data), onSuccess: invalidate })
}

export const useUpdateArticle = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({ mutationFn: ({ id, data }) => updateArticle(id, data), onSuccess: invalidate })
}

/** Publication/dépublication/archivage — published_at figé à la 1re publication (serveur). */
export const useChangerStatutArticle = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({
    mutationFn: ({ id, status }) => updateArticleStatus(id, status),
    onSuccess: invalidate,
  })
}

export const useMettreALaUne = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({
    mutationFn: ({ id, data }) => updateArticleFeatured(id, data),
    onSuccess: invalidate,
  })
}

export const useDeleteArticle = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({ mutationFn: (id) => deleteArticle(id), onSuccess: invalidate })
}

/* ─── Sections & blocs (éditeur) ─────────────────────────────────────── */

export const useCreateSection = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({
    mutationFn: ({ articleId, data }) => createSection(articleId, data),
    onSuccess: invalidate,
  })
}

export const useUpdateSection = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({ mutationFn: ({ id, data }) => updateSection(id, data), onSuccess: invalidate })
}

export const useDeleteSection = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({ mutationFn: (id) => deleteSection(id), onSuccess: invalidate })
}

export const useCreateBlock = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({
    mutationFn: ({ sectionId, data }) => createBlock(sectionId, data),
    onSuccess: invalidate,
  })
}

export const useUpdateBlock = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({ mutationFn: ({ id, data }) => updateBlock(id, data), onSuccess: invalidate })
}

export const useDeleteBlock = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({ mutationFn: (id) => deleteBlock(id), onSuccess: invalidate })
}

/** Réordonnancement : liste COMPLÈTE des IDs dans le nouvel ordre (serveur gère les positions négatives). */
export const useReorderSections = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({
    mutationFn: ({ articleId, sectionIds }) => reorderSections(articleId, sectionIds),
    onSuccess: invalidate,
  })
}

/* ─── Points clés & chiffres clés (routes créées cycle 14) ────────────── */

export const useCreateTakeaway = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({
    mutationFn: ({ articleId, data }) =>
      import("@/api/admin/content-ext").then((m) => m.addTakeaway(articleId, data)),
    onSuccess: invalidate,
  })
}

export const useDeleteTakeaway = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({
    mutationFn: (id) => import("@/api/admin/content-ext").then((m) => m.removeTakeaway(id)),
    onSuccess: invalidate,
  })
}

export const useCreateKeyFigure = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({
    mutationFn: ({ articleId, data }) =>
      import("@/api/admin/content-ext").then((m) => m.addKeyFigure(articleId, data)),
    onSuccess: invalidate,
  })
}

export const useDeleteKeyFigure = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({
    mutationFn: (id) => import("@/api/admin/content-ext").then((m) => m.removeKeyFigure(id)),
    onSuccess: invalidate,
  })
}

/* ─── Catégories ──────────────────────────────────────────────────────── */

export const useAdminCategoriesQuery = () =>
  useQuery({
    queryKey: adminContenuKeys.categories,
    queryFn: ({ signal }) => getCategories({ signal }),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

export const useCreateCategory = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({ mutationFn: (data) => createCategory(data), onSuccess: invalidate })
}

export const useUpdateCategory = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({ mutationFn: ({ id, data }) => updateCategory(id, data), onSuccess: invalidate })
}

export const useDeleteCategory = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({ mutationFn: (id) => deleteCategory(id), onSuccess: invalidate })
}

/* ─── Conseils du jour ──────────────────────────────────────────────── */

export const useAdminDailyTipsQuery = () =>
  useQuery({
    queryKey: adminContenuKeys.dailyTips,
    queryFn: ({ signal }) => getDailyTips({ signal }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

export const useCreateDailyTip = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({ mutationFn: (data) => createDailyTip(data), onSuccess: invalidate })
}

export const useUpdateDailyTip = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({ mutationFn: ({ id, data }) => updateDailyTip(id, data), onSuccess: invalidate })
}

export const useDeleteDailyTip = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({ mutationFn: (id) => deleteDailyTip(id), onSuccess: invalidate })
}

/* ─── Séries ─────────────────────────────────────────────────────────── */

export const useAdminSeriesQuery = () =>
  useQuery({
    queryKey: adminContenuKeys.series,
    queryFn: ({ signal }) => getSeries({ signal }),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

export const useCreateSeries = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({ mutationFn: (data) => createSeries(data), onSuccess: invalidate })
}

export const useUpdateSeries = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({ mutationFn: ({ id, data }) => updateSeries(id, data), onSuccess: invalidate })
}

export const useDeleteSeries = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({ mutationFn: (id) => deleteSeries(id), onSuccess: invalidate })
}

/** Remplace TOUTE la composition — envoyer la liste complète d'IDs. */
export const useUpdateSeriesArticles = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({
    mutationFn: ({ id, articleIds }) => updateSeriesArticles(id, articleIds),
    onSuccess: invalidate,
  })
}

/* ─── Pages statiques (routes créées/typées cycle 14) ────────────────── */

export const useAdminPagesQuery = () =>
  useQuery({
    queryKey: adminContenuKeys.pages,
    queryFn: ({ signal }) => getPages({ signal }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

export const useCreatePage = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({
    mutationFn: (data) =>
      import("@/api/admin/content-ext").then((m) => m.createPageStatique(data)),
    onSuccess: invalidate,
  })
}

export const useUpdatePage = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({
    mutationFn: ({ id, data }) =>
      import("@/api/admin/content-ext").then((m) => m.updatePageStatique(id, data)),
    onSuccess: invalidate,
  })
}

/** Publication d'une page (PATCH /pages/{id}/status — published_at figé serveur). */
export const useChangerStatutPage = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({
    mutationFn: ({ id, status }) =>
      import("@/api/admin/content-ext").then((m) => m.changerStatutPage(id, status)),
    onSuccess: invalidate,
  })
}

export const useDeletePage = () => {
  const invalidate = useInvalidateContenu()
  return useMutation({ mutationFn: (id) => deletePage(id), onSuccess: invalidate })
}
