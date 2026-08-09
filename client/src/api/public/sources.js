import api from "../axiosInstance";
import { cleanParams } from "../utils";

const API_URL = "/api/sources"


const getSources = async() => {
  const response = await api.get(`${API_URL}`)
  return response.data
}

const getSourcesBySlug = async(slug) => {
  const response = await api.get(`${API_URL}/${slug}`)
  return response.data
}

const getSourceOffers = async(slug, params = {}) => {
  const response = await api.get(`${API_URL}/${slug}/offers`, { params: cleanParams(params) })
  return response.data
}

export {
  getSources,
  getSourcesBySlug,
  getSourceOffers
}