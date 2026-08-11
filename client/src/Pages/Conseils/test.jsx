// src/pages/conseils/[slug]/DetailsConseil.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bell,
  Check,
  ChevronRight,
  Clock,
  Eye,
  Inbox,
  Lightbulb,
  Link2,
  Quote,
  RefreshCw,
  SearchX,
  Sparkles,
} from "lucide-react";
import { FaLinkedin } from "react-icons/fa6";

import { cn } from "@/lib/utils";
import Seo from "@/components/seo/Seo";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

import {
  BadgeNouveau,
  BarreProgression,
  CarteArticle,
  CountUp,
  CtaLink,
  SectionHeading,
  Sommaire,
  SommaireFlottant,
} from "@/components/shared";

import { HUES } from "@/lib/hues";
import { dateLabel } from "@/lib/dates";
import { CATEGORIES, fmtVus } from "@/data/conseils";
import { conseilSeo } from "@/lib/seo";

import {
  getArticleBySlug,
  getArticlesSimilar,
  incrementeView,
} from "@/api/public/articles";

/* ════════════════════════════════════════════════════════════════════
OUTILS & ADAPTATION API → UI
════════════════════════════════════════════════════════════════════ */

const CATEGORIE_DEFAUT =
  CATEGORIES?.find((c) => c.code === "marche") ??
  CATEGORIES?.[0] ?? {
    code: "marche",
    label: "Conseils",
    hue: "sky",
    icon: Lightbulb,
  };

const HUE_FALLBACK = {
  hex: "#F5A623",
  solid: "bg-brand-orange",
  tile: "bg-brand-orange/10 text-brand-orange",
  accent: "text-brand-orange",
  dot: "bg-brand-orange",
  glow: "bg-brand-orange/15",
};

const messageErreur = (erreur) =>
  erreur?.response?.data?.detail ||
  erreur?.response?.data?.message ||
  erreur?.message ||
  "Une erreur inattendue est survenue.";

const estErreur404 = (erreur) =>
  erreur?.response?.status === 404 ||
  erreur?.status === 404 ||
  String(erreur?.response?.data?.detail || "").toLowerCase().includes("not found");

const nombre = (valeur, defaut = 0) => {
  const n = Number(valeur);
  return Number.isFinite(n) ? n : defaut;
};

const joursDepuis = (iso) => {
  if (!iso) return 0;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 0;

  const debutJour = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const diff = Math.round((debutJour(new Date()) - debutJour(date)) / 86_400_000);

  return diff > 0 ? diff : 0;
};

const slugify = (texte = "") =>
  String(texte)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";

const normaliserHue = (categorie) => {
  const hue = HUES?.[categorie?.hue] ?? HUES?.sky ?? HUE_FALLBACK;

  return {
    ...HUE_FALLBACK,
    ...hue,
    glow: hue?.glow || HUE_FALLBACK.glow,
  };
};

const codeLocalDepuisCategorie = (categorieApi) => {
  if (!categorieApi) return CATEGORIE_DEFAUT.code;

  const candidats = [categorieApi.code, categorieApi.slug].filter(Boolean);
  const trouve = CATEGORIES?.find((c) => candidats.includes(c.code));

  return trouve?.code ?? CATEGORIE_DEFAUT.code;
};

const metaCategorie = (code) =>
  CATEGORIES?.find((c) => c.code === code) ?? CATEGORIE_DEFAUT;

const adapterCategorieApi = (categorieApi) => {
  const code = codeLocalDepuisCategorie(categorieApi);
  const meta = metaCategorie(code);

  return {
    ...meta,
    code,
    label: categorieApi?.label?.trim() || meta.label,
    hue:
      categorieApi?.hue && HUES?.[categorieApi.hue]
        ? categorieApi.hue
        : meta.hue || CATEGORIE_DEFAUT.hue,
    icon: meta.icon ?? Lightbulb,
  };
};

const extrairePoints = (texte = "") =>
  String(texte)
    .split(/\n+/)
    .map((ligne) =>
      ligne
        .replace(/^[-*•]\s*/, "")
        .replace(/^\s*-\s*/, "")
        .trim()
    )
    .filter(Boolean);

const adapterSections = (sectionsApi = []) => {
  const sections = Array.isArray(sectionsApi) ? sectionsApi : [];

  return sections
    .slice()
    .sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0))
    .map((section, index) => {
      const paragraphes = [];
      const points = [];

      const blocks = Array.isArray(section?.blocks) ? section.blocks : [];

      blocks
        .slice()
        .sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0))
        .forEach((block) => {
          const contenu =
            typeof block?.content === "string" ? block.content.trim() : "";

          if (!contenu) return;

          if (block?.block_type === "list") {
            extrairePoints(contenu).forEach((point) => points.push(point));
          } else {
            paragraphes.push(contenu);
          }
        });

      return {
        id: section?.anchor || `${slugify(section?.title || "section")}-${index + 1}`,
        titre: section?.title?.trim() || "Section",
        paragraphes,
        points,
      };
    })
    .filter((section) => section.paragraphes.length > 0 || section.points.length > 0);
};

