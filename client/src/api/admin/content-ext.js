import adminApi from "./axiosAdmin"

/* ─────────────────────────────────────────────────────────────────────
   Extensions du module content (cycle 14) — routes créées côté serveur
   pour la page Contenu :
   - takeaways / key-figures (doc v3 §14.1 : points clés & chiffres) ;
   - PATCH /pages/{id}/status (publication des pages statiques).

   Vérifiées live + 8 tests pytest (server/tests/test_admin_content_cycle14.py).
   ───────────────────────────────────────────────────────────────────── */

const API_URL = "/api/admin/content"

/** POST /articles/{id}/takeaways {text, position?} → ArticleRead (liste complète re-sérialisée). */
const addTakeaway = async (articleId, data, { signal } = {}) => {
  const response = await adminApi.post(
    `${API_URL}/articles/${encodeURIComponent(articleId)}/takeaways`,
    data,
    { signal },
  )
  return response.data
}

/** DELETE /takeaways/{id} → 204 (positions recompactées serveur). */
const removeTakeaway = async (takeawayId, { signal } = {}) => {
  await adminApi.delete(`${API_URL}/takeaways/${encodeURIComponent(takeawayId)}`, { signal })
  return true
}

/** POST /articles/{id}/key-figures {value, label, prefix?, suffix?, position?} → ArticleRead. */
const addKeyFigure = async (articleId, data, { signal } = {}) => {
  const response = await adminApi.post(
    `${API_URL}/articles/${encodeURIComponent(articleId)}/key-figures`,
    data,
    { signal },
  )
  return response.data
}

/** DELETE /key-figures/{id} → 204. */
const removeKeyFigure = async (figureId, { signal } = {}) => {
  await adminApi.delete(`${API_URL}/key-figures/${encodeURIComponent(figureId)}`, { signal })
  return true
}

/** POST /pages {content_type, slug, title, …} → 201, statut initial draft. */
const createPageStatique = async (data, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/pages`, data, { signal })
  return response.data
}

/** PUT /pages/{id} — champs fournis uniquement (slug/type immuables). */
const updatePageStatique = async (pageId, data, { signal } = {}) => {
  const response = await adminApi.put(
    `${API_URL}/pages/${encodeURIComponent(pageId)}`,
    data,
    { signal },
  )
  return response.data
}

/** PATCH /pages/{id}/status {status} — published_at figé à la 1re publication. */
const changerStatutPage = async (pageId, status, { signal } = {}) => {
  const response = await adminApi.patch(
    `${API_URL}/pages/${encodeURIComponent(pageId)}/status`,
    { status },
    { signal },
  )
  return response.data
}

export {
  addTakeaway,
  removeTakeaway,
  addKeyFigure,
  removeKeyFigure,
  createPageStatique,
  updatePageStatique,
  changerStatutPage,
}

export default {
  addTakeaway,
  removeTakeaway,
  addKeyFigure,
  removeKeyFigure,
  createPageStatique,
  updatePageStatique,
  changerStatutPage,
}
