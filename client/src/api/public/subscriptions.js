import api from "../axiosInstance"
import { cleanParams } from "../utils";

const API_URL = "/api/subscriptions";

/**
 * 
 * @param {list} datadata : {
    "email": "string",
    "full_name": "string",
    "city": "string",
    "filieres": [
      "string"
    ],
    "experience": "string",
    "contract_types": [
      "string"
    ],
    "wants_career_tips": true,
    "source": "site"
  }
 */
const subscribe = async (data) => {
  const response = await api.post(API_URL, data)
  return response.data
}

const ConfirmSubscribe = async (token) => {
  const response = await api.get(`${API_URL}/confirm/${token}`)
  return response.data
}

const unsubscribe = async (token, params) => {
  const response = await api.post(`${API_URL}/unsubscribe/${token}`, { params: cleanParams(params) })
  return response.data
}

const getPreferences = async (token) => {
  const response = await api.get(`${API_URL}/preferences/${token}`)
  return response.data
}

/**
 * 
 * @param {string} token 
 * @param {list} data = {
    "filieres": [
      "string"
    ],
    "contract_types": [
      "string"
    ],
    "wants_career_tips": true
  }
 * @returns 
 */
const updatePreferences = async (token, data) => {
  const response = await api.put(`${API_URL}/preferences/${token}`, data)
  return response.data
}

export default {
  subscribe,
  ConfirmSubscribe,
  unsubscribe,
  getPreferences,
  updatePreferences
}