// src/pages/conseils/detail/conseil-detail.constants.js
import { Lightbulb } from "lucide-react"
import { HUES } from "@/lib/hues"
import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getArticleBySlug, getArticlesSimilar, incrementeView,
} from "@/api/public/articles"

const CATEGORIES = []

/** Catégorie de repli quand l'API n'en fournit pas (ou code inconnu). */
export const CATEGORIE_DEFAUT =
  CATEGORIES?.find((c) => c.code === "marche") ??
  CATEGORIES?.[0] ?? {
    code: "marche",
    label: "Conseils",
    hue: "sky",
    icon: Lightbulb,
  }

/** Palette minimale garantie (complète les hues du design system). */
export const HUE_FALLBACK = {
  hex: "#F5A623",
  solid: "bg-brand-orange",
  tile: "bg-brand-orange/10 text-brand-orange",
  accent: "text-brand-orange",
  dot: "bg-brand-orange",
  glow: "bg-brand-orange/15",
}


/* ════════════════════════════════════════════════════════════════════
   ADAPTATEURS API → UI (fonctions pures, défensives).
   Le backend renvoie ArticleRead (sections/blocks/takeaways/key_figures) ;
   l'UI attend { article, contenu, cat, hue }.
════════════════════════════════════════════════════════════════════ */

const nombre = (valeur, defaut = 0) => {
  const n = Number(valeur)
  return Number.isFinite(n) ? n : defaut
}

/** Nombre de jours écoulés depuis une date ISO (0 = aujourd'hui). */
export const joursDepuis = (iso) => {
  if (!iso) return 0
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 0
  const debutJour = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diff = Math.round((debutJour(new Date()) - debutJour(date)) / 86_400_000)
  return diff > 0 ? diff : 0
}

const slugify = (texte = "") =>
  String(texte)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section"

export const normaliserHue = (categorie) => {
  const hue = HUES?.[categorie?.hue] ?? HUES?.sky ?? HUE_FALLBACK
  return {
    ...HUE_FALLBACK,
    ...hue,
    glow: hue?.glow || HUE_FALLBACK.glow,
  }
}

/* ─── Catégories : codes API → méta local (icône + palette) ─── */
const codeLocalDepuisCategorie = (categorieApi) => {
  if (!categorieApi) return CATEGORIE_DEFAUT.code
  const candidats = [categorieApi.code, categorieApi.slug].filter(Boolean)
  const trouve = CATEGORIES?.find((c) => candidats.includes(c.code))
  return trouve?.code ?? CATEGORIE_DEFAUT.code
}

const metaCategorie = (code) => CATEGORIES?.find((c) => c.code === code) ?? CATEGORIE_DEFAUT

const adapterCategorieApi = (categorieApi) => {
  const code = codeLocalDepuisCategorie(categorieApi)
  const meta = metaCategorie(code)
  return {
    ...meta,
    code,
    label: categorieApi?.label?.trim() || meta.label,
    hue:
      categorieApi?.hue && HUES?.[categorieApi.hue]
        ? categorieApi.hue
        : meta.hue || CATEGORIE_DEFAUT.hue,
    icon: meta.icon ?? Lightbulb,
  }
}

/* ─── Sections & blocks ─── */
const extrairePoints = (texte = "") =>
  String(texte)
    .split(/\n+/)
    .map((ligne) => ligne.replace(/^[-*•]\s*/, "").replace(/^\s*-\s*/, "").trim())
    .filter(Boolean)

const adapterSections = (sectionsApi = []) => {
  const sections = Array.isArray(sectionsApi) ? sectionsApi : []
  return sections
    .slice()
    .sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0))
    .map((section, index) => {
      const paragraphes = []
      const points = []
      const blocks = Array.isArray(section?.blocks) ? section.blocks : []

      blocks
        .slice()
        .sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0))
        .forEach((block) => {
          const contenu = typeof block?.content === "string" ? block.content.trim() : ""
          if (!contenu) return
          if (block?.block_type === "list") {
            extrairePoints(contenu).forEach((point) => points.push(point))
          } else {
            paragraphes.push(contenu)
          }
        })

      return {
        id: section?.anchor || `${slugify(section?.title || "section")}-${index + 1}`,
        titre: section?.title?.trim() || "Section",
        paragraphes,
        points,
      }
    })
    .filter((section) => section.paragraphes.length > 0 || section.points.length > 0)
}

/* ─── Articles ─── */
export const adaptArticleDetail = (raw) => {
  if (!raw?.slug) return null
  const category = adapterCategorieApi(raw.category)
  return {
    id: raw.id ?? raw.slug,
    slug: raw.slug,
    titre: raw.title?.trim() || "Conseil JobAlert CI",
    extrait: raw.excerpt?.trim() || "",
    cat: category.code,
    category,
    jours: joursDepuis(raw.published_at),
    lecture: Math.max(1, Math.round(nombre(raw.reading_minutes, 5))),
    vus: Math.max(0, Math.round(nombre(raw.view_count, 0))),
  }
}