const adapterArticleDetail = (raw) => {
  if (!raw?.slug) return null;

  const category = adapterCategorieApi(raw.category);

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
  };
};

const adapterArticleListe = (item, categorieCode) => {
  if (!item?.slug) return null;

  const categorie = item.category
    ? adapterCategorieApi(item.category)
    : null;

  return {
    id: item.id ?? item.slug,
    slug: item.slug,
    titre: item.title?.trim() || "Conseil JobAlert CI",
    extrait: item.excerpt?.trim() || "",
    cat: categorie?.code || categorieCode || CATEGORIE_DEFAUT.code,
    jours: joursDepuis(item.published_at),
    lecture: Math.max(1, Math.round(nombre(item.reading_minutes, 5))),
    vus: Math.max(0, Math.round(nombre(item.view_count, 0))),
  };
};

const adapterArticlesSimilaires = (items, categorieCode) => {
  const liste = Array.isArray(items) ? items : [];

  return liste
    .reduce((acc, item) => {
      const article = adapterArticleListe(item, categorieCode);

      if (article && !acc.some((x) => x.slug === article.slug)) {
        acc.push(article);
      }

      return acc;
    }, [])
    .slice(0, 3);
};

const adapterContenu = (raw, article) => {
  const sections = adapterSections(raw?.sections);

  const fallbackSections = article.extrait
    ? [
        {
          id: "essentiel",
          titre: "L’essentiel",
          paragraphes: [article.extrait],
          points: [],
        },
      ]
    : [];

  const stats = (Array.isArray(raw?.key_figures) ? raw.key_figures : [])
    .slice()
    .sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0))
    .map((figure) => ({
      v: Math.round(nombre(figure?.value, 0)),
      l: figure?.label?.trim() || "",
      prefix: figure?.prefix ?? "",
      suffix: figure?.suffix ?? "",
    }))
    .filter((stat) => stat.l);

  const takeaways = (Array.isArray(raw?.takeaways) ? raw.takeaways : [])
    .slice()
    .sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0))
    .map((item) => item?.text?.trim())
    .filter(Boolean);

  return {
    intro: article.extrait,
    stats,
    sections: sections.length > 0 ? sections : fallbackSections,
    citation: raw?.quote_text
      ? {
          texte: raw.quote_text.trim(),
          auteur: raw.quote_author?.trim() || "Équipe JobAlert CI",
        }
      : null,
    aRetenir: takeaways.length > 0 ? takeaways : article.extrait ? [article.extrait] : [],
    tags: Array.isArray(raw?.tags) ? raw.tags.filter(Boolean) : [],
  };
};

/* ════════════════════════════════════════════════════════════════════
HOOK — chargement article + similaires
════════════════════════════════════════════════════════════════════ */

