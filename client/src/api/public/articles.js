import api from "../axiosInstance";
import { cleanParams } from "../utils";

const API_URL = "/api/articles"


const getArticles = async (params = {}, { signal } = {}) => {
  const response = await api.get(`${API_URL}`, { params: cleanParams(params), signal })
  return response.data
}

const getArticleBySlug = async(slug, { signal } = {}) => {
  const response = await api.get(`${API_URL}/${slug}`, {signal})
  return response.data
}

const getArticlesSimilar = async(slug, params={}, { signal } = {}) => {
  const response = await api.get(`${API_URL}/${slug}/related`, { params: cleanParams(params), signal })
  return response.data
}

const getArticleCategories = async ({ signal } = {}) => {
  const response = await api.get(`${API_URL}/categories`, {signal})
  return response.data
}

const getArticleFeatured = async ({ signal } = {}) => {
  const response = await api.get(`${API_URL}/featured`, {signal})
  return response.data
}

const getArticlesDaily = async ({ signal } = {}) => {
  const response = await api.get(`${API_URL}/daily-tip`, {signal})
  return response.data
}

const getArticleSeries = async ({ signal } = {}) => {
  const response = await api.get(`${API_URL}/series`, {signal})
  return response.data
}

const getArticlesPopular = async (params = {}, { signal } = {}) => {
  const response = await api.get(`${API_URL}/popular`, { params: cleanParams(params), signal })
  return response.data
}

const incrementeView = async(slug) => {
  const response = await api.post(`${API_URL}/${slug}/view`)
  return response.data
}

export {
  getArticles,
  getArticleBySlug,
  getArticlesSimilar,
  getArticleCategories,
  getArticleFeatured,
  getArticlesDaily,
  getArticleSeries,
  getArticlesPopular,
  incrementeView
}