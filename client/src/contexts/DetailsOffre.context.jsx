// src/pages/offres/detail/offre-detail.context.jsx
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react"
import { useParams } from "react-router-dom"
import { formatApiError } from "@/api/errors"
import { adaptOffer, adaptOffers } from "@/lib/offers-adapter"
import getFiliereTheme from "@/lib/filiere-theme"
import { HUES } from "@/lib/hues"
import {
  isNotFoundError,
  useOffreDetailQuery,
  useOffresSimilairesQuery,
  useSaveOffreMutation,
  useTrackOffreView,
  fakeHash
} from "@/tools/offre-detail.tools"

/* ════════════════════════════════════════════════════════════════════
   CONTEXTE DE PAGE — chaque section lit l'offre, la filière et les
   états « enregistrée / copiée » directement ici : zéro prop drilling.
   Avant : DetailsOffre → HeroOffre → CartePostuler (9 props relayées).
════════════════════════════════════════════════════════════════════ */
const OffreDetailContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useOffreDetail = () => {
  const ctx = useContext(OffreDetailContext)
  if (!ctx) {
    throw new Error("useOffreDetail doit être utilisé sous <OffreDetailProvider>")
  }
  return ctx
}

export const OffreDetailProvider = ({ children }) => {
  const { id } = useParams()

  /* Requêtes — détail + similaires partent EN PARALLÈLE.
     (Avant : getSimilarOffers attendait la fin de getOfferById.) */
  const detailQuery = useOffreDetailQuery(id)
  const similairesQuery = useOffresSimilairesQuery(id)

  /* Adaptation API → UI, mémoïsée */
  const offre = useMemo(() => {
    const raw = detailQuery.data
    if (!raw) return null
    const adapted = adaptOffer(raw)
    return adapted ? { ...adapted, detail: raw.detail ?? {} } : null
  }, [detailQuery.data])

  const meta = useMemo(() => getFiliereTheme(offre?.filiere), [offre?.filiere])
  const hue = meta ? HUES[meta.hue] : HUES.sky
  const hash = useMemo(() => (offre ? fakeHash(offre.id) : ""), [offre])
  const similaires = useMemo(
    () => adaptOffers(similairesQuery.data ?? []),
    [similairesQuery.data]
  )

  /* États locaux réinitialisés à chaque changement d'offre.
     (Avant : « Enregistrée » restait coché en naviguant entre offres.) */
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(false)
    setCopied(false)
  }, [id])

  /* Enregistrement — optimiste, rollback si l'API refuse */
  const saveMutation = useSaveOffreMutation()
  const toggleSave = useCallback(() => {
    if (!offre || saveMutation.isPending) return
    const next = !saved
    setSaved(next)
    saveMutation.mutate(offre.id, {
      onError: () => setSaved(!next),
    })
  }, [offre, saved, saveMutation])

  /* Copie du lien — timer nettoyé à la sortie */
  const copyTimer = useRef(null)
  useEffect(() => () => clearTimeout(copyTimer.current), [])
  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
    } catch {
      /* contexte non sécurisé */
    }
    setCopied(true)
    clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 2000)
  }, [])

  /* Vue comptée une seule fois, uniquement quand l'offre est affichable */
  useTrackOffreView(id, Boolean(offre))

  const notFound = detailQuery.isError && isNotFoundError(detailQuery.error)
  const hasError = detailQuery.isError && !notFound

  const value = useMemo(
    () => ({
      id,
      offre,
      meta,
      hue,
      hash,
      detail: offre?.detail ?? {},
      similaires,
      similairesQuery,
      saved,
      isSaving: saveMutation.isPending,
      toggleSave,
      copied,
      copyLink,
      isPending: detailQuery.isPending,
      notFound,
      hasError,
      errorMessage: hasError ? formatApiError(detailQuery.error) : null,
      retry: detailQuery.refetch,
    }),
    [id, offre, meta, hue, hash, similaires, similairesQuery, saved,
     saveMutation.isPending, toggleSave, copied, copyLink,
     detailQuery.isPending, notFound, hasError,
     detailQuery.error, detailQuery.refetch]
  )

  return (
    <OffreDetailContext.Provider value={value}>
      {children}
    </OffreDetailContext.Provider>
  )
}