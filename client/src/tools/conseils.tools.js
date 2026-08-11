import { Clock, Flame, Zap } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import {
  getArticles, getArticleCategories, getArticleFeatured,
  getArticlesDaily, getArticleSeries, getArticlesPopular,
} from "@/api/public/articles"

export const LIMIT_ARTICLES = 50
export const MAX_LOTS_ARTICLES = 9
export const PAR_PAGE = 9
export const DUREE_UNE = 6500
export const DUREE_CONSEIL = 5000

/** Filtres ↔ URL : /conseils?cat=cv-lettres&tri=populaires&q=entretien */
export const CONFIG_FILTRES = {
  scalars: [
    { key: "cat", param: "cat", defaut: "tous" },
    { key: "sort", param: "tri", defaut: "recents" },
    { key: "query", param: "q", defaut: "" },
  ],
}

export const MODES_TRI = [
  { k: "recents", l: "Récents", I: Clock },
  { k: "populaires", l: "Populaires", I: Flame },
  { k: "courts", l: "Courts", I: Zap },
]

export const TRI_DRAWER = [
  { k: "recents", l: "Plus récents" },
  { k: "populaires", l: "Plus lus" },
  { k: "courts", l: "Lecture courte" },
]

// src/pages/conseils/conseils.animations.js
export const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
}

export const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

export const variantsGlissement = {
  entrer: (dir) => ({ opacity: 0, x: 64 * dir }),
  visible: { opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  sortir: (dir) => ({ opacity: 0, x: -48 * dir, transition: { duration: 0.28, ease: "easeIn" } }),
}

export const variantsGlissementDoux = {
  entrer: (dir) => ({ opacity: 0, x: 32 * dir }),
  visible: { opacity: 1, x: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
  sortir: (dir) => ({ opacity: 0, x: -24 * dir, transition: { duration: 0.25, ease: "easeIn" } }),
}

// src/pages/conseils/conseils.utils.js

/** Normalisation recherche : minuscules + suppression des accents. */
export const normaliser = (texte = "") =>
  String(texte)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

export const joursDepuis = (iso) => {
  if (!iso) return 0
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 0
  const debut = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diff = Math.round((debut(new Date()) - debut(date)) / 86_400_000)
  return diff > 0 ? diff : 0
}

/** Conseils quotidiens bruts → format UI (payload objet ou tableau). */
export const adaptConseilsQuotidiens = (payload, index = []) => {
  const brut = Array.isArray(payload) ? payload : payload ? [payload] : []
  return brut
    .filter((t) => t?.text)
    .map((t) => ({
      id: t.id ?? t.text,
      t: t.text,
      cat: index.find((c) => c.id === t.category_id) ?? {},
    }))
}

export const estErreur404 = (erreur) =>
  erreur?.response?.status === 404 || erreur?.status === 404

/**
 * Filtrage + tri des articles — fonction pure (testable).
 * Recherche insensible aux accents, étendue au libellé de catégorie.
 */
export const filtrerEtTrierArticles = (articles, cat, rechercheNormee, sort) => {
  const list = articles.filter((a) => {
    if (cat !== "tous" && a.category?.code !== cat) return false
    if (!rechercheNormee) return true
    return (
      normaliser(a.title ?? "").includes(rechercheNormee) ||
      normaliser(a.excerpt ?? "").includes(rechercheNormee) ||
      normaliser(a.category?.label ?? "").includes(rechercheNormee)
    )
  })

  if (sort === "populaires") list.sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
  else if (sort === "courts") list.sort((a, b) => (a.reading_minutes ?? 999) - (b.reading_minutes ?? 999))
  else list.sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0))

  return list
}

/** Pagination avec ellipses. */
export const pagesAvecEllipses = (page, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const ens = new Set([1, totalPages, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((p) => ens.add(p))
  if (page >= totalPages - 2) {
    [totalPages - 1, totalPages - 2, totalPages - 3].forEach((p) => ens.add(p))
  }
  const liste = [...ens].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const avec = []
  let prec = 0
  for (const p of liste) {
    if (p - prec > 1) avec.push("…")
    avec.push(p)
    prec = p
  }
  return avec
}

/** Moyenne de lecture arrondie (repli : 5 min). */
export const moyenneLecture = (articles = []) => {
  if (!articles.length) return 5
  const somme = articles.reduce((acc, a) => acc + (Number(a.reading_minutes) || 0), 0)
  return Math.max(1, Math.round(somme / articles.length))
}


/* ════════════════════════════════════════════════════════════════════
   CLÉS DE CACHE — une par ressource. Chaque section consomme SON hook :
   chargement délégué, zéro prop drilling, déduplication automatique.
════════════════════════════════════════════════════════════════════ */
export const conseilsKeys = {
  root: ["conseils"],
  articles: ["conseils", "articles", "tous"],
  categories: ["conseils", "categories"],
  featured: ["conseils", "a-la-une"],
  daily: ["conseils", "conseil-du-jour"],
  series: ["conseils", "series"],
  popular: ["conseils", "populaires"],
}

const enListe = (data) => (Array.isArray(data) ? data : data ? [data] : [])

/**
 * Tous les articles, chargés par lots.
 * AVANT : boucle séquentielle → jusqu'à 9 allers-retours réseau.
 * APRÈS : tous les lots partent EN PARALLÈLE (un seul round-trip) ;
 * on recoupe au premier lot court ou en échec — même sémantique.
 */
const chargerTousArticles = async () => {
  const lots = await Promise.allSettled(
    Array.from({ length: MAX_LOTS_ARTICLES }, (_, i) =>
      getArticles({ limit: LIMIT_ARTICLES, offset: i * LIMIT_ARTICLES, sort: "recent" })
    )
  )
  const articles = []
  for (const lot of lots) {
    if (lot.status === "rejected") break
    const liste = Array.isArray(lot.value) ? lot.value : []
    articles.push(...liste)
    if (liste.length < LIMIT_ARTICLES) break
  }
  return articles
}

export const useArticlesQuery = () =>
  useQuery({
    queryKey: conseilsKeys.articles,
    queryFn: chargerTousArticles,
    staleTime: 10 * 60 * 1000, // retour depuis un article → liste instantanée
    placeholderData: [],
  })

export const useCategoriesQuery = () =>
  useQuery({
    queryKey: conseilsKeys.categories,
    queryFn: getArticleCategories,
    staleTime: 15 * 60 * 1000,
    placeholderData: [],
  })

export const useFeaturedQuery = () =>
  useQuery({
    queryKey: conseilsKeys.featured,
    queryFn: getArticleFeatured,
    select: enListe,
    staleTime: 10 * 60 * 1000,
    placeholderData: [],
  })

export const useDailyTipsQuery = () =>
  useQuery({
    queryKey: conseilsKeys.daily,
    queryFn: getArticlesDaily,
    staleTime: 10 * 60 * 1000,
    placeholderData: [],
  })

export const useSeriesQuery = () =>
  useQuery({
    queryKey: conseilsKeys.series,
    queryFn: getArticleSeries,
    select: enListe,
    staleTime: 15 * 60 * 1000,
    placeholderData: [],
  })

export const usePopularQuery = () =>
  useQuery({
    queryKey: conseilsKeys.popular,
    queryFn: () => getArticlesPopular({ limit: 5 }),
    select: enListe,
    staleTime: 10 * 60 * 1000,
    placeholderData: [],
  })