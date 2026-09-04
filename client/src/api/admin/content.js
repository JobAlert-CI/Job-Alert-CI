import adminApi from "./axiosAdmin";
import { cleanParams } from "../utils";

/* Gestion de contenu editorial : articles, sections/blocs, categories,
   conseils du jour, series, pages statiques. */

const API_URL = "/api/admin/content";

/* ─── Articles ───────────────────────────────────────────────────────── */

/**
 * GET /api/admin/content/articles
 * @param {Object} params status ("draft"|"published"|"archived"), category_id, q, limit (1-100, defaut 20), offset
 */
const getArticles = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/articles`, { params: cleanParams(params), signal });
  return response.data;
};

/** GET /api/admin/content/articles/{article_id} — article complet avec sections/blocs. */
const getArticle = async (articleId, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/articles/${encodeURIComponent(articleId)}`, { signal });
  return response.data;
};

/** POST /api/admin/content/articles → 201. */
const createArticle = async (data, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/articles`, data, { signal });
  return response.data;
};

/** PUT /api/admin/content/articles/{article_id}. */
const updateArticle = async (articleId, data, { signal } = {}) => {
  const response = await adminApi.put(`${API_URL}/articles/${encodeURIComponent(articleId)}`, data, { signal });
  return response.data;
};

/** PATCH /api/admin/content/articles/{article_id}/status — body { status: "draft"|"published"|"archived" }. */
const updateArticleStatus = async (articleId, status, { signal } = {}) => {
  const response = await adminApi.patch(
    `${API_URL}/articles/${encodeURIComponent(articleId)}/status`,
    { status },
    { signal },
  );
  return response.data;
};

/** PATCH /api/admin/content/articles/{article_id}/featured — body { is_featured, featured_order }. */
const updateArticleFeatured = async (articleId, data, { signal } = {}) => {
  const response = await adminApi.patch(
    `${API_URL}/articles/${encodeURIComponent(articleId)}/featured`,
    data,
    { signal },
  );
  return response.data;
};

/** DELETE /api/admin/content/articles/{article_id} → 204. */
const deleteArticle = async (articleId, { signal } = {}) => {
  await adminApi.delete(`${API_URL}/articles/${encodeURIComponent(articleId)}`, { signal });
  return true;
};

/* ─── Sections et blocs ──────────────────────────────────────────────── */

/** POST /api/admin/content/articles/{article_id}/sections → 201 — nouvelle section. */
const createSection = async (articleId, data, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/articles/${encodeURIComponent(articleId)}/sections`, data, { signal });
  return response.data;
};

/** PUT /api/admin/content/sections/{section_id}. */
const updateSection = async (sectionId, data, { signal } = {}) => {
  const response = await adminApi.put(`${API_URL}/sections/${encodeURIComponent(sectionId)}`, data, { signal });
  return response.data;
};

/** DELETE /api/admin/content/sections/{section_id} → 204. */
const deleteSection = async (sectionId, { signal } = {}) => {
  await adminApi.delete(`${API_URL}/sections/${encodeURIComponent(sectionId)}`, { signal });
  return true;
};

/** POST /api/admin/content/sections/{section_id}/blocks → 201 — nouveau bloc. */
const createBlock = async (sectionId, data, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/sections/${encodeURIComponent(sectionId)}/blocks`, data, { signal });
  return response.data;
};

/** PUT /api/admin/content/blocks/{block_id}. */
const updateBlock = async (blockId, data, { signal } = {}) => {
  const response = await adminApi.put(`${API_URL}/blocks/${encodeURIComponent(blockId)}`, data, { signal });
  return response.data;
};

/** DELETE /api/admin/content/blocks/{block_id} → 204. */
const deleteBlock = async (blockId, { signal } = {}) => {
  await adminApi.delete(`${API_URL}/blocks/${encodeURIComponent(blockId)}`, { signal });
  return true;
};

/**
 * PUT /api/admin/content/articles/{article_id}/sections/reorder
 * Remplacement complet de l'ordre des sections — body { section_ids: string[] }.
 */
const reorderSections = async (articleId, sectionIds, { signal } = {}) => {
  const response = await adminApi.put(
    `${API_URL}/articles/${encodeURIComponent(articleId)}/sections/reorder`,
    { section_ids: sectionIds },
    { signal },
  );
  return response.data;
};

/* ─── Categories ─────────────────────────────────────────────────────── */

/** GET /api/admin/content/categories. */
const getCategories = async ({ signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/categories`, { signal });
  return response.data;
};

