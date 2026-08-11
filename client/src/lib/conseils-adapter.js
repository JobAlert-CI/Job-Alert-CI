import { Lightbulb } from "lucide-react";
import { CATEGORIES } from "@/data/conseils";

/* ════════════════════════════════════════════════════════════════════
  ADAPTATEUR CONSEILS — API (FastAPI) → forme attendue par l'UI.

  L'API renvoie des `ArticleListItem` (slug, title, excerpt, category_id,
  reading_minutes, view_count, published_at). Les composants partagés
  (CarteArticle, PlusLus…) attendent la forme historique :
  { slug, titre, extrait, cat, jours, lecture, vus }.

  Règle de robustesse : aucun champ n'est supposé présent, et le code
  catégorie renvoyé appartient TOUJOURS au référentiel local (icône +
  teinte garanties, jamais de `undefined.hue`).
════════════════════════════════════════════════════════════════════ */

export const CATEGORIE_DEFAUT = CATEGORIES.find((c) => c.code === "marche") ?? CATEGORIES[0];

/** Métadonnées visuelles sûres pour un code catégorie (jamais undefined). */
export const metaCategorie = (code) => CATEGORIES.find((c) => c.code === code) ?? CATEGORIE_DEFAUT;

/** Code local le plus proche d'une catégorie API (code, puis slug). */
const codeLocal = (categorie) => {
  if (!categorie) return CATEGORIE_DEFAUT.code;
  const candidats = [categorie.code, categorie.slug].filter(Boolean);
  const trouve = CATEGORIES.find((c) => candidats.includes(c.code));
  return trouve?.code ?? CATEGORIE_DEFAUT.code;
};

/**
 * Index des catégories API : liste normalisée + accès par id / par code.
 * Chaque entrée : { id, code (local), label, hue, icon }
 */
export const buildCategoriesIndex = (categoriesApi) => {
  const liste = (Array.isArray(categoriesApi) ? categoriesApi : [])
    .filter((c) => c && (c.code || c.slug))
    .map((c) => {
      const code = codeLocal(c);
      const meta = metaCategorie(code);
      return {
        id: c.id ?? null,
        code: c.code,
        label: c.label || meta.label,
        hue: c.hue,
        icon: meta.icon ?? Lightbulb,
      };
    });

  const parId = new Map();
  const parCode = new Map();
  liste.forEach((c) => {
    if (c.id) parId.set(c.id, c);
    if (!parCode.has(c.code)) parCode.set(c.code, c);
  });

  return {
    liste,
    parId,
    parCode,
    idDe: (code) => parCode.get(code)?.id ?? null,
    de: (id) => parId.get(id) ?? null,
  };
};

/** Index vide — évite les gardes `index?.` partout dans la page. */
export const INDEX_CATEGORIES_VIDE = buildCategoriesIndex([]);

/** Nombre de jours écoulés depuis une date ISO (0 si aujourd'hui / inconnue). */
export const joursDepuis = (iso) => {
  if (!iso) return 0;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 0;
  const debut = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((debut(new Date()) - debut(date)) / 86_400_000);
  return diff > 0 ? diff : 0;
};

const nombre = (v, defaut = 0) => (Number.isFinite(Number(v)) ? Number(v) : defaut);

/** ArticleListItem | ArticleRead → article UI. Renvoie null si inexploitable. */
export const adaptArticle = (item, index = INDEX_CATEGORIES_VIDE) => {
  if (!item?.slug) return null;
  const categorie =
    index.de(item.category_id) ?? (item.category ? { code: codeLocal(item.category) } : null);
  const code = categorie?.code ?? CATEGORIE_DEFAUT.code;

  return {
    id: item.id ?? item.slug,
    slug: item.slug,
    titre: item.title?.trim() || "Conseil JobAlert CI",
    extrait: item.excerpt?.trim() || "",
    cat: code,
    jours: joursDepuis(item.published_at),
    lecture: Math.max(1, nombre(item.reading_minutes, 5)),
    vus: Math.max(0, nombre(item.view_count, 0)),
  };
};

/** Liste d'articles adaptée, dédupliquée par slug, entrées invalides écartées. */
export const adaptArticles = (items, index = INDEX_CATEGORIES_VIDE) => {
  const vus = new Set();
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const article = adaptArticle(item, index);
    if (article && !vus.has(article.slug)) {
      vus.add(article.slug);
      acc.push(article);
    }
    return acc;
  }, []);
};

/** DailyTipRead (ou liste) → conseils du jour utilisables par le carrousel. */
export const adaptConseilsQuotidiens = (payload, index = []) => {
  const brut = Array.isArray(payload) ? payload : payload ? [payload] : [];
  return brut
    .filter((t) => t?.text)
    .map((t) => ({
      id: t.id ?? t.text,
      t: t.text,
      cat: index.filter((c) => c.id === t.category_id)[0] ?? {},
    }));
};

/** ArticleSeriesRead[] → séries UI (teinte sûre, description optionnelle). */
export const adaptSeries = (payload) =>
  (Array.isArray(payload) ? payload : [])
    .filter((s) => s?.title)
    .map((s) => ({
      id: s.id ?? s.slug ?? s.title,
      titre: s.title,
      slug: s.slug ?? null,
      description: s.description?.trim() || "",
      hue: s.hue || CATEGORIE_DEFAUT.hue,
    }));