const useArticleDetail = (slug) => {
  const [tentative, setTentative] = useState(0);
  const [etat, setEtat] = useState({
    statut: "loading", // loading | ready | error | notfound
    article: null,
    contenu: null,
    cat: CATEGORIE_DEFAUT,
    hue: normaliserHue(CATEGORIE_DEFAUT),
    related: [],
    relatedStatut: "loading", // loading | ready | empty | error
    erreurs: {},
  });

  const retry = useCallback(() => {
    setTentative((t) => t + 1);
  }, []);

  useEffect(() => {
    let actif = true;

    if (!slug) {
      setEtat({
        statut: "notfound",
        article: null,
        contenu: null,
        cat: CATEGORIE_DEFAUT,
        hue: normaliserHue(CATEGORIE_DEFAUT),
        related: [],
        relatedStatut: "empty",
        erreurs: {},
      });

      return;
    }

    const charger = async () => {
      setEtat((prev) => ({
        ...prev,
        statut: "loading",
        relatedStatut: "loading",
        erreurs: {},
      }));

      const [articleRes, similarRes] = await Promise.allSettled([
        getArticleBySlug(slug),
        getArticlesSimilar(slug, { limit: 3 }),
      ]);

      if (!actif) return;

      if (articleRes.status === "rejected") {
        const introuvable = estErreur404(articleRes.reason);

        setEtat({
          statut: introuvable ? "notfound" : "error",
          article: null,
          contenu: null,
          cat: CATEGORIE_DEFAUT,
          hue: normaliserHue(CATEGORIE_DEFAUT),
          related: [],
          relatedStatut: "empty",
          erreurs: {
            article: articleRes.reason,
          },
        });

        return;
      }

      const article = adapterArticleDetail(articleRes.value);

      if (!article) {
        setEtat({
          statut: "notfound",
          article: null,
          contenu: null,
          cat: CATEGORIE_DEFAUT,
          hue: normaliserHue(CATEGORIE_DEFAUT),
          related: [],
          relatedStatut: "empty",
          erreurs: {},
        });

        return;
      }

      const contenu = adapterContenu(articleRes.value, article);

      const related =
        similarRes.status === "fulfilled"
          ? adapterArticlesSimilaires(similarRes.value, article.cat)
          : [];

      const relatedStatut =
        similarRes.status === "fulfilled"
          ? related.length > 0
            ? "ready"
            : "empty"
          : estErreur404(similarRes.reason)
            ? "empty"
            : "error";

      setEtat({
        statut: "ready",
        article,
        contenu,
        cat: article.category,
        hue: normaliserHue(article.category),
        related,
        relatedStatut,
        erreurs:
          similarRes.status === "rejected" && !estErreur404(similarRes.reason)
            ? { related: similarRes.reason }
            : {},
      });
    };

    charger().catch((erreur) => {
      if (!actif) return;

      setEtat({
        statut: "error",
        article: null,
        contenu: null,
        cat: CATEGORIE_DEFAUT,
        hue: normaliserHue(CATEGORIE_DEFAUT),
        related: [],
        relatedStatut: "empty",
        erreurs: { global: erreur },
      });
    });

    return () => {
      actif = false;
    };
  }, [slug, tentative]);

  // Enregistrement de la vue — une seule fois par slug dans la session courante
  useEffect(() => {
    if (etat.statut !== "ready" || !slug) return;
    if (typeof window === "undefined") return;

    const storeKey = "__jobalertci_article_views__";
    window[storeKey] = window[storeKey] || new Set();

    if (window[storeKey].has(slug)) return;

    window[storeKey].add(slug);

    let actif = true;

    incrementeView(slug)
      .then((res) => {
        const nouvelleVue = Number(res?.view_count);

        if (actif && Number.isFinite(nouvelleVue)) {
          setEtat((prev) =>
            prev.article
              ? {
                  ...prev,
                  article: {
                    ...prev.article,
                    vus: nouvelleVue,
                  },
                }
              : prev
          );
        }
      })
      .catch(() => {
        // On n’affiche pas d’erreur pour un simple compteur de vue.
      });

    return () => {
      actif = false;
    };
  }, [etat.statut, slug]);

  return {
    ...etat,
    retry,
  };
};

/* ════════════════════════════════════════════════════════════════════
UI — SKELETON / EMPTY / ERROR
════════════════════════════════════════════════════════════════════ */

const Skeleton = ({ className }) => (
  <div
    aria-hidden
    className={cn("animate-pulse rounded-lg bg-surface-container-high", className)}
  />
);

const EtatVide = ({
  title = "Aucun contenu pour le moment",
  description = "",
  action,
  icon: Icon = Inbox,
  compact = false,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    className={cn(
      "rounded-xl border border-dashed border-outline-variant/60 bg-white text-center",
      compact ? "p-6" : "p-12"
    )}
  >
    <span className="mx-auto grid size-10 place-items-center rounded-full bg-surface-container text-muted-foreground">
      <Icon className="size-5" />
    </span>

    <h3 className="mt-4 font-heading text-lg font-bold text-brand-navy">{title}</h3>

    {description && (
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    )}

    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </motion.div>
);

const DetailSkeleton = () => (
  <main aria-busy="true">
    <section className="relative overflow-hidden hero-gradient">
      <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />

      <div className="relative z-10 mx-auto max-w-7xl px-6 pb-14 pt-8 md:px-12 md:pb-16 md:pt-10">
        <Skeleton className="h-4 w-72" />

        <div className="mt-8 grid items-start gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="space-y-5">
            <Skeleton className="h-7 w-56 rounded-full" />
            <Skeleton className="h-12 w-full max-w-xl" />
            <Skeleton className="h-5 w-full max-w-2xl" />
            <Skeleton className="h-12 w-full max-w-md" />
            <Skeleton className="h-12 w-full max-w-lg" />
          </div>

          <Skeleton className="h-[30rem] w-full rounded-2xl" />
        </div>
      </div>
    </section>

    <section className="border-b border-outline-variant/30 bg-background py-14 md:py-18">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 md:px-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>

        <div className="space-y-6">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
        </div>
      </div>
    </section>

    <section className="bg-surface-container-lowest py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <Skeleton className="h-8 w-72" />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      </div>
    </section>
  </main>
);

const ErreurDetail = ({ slug, detail, onRetry }) => (
  <section className="hero-gradient flex min-h-[60vh] items-center justify-center px-6 py-20">
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-md text-center"
    >
      <span className="mx-auto flex size-16 items-center justify-center rounded-xl bg-error-container/40 text-error">
        <AlertTriangle className="size-8" strokeWidth={1.8} />
      </span>

      <h1 className="mt-5 font-heading text-3xl font-black tracking-tight text-brand-navy">
        Impossible de charger ce conseil
      </h1>

      <p className="mt-3 text-on-surface-variant">
        {detail || "Une erreur est survenue pendant la récupération de l’article."}
      </p>

      {slug && (
        <p className="mt-2 text-xs text-muted-foreground">
          Référence : <span className="font-semibold">{slug}</span>
        </p>
      )}

      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
          >
            <RefreshCw className="size-4" />
            Réessayer
          </button>
        )}

        <CtaLink to="/conseils" variant="outline" iconRight={ArrowRight}>
          Voir tous les conseils
        </CtaLink>
      </div>
    </motion.div>
  </section>
);