/** POST /api/admin/content/categories → 201. */
const createCategory = async (data, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/categories`, data, { signal });
  return response.data;
};

/** PUT /api/admin/content/categories/{category_id}. */
const updateCategory = async (categoryId, data, { signal } = {}) => {
  const response = await adminApi.put(`${API_URL}/categories/${encodeURIComponent(categoryId)}`, data, { signal });
  return response.data;
};

/** DELETE /api/admin/content/categories/{category_id} → 204. */
const deleteCategory = async (categoryId, { signal } = {}) => {
  await adminApi.delete(`${API_URL}/categories/${encodeURIComponent(categoryId)}`, { signal });
  return true;
};

/* ─── Conseils du jour ──────────────────────────────────────────────── */

/** GET /api/admin/content/daily-tips. */
const getDailyTips = async ({ signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/daily-tips`, { signal });
  return response.data;
};

/** POST /api/admin/content/daily-tips → 201. */
const createDailyTip = async (data, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/daily-tips`, data, { signal });
  return response.data;
};

/** PUT /api/admin/content/daily-tips/{tip_id}. */
const updateDailyTip = async (tipId, data, { signal } = {}) => {
  const response = await adminApi.put(`${API_URL}/daily-tips/${encodeURIComponent(tipId)}`, data, { signal });
  return response.data;
};

/** DELETE /api/admin/content/daily-tips/{tip_id} → 204. */
const deleteDailyTip = async (tipId, { signal } = {}) => {
  await adminApi.delete(`${API_URL}/daily-tips/${encodeURIComponent(tipId)}`, { signal });
  return true;
};

/* ─── Series ─────────────────────────────────────────────────────────── */

/** GET /api/admin/content/series. */
const getSeries = async ({ signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/series`, { signal });
  return response.data;
};

/** POST /api/admin/content/series → 201. */
const createSeries = async (data, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/series`, data, { signal });
  return response.data;
};

/** PUT /api/admin/content/series/{series_id}. */
const updateSeries = async (seriesId, data, { signal } = {}) => {
  const response = await adminApi.put(`${API_URL}/series/${encodeURIComponent(seriesId)}`, data, { signal });
  return response.data;
};

/** DELETE /api/admin/content/series/{series_id} → 204. */
const deleteSeries = async (seriesId, { signal } = {}) => {
  await adminApi.delete(`${API_URL}/series/${encodeURIComponent(seriesId)}`, { signal });
  return true;
};

/**
 * PUT /api/admin/content/series/{series_id}/articles — remplacement complet
 * de la liste des articles d'une serie — body { article_ids: string[] }.
 */
const updateSeriesArticles = async (seriesId, articleIds, { signal } = {}) => {
  const response = await adminApi.put(
    `${API_URL}/series/${encodeURIComponent(seriesId)}/articles`,
    { article_ids: articleIds },
    { signal },
  );
  return response.data;
};

/* ─── Pages statiques ─────────────────────────────────────────────────── */

/** GET /api/admin/content/pages. */
const getPages = async ({ signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/pages`, { signal });
  return response.data;
};

/** POST /api/admin/content/pages → 201. */
const createPage = async (data, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/pages`, data, { signal });
  return response.data;
};

/** PUT /api/admin/content/pages/{page_id}. */
const updatePage = async (pageId, data, { signal } = {}) => {
  const response = await adminApi.put(`${API_URL}/pages/${encodeURIComponent(pageId)}`, data, { signal });
  return response.data;
};

/** DELETE /api/admin/content/pages/{page_id} → 204. */
const deletePage = async (pageId, { signal } = {}) => {
  await adminApi.delete(`${API_URL}/pages/${encodeURIComponent(pageId)}`, { signal });
  return true;
};

export {
  getArticles,
  getArticle,
  createArticle,
  updateArticle,
  updateArticleStatus,
  updateArticleFeatured,
  deleteArticle,
  createSection,
  updateSection,
  deleteSection,
  createBlock,
  updateBlock,
  deleteBlock,
  reorderSections,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getDailyTips,
  createDailyTip,
  updateDailyTip,
  deleteDailyTip,
  getSeries,
  createSeries,
  updateSeries,
  deleteSeries,
  updateSeriesArticles,
  getPages,
  createPage,
  updatePage,
  deletePage,
};

export default {
  getArticles,
  getArticle,
  createArticle,
  updateArticle,
  updateArticleStatus,
  updateArticleFeatured,
  deleteArticle,
  createSection,
  updateSection,
  deleteSection,
  createBlock,
  updateBlock,
  deleteBlock,
  reorderSections,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getDailyTips,
  createDailyTip,
  updateDailyTip,
  deleteDailyTip,
  getSeries,
  createSeries,
  updateSeries,
  deleteSeries,
  updateSeriesArticles,
  getPages,
  createPage,
  updatePage,
  deletePage,
};
