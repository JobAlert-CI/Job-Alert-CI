import adminApi from "./adminAxios"

/**
 * API contenu (super_admin + moderateur) — 4 onglets :
 * 1. Articles (+ catégories, séries, sections/blocs)
 * 2. Conseils du jour (daily-tips)
 * 3. Pages statiques
 * 4. FAQ (routes admin absentes du backend → désactivée côté UI avec note)
 */

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms))

const MOCK_CATEGORIES = [
  { id: "cat-1", code: "candidature", label: "Candidature", slug: "candidature", sort_order: 1, is_active: true },
  { id: "cat-2", code: "carriere", label: "Évolution de carrière", slug: "carriere", sort_order: 2, is_active: true },
  { id: "cat-3", code: "entretien", label: "Entretiens", slug: "entretien", sort_order: 3, is_active: true },
]

/* ─── Catégories ─── */
export const fetchCategories = async () => {
  try {
    const { data } = await adminApi.get("/content/categories")
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    return [...MOCK_CATEGORIES]
  }
}
export const createCategory = async (payload) => {
  const { data } = await adminApi.post("/content/categories", payload)
  return data
}
export const updateCategory = async (categoryId, payload) => {
  const { data } = await adminApi.put(`/content/categories/${categoryId}`, payload)
  return data
}
export const deleteCategory = async (categoryId) => {
  await adminApi.delete(`/content/categories/${categoryId}`)
}

/* ─── Séries ─── */
export const fetchSeries = async () => {
  try {
    const { data } = await adminApi.get("/content/series")
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    return [
      { id: "ser-1", title: "Premier emploi", slug: "premier-emploi", description: "Guide en 5 parties pour décrocher son premier poste.", sort_order: 1 },
    ]
  }
}
export const createSeries = async (payload) => {
  const { data } = await adminApi.post("/content/series", payload)
  return data
}
export const updateSeries = async (seriesId, payload) => {
  const { data } = await adminApi.put(`/content/series/${seriesId}`, payload)
  return data
}
export const deleteSeries = async (seriesId) => {
  await adminApi.delete(`/content/series/${seriesId}`)
}
export const updateSeriesArticles = async (seriesId, articleIds) => {
  const { data } = await adminApi.put(`/content/series/${seriesId}/articles`, { article_ids: articleIds })
  return data
}

/* ─── Articles ─── */
const MOCK_ARTICLES = [
  {
    id: "art-1",
    content_page_id: "cp-1",
    slug: "cv-qui-attire-recruteurs",
    title: "Le CV qui attire les recruteurs en Côte d'Ivoire",
    excerpt: "Structure, mots-clés et format : les règles d'or d'un CV efficace à Abidjan.",
    status: "published",
    is_featured: true,
    view_count: 1240,
    reading_minutes: 6,
    published_at: "2026-08-10T09:00:00Z",
    category_id: "cat-1",
    category: MOCK_CATEGORIES[0],
  },
  {
    id: "art-2",
    content_page_id: "cp-2",
    slug: "negocier-salaire-abidjan",
    title: "Négocier son salaire : le guide pratique",
    excerpt: "Fourchettes réelles par secteur et techniques de négociation adaptées au marché local.",
    status: "draft",
    is_featured: false,
    view_count: 0,
    reading_minutes: 8,
    published_at: null,
    category_id: "cat-2",
    category: MOCK_CATEGORIES[1],
  },
]

export const fetchArticles = async ({ q, status, category_id, limit = 20, offset = 0 } = {}) => {
  try {
    const { data } = await adminApi.get("/content/articles", {
      params: { q: q || undefined, status: status || undefined, category_id: category_id || undefined, limit, offset },
    })
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    let list = [...MOCK_ARTICLES]
    if (q) list = list.filter((a) => a.title?.toLowerCase().includes(q.toLowerCase()))
    if (status) list = list.filter((a) => a.status === status)
    if (category_id) list = list.filter((a) => a.category_id === category_id)
    return list.slice(offset, offset + limit)
  }
}

