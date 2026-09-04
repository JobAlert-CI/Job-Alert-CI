import api from "../axiosInstance";
import { cleanParams } from "../utils";

const API_URL = "/api/articles";

/**
 * GET /api/articles
 * @param {Object} params category_id, q (min. 2), is_featured (bool),
 *   sort: "recent" | "popular" | "short" (défaut "recent"),
 *   limit (1-50, défaut 9), offset (>= 0)
 */
const getArticles = async (params = {}, { signal } = {}) => {
  const response = await api.get(API_URL, { params: cleanParams(params), signal });
  return response.data;
};

/** GET /api/articles/{slug} — article complet. */
const getArticleBySlug = async (slug, { signal } = {}) => {
  const response = await api.get(`${API_URL}/${encodeURIComponent(slug)}`, { signal });
  return response.data;
};

/** GET /api/articles/{slug}/related — params : { limit } (1-6, défaut 3). */
const getArticlesSimilar = async (slug, params = {}, { signal } = {}) => {
  const response = await api.get(`${API_URL}/${encodeURIComponent(slug)}/related`, {
    params: cleanParams(params),
    signal,
  });
  return response.data;
};

/** GET /api/articles/categories */
const getArticleCategories = async ({ signal } = {}) => {
  const response = await api.get(`${API_URL}/categories`, { signal });
  return response.data;
};

/** GET /api/articles/featured */
const getArticleFeatured = async ({ signal } = {}) => {
  const response = await api.get(`${API_URL}/featured`, { signal });
  return response.data;
};

/** GET /api/articles/daily-tip — un seul conseil du jour. */
const getArticlesDaily = async ({ signal } = {}) => {
  const response = await api.get(`${API_URL}/daily-tip`, { signal });
  return response.data;
};

/** GET /api/articles/series */
const getArticleSeries = async ({ signal } = {}) => {
  const response = await api.get(`${API_URL}/series`, { signal });
  return response.data;
};

/** GET /api/articles/popular — params : { limit } (1-10, défaut 5). */
const getArticlesPopular = async (params = {}, { signal } = {}) => {
  const response = await api.get(`${API_URL}/popular`, { params: cleanParams(params), signal });
  return response.data;
};

/** POST /api/articles/{slug}/view */
const incrementeView = async (slug, { signal } = {}) => {
  const response = await api.post(`${API_URL}/${encodeURIComponent(slug)}/view`, null, { signal });
  return response.data;
};

export {
  getArticles,
  getArticleBySlug,
  getArticlesSimilar,
  getArticleCategories,
  getArticleFeatured,
  getArticlesDaily,
  getArticleSeries,
  getArticlesPopular,
  incrementeView,
};

export default {
  getArticles,
  getArticleBySlug,
  getArticlesSimilar,
  getArticleCategories,
  getArticleFeatured,
  getArticlesDaily,
  getArticleSeries,
  getArticlesPopular,
  incrementeView,
};
