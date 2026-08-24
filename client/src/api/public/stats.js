import api from "../axiosInstance";
import { cleanParams } from "../utils";

const API_URL = "/api/stats"

const getGlobalSats = async ({ signal } = {}) => {
  const response = await api.get(`${API_URL}/global`, {signal})
  return response.data
}

const getPipelineStatus = async ({ signal } = {}) => {
  const response = await api.get(`${API_URL}/pipeline`, {signal})
  return response.data
}

const getOfferSats = async (params = {}, { signal } = {}) => {
  const response = await api.get(`${API_URL}/offers`, { params: cleanParams(params), signal })
  return response.data
}

const getOfferSatsByFiliere = async (params = {}, { signal } = {}) => {
  const response = await api.get(`${API_URL}/offers/by-filiere`, { params: cleanParams(params), signal })
  return response.data
}

const getOfferSatsBySource = async (params = {}, { signal } = {}) => {
  const response = await api.get(`${API_URL}/offers/by-source`, { params: cleanParams(params), signal })
  return response.data
}

const getOfferSatsByContract = async (params = {}, { signal } = {}) => {
  const response = await api.get(`${API_URL}/offers/by-contract`, { params: cleanParams(params), signal })
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