const adaptArticleListe = (item, categorieCode) => {
  if (!item?.slug) return null
  const categorie = item.category ? adapterCategorieApi(item.category) : null
  return {
    id: item.id ?? item.slug,
    slug: item.slug,
    titre: item.title?.trim() || "Conseil JobAlert CI",
    extrait: item.excerpt?.trim() || "",
    cat: categorie?.code || categorieCode || CATEGORIE_DEFAUT.code,
    jours: joursDepuis(item.published_at),
    lecture: Math.max(1, Math.round(nombre(item.reading_minutes, 5))),
    vus: Math.max(0, Math.round(nombre(item.view_count, 0))),
  }
}

/** Similaires : dédupliqués par slug, plafonnés à 3. */
export const adaptArticlesSimilaires = (items, categorieCode) => {
  const liste = Array.isArray(items) ? items : []
  return liste
    .reduce((acc, item) => {
      const article = adaptArticleListe(item, categorieCode)
      if (article && !acc.some((x) => x.slug === article.slug)) acc.push(article)
      return acc
    }, [])
    .slice(0, 3)
}

/** Contenu riche : intro, chiffres, sections, citation, à-retenir, tags. */
export const adaptContenu = (raw, article) => {
  const sections = adapterSections(raw?.sections)
  const fallbackSections = article.extrait
    ? [{ id: "essentiel", titre: "L'essentiel", paragraphes: [article.extrait], points: [] }]
    : []

  const stats = (Array.isArray(raw?.key_figures) ? raw.key_figures : [])
    .slice()
    .sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0))
    .map((figure) => ({
      v: Math.round(nombre(figure?.value, 0)),
      l: figure?.label?.trim() || "",
      prefix: figure?.prefix ?? "",
      suffix: figure?.suffix ?? "",
    }))
    .filter((stat) => stat.l)

  const takeaways = (Array.isArray(raw?.takeaways) ? raw.takeaways : [])
    .slice()
    .sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0))
    .map((item) => item?.text?.trim())
    .filter(Boolean)

  return {
    intro: article.extrait,
    stats,
    sections: sections.length > 0 ? sections : fallbackSections,
    citation: raw?.quote_text
      ? { texte: raw.quote_text.trim(), auteur: raw.quote_author?.trim() || "Équipe JobAlert CI" }
      : null,
    aRetenir: takeaways.length > 0 ? takeaways : article.extrait ? [article.extrait] : [],
    tags: Array.isArray(raw?.tags) ? raw.tags.filter(Boolean) : [],
  }
}


/* ═══ CLÉS DE CACHE — préfixe commun avec la page /conseils ═══ */
export const conseilDetailKeys = {
  root: ["conseils"],
  detail: (slug) => ["conseils", "detail", slug],
  similaires: (slug) => ["conseils", "similaires", slug],
}

/** Une 404 est définitive : inutile de la retenter. */
export const estErreur404 = (erreur) =>
  erreur?.response?.status === 404 ||
  erreur?.status === 404 ||
  String(erreur?.response?.data?.detail || "").toLowerCase().includes("not found")

/* ─────────────── Article (bloquant pour la page) ─────────────── */
export const useArticleQuery = (slug) =>
  useQuery({
    queryKey: conseilDetailKeys.detail(slug),
    queryFn: ({ signal }) => getArticleBySlug(slug, { signal }),
    enabled: Boolean(slug),
    staleTime: 10 * 60 * 1000, // navigation entre articles : retour instantané
    retry: (failureCount, error) => !estErreur404(error) && failureCount < 2,
  })

/* ─────────────── Similaires — décoratifs, JAMAIS bloquants ───────────────
   Requête indépendante : l'article s'affiche sans attendre les suggestions.
   (si votre wrapper n'accepte pas de 3e argument, retirez `{ signal }`) */
export const useArticlesSimilarQuery = (slug) =>
  useQuery({
    queryKey: conseilDetailKeys.similaires(slug),
    queryFn: () => getArticlesSimilar(slug, { limit: 3 }),
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

/* ─────────────── Comptage de vue ───────────────
   · un seul appel par slug et par session (Set module, pas window)
   · le total renvoyé par l'API est écrit DANS LE CACHE : l'UI se met à
     jour par dérivation, sans état local dupliqué */
const vuesEnregistrees = new Set()

export const useTrackArticleView = (slug, enabled) => {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!slug || !enabled || vuesEnregistrees.has(slug)) return
    let actif = true

    incrementeView(slug)
      .then((res) => {
        if (!actif) return
        vuesEnregistrees.add(slug)
        const total = Number(res?.view_count)
        if (!Number.isFinite(total)) return
        queryClient.setQueryData(conseilDetailKeys.detail(slug), (raw) =>
          raw && typeof raw === "object" ? { ...raw, view_count: total } : raw
        )
      })
      .catch(() => {}) // un compteur ne doit jamais bloquer la page

    return () => { actif = false }
  }, [slug, enabled, queryClient])
}