import api from "../axiosInstance";
import { cleanParams } from "../utils";

const API_URL = "/api/filieres"


const getFilieres = async(params = {}, { signal } = {}) => {
  const response = await api.get(`${API_URL}`, { params: cleanParams(params), signal })
  return response.data
}

const getFilieresBySlug = async(slug, { signal } = {}) => {
  const response = await api.get(`${API_URL}/${slug}`, {signal})
  return response.data
}

const getFiliereOffers = async(slug, params = {}, { signal } = {}) => {
  const response = await api.get(`${API_URL}/${slug}/offers`, { params: cleanParams(params), signal })
  return response.data
}

const getFilieresStats = async(slug, { signal } = {}) => {
  const response = await api.get(`${API_URL}/${slug}/stats`, {signal})
  return response.data
}

export {
  getFilieres,
  getFilieresBySlug,
  getFiliereOffers,
  getFilieresStats
}