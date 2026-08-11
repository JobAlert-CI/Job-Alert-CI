import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatApiError, isCanceledError } from "@/api/errors";
import {
  getArticleCategories,
  getArticleFeatured,
  getArticleSeries,
  getArticles,
  getArticlesDaily,
  getArticlesPopular,
} from "@/api/public/articles";
import {
  INDEX_CATEGORIES_VIDE,
  adaptArticles,
  adaptConseilsQuotidiens,
  adaptSeries,
  buildCategoriesIndex,
} from "@/lib/conseils-adapter";

/* ════════════════════════════════════════════════════════════════════
  HOOKS DONNÉES — page Conseils
  · chaque requête est annulable (AbortController) et démontée proprement
  · une réponse obsolète est ignorée (garde par requestId)
  · une erreur ne casse jamais la page : état { data, isLoading, error }
════════════════════════════════════════════════════════════════════ */

/** Petit socle commun : charge une promesse, expose data/isLoading/error/reload. */
const useRessource = (fetcher, { adapt, initial = null, actif = true } = {}) => {
  const [state, setState] = useState({ data: initial, isLoading: actif, error: null });
  const requestId = useRef(0);
  const adaptRef = useRef(adapt);
  adaptRef.current = adapt;

  const charger = useCallback(
    async (signal) => {
      if (!actif) {
        setState({ data: initial, isLoading: false, error: null });
        return;
      }
      const id = ++requestId.current;
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const brut = await fetcher({ signal });
        if (id !== requestId.current || signal?.aborted) return;
        const data = adaptRef.current ? adaptRef.current(brut) : brut;
        setState({ data, isLoading: false, error: null });
      } catch (err) {
        if (isCanceledError(err) || id !== requestId.current) return;
        setState({ data: initial, isLoading: false, error: formatApiError(err) });
      }
    },
    // `initial` est une constante de module côté appelants (tableau figé)
    [fetcher, actif, initial],
  );

  useEffect(() => {
    const controller = new AbortController();
    charger(controller.signal);
    return () => controller.abort();
  }, [charger]);

  return { ...state, reload: () => charger() };
};

const LISTE_VIDE = [];

/* ─────────────────────────── Catégories (chips + index) ─────────────────────────── */
export const useCategoriesConseils = () => {
  const fetcher = useCallback((config) => getArticleCategories(config), []);
  const { data, isLoading, error, reload } = useRessource(fetcher, {
    adapt: buildCategoriesIndex,
    initial: INDEX_CATEGORIES_VIDE,
  });

  console.log(data)

  return {
    index: data ?? INDEX_CATEGORIES_VIDE,
    categories: (data ?? INDEX_CATEGORIES_VIDE).liste,
    isLoading,
    error,
    reload,
  };
};

/* ─────────────────────────── À la une (héro) ─────────────────────────── */
export const useArticlesALaUne = (index) => {
  const fetcher = useCallback((config) => getArticleFeatured(config), []);
  const adapt = useCallback((brut) => adaptArticles(brut, index), [index]);
  const { data, isLoading, error, reload } = useRessource(fetcher, { adapt, initial: LISTE_VIDE });

  return { articles: data ?? LISTE_VIDE, isLoading, error, reload };
};

/* ─────────────────────────── Conseil du jour ─────────────────────────── */
export const useConseilDuJour = (index) => {
  const fetcher = useCallback((config) => getArticlesDaily(config), []);
  const adapt = useCallback((brut) => adaptConseilsQuotidiens(brut, index), [index]);
  const { data, isLoading, error, reload } = useRessource(fetcher, { adapt, initial: LISTE_VIDE });

  return { conseils: data ?? LISTE_VIDE, isLoading, error, reload };
};

/* ─────────────────────────── Les plus lus (sidebar) ─────────────────────────── */
export const useArticlesPopulaires = (index, limit = 5) => {
  const fetcher = useCallback((config) => getArticlesPopular({ limit }, config), [limit]);
  const adapt = useCallback((brut) => adaptArticles(brut, index), [index]);
  const { data, isLoading, error, reload } = useRessource(fetcher, { adapt, initial: LISTE_VIDE });

  return { articles: data ?? LISTE_VIDE, isLoading, error, reload };
};