const ConseilIntrouvable = ({ slug }) => (
  <section className="hero-gradient flex min-h-[60vh] items-center justify-center px-6 py-20">
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-md text-center"
    >
      <span className="mx-auto flex size-16 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange">
        <SearchX className="size-8" strokeWidth={1.8} />
      </span>

      <h1 className="mt-5 font-heading text-3xl font-black tracking-tight text-brand-navy">
        Conseil introuvable
      </h1>

      <p className="mt-3 text-on-surface-variant">
        L’article « {slug || "inconnu"} » n’existe pas ou a été archivé.
        La bibliothèque, elle, est bien à jour.
      </p>

      <div className="mt-6 flex justify-center">
        <CtaLink to="/conseils" iconRight={ArrowRight}>
          Voir tous les conseils
        </CtaLink>
      </div>
    </motion.div>
  </section>
);

/* ════════════════════════════════════════════════════════════════════
EN-TÊTE — article + brief “à retenir”
════════════════════════════════════════════════════════════════════ */

const CarteBrief = ({ a, cat, hue, contenu }) => {
  const Icon = cat.icon ?? Lightbulb;

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, rotate: 1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-md min-w-0 md:max-w-none"
    >
      <div className={cn("absolute -inset-8 rounded-full blur-3xl", hue.glow)} aria-hidden />

      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, y: [0, -7, 0] }}
        transition={{
          delay: 0.9,
          opacity: { duration: 0.4 },
          scale: { duration: 0.4 },
          y: { duration: 4.6, repeat: Infinity, ease: "easeInOut" },
        }}
        className="absolute -top-4 left-5 z-20 inline-flex -rotate-3 items-center gap-1.5 rounded-full bg-brand-orange px-3.5 py-1.5 text-[11px] font-bold text-white shadow-lg sm:-left-4"
      >
        <Clock className="size-3" />
        {a.lecture} min de lecture
      </motion.span>

      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.05, duration: 0.4 }}
        className="absolute -top-3 right-6 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3 py-1.5 text-[11px] font-bold text-brand-navy shadow-soft"
      >
        <Eye className="size-3 text-brand-orange" />
        {fmtVus(a.vus)} lectures
      </motion.span>

      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
        transition={{
          delay: 1.2,
          opacity: { duration: 0.4 },
          scale: { duration: 0.4 },
          y: { duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 },
        }}
        className="absolute -bottom-4 right-8 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3.5 py-1.5 text-[11px] font-bold text-emerald-600 shadow-hover"
      >
        <Sparkles className="size-3" />
        Nourri par la collecte
      </motion.span>

      <div className="relative flex flex-col overflow-hidden rounded-2xl bg-brand-navy text-white shadow-[0_24px_48px_-16px_rgba(15,45,77,0.35)]">
        <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />
        <div
          className={cn(
            "pointer-events-none absolute -right-24 -top-24 size-80 rounded-full blur-3xl",
            hue.glow
          )}
          aria-hidden
        />

        <Icon
          className="pointer-events-none absolute -bottom-8 -right-4 size-48 rotate-12 text-white/5"
          strokeWidth={1}
          aria-hidden
        />

        <div className="relative flex items-center gap-3 border-b border-white/10 px-6 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-orange font-heading text-[11px] font-black text-white">
            JA
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold">Le brief JobAlert CI</p>
            <p className="truncate text-[11px] text-white/60">
              {cat.label} · {dateLabel(a.jours)}
            </p>
          </div>

          <Icon className="size-4 shrink-0 text-white/40" />
        </div>

        <div className="relative flex flex-1 flex-col px-6 py-6">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-orange">
            <Lightbulb className="size-3.5" />
            À retenir en 30 secondes
          </p>

          <ul className="mt-3.5 space-y-2.5">
            {contenu.aRetenir.length > 0 ? (
              contenu.aRetenir.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-2.5 text-[13px] leading-relaxed text-white/80"
                >
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-orange/20">
                    <Check className="size-2.5 text-brand-orange" strokeWidth={3.5} />
                  </span>
                  {point}
                </li>
              ))
            ) : (
              <li className="text-[13px] leading-relaxed text-white/70">
                Les points clés seront bientôt disponibles.
              </li>
            )}
          </ul>

          <div className="mt-auto pt-6">
            <CtaLink to="/inscription" size="md" icon={Bell} animateIcon className="w-full">
              Recevoir ce thème à 8h00
            </CtaLink>

            <p className="mt-3 text-center text-[10px] text-white/50">
              Gratuit · 1 email par jour · désinscription en 1 clic
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const EnTeteArticle = ({ a, cat, hue, contenu, copied, onCopy }) => {
  const Icon = cat.icon ?? Lightbulb;

  return (
    <section className="relative overflow-hidden hero-gradient">
      <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
      <div
        className={cn("absolute -top-32 right-[-10%] size-140 rounded-full blur-3xl", hue.glow)}
        aria-hidden
      />
      <div className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/5 blur-3xl" aria-hidden />

      <div className="relative z-10 mx-auto max-w-7xl px-6 pb-14 pt-8 md:px-12 md:pb-16 md:pt-10">
        <motion.nav
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground"
          aria-label="Fil d’Ariane"
        >
          <Link to="/" className="transition-colors hover:text-brand-navy">
            Accueil
          </Link>

          <ChevronRight className="size-3" />

          <Link to="/conseils" className="transition-colors hover:text-brand-navy">
            Conseils
          </Link>

          <ChevronRight className="size-3" />

          <Link
            to={`/conseils?cat=${cat.code}`}
            className={cn("rounded-full px-2 text-white", hue.solid)}
          >
            {cat.label}
          </Link>

          <ChevronRight className="size-3" />

          <span className="truncate font-semibold text-brand-navy">{a.titre}</span>
        </motion.nav>

        <div className="mt-8 grid items-start gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <motion.div
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
            }}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-start gap-5"
          >
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 22 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
                },
              }}
              className="flex flex-wrap items-center gap-2.5"
            >
              <Link
                to="/conseils"
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-all duration-200 hover:-translate-y-0.5",
                  hue.tile
                )}
              >
                <Icon className="size-3.5" />
                {cat.label}
              </Link>

              {a.jours === 0 && <BadgeNouveau />}

              <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white/80 px-3.5 py-1.5 text-[11px] font-bold text-on-surface-variant">
                <Clock className="size-3 text-brand-orange" />
                {a.lecture} min de lecture
              </span>
            </motion.div>

            <motion.h1
              variants={{
                hidden: { opacity: 0, y: 22 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
                },
              }}
              className="font-heading text-3xl font-black leading-[1.12] tracking-tight text-brand-navy sm:text-4xl xl:text-5xl"
            >
              {a.titre}
            </motion.h1>

            <motion.p
              variants={{
                hidden: { opacity: 0, y: 22 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
                },
              }}
              className="max-w-2xl leading-relaxed text-on-surface-variant md:text-lg"
            >
              {a.extrait}
            </motion.p>

            <motion.div
              variants={{
                hidden: { opacity: 0, y: 22 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
                },
              }}
              className="flex flex-wrap items-center gap-x-4 gap-y-3"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex size-10 items-center justify-center rounded-full bg-brand-navy font-heading text-[11px] font-black text-white">
                  RC
                </span>

                <div>
                  <p className="flex items-center gap-1.5 text-[13px] font-bold text-brand-navy">
                    La rédaction
                    <BadgeCheck className="size-3.5 text-brand-orange" />
                  </p>

                  <p className="text-[11px] text-muted-foreground">
                    Analystes marché · JobAlert CI
                  </p>
                </div>
              </div>

              <span className="hidden h-8 w-px bg-outline-variant/50 sm:block" aria-hidden />

              <span className="text-xs font-semibold text-muted-foreground">
                {dateLabel(a.jours)}
              </span>

              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Clock className="size-3.5 text-brand-orange" />
                {a.lecture} min
              </span>

              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Eye className="size-3.5 text-brand-orange" />
                {fmtVus(a.vus)} lectures
              </span>
            </motion.div>

            <motion.div
              variants={{
                hidden: { opacity: 0, y: 22 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
                },
              }}
              className="mt-1 flex flex-wrap items-center gap-2.5"
            >
              <button
                type="button"
                onClick={onCopy}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-xs font-bold transition-all duration-200",
                  copied
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700"
                    : "border-outline-variant/60 bg-white text-on-surface-variant hover:border-brand-navy/40 hover:text-brand-navy"
                )}
              >
                {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
                {copied ? "Lien copié" : "Copier le lien"}
              </button>

              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                  typeof window !== "undefined" ? window.location.href : ""
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#0A66C2]/30 bg-[#0A66C2]/5 px-4 text-xs font-bold text-[#0A66C2] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0A66C2] hover:text-white"
              >
                <FaLinkedin className="size-3.5" />
                Partager
              </a>

              <CtaLink to="/inscription" size="md" icon={Bell} animateIcon className="h-10">
                Recevoir ce thème à 8h00
              </CtaLink>
            </motion.div>
          </motion.div>

          <CarteBrief a={a} cat={cat} hue={hue} contenu={contenu} />
        </div>
      </div>
    </section>
  );
};

