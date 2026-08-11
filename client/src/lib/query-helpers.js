// src/lib/query-helpers.js

/** Une 404 est définitive : inutile de la retenter. */
export const isNotFoundError = (error) =>
  error?.response?.status === 404 || error?.status === 404

/** Valeur d'un PromiseSettledResult réussi, sinon un repli. */
export const settled = (result, fallback = []) =>
  result?.status === "fulfilled" && Array.isArray(result.value) ? result.value : fallback

export const fmtVus = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",")} k` : n)