/* ─────────────────────────── Séries (sidebar) ─────────────────────────── */
export const useSeriesConseils = () => {
  const fetcher = useCallback((config) => getArticleSeries(config), []);
  const { data, isLoading, error, reload } = useRessource(fetcher, {
    adapt: adaptSeries,
    initial: LISTE_VIDE,
  });

  return { series: data ?? LISTE_VIDE, isLoading, error, reload };
};

/* ─────────────────────────── Vue d'ensemble (stats héro + compteurs chips) ───────────
  L'API n'expose pas de total : on sonde jusqu'à SONDE_MAX articles publiés,
  ce qui suffit à alimenter les statistiques et les compteurs par thème.
──────────────────────────────────────────────────────────────────────────────────── */
const SONDE_MAX = 50;

export const useApercuConseils = (index) => {
  const fetcher = useCallback(
    (config) => getArticles({ limit: SONDE_MAX, sort: "recent" }, config),
    [],
  );
  const adapt = useCallback((brut) => adaptArticles(brut, index), [index]);
  const { data, isLoading, error, reload } = useRessource(fetcher, { adapt, initial: LISTE_VIDE });

  const articles = data ?? LISTE_VIDE;

  return useMemo(() => {
    const lectureMoyenne = articles.length
      ? Math.round(articles.reduce((s, a) => s + a.lecture, 0) / articles.length)
      : 0;
    const parCategorie = articles.reduce((acc, a) => {
      acc[a.cat] = (acc[a.cat] ?? 0) + 1;
      return acc;
    }, {});

    return {
      total: articles.length,
      totalPartiel: articles.length >= SONDE_MAX,
      lectureMoyenne,
      parCategorie,
      isLoading,
      error,
      reload,
    };
  }, [articles, isLoading, error, reload]);
};

/* ─────────────────────────── Bibliothèque paginée ───────────────────────────
  Filtres serveur : category_id, q, sort, limit/offset.
  Le total n'étant pas fourni, on demande `perPage + 1` élément pour savoir
  s'il existe une page suivante.
──────────────────────────────────────────────────────────────────────────── */
export const TRIS_API = { recents: "recent", populaires: "popular", courts: "short" };

export const useBibliothequeConseils = ({
  categoryId = null,
  sort = "recents",
  q = "",
  page = 1,
  perPage = 9,
  index,
}) => {
  const requestId = useRef(0);
  const [state, setState] = useState({
    articles: LISTE_VIDE,
    isLoading: true,
    isFetching: true,
    error: null,
    hasMore: false,
  });

  const recherche = q.trim();
  const cle = useMemo(
    () => JSON.stringify({ categoryId, sort, recherche, page, perPage }),
    [categoryId, sort, recherche, page, perPage],
  );
  const indexRef = useRef(index);
  indexRef.current = index;

  const charger = useCallback(
    async (signal) => {
      const id = ++requestId.current;
      const params = JSON.parse(cle);
      setState((s) => ({
        ...s,
        isFetching: true,
        error: null,
        isLoading: s.articles.length === 0,
      }));

      try {
        const brut = await getArticles(
          {
            category_id: params.categoryId ?? undefined,
            // l'API impose min_length=2 sur la recherche
            q: params.recherche.length >= 2 ? params.recherche : undefined,
            sort: TRIS_API[params.sort] ?? "recent",
            limit: params.perPage + 1,
            offset: (params.page - 1) * params.perPage,
          },
          { signal },
        );
        if (id !== requestId.current || signal?.aborted) return;

        const adaptes = adaptArticles(brut, indexRef.current ?? INDEX_CATEGORIES_VIDE);
        setState({
          articles: adaptes.slice(0, params.perPage),
          hasMore: adaptes.length > params.perPage,
          isLoading: false,
          isFetching: false,
          error: null,
        });
      } catch (err) {
        if (isCanceledError(err) || id !== requestId.current) return;
        setState({
          articles: LISTE_VIDE,
          hasMore: false,
          isLoading: false,
          isFetching: false,
          error: formatApiError(err),
        });
      }
    },
    [cle],
  );

  useEffect(() => {
    const controller = new AbortController();
    charger(controller.signal);
    return () => controller.abort();
  }, [charger]);

  return { ...state, reload: () => charger() };
};
