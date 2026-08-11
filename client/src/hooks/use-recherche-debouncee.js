// src/hooks/use-recherche-debouncee.js
import { useEffect, useState } from "react"

/**
 * Champ de recherche : état local INSTANTANÉ → URL debouncée.
 * La saisie ne bloque jamais ; l'historique n'est pas pollué.
 * Réutilisable tel quel sur /offres et /filieres/:code.
 */
export const useRechercheDebouncee = ({
  valeurUrl,
  setScalar,
  cle = "query",
  delai = 350,
}) => {
  const [valeurLocale, setValeurLocale] = useState(valeurUrl)

  /* Synchronise si l'URL change de l'extérieur (reset, navigation, back) */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValeurLocale(valeurUrl)
  }, [valeurUrl])

  /* Debounce local → URL */
  useEffect(() => {
    if (valeurLocale === valeurUrl) return
    const timer = setTimeout(() => setScalar(cle, valeurLocale), delai)
    return () => clearTimeout(timer)
  }, [valeurLocale, valeurUrl, setScalar, cle, delai])

  return { valeurLocale, setValeurLocale }
}