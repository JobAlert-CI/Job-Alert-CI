import api from "../axiosInstance"
import { cleanParams } from "../utils";

const API_URL = "/api/offers";

const getOffers = async(params = {}) => {
  const response = await api.get(`${API_URL}`, { params: cleanParams(params) })
  return response.data
}

const getOfferById = async(id) => {
  const response = await api.get(`${API_URL}/${id}`)
  return response.data
}

const getSimilarOffers = async(id, params = {}) => {
  const response = await api.get(`${API_URL}/${id}/similar`, { params: cleanParams(params) })
  return response.data
}

const incrementeView = async(id) => {
  const response = await api.post(`${API_URL}/${id}/view`)
  return response.data
}

const saveOffer = async(id) => {
  const response = await api.post(`${API_URL}/${id}/save`)
  return response.data
}


export {
  getOffers,
  getOfferById,
  getSimilarOffers,
  incrementeView,
  saveOffer
}
