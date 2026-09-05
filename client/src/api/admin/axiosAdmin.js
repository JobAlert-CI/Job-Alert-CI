import axios from "axios";

/* Instance dediee au back-office admin : ajoute le Bearer JWT et gere la
   rotation du refresh token (audit 2 : rotation a chaque /refresh, usage
   unique, revocation de famille en cas de reuse detecte cote serveur).

   Les tokens vivent en localStorage (`jobalert_admin_tokens`). La rotation
   n'est pas re-entrante : un mutex par requete evite qu'une salve de 401
   declenche plusieurs appels /refresh en parallele (le second re-use serait
   refuse par le serveur et revoquerait toute la famille). */

const TOKENS_STORAGE_KEY = "jobalert_admin_tokens";

/** @typedef {{access_token: string, refresh_token: string, token_type: string, admin_id: string, role: string}} AdminTokens */

/** @returns {AdminTokens|null} */
const getStoredTokens = () => {
  try {
    const raw = window.localStorage.getItem(TOKENS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const setStoredTokens = (tokens) => {
  try {
    window.localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    /* localStorage indisponible (navigation privee) : on continue sans cache. */
  }
};

const clearStoredTokens = () => {
  try {
    window.localStorage.removeItem(TOKENS_STORAGE_KEY);
  } catch {
    /* idem : echec de suppression non bloquant */
  }
};

const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  timeout: 30000,
  headers: { Accept: "application/json" },
});

/* ─── Intercepteur requete : bearer token ───────────────────────────── */
adminApi.interceptors.request.use((config) => {
  const tokens = getStoredTokens();
  if (tokens?.access_token) {
    config.headers.Authorization = `Bearer ${tokens.access_token}`;
  }
  return config;
});

/* ─── Intercepteur reponse : rotation au 401 ────────────────────────── */
let refreshInFlight = null;

adminApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error?.config;
    const status = error?.response?.status;

    // Pas un 401, ou requete deja retentee, ou echec du /refresh lui-meme :
    // on ne boucle pas.
    if (status !== 401 || !original || original._retried || original.__isRefreshCall) {
      return Promise.reject(error);
    }

    const tokens = getStoredTokens();
    if (!tokens?.refresh_token) {
      clearStoredTokens();
      return Promise.reject(error);
    }

    // Mutex : si une rotation est deja en cours, on attend SON resultat
    // (le refresh token est a usage unique, un second appel serait un
    // "reuse detecte" et revoquerait la famille cote serveur).
    try {
      const newTokens =
        refreshInFlight ??
        (refreshInFlight = axios
          .post(
            `${adminApi.defaults.baseURL || ""}/api/admin/auth/refresh`,
            { refresh_token: tokens.refresh_token },
            { headers: { Accept: "application/json" } },
          )
          .then((response) => {
            setStoredTokens(response.data);
            return response.data;
          })
          .finally(() => {
            refreshInFlight = null;
          }));
      original._retried = true;
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${newTokens.access_token}`;
      return adminApi(original);
    } catch (refreshError) {
      clearStoredTokens();
      // Session invalide même après rotation (famille révoquée serveur) :
      // on signale le layout admin pour le message dédié avant purge du cache.
      try {
        window.dispatchEvent(new CustomEvent("jobalert:admin-session-revoquee"));
      } catch { /* environnement sans DOM : silencieux */ }
      return Promise.reject(refreshError);
    }
  },
);

/* Export bruts de la gestion des tokens : utilises par adminApi/auth. */
export { adminApi, getStoredTokens, setStoredTokens, clearStoredTokens };
export default adminApi;
