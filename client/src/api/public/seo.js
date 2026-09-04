import api from "../axiosInstance";

/** GET /sitemap.xml — renvoie le XML brut (route SEO du backend). */
const getSitemap = async ({ signal } = {}) => {
  const response = await api.get("/sitemap.xml", { signal, responseType: "text" });
  return response.data;
};

export { getSitemap };

export default { getSitemap };
