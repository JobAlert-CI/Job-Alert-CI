import api from "../axiosInstance";

const API_URL = "/api/contact";

/**
 * POST /api/contact → 201
 * @param {Object} data { full_name, email, subject_code, message }
 */
const createContact = async (data, { signal } = {}) => {
  const response = await api.post(API_URL, data, { signal });
  return response.data;
};

export { createContact };

export default { createContact };
