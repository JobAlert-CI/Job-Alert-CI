import axios from "axios"

export const isCanceledError = (err) =>
  err?.isCanceled === true ||
  axios.isCancel?.(err) === true ||
  err?.name === "CanceledError" ||
  err?.code === "ERR_CANCELED" ||
  err?.name === "AbortError"

export const formatApiError = (err) => {
  // 1. Une requête annulée n'est PAS une erreur à afficher à l'utilisateur
  if (isCanceledError(err)) {
    return null 
  }

  if (axios.isAxiosError(err)) {
    if (err.response) {
      const data = err.response.data
      const detail = data?.detail
      
      // 2. On extrait toujours une chaîne de caractères exploitable par l'UI
      if (Array.isArray(detail)) {
        return detail.map((item) => item?.msg || "Valeur invalide").join(", ")
      }
      if (typeof detail === "string") {
        return detail
      }
      return data?.message || err.response.statusText || `Erreur ${err.response.status}`
    }
    if (err.request) {
      return "Impossible de joindre le serveur. Vérifiez votre connexion."
    }
  }
  
  // Fallback sécurisé pour les objets Error standards
  return err?.message || "Une erreur inattendue est survenue."
}