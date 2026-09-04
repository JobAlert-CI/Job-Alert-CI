import axios from "axios";

/* Site public sans cookies d'authentification → withCredentials inutile,
   et contraignant côté CORS si l'API est séparée (cf. Audit.md P2-12). */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  timeout: 20000,
  headers: { Accept: "application/json" },
});

export default api;
