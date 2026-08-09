import api from "../axiosInstance";
import { cleanParams } from "../utils";

const API_URL = "/api/articles"


const getArticles = async (params = {}) => {
  const response = await api.get(`${API_URL}`, { params: cleanParams(params) })
  return response.data
}

const getArticleBySlug = async(slug) => {
  const response = await api.get(`${API_URL}/${slug}`)
  return response.data
}

const getArticlesSimilar = async(slug, params={}) => {
  const response = await api.get(`${API_URL}/${slug}/related`, { params: cleanParams(params) })
  return response.data
}

const getArticleCategories = async () => {
  const response = await api.get(`${API_URL}/categories`)
  return response.data
}

const getArticleFeatured = async () => {
  const response = await api.get(`${API_URL}/featured`)
  return response.data
}

const getArticlesDaily = async () => {
  const response = await api.get(`${API_URL}/daily-tip`)
  return response.data
}

const getArticleSeries = async () => {
  const response = await api.get(`${API_URL}/series`)
  return response.data
}

const getArticlesPopular = async (params = {}) => {
  const response = await api.get(`${API_URL}/popular`, { params: cleanParams(params) })
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