export const getArticleById = async (articleId) => {
  const { data } = await adminApi.get(`/content/articles/${articleId}`)
  return data
}

export const createArticle = async (payload) => {
  const { data } = await adminApi.post("/content/articles", payload)
  return data
}

export const updateArticle = async (articleId, payload) => {
  const { data } = await adminApi.put(`/content/articles/${articleId}`, payload)
  return data
}

export const updateArticleStatus = async (articleId, status) => {
  const { data } = await adminApi.patch(`/content/articles/${articleId}/status`, { status })
  return data
}

export const toggleArticleFeatured = async (articleId, isFeatured, featuredOrder) => {
  const { data } = await adminApi.patch(`/content/articles/${articleId}/featured`, {
    is_featured: isFeatured,
    featured_order: featuredOrder ?? null,
  })
  return data
}

/** Suppression logique. */
export const deleteArticle = async (articleId) => {
  await adminApi.delete(`/content/articles/${articleId}`)
}

/* ─── Sections & blocs d'article ─── */
export const addSection = async (articleId, payload) => {
  const { data } = await adminApi.post(`/content/articles/${articleId}/sections`, payload)
  return data
}
export const updateSection = async (sectionId, payload) => {
  const { data } = await adminApi.put(`/content/sections/${sectionId}`, payload)
  return data
}
export const deleteSection = async (sectionId) => {
  await adminApi.delete(`/content/sections/${sectionId}`)
}
/** Drag & drop des sections — remplacement complet de l'ordre. */
export const reorderSections = async (articleId, sectionIds) => {
  const { data } = await adminApi.put(`/content/articles/${articleId}/sections/reorder`, { section_ids: sectionIds })
  return data
}
export const addBlock = async (sectionId, payload) => {
  const { data } = await adminApi.post(`/content/sections/${sectionId}/blocks`, payload)
  return data
}
export const updateBlock = async (blockId, payload) => {
  const { data } = await adminApi.put(`/content/blocks/${blockId}`, payload)
  return data
}
export const deleteBlock = async (blockId) => {
  await adminApi.delete(`/content/blocks/${blockId}`)
}

/* ─── Conseils du jour ─── */
export const fetchDailyTips = async () => {
  try {
    const { data } = await adminApi.get("/content/daily-tips")
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    return [
      { id: "tip-1", text: "Personnalisez votre email de candidature pour chaque offre.", rotation_order: 1, is_active: true, category_id: null },
      { id: "tip-2", text: "Relisez-vous : une faute dans un CV coûte des entretiens.", rotation_order: 2, is_active: true, category_id: null },
      { id: "tip-3", text: "Activez les alertes JobAlert CI pour ne rien manquer.", rotation_order: 3, is_active: false, category_id: null },
    ]
  }
}
export const createDailyTip = async (payload) => {
  const { data } = await adminApi.post("/content/daily-tips", payload)
  return data
}
export const updateDailyTip = async (tipId, payload) => {
  const { data } = await adminApi.put(`/content/daily-tips/${tipId}`, payload)
  return data
}
export const deleteDailyTip = async (tipId) => {
  await adminApi.delete(`/content/daily-tips/${tipId}`)
}

/* ─── Pages statiques ─── */
export const fetchPages = async () => {
  try {
    const { data } = await adminApi.get("/content/pages")
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    return []
  }
}
export const createPage = async (payload) => {
  // ⚠ Correctif backend requis : ContentPageCreate/Update dédiés
  const { data } = await adminApi.post("/content/pages", payload)
  return data
}
export const updatePage = async (pageId, payload) => {
  const { data } = await adminApi.put(`/content/pages/${pageId}`, payload)
  return data
}
export const deletePage = async (pageId) => {
  await adminApi.delete(`/content/pages/${pageId}`)
}


