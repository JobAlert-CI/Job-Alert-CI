import api from "../axiosInstance";

const API_URL = "/api/referentials";

const getSources = async() => {
  const response = await api.get(`${API_URL}/sources`)
  return response.data
}

const getFilieres = async() => {
  const response = await api.get(`${API_URL}/filieres`)
  return response.data
}

const getFilieresBySlug = async(slug) => {
  const response = await api.get(`${API_URL}/filieres/${slug}`)
  return response.data
}

const getSpecialitesFiliere = async(slug) => {
  const response = await api.get(`${API_URL}/filieres/${slug}/specialites`)
  return response.data
}

const getContractTypes = async() => {
  const response = await api.get(`${API_URL}/contract-types`)
  return response.data
}

const getExperienceLevels = async() => {
  const response = await api.get(`${API_URL}/experience-levels`)
  return response.data
}

const getEducationLevels = async() => {
  const response = await api.get(`${API_URL}/education-levels`)
  return response.data
}

const getLocations = async() => {
  const response = await api.get(`${API_URL}/locations`)
  return response.data
}


export {
  getSources,
  getFilieres,
  getFilieresBySlug,
  getSpecialitesFiliere,
  getContractTypes,
  getExperienceLevels,
  getEducationLevels,
  getLocations
}