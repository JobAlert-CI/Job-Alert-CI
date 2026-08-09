import api from "../axiosInstance";


const API_URL = "/api/contact";

/**
 * 
 * @param {list} data = {
    "full_name": "string",
    "email": "string",
    "subject_code": "string",
    "message": "string"
  }
 * @returns 
 */
const createContact = async(data) => {
  const response = await api.post(API_URL, data)
  return response.data
}

export default {
  createContact
}