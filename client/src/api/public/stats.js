import api from "../axiosInstance";
import { cleanParams } from "../utils";

const API_URL = "/api/stats"

const getGlobalSats = async () => {
  const response = await api.get(`${API_URL}/global`)
  return response.data
}

const getPipelineStatus = async () => {
  const response = await api.get(`${API_URL}/pipeline`)
  return response.data
}

const getOfferSats = async (params = {}) => {
  const response = await api.get(`${API_URL}/offers`, { params: cleanParams(params) })
  return response.data
}

const getOfferSatsByFiliere = async (params = {}) => {
  const response = await api.get(`${API_URL}/offers/by-filiere`, { params: cleanParams(params) })
  return response.data
}

const getOfferSatsBySource = async (params = {}) => {
  const response = await api.get(`${API_URL}/offers/by-source`, { params: cleanParams(params) })
  return response.data
}

const getOfferSatsByContract = async (params = {}) => {
  const response = await api.get(`${API_URL}/offers/by-contract`, { params: cleanParams(params) })
  return response.data
}

export {
  getGlobalSats,
  getPipelineStatus,
  getOfferSats,
  getOfferSatsByFiliere,
  getOfferSatsBySource,
  getOfferSatsByContract
}