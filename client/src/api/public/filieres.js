import api from "../axiosInstance";
import { cleanParams } from "../utils";

const API_URL = "/api/filieres"


const getFilieres = async(params = {}) => {
  const response = await api.get(`${API_URL}`, { params: cleanParams(params) })
  return response.data
}

const getFilieresBySlug = async(slug) => {
  const response = await api.get(`${API_URL}/${slug}`)
  return response.data
}

const getFiliereOffers = async(slug, params = {}) => {
  const response = await api.get(`${API_URL}/${slug}/offers`, { params: cleanParams(params) })
  return response.data
}

const getFilieresStats = async(slug) => {
  const response = await api.get(`${API_URL}/${slug}/stats`)
  return response.data
}

export {
  getFilieres,
  getFilieresBySlug,
  getFiliereOffers,
  getFilieresStats
}