import axios from "axios"

/* ════════════════════════════════════════════════════════════════════
  Normalisation des erreurs API (FastAPI) → objet stable pour l'UI.
  { message, status, details, validationErrors, isCanceled }
════════════════════════════════════════════════════════════════════ */
export const isCanceledError = (err) =>
  axios.isCancel?.(err) === true ||
  err?.name === "CanceledError" ||
  err?.code === "ERR_CANCELED" ||
  err?.name === "AbortError"

export const formatApiError = (err) => {
  const formatted = {
    message: "Une erreur inattendue est survenue.",
    status: null,
    details: null,
    validationErrors: null,
    isCanceled: isCanceledError(err),
  }

  if (formatted.isCanceled) {
    formatted.message = "Requête annulée."
    return formatted
  }

  if (axios.isAxiosError(err)) {
    if (err.response) {
      const data = err.response.data
      formatted.status = err.response.status
      formatted.details = data
      const detail = data?.detail
      if (Array.isArray(detail)) {
        formatted.message = "Certains filtres envoyés sont invalides."
        formatted.validationErrors = detail.map((item) => ({
          field: Array.isArray(item?.loc) ? item.loc.join(".") : String(item?.loc ?? ""),
          message: item?.msg ?? "Valeur invalide",
          type: item?.type ?? null,
        }))
      } else if (typeof detail === "string") {
        formatted.message = detail
      } else {
        formatted.message = data?.message || err.response.statusText || `Erreur ${err.response.status}`
      }
    } else if (err.request) {
      formatted.message = "Le serveur ne répond pas — vérifiez votre connexion."
    } else {
      formatted.message = err.message
    }
  } else if (err instanceof Error) {
    formatted.message = err.message
  }

  return formatted
}