/* ════════════════════════════════════════════════════════════════════
CORPS — chiffres, sections, citation, tags, sidebar
════════════════════════════════════════════════════════════════════ */

const ChiffresCles = ({ stats, hue }) => {
  if (!stats?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mt-8 grid grid-cols-3 gap-3"
    >
      {stats.map((s) => (
        <div
          key={`${s.l}-${s.v}`}
          className="rounded-xl border border-outline-variant/40 bg-white p-4 text-center shadow-soft"
          style={{ borderTop: `3px solid ${hue.hex}` }}
        >
          <p className="font-heading text-2xl font-black text-brand-navy sm:text-3xl">
            <CountUp to={s.v} prefix={s.prefix ?? ""} suffix={s.suffix ?? ""} />
          </p>

          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {s.l}
          </p>
        </div>
      ))}
    </motion.div>
  );
};

const MemeTheme = ({ articles, statut, hue, onRetry }) => {
  if (statut === "loading") {
    return (
      <div className="rounded-xl border border-outline-variant/40 bg-white p-5 shadow-soft">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          <Sparkles className="size-3.5 text-brand-orange" />
          Sur le même thème
        </p>

        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (statut === "error") {
    return (
      <div className="rounded-xl border border-outline-variant/40 bg-white p-5 shadow-soft">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          <Sparkles className="size-3.5 text-brand-orange" />
          Sur le même thème
        </p>

        <p className="mt-4 text-xs text-muted-foreground">
          Les suggestions ne peuvent pas être chargées pour le moment.
        </p>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-brand-navy/20 px-4 py-2 text-xs font-bold text-brand-navy transition-all hover:border-brand-navy hover:bg-brand-navy hover:text-white"
          >
            <RefreshCw className="size-3.5" />
            Recharger
          </button>
        )}
      </div>
    );
  }

  if (!articles?.length) {
    return (
      <div className="rounded-xl border border-outline-variant/40 bg-white p-5 shadow-soft">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          <Sparkles className="size-3.5 text-brand-orange" />
          Sur le même thème
        </p>

        <p className="mt-4 text-xs text-muted-foreground">
          Pas encore d’autres conseils sur ce thème.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-white p-5 shadow-soft">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <Sparkles className="size-3.5 text-brand-orange" />
        Sur le même thème
      </p>

      <ul className="mt-4 space-y-1">
        {articles.map((x) => (
          <HoverCard key={x.slug} openDelay={200}>
            <HoverCardTrigger asChild>
              <li>
                <Link
                  to={`/conseils/${x.slug}`}
                  className="group flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-surface-container-low"
                >
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", hue.dot)} />

                  <div className="min-w-0">
                    <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-on-surface transition-colors group-hover:text-brand-orange">
                      {x.titre}
                    </p>

                    <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                      {x.lecture} min · {fmtVus(x.vus)} lectures
                    </p>
                  </div>
                </Link>
              </li>
            </HoverCardTrigger>

            <HoverCardContent align="start" className="w-72">
              <p className="text-xs leading-relaxed text-muted-foreground">{x.extrait}</p>
            </HoverCardContent>
          </HoverCard>
        ))}
      </ul>
    </div>
  );
};

const MiniAlerte = ({ cat, hue }) => (
  <div className="relative overflow-hidden rounded-xl bg-brand-navy p-5 text-white">
    <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />

    <div
      className={cn(
        "pointer-events-none absolute -right-16 -top-16 size-56 rounded-full blur-3xl",
        hue.glow
      )}
      aria-hidden
    />

    <div className="relative">
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em]",
          hue.solid
        )}
      >
        <Bell className="size-3" />
        Alerte {cat.label}
      </span>

      <p className="mt-3 font-heading text-lg font-extrabold leading-snug">
        Ces conseils + vos offres, chaque matin à{" "}
        <span className="text-brand-orange">8h00</span>.
      </p>

      <CtaLink to="/inscription" size="md" icon={Bell} animateIcon className="mt-4 w-full">
        Créer mon alerte
      </CtaLink>

      <p className="mt-3 text-center text-[10px] text-white/50">
        Gratuit · 1 email par jour · 1 clic pour partir
      </p>
    </div>
  </div>
);

const CorpsArticle = ({
  a,
  cat,
  hue,
  contenu,
  related,
  relatedStatut,
  onRetry,
}) => {
  const sectionsSommaire = contenu.sections.map((s) => ({
    id: s.id,
    titre: s.titre,
  }));

  return (
    <section className="border-b border-outline-variant/30 bg-background py-14 md:py-18">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 md:px-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article>
          {contenu.intro && (
            <p className="text-lg leading-relaxed text-on-surface first-letter:float-left first-letter:mr-3 first-letter:font-heading first-letter:text-6xl first-letter:font-black first-letter:leading-[0.85] first-letter:text-brand-orange">
              {contenu.intro}
            </p>
          )}

          <ChiffresCles stats={contenu.stats} hue={hue} />

          {contenu.sections.length === 0 ? (
            <div className="mt-12">
              <EtatVide
                compact
                title="Contenu détaillé en cours de rédaction"
                description="Le résumé est déjà disponible. Le contenu complet sera publié prochainement."
              />
            </div>
          ) : (
            <div className="mt-12 space-y-11">
              {contenu.sections.map((s, i) => (
                <section key={s.id} id={s.id} className="scroll-mt-24">
                  <h2 className="flex items-baseline gap-3 font-heading text-2xl font-extrabold tracking-tight text-brand-navy">
                    <span className="text-sm font-black text-brand-orange">
                      0{i + 1}
                    </span>
                    {s.titre}
                  </h2>

                  {s.paragraphes?.map((p, index) => (
                    <p
                      key={`${s.id}-paragraphe-${index}`}
                      className="mt-4 leading-relaxed text-on-surface-variant"
                    >
                      {p}
                    </p>
                  ))}

                  {s.points?.length > 0 && (
                    <ul className="mt-4 space-y-2.5">
                      {s.points.map((point, index) => (
                        <li
                          key={`${s.id}-point-${index}`}
                          className="flex items-start gap-2.5 text-[15px] leading-relaxed text-on-surface-variant"
                        >
                          <span className="mt-1 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-brand-orange/10">
                            <Check className="size-2.5 text-brand-orange" strokeWidth={3.5} />
                          </span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  )}

                  {i === Math.min(1, contenu.sections.length - 1) && contenu.citation && (
                    <blockquote className="relative mt-8 overflow-hidden rounded-xl bg-brand-navy p-6 text-white sm:p-7">
                      <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />

                      <div
                        className={cn(
                          "pointer-events-none absolute -right-16 -top-16 size-56 rounded-full blur-3xl",
                          hue.glow
                        )}
                        aria-hidden
                      />

                      <Quote
                        className="relative size-7 text-brand-orange"
                        strokeWidth={1.5}
                        aria-hidden
                      />

                      <p className="relative mt-3 font-heading text-lg font-semibold leading-relaxed">
                        « {contenu.citation.texte} »
                      </p>

                      <footer className="relative mt-3 text-xs font-semibold text-white/60">
                        — {contenu.citation.auteur}
                      </footer>
                    </blockquote>
                  )}
                </section>
              ))}
            </div>
          )}

          {contenu.aRetenir.length > 0 && (
            <div className="mt-12 rounded-xl border-l-4 border-brand-orange bg-brand-orange/5 p-6">
              <p className="flex items-center gap-2 font-heading text-sm font-extrabold uppercase tracking-[0.14em] text-brand-navy">
                <Lightbulb className="size-4 text-brand-orange" />
                À retenir
              </p>

              <ul className="mt-3.5 space-y-2.5">
                {contenu.aRetenir.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2.5 text-[15px] leading-relaxed text-on-surface-variant"
                  >
                    <span className="mt-1 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-brand-orange/15">
                      <Check className="size-2.5 text-brand-orange" strokeWidth={3.5} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {contenu.tags.length > 0 && (
            <div className="mt-10 border-t border-outline-variant/40 pt-6">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                <Sparkles className="size-3.5 text-brand-orange" />
                Mots-clés associés
              </p>

              <div className="mt-2.5 flex flex-wrap gap-2">
                {contenu.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-outline-variant/60 bg-white px-3 py-1 text-xs font-medium text-on-surface-variant transition-colors hover:border-brand-navy/40 hover:text-brand-navy"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-4 rounded-xl border border-outline-variant/40 bg-white p-6 shadow-soft sm:flex-row sm:items-center">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-navy font-heading text-[13px] font-black text-white">
              RC
            </span>

            <div className="flex-1">
              <p className="flex items-center gap-1.5 font-heading text-sm font-bold text-brand-navy">
                La rédaction JobAlert CI
                <BadgeCheck className="size-4 text-brand-orange" />
              </p>

              <p className="mt-1 text-[13px] leading-relaxed text-on-surface-variant">
                Chaque conseil est écrit à partir des offres réellement collectées chaque matin
                sur nos sources, jamais de théorie hors-sol.
              </p>
            </div>

            <CtaLink
              to="/inscription"
              size="md"
              icon={Bell}
              animateIcon
              className="shrink-0"
            >
              Recevoir le brief
            </CtaLink>
          </div>
        </article>

        <aside className="flex flex-col gap-6 self-start lg:sticky lg:top-24">
          {contenu.sections.length > 0 && (
            <Sommaire
              sections={sectionsSommaire}
              lecture={a.lecture}
              className="hidden lg:block"
            />
          )}

          <MemeTheme
            articles={related}
            statut={relatedStatut}
            hue={hue}
            onRetry={onRetry}
          />

          <MiniAlerte cat={cat} hue={hue} />
        </aside>
      </div>
    </section>
  );
};

/* ════════════════════════════════════════════════════════════════════
CONTINUER LA LECTURE
════════════════════════════════════════════════════════════════════ */

const ContinuerLecture = ({ articles, statut, cat, onRetry }) => {
  return (
    <section className="bg-surface-container-lowest py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Continuer la lecture"
            title={
              <>
                D’autres conseils{" "}
                <span className="text-brand-orange">{cat.label}</span> vous attendent.
              </>
            }
          />

          <CtaLink
            to="/conseils"
            variant="outline"
            size="md"
            iconRight={ArrowRight}
            className="hidden md:inline-flex"
          >
            Toute la bibliothèque
          </CtaLink>
        </div>

        <div className="mt-10">
          {statut === "loading" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-xl" />
              ))}
            </div>
          ) : statut === "error" ? (
            <EtatVide
              icon={AlertTriangle}
              title="Suggestions indisponibles"
              description="Nous n’arrivons pas à charger les conseils similaires pour le moment."
              action={
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
                    >
                      <RefreshCw className="size-4" />
                      Réessayer
                    </button>
                  )}

                  <CtaLink to="/conseils" variant="outline" size="md" iconRight={ArrowRight}>
                    Voir la bibliothèque
                  </CtaLink>
                </div>
              }
            />
          ) : articles.length === 0 ? (
            <EtatVide
              title="Pas encore de conseils similaires"
              description="D’autres contenus sont en préparation. En attendant, explorez la bibliothèque complète."
              action={
                <CtaLink to="/conseils" variant="outline" size="md" iconRight={ArrowRight}>
                  Voir la bibliothèque
                </CtaLink>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {articles.map((x, i) => (
                <CarteArticle key={x.slug} a={x} index={i} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 text-center md:hidden">
          <CtaLink to="/conseils" variant="outline" size="md" iconRight={ArrowRight}>
            Toute la bibliothèque
          </CtaLink>
        </div>
      </div>
    </section>
  );
};

/* ════════════════════════════════════════════════════════════════════
PAGE
════════════════════════════════════════════════════════════════════ */

const DetailsConseil = () => {
  const { slug } = useParams();

  const {
    statut,
    article,
    contenu,
    cat,
    hue,
    related,
    relatedStatut,
    erreurs,
    retry,
  } = useArticleDetail(slug);

  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    setCopied(false);
  }, [slug]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Contexte non sécurisé ou navigateur trop ancien.
    }

    setCopied(true);

    if (copyTimer.current) clearTimeout(copyTimer.current);

    copyTimer.current = setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const seo =
    statut === "ready" && article
      ? conseilSeo({ article, cat, contenu })
      : conseilSeo({ slug: slug || "conseil" });

  if (statut === "loading") {
    return (
      <>
        <Seo {...seo} />
        <DetailSkeleton />
      </>
    );
  }

  if (statut === "error") {
    return (
      <>
        <Seo {...seo} />
        <ErreurDetail
          slug={slug}
          detail={messageErreur(erreurs?.article || erreurs?.global)}
          onRetry={retry}
        />
      </>
    );
  }

  if (statut === "notfound" || !article) {
    return (
      <>
        <Seo {...seo} />
        <ConseilIntrouvable slug={slug} />
      </>
    );
  }

  return (
    <>
      <Seo {...seo} />

      <BarreProgression hex={hue.hex} />

      <main>
        <EnTeteArticle
          a={article}
          cat={cat}
          hue={hue}
          contenu={contenu}
          copied={copied}
          onCopy={copyLink}
        />

        <CorpsArticle
          a={article}
          cat={cat}
          hue={hue}
          contenu={contenu}
          related={related}
          relatedStatut={relatedStatut}
          onRetry={retry}
        />

        <ContinuerLecture
          articles={related}
          statut={relatedStatut}
          cat={cat}
          onRetry={retry}
        />

        {contenu.sections.length > 0 && (
          <SommaireFlottant
            sections={contenu.sections.map((s) => ({ id: s.id, titre: s.titre }))}
            lecture={article.lecture}
          />
        )}
      </main>
    </>
  );
};

export default DetailsConseil;