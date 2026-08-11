// src/pages/conseils/index.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  ArrowUpRight,
  Bell,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Inbox,
  Lightbulb,
  MoveHorizontal,
  Newspaper,
  RefreshCw,
  Search,
  SearchX,
  SlidersHorizontal,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";

import Seo from "@/components/seo/Seo";
import { cn } from "@/lib/utils";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { HUES } from "@/lib/hues";
import useCarrousel from "@/hooks/use-carrousel";

import {
  ChipFiltre,
  ChipsFiltres,
  CountUp,
  CtaLink,
  FilterGroup,
  ReassuranceList,
  SectionHeading,
  SegmentsProgression,
  StatusChip,
  StickyFilterBar,
} from "@/components/shared";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import { CATEGORIES, fmtVus } from "@/data/conseils";
import { dateLabel } from "@/lib/dates";
import { CarteArticle } from "@/components/shared";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { conseilsSeo } from "@/lib/seo";

import {
  getArticles,
  getArticleCategories,
  getArticleFeatured,
  getArticlesDaily,
  getArticleSeries,
  getArticlesPopular,
} from "@/api/public/articles";

import { REASSURANCES } from "@/data/constanteMetier";

/* ════════════════════════════════════════════════════════════════════
OUTILS
════════════════════════════════════════════════════════════════════ */

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

const SEUIL_SWIPE_PX = 56;
const SEUIL_SWIPE_VITESSE = 420;

const messageErreur = (erreur) =>
  erreur?.response?.data?.detail ||
  erreur?.response?.data?.message ||
  erreur?.message ||
  "Une erreur inattendue est survenue.";

const estErreur404 = (erreur) =>
  erreur?.response?.status === 404 || erreur?.status === 404;


const useGlissement = ({ count, idx, setIdx, pause, reprendre }) => {
  const [direction, setDirection] = useState(1);

  const suivant = () => {
    setDirection(1);
    setIdx((i) => (i + 1) % count);
  };

  const precedent = () => {
    setDirection(-1);
    setIdx((i) => (i - 1 + count) % count);
  };

  const onSelect = (i) => {
    if (i !== idx) {
      setDirection(i > idx ? 1 : -1);
      setIdx(i);
    }
  };

  const propsGlissement = {
    drag: "x",
    dragConstraints: { left: 0, right: 0 },
    dragElastic: 0.15,
    dragMomentum: false,
    dragTransition: { bounceStiffness: 600, bounceDamping: 28 },
    onDragStart: pause,
    onDragEnd: (e, info) => {
      reprendre();
      const { offset, velocity } = info;

      if (offset.x < -SEUIL_SWIPE_PX || velocity.x < -SEUIL_SWIPE_VITESSE) {
        suivant();
      } else if (offset.x > SEUIL_SWIPE_PX || velocity.x > SEUIL_SWIPE_VITESSE) {
        precedent();
      }
    },
  };

  return { direction, onSelect, propsGlissement };
};

const variantsGlissement = {
  entrer: (dir) => ({ opacity: 0, x: 64 * dir }),
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
  sortir: (dir) => ({
    opacity: 0,
    x: -48 * dir,
    transition: { duration: 0.28, ease: "easeIn" },
  }),
};

const variantsGlissementDoux = {
  entrer: (dir) => ({ opacity: 0, x: 32 * dir }),
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
  },
  sortir: (dir) => ({
    opacity: 0,
    x: -24 * dir,
    transition: { duration: 0.25, ease: "easeIn" },
  }),
};

/* ════════════════════════════════════════════════════════════════════
CHARGEMENT DES DONNÉES
════════════════════════════════════════════════════════════════════ */

const LIMIT_ARTICLES = 50;
const MAX_LOTS_ARTICLES = 9;

const joursDepuis = (iso) => {
  if (!iso) return 0;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 0;
  const debut = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((debut(new Date()) - debut(date)) / 86_400_000);
  return diff > 0 ? diff : 0;
};

const adaptConseilsQuotidiens = (payload, index = []) => {
  const brut = Array.isArray(payload) ? payload : payload ? [payload] : [];
  return brut
    .filter((t) => t?.text)
    .map((t) => ({
      id: t.id ?? t.text,
      t: t.text,
      cat: index.filter((c) => c.id === t.category_id)[0] ?? {},
    }));
};

const chargerTousArticles = async () => {
  const articles = [];

  for (let lot = 0; lot < MAX_LOTS_ARTICLES; lot += 1) {
    try {
      const data = await getArticles({
        limit: LIMIT_ARTICLES,
        offset: lot * LIMIT_ARTICLES,
        sort: "recent",
      });

      const liste = Array.isArray(data) ? data : [];
      articles.push(...liste);

      if (liste.length < LIMIT_ARTICLES) break;
    } catch (erreur) {
      // Si la première page échoue, on propage l’erreur.
      if (lot === 0) throw erreur;

      // Si une page suivante échoue, on garde au moins les données déjà chargées.
      break;
    }
  }

  return articles;
};

const useConseilsData = () => {
  const [tentative, setTentative] = useState(0);
  const [etat, setEtat] = useState({
    statut: "loading", // loading | ready | empty | error
    articles: [],
    featured: [],
    dailyTips: [],
    series: [],
    popular: [],
    categoriesIndex: [],
    erreurs: {},
  });

  useEffect(() => {
    let actif = true;

    const charger = async () => {
      setEtat((prev) => ({
        ...prev,
        statut: "loading",
        erreurs: {},
      }));

      const [
        categoriesRes,
        featuredRes,
        dailyRes,
        seriesRes,
        popularRes,
        articlesRes,
      ] = await Promise.allSettled([
        getArticleCategories(),
        getArticleFeatured(),
        getArticlesDaily(),
        getArticleSeries(),
        getArticlesPopular({ limit: 5 }),
        chargerTousArticles(),
      ]);

      // console.log("categoriesRes", categoriesRes)


      if (!actif) return;

      const categoriesIndex =
        categoriesRes.status === "fulfilled"
          ? categoriesRes.value
          : [];

      const featured =
        featuredRes.status === "fulfilled"
          ? featuredRes.value
          : [];

      const dailyTips =
        dailyRes.status === "fulfilled"
          ? adaptConseilsQuotidiens(dailyRes.value, categoriesIndex)
          : [];

      const series =
        seriesRes.status === "fulfilled"
          ? seriesRes.value
          : [];

      const popular =
        popularRes.status === "fulfilled"
          ? popularRes.value
          : [];

      const articles =
        articlesRes.status === "fulfilled"
          ? articlesRes.value
          : [];

      const erreurs = {};

      const erreurReelle = (res) =>
        res.status === "rejected" && !estErreur404(res.reason);

      if (erreurReelle(categoriesRes)) erreurs.categories = categoriesRes.reason;
      if (erreurReelle(featuredRes)) erreurs.featured = featuredRes.reason;
      if (erreurReelle(dailyRes)) erreurs.daily = dailyRes.reason;
      if (erreurReelle(seriesRes)) erreurs.series = seriesRes.reason;
      if (erreurReelle(popularRes)) erreurs.popular = popularRes.reason;
      if (erreurReelle(articlesRes)) erreurs.articles = articlesRes.reason;

      const aDesDonnees =
        articles.length > 0 ||
        featured.length > 0 ||
        dailyTips.length > 0 ||
        series.length > 0 ||
        popular.length > 0;

      const statut = aDesDonnees
        ? "ready"
        : erreurReelle(articlesRes) || erreurReelle(featuredRes)
          ? "error"
          : "empty";

      setEtat({
        statut,
        articles,
        featured,
        dailyTips,
        series,
        popular,
        categoriesIndex,
        erreurs,
      });
    };

    charger().catch((erreur) => {
      console.error("Une erreur a fait planter la fonction charger :", erreur);
      if (!actif) return;

      setEtat({
        statut: "error",
        articles: [],
        featured: [],
        dailyTips: [],
        series: [],
        popular: [],
        categoriesIndex: [],
        erreurs: { global: erreur },
      });
    });

    return () => {
      actif = false;
    };
  }, [tentative]);

  const retry = useCallback(() => {
    setTentative((t) => t + 1);
  }, []);

  return { ...etat, retry };
};

/* ════════════════════════════════════════════════════════════════════
UI — SKELETONS / ERREURS / EMPTY
════════════════════════════════════════════════════════════════════ */

const Skeleton = ({ className }) => (
  <div
    aria-hidden
    className={cn("animate-pulse rounded-lg bg-surface-container-high", className)}
  />
);

const HeroSkeleton = () => (
  <section className="relative overflow-hidden hero-gradient">
    <div className="relative z-10 mx-auto max-w-7xl px-6 pb-14 pt-8 md:px-12 md:pb-16 md:pt-10">
      <Skeleton className="h-4 w-40" />

      <div className="mt-8 grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="space-y-5">
          <Skeleton className="h-7 w-64 rounded-full" />
          <Skeleton className="h-14 w-full max-w-xl" />
          <Skeleton className="h-14 w-full max-w-lg" />
          <Skeleton className="h-5 w-full max-w-xl" />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Skeleton className="h-12 w-64 rounded-full" />
            <Skeleton className="h-12 w-52 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-8">
            <Skeleton className="h-14 w-20" />
            <Skeleton className="h-14 w-20" />
            <Skeleton className="h-14 w-20" />
          </div>
        </div>

        <Skeleton className="h-[28rem] w-full rounded-2xl" />
      </div>
    </div>
  </section>
);

const ConseilDuJourSkeleton = () => (
  <section className="border-y border-outline-variant/40 bg-surface-container-lowest">
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between md:px-12">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-10 w-full max-w-xl" />
      <Skeleton className="h-5 w-28" />
    </div>
  </section>
);

const GrilleSkeleton = () => (
  <section className="bg-background py-10 md:py-12">
    <div className="mx-auto max-w-7xl px-6 md:px-12">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full max-w-lg" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <Skeleton className="mb-6 h-28 w-full rounded-xl" />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>

        <div className="space-y-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
        </div>
      </div>
    </div>
  </section>
);

const EtatErreur = ({
  title = "Une erreur est survenue",
  detail,
  onRetry,
  compact = false,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    className={cn(
      "rounded-xl border border-error/20 bg-error-container/25 text-center",
      compact ? "p-6" : "p-12"
    )}
  >
    <span className="mx-auto grid size-10 place-items-center rounded-full bg-error-container text-error">
      <AlertTriangle className="size-5" />
    </span>

    <h3 className="mt-4 font-heading text-lg font-bold text-brand-navy">{title}</h3>
    <p className="mt-1 text-sm text-muted-foreground">
      {detail || "Certaines données n’ont pas pu être récupérées."}
    </p>

    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
      >
        <RefreshCw className="size-4" />
        Réessayer
      </button>
    )}
  </motion.div>
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

const BandeauErreurPartielle = ({ erreurs, onRetry }) => {
  const messages = Object.values(erreurs || {}).filter(Boolean);

  if (!messages.length) return null;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-error/20 bg-error-container/20 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-error" />
        <div>
          <p className="text-sm font-semibold text-brand-navy">
            Certaines sections n’ont pas pu être chargées.
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Les données affichées peuvent être incomplètes.
          </p>
        </div>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-brand-navy/20 px-4 py-2 text-xs font-bold text-brand-navy transition-all hover:border-brand-navy hover:bg-brand-navy hover:text-white"
        >
          <RefreshCw className="size-3.5" />
          Recharger
        </button>
      )}
    </div>
  );
};

const PageErreur = ({ onRetry }) => (
  <section className="relative overflow-hidden hero-gradient">
    <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />

    <div className="relative z-10 mx-auto max-w-7xl px-6 pb-14 pt-8 md:px-12 md:pb-16 md:pt-10">
      <nav
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
        aria-label="Fil d’Ariane"
      >
        <Link to="/" className="transition-colors hover:text-brand-navy">
          Accueil
        </Link>
        <ChevronRight className="size-3" />
        <span className="font-semibold text-brand-navy">Conseils & Analyses</span>
      </nav>

      <div className="mx-auto mt-16 max-w-2xl">
        <EtatErreur
          title="Impossible de charger la page Conseils"
          detail="Vérifiez votre connexion internet, puis réessayez."
          onRetry={onRetry}
        />
      </div>
    </div>
  </section>
);

/* ════════════════════════════════════════════════════════════════════
HERO — À LA UNE
════════════════════════════════════════════════════════════════════ */

const DUREE_UNE = 6500;

const CarteUneVide = () => (
  <div className="relative mx-auto w-full max-w-md md:max-w-none">
    <div className="rounded-2xl border border-dashed border-outline-variant/60 bg-white p-10 text-center shadow-soft">
      <Newspaper className="mx-auto size-8 text-muted-foreground/50" />
      <p className="mt-4 font-heading text-lg font-bold text-brand-navy">
        Aucun conseil à la une
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Les prochains contenus sont en cours de préparation.
      </p>

      <CtaLink to="#bibliotheque" variant="secondary" className="mt-5">
        Explorer la bibliothèque
      </CtaLink>
    </div>
  </div>
);

const CarrouselUne = ({ articles }) => {
  const { idx, setIdx, progression, pause, reprendre } = useCarrousel({
    count: articles.length,
    duree: DUREE_UNE,
  });

  const { direction, onSelect, propsGlissement } = useGlissement({
    count: articles.length,
    idx,
    setIdx,
    pause,
    reprendre,
  });

  const indexSur = articles.length
    ? ((idx % articles.length) + articles.length) % articles.length
    : 0;

  const a = articles[indexSur];

  if (!a) return <CarteUneVide />;

  const hue = HUES[a.category?.hue] || HUES["sky"];
  // const Icon = cat.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, rotate: 1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={pause}
      onMouseLeave={reprendre}
      className="relative mx-auto w-full max-w-md min-w-0 md:max-w-none"
    >
      <motion.div
        className="absolute -inset-8 rounded-full blur-3xl"
        animate={{ backgroundColor: `${hue.hex}30` }}
        transition={{ duration: 0.9 }}
        aria-hidden
      />

      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: [0, -7, 0],
        }}
        transition={{
          delay: 0.9,
          opacity: { duration: 0.4 },
          scale: { duration: 0.4 },
          y: { duration: 4.6, repeat: Infinity, ease: "easeInOut" },
        }}
        className="absolute -top-4 left-5 z-20 inline-flex -rotate-3 items-center gap-1.5 rounded-full bg-brand-orange px-3.5 py-1.5 text-[11px] font-bold text-white shadow-lg sm:-left-4"
      >
        <Newspaper className="size-3" />
        À la une
      </motion.span>

      <motion.span
        key={`lecture-${a.slug}`}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
        transition={{
          opacity: { duration: 0.3, delay: 0.1 },
          scale: { duration: 0.3, delay: 0.1 },
          y: { duration: 5.2, repeat: Infinity, ease: "easeInOut" },
        }}
        className="absolute -top-3 right-6 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3 py-1.5 text-[11px] font-bold text-brand-navy shadow-soft"
      >
        <Clock className="size-3 text-brand-orange" />
        {a.reading_minutes} min de lecture
      </motion.span>

      <motion.span
        key={`vus-${a.slug}`}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
        transition={{
          opacity: { duration: 0.3, delay: 0.2 },
          scale: { duration: 0.3, delay: 0.2 },
          y: { duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 0.6 },
        }}
        className="absolute -bottom-4 right-8 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3.5 py-1.5 text-[11px] font-bold text-emerald-600 shadow-hover"
      >
        <TrendingUp className="size-3" />
        {fmtVus(a.view_count)} lectures
      </motion.span>

      <motion.div
        {...propsGlissement}
        className="relative flex cursor-grab select-none flex-col overflow-hidden rounded-2xl bg-brand-navy text-white shadow-[0_24px_48px_-16px_rgba(15,45,77,0.35)] active:cursor-grabbing"
      >
        <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />

        <motion.div
          className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full blur-3xl"
          animate={{ backgroundColor: `${hue.hex}3d` }}
          transition={{ duration: 0.9 }}
          aria-hidden
        />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={a.slug}
            initial={{ opacity: 0, scale: 0.92, rotate: 6 }}
            animate={{ opacity: 1, scale: 1, rotate: 12 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute -bottom-8 -right-4"
            aria-hidden
          >
            {/* <Icon className="size-48 text-white/5" strokeWidth={1} /> */}
          </motion.div>
        </AnimatePresence>

        <div className="relative px-6 pt-5">
          <SegmentsProgression
            count={articles.length}
            idx={indexSur}
            progression={progression}
            onSelect={onSelect}
            tone="dark"
            labels={articles.map((x) => x.title)}
          />
        </div>

        <div className="relative flex items-center gap-3 border-b border-white/10 px-6 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white font-heading text-[11px] font-black text-white">
            <img src="/logo2.svg" alt="Logo" className="h-full w-full" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold">Le brief JobAlert CI</p>

            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={a.slug}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.25 }}
                className="truncate text-[11px] text-white/60"
              >
                À la une · {dateLabel(joursDepuis(a.published_at))} · {indexSur + 1}/{articles.length}
              </motion.p>
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={a.slug}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="shrink-0 text-[11px] font-semibold text-white/60"
            >
              {a.reading_minutes} min
            </motion.span>
          </AnimatePresence>

          <MoveHorizontal className="pointer-coarse:block hidden size-3.5 shrink-0 text-white/40" aria-hidden />
        </div>

        <div className="relative flex min-h-90 flex-1 flex-col sm:min-h-94">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={a.slug}
              custom={direction}
              variants={variantsGlissement}
              initial="entrer"
              animate="visible"
              exit="sortir"
              className="flex flex-1 flex-col px-6 py-6"
            >
              <span
                className={cn(
                  "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white",
                  hue.solid
                )}
              >
                {/* <Icon className="size-3" /> */}
                {a.category?.label}
              </span>

              <Link
                to={`/conseils/${a.slug}`}
                className="mt-4 line-clamp-3 font-heading text-2xl font-extrabold leading-snug transition-colors duration-300 hover:text-brand-orange sm:text-[1.7rem]"
              >
                {a.title}
              </Link>

              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/70">
                {a.excerpt}
              </p>

              <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/10 pt-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-full bg-white/10 text-[10px] font-black ring-1 ring-white/20">
                    RC
                  </span>

                  <div>
                    <p className="text-xs font-bold">La rédaction</p>
                    <p className="text-[10px] text-white/50">Analystes marché · JobAlert CI</p>
                  </div>
                </div>

                <Link
                  to={`/conseils/${a.slug}`}
                  className="group inline-flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2.5 text-xs font-bold text-white transition-all duration-300 hover:brightness-110 active:scale-[0.98]"
                >
                  Lire l’article
                  <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

const CarteUne = ({ articles }) =>
  articles.length ? <CarrouselUne articles={articles} /> : <CarteUneVide />;

const HeroConseils = ({
  featured,
  articlesCount,
  categoriesCount,
  moyenneLecture,
  erreurs,
  retry,
}) => {
  return (
    <section className="relative overflow-hidden hero-gradient">
      <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
      <div className="absolute -top-32 right-[-10%] size-140 rounded-full bg-brand-orange/8 blur-3xl" aria-hidden />
      <div className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/5 blur-3xl" aria-hidden />

      <div className="relative z-10 mx-auto max-w-7xl px-6 pb-14 pt-8 md:px-12 md:pb-16 md:pt-10">
        <motion.nav
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          aria-label="Fil d’Ariane"
        >
          <Link to="/" className="transition-colors hover:text-brand-navy">
            Accueil
          </Link>
          <ChevronRight className="size-3" />
          <span className="font-semibold text-brand-navy">Conseils & Analyses</span>
        </motion.nav>

        <div className="mt-8 grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-start gap-5"
          >
            <motion.div variants={fadeUp}>
              <StatusChip tooltip="Un nouveau conseil publié chaque mardi à 6h02, en même temps que la collecte des 4 sources.">
                Nouveau conseil chaque mardi · 6h02
              </StatusChip>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-heading text-4xl font-black leading-[1.06] tracking-tight text-brand-navy sm:text-5xl xl:text-6xl"
            >
              Le marché de l’emploi ivoirien,{" "}
              <span className="relative whitespace-nowrap text-brand-orange">
                décodé
                <svg
                  className="absolute -bottom-1.5 left-0 w-full"
                  viewBox="0 0 200 9"
                  fill="none"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <motion.path
                    d="M2 6.5C60 2.5 140 2.5 198 6.5"
                    stroke="#F5A623"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    whileInView={{ pathLength: 1, opacity: 0.85 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.6, ease: "easeOut", delay: 0.5 }}
                  />
                </svg>
              </span>
              .
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="max-w-xl leading-relaxed text-on-surface-variant md:text-lg"
            >
              CV, entretiens, salaires, tendances par filière : des conseils concrets,
              écrits à partir des offres collectées chaque matin sur nos sources.
              Pas de théorie, du terrain.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-1 flex flex-col gap-3 sm:flex-row">
              <CtaLink to="/inscription" icon={Bell} animateIcon>
                Recevoir conseils + offres à 8h00
              </CtaLink>

              <CtaLink
                to="#bibliotheque"
                variant="secondary"
                iconRight={ChevronDown}
                iconRightClassName="group-hover:translate-x-0 group-hover:translate-y-0.5"
              >
                Explorer la bibliothèque
              </CtaLink>
            </motion.div>

            <motion.dl variants={fadeUp} className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-4">
              {[
                { valeur: articlesCount, label: "conseils publiés" },
                { valeur: categoriesCount, label: "thèmes couverts" },
                { valeur: moyenneLecture, label: "min de lecture moyenne" },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="font-heading text-3xl font-black text-brand-navy">
                    <CountUp to={s.valeur} />
                  </dd>
                  <dd className="text-xs font-medium text-muted-foreground">{s.label}</dd>
                </div>
              ))}
            </motion.dl>
          </motion.div>

          <div>
            {featured.length > 0 ? (
              <CarteUne articles={featured} />
            ) : erreurs.featured ? (
              <EtatErreur
                compact
                title="À la une indisponible"
                detail={messageErreur(erreurs.featured)}
                onRetry={retry}
              />
            ) : (
              <CarteUneVide />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ════════════════════════════════════════════════════════════════════
CONSEIL DU JOUR
════════════════════════════════════════════════════════════════════ */

const DUREE_CONSEIL = 5000;

const ConseilDuJourVide = () => (
  <section className="border-y border-outline-variant/40 bg-surface-container-lowest">
    <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-6 py-4 md:flex-row md:justify-between md:px-12">
      <div className="flex items-center gap-2.5">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-orange opacity-70" />
          <span className="relative inline-flex size-2 rounded-full bg-brand-orange" />
        </span>
        <span className="whitespace-nowrap text-[11px] font-black uppercase tracking-[0.16em] text-brand-navy">
          Conseil du jour
        </span>
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Lightbulb className="size-4 text-brand-orange" />
        Pas de conseil du jour pour le moment.
      </div>
    </div>
  </section>
);

const ConseilDuJourCarrousel = ({ tips }) => {
  const { idx, setIdx, progression, pause, reprendre } = useCarrousel({
    count: tips.length,
    duree: DUREE_CONSEIL,
  });

  const { direction, onSelect, propsGlissement } = useGlissement({
    count: tips.length,
    idx,
    setIdx,
    pause,
    reprendre,
  });

  const indexSur = tips.length
    ? ((idx % tips.length) + tips.length) % tips.length
    : 0;

  const conseil = tips[indexSur];

  if (!conseil) return <ConseilDuJourVide />;

  const hue = HUES[conseil.cat?.hue] || HUES["sky"]

  return (
    <section
      onMouseEnter={pause}
      onMouseLeave={reprendre}
      className="border-y border-outline-variant/40 bg-surface-container-lowest"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-stretch px-6 md:flex-row md:px-12">
        <div className="z-10 flex shrink-0 items-center gap-2.5 border-outline-variant/40 py-4 pr-5 md:border-r">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-orange opacity-70" />
            <span className="relative inline-flex size-2 rounded-full bg-brand-orange" />
          </span>

          <span className="whitespace-nowrap text-[11px] font-black uppercase tracking-[0.16em] text-brand-navy">
            Conseil du jour
          </span>
        </div>

        <motion.div
          {...propsGlissement}
          className="flex flex-1 cursor-grab select-none flex-col justify-center gap-3 py-4 pl-5 active:cursor-grabbing sm:flex-row sm:items-center sm:gap-5"
        >
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg transition-colors duration-500",
              hue.tile
            )}
          >
            <Lightbulb className="size-4.5" />
          </span>

          <div className="min-h-12 flex-1 sm:min-h-10">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={indexSur}
                custom={direction}
                variants={variantsGlissementDoux}
                initial="entrer"
                animate="visible"
                exit="sortir"
              >
                <p className="text-[13px] font-medium leading-relaxed text-on-surface sm:text-sm">
                  {conseil.t}
                </p>
                <p className={cn("mt-1 text-[10px] font-bold uppercase tracking-[0.14em]", hue.accent)}>
                  {conseil.cat?.label}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex shrink-0 items-center gap-3.5">
            <SegmentsProgression
              count={tips.length}
              idx={indexSur}
              progression={progression}
              onSelect={onSelect}
              tone="light"
              className="w-24 sm:w-28"
              labels={tips.map((c) => c.t)}
            />

            <span className="rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-bold text-on-surface-variant">
              n° {indexSur + 1} / {tips.length}
            </span>

            <MoveHorizontal className="pointer-coarse:block hidden size-3.5 text-muted-foreground/60" aria-hidden />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const ConseilDuJour = ({ tips }) =>
  tips.length ? <ConseilDuJourCarrousel tips={tips} /> : <ConseilDuJourVide />;

/* ════════════════════════════════════════════════════════════════════
SIDEBAR — PLUS LUS / SÉRIES / ALERTE
════════════════════════════════════════════════════════════════════ */

const PlusLus = ({ popular, articles }) => {
  const top = useMemo(() => {
    const source = popular.length
      ? popular
      : [...articles].sort((a, b) => (b.view_count || 0) - (a.view_count || 0));

    return source.slice(0, 5);
  }, [popular, articles]);

  if (!top.length) {
    return (
      <div className="rounded-xl border border-outline-variant/40 bg-white p-5 shadow-soft">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          <Flame className="size-3.5 text-brand-orange" />
          Les plus lus
        </p>

        <p className="mt-4 text-xs text-muted-foreground">
          Aucun conseil disponible pour le moment.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-white p-5 shadow-soft">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <Flame className="size-3.5 text-brand-orange" />
        Les plus lus
      </p>

      <ol className="mt-4 space-y-1">
        {top.map((a, i) => {
          const hue = HUES[a.category?.hue] || HUES["sky"];

          return (
            <HoverCard key={a.slug} openDelay={200}>
              <HoverCardTrigger asChild>
                <li>
                  <Link
                    to={`/conseils/${a.slug}`}
                    className="group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-container-low"
                  >
                    <span className="font-heading text-lg font-black leading-none text-brand-navy/15 transition-colors group-hover:text-brand-orange/40">
                      0{i + 1}
                    </span>

                    <div className="min-w-0">
                      <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-on-surface transition-colors group-hover:text-brand-orange">
                        {a.title}
                      </p>

                      <p className="mt-0.5 flex items-center gap-2 text-[10px] font-semibold text-muted-foreground">
                        <span className={cn("size-1.5 rounded-full", hue.dot)} />
                        {a.category?.label} · {fmtVus(a.view_count)} lectures
                      </p>
                    </div>
                  </Link>
                </li>
              </HoverCardTrigger>

              <HoverCardContent align="start" className="w-72">
                <p className="font-heading text-sm font-bold text-brand-navy">{a.titre}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {a.excerpt}
                </p>
                <p className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                  <Clock className="size-3 text-brand-orange" />
                  {a.reading_minutes} min · {dateLabel(joursDepuis(a.published_at))}
                </p>
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </ol>
    </div>
  );
};

const Series = ({ series }) => {
  if (!series.length) {
    return (
      <div className="rounded-xl border border-outline-variant/40 bg-white p-5 shadow-soft">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          <BookOpen className="size-3.5 text-brand-orange" />
          Séries à suivre
        </p>

        <p className="mt-4 text-xs text-muted-foreground">
          Aucune série proposée pour le moment.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-white p-5 shadow-soft">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <BookOpen className="size-3.5 text-brand-orange" />
        Séries à suivre
      </p>

      <div className="mt-4 space-y-2.5">
        {series.map((s) => {
          const hue = HUES[s.hue] || HUES["sky"];

          const aProgression =
            typeof s.lus === "number" &&
            typeof s.total === "number" &&
            s.total > 0;

          return (
            <Link
              key={s.id}
              to="/conseils"
              className="group block rounded-lg border border-outline-variant/50 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-navy/30 hover:shadow-soft"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-bold text-brand-navy transition-colors group-hover:text-brand-orange">
                  {s.title}
                </p>
                <ArrowRight className="size-3.5 shrink-0 text-outline-variant transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand-orange" />
              </div>

              {aProgression ? (
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-container">
                    <div
                      className={cn("h-full rounded-full", hue.solid)}
                      style={{ width: `${(s.lus / s.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {s.lus}/{s.total}
                  </span>
                </div>
              ) : (
                <p className="mt-2.5 line-clamp-2 text-xs text-muted-foreground">
                  {s.description || "Une série de conseils JobAlert CI."}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

const MiniAlerte = () => (
  <div className="relative hidden overflow-hidden rounded-xl bg-brand-navy p-5 text-white lg:flex">
    <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />
    <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-brand-orange/20 blur-3xl" aria-hidden />

    <div className="relative">
      <span className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em]">
        <Bell className="size-3" />
        Le brief quotidien
      </span>

      <p className="mt-3 font-heading text-lg font-extrabold leading-snug">
        1 conseil + vos offres, chaque matin à <span className="text-brand-orange">8h00</span>.
      </p>

      <CtaLink to="/inscription" size="md" icon={Bell} animateIcon className="mt-4 w-full">
        Créer mon alerte
      </CtaLink>

      <div className="mt-3.5 border-t border-white/10 pt-3.5">
        <ReassuranceList
          items={REASSURANCES}
          tone="dark"
          className="gap-x-4 gap-y-1.5"
        />
      </div>
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════════════
BIBLIOTHÈQUE — FILTRES + RECHERCHE + TRI + PAGINATION
════════════════════════════════════════════════════════════════════ */

const CONFIG_FILTRES = {
  scalars: [
    { key: "cat", param: "cat", defaut: "tous" },
    { key: "sort", param: "tri", defaut: "recents" },
    { key: "query", param: "q", defaut: "" },
  ],
};

const PAR_PAGE = 9;

const pagesAvecEllipses = (page, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const ens = new Set([1, totalPages, page - 1, page, page + 1]);

  if (page <= 3) [2, 3, 4].forEach((p) => ens.add(p));
  if (page >= totalPages - 2) {
    [totalPages - 1, totalPages - 2, totalPages - 3].forEach((p) => ens.add(p));
  }

  const liste = [...ens]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const avec = [];
  let prec = 0;

  for (const p of liste) {
    if (p - prec > 1) avec.push("…");
    avec.push(p);
    prec = p;
  }

  return avec;
};

const Pagination = ({ page, totalPages, depart, nbVisibles, total, onChange }) => {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination des conseils" className="mt-10 flex flex-col items-center gap-2.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          aria-label="Page précédente"
          className="grid size-9 place-items-center rounded-lg border border-outline-variant/60 bg-white text-on-surface-variant shadow-soft transition-all duration-200 enabled:hover:-translate-x-0.5 enabled:hover:border-brand-navy/40 enabled:hover:text-brand-navy enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>

        {pagesAvecEllipses(page, totalPages).map((p, i) =>
          p === "…" ? (
            <span
              key={`points-${i}`}
              aria-hidden
              className="px-0.5 text-sm font-bold text-muted-foreground/60"
            >
              …
            </span>
          ) : (
            <button
              type="button"
              key={p}
              onClick={() => onChange(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "size-9 rounded-lg text-sm font-bold transition-all duration-200",
                p === page
                  ? "bg-brand-navy text-white shadow-hover"
                  : "border border-outline-variant/60 bg-white text-on-surface-variant shadow-soft hover:border-brand-navy/40 hover:text-brand-navy active:scale-95"
              )}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Page suivante"
          className="grid size-9 place-items-center rounded-lg border border-outline-variant/60 bg-white text-on-surface-variant shadow-soft transition-all duration-200 enabled:hover:translate-x-0.5 enabled:hover:border-brand-navy/40 enabled:hover:text-brand-navy enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Conseils{" "}
        <strong className="font-heading font-bold text-brand-navy">
          {depart + 1}–{depart + nbVisibles}
        </strong>{" "}
        sur <strong className="font-heading font-bold text-brand-navy">{total}</strong> · page{" "}
        {page}/{totalPages}
      </p>
    </nav>
  );
};

const GrilleArticles = ({ articles, popular, series, categoriesIndex, erreurs, retry }) => {
  const { valeurs, setScalar, reset } = useUrlFilters(CONFIG_FILTRES);

  const categoriesPourFiltres = useMemo(() => {
    const base = categoriesIndex ?? [];

    return base.filter(
      (cat, index, arr) => arr.findIndex((x) => x.code === cat.code) === index
    );
  }, [categoriesIndex]);

  const cat =
    valeurs.cat === "tous" || categoriesPourFiltres.some((c) => c.code === valeurs.cat)
      ? valeurs.cat
      : "tous";

  const sort = ["recents", "populaires", "courts"].includes(valeurs.sort)
    ? valeurs.sort
    : "recents";

  const setCat = useCallback((code) => setScalar("cat", code), [setScalar]);
  const setSort = useCallback((k) => setScalar("sort", k), [setScalar]);

  const [queryLocale, setQueryLocale] = useState(valeurs.query);

  useEffect(() => {
    setQueryLocale(valeurs.query);
  }, [valeurs.query]);

  useEffect(() => {
    if (queryLocale === valeurs.query) return;

    const t = setTimeout(() => setScalar("query", queryLocale), 350);
    return () => clearTimeout(t);
  }, [queryLocale, valeurs.query, setScalar]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const grilleRef = useRef(null);

  useEffect(() => {
    setPage(1);
  }, [cat, sort, queryLocale]);

  const chipsDefs = useMemo(() => {
    return [
      { code: "tous", label: "Tous", icon: null, count: articles.length },
      ...categoriesPourFiltres.map((c) => ({
        ...c,
        count: articles.filter((a) => a.category?.code === c.code).length,
      })),
    ];
  }, [articles, categoriesPourFiltres]);

  const filtered = useMemo(() => {
    const q = queryLocale.trim().toLowerCase();

    let list = articles.filter(
      (a) =>
        (cat === "tous" || a.category?.code === cat) &&
        (!q ||
          a.title?.toLowerCase().includes(q) ||
          a.excerpt?.toLowerCase().includes(q))
    );

    if (sort === "recents") {
      list = [...list].sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0));
    }

    if (sort === "populaires") {
      list = [...list].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0));
    }

    if (sort === "courts") {
      list = [...list].sort((a, b) => (a.reading_minutes ?? 999) - (b.reading_minutes ?? 999));
    }

    return list;
  }, [articles, cat, queryLocale, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAR_PAGE));
  const pageCourante = Math.min(page, totalPages);
  const depart = (pageCourante - 1) * PAR_PAGE;
  const visibles = filtered.slice(depart, depart + PAR_PAGE);

  const changerPage = (p) => {
    if (p < 1 || p > totalPages || p === pageCourante) return;

    setPage(p);
    grilleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const activeCount =
    (cat !== "tous" ? 1 : 0) +
    (sort !== "recents" ? 1 : 0) +
    (queryLocale.trim() ? 1 : 0);

  const resetFilters = () => {
    reset();
    setQueryLocale("");
  };

  const aUneErreurArticles = Boolean(erreurs?.articles);

  if (!articles.length && aUneErreurArticles) {
    return (
      <section id="bibliotheque" className="scroll-mt-28 bg-background pt-16 md:pt-20">
        <div className="mx-auto max-w-7xl px-6 md:px-12">
          <SectionHeading
            eyebrow="La bibliothèque"
            title={
              <>
                Des conseils <span className="text-brand-orange">actionnables</span>, pas de la théorie.
              </>
            }
            sub="Écrits par nos analystes à partir des offres réellement collectées. Lisez, appliquez, postulez."
          />

          <div className="mt-10">
            <EtatErreur
              title="Impossible de charger la bibliothèque"
              detail={messageErreur(erreurs.articles)}
              onRetry={retry}
            />
          </div>
        </div>
      </section>
    );
  }

  if (!articles.length) {
    return (
      <section id="bibliotheque" className="scroll-mt-28 bg-background pt-16 md:pt-20">
        <div className="mx-auto max-w-7xl px-6 md:px-12">
          <SectionHeading
            eyebrow="La bibliothèque"
            title={
              <>
                Des conseils <span className="text-brand-orange">actionnables</span>, pas de la théorie.
              </>
            }
            sub="Écrits par nos analystes à partir des offres réellement collectées. Lisez, appliquez, postulez."
          />

          <div className="mt-10">
            <EtatVide
              title="Aucun conseil publié pour le moment"
              description="Nos analystes préparent les prochains contenus. Revenez bientôt ou créez votre alerte pour être informé dès la publication."
              action={
                <CtaLink to="/inscription" icon={Bell}>
                  Créer mon alerte
                </CtaLink>
              }
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section id="bibliotheque" className="scroll-mt-28 bg-background pt-16 md:pt-20">
        <div className="mx-auto max-w-7xl px-6 md:px-12">
          <SectionHeading
            eyebrow="La bibliothèque"
            title={
              <>
                Des conseils <span className="text-brand-orange">actionnables</span>, pas de la théorie.
              </>
            }
            sub="Écrits par nos analystes à partir des offres réellement collectées. Lisez, appliquez, postulez."
          />
        </div>
      </section>

      {Object.keys(erreurs || {}).length > 0 && (
        <div className="mx-auto max-w-7xl px-6 pb-6 pt-6 md:px-12">
          <BandeauErreurPartielle erreurs={erreurs} onRetry={retry} />
        </div>
      )}

      <StickyFilterBar>
        {/* Desktop */}
        <div className="hidden flex-col gap-3 lg:flex">
          <ChipsFiltres chips={chipsDefs} actif={cat} onSelect={setCat} />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <input
                value={queryLocale}
                onChange={(e) => setQueryLocale(e.target.value)}
                placeholder="Rechercher un conseil…"
                aria-label="Rechercher un conseil"
                className="h-9 w-full rounded-lg border border-outline-variant/60 bg-white pl-9 pr-9 text-[13px] outline-none transition-all placeholder:text-muted-foreground/70 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
              />

              {queryLocale && (
                <button
                  type="button"
                  onClick={() => setQueryLocale("")}
                  aria-label="Effacer la recherche"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-brand-navy"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 sm:ml-auto">
              <span className="text-xs text-muted-foreground">
                <strong className="font-heading text-sm font-bold text-brand-navy">
                  {filtered.length}
                </strong>{" "}
                conseil{filtered.length > 1 ? "s" : ""}
              </span>

              <div className="flex rounded-lg border border-outline-variant/60 bg-white p-0.5 shadow-soft">
                {[
                  { k: "recents", l: "Récents", I: Clock },
                  { k: "populaires", l: "Populaires", I: Flame },
                  { k: "courts", l: "Courts", I: Zap },
                ].map(({ k, l, I }) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSort(k)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all duration-200",
                      sort === k
                        ? "bg-brand-navy text-white shadow-soft"
                        : "text-muted-foreground hover:text-brand-navy"
                    )}
                  >
                    <I className="size-3.5" />
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <input
              value={queryLocale}
              onChange={(e) => setQueryLocale(e.target.value)}
              placeholder="Rechercher…"
              aria-label="Rechercher un conseil"
              className="h-10 w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest pl-9 pr-9 text-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
            />

            {queryLocale && (
              <button
                type="button"
                onClick={() => setQueryLocale("")}
                aria-label="Effacer la recherche"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-brand-navy"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-sm font-bold transition-all",
              activeCount > 0
                ? "border-brand-navy bg-brand-navy text-white shadow-soft"
                : "border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant"
            )}
          >
            <SlidersHorizontal className="size-4" />
            Filtres
            {activeCount > 0 && (
              <span className="grid size-4.5 place-items-center rounded-full bg-brand-orange text-[10px] font-black text-white">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </StickyFilterBar>

      {/* Drawer mobile */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[88vh]">
          <DrawerHeader className="border-b border-outline-variant/40 px-5 pb-4 pt-2">
            <DrawerTitle className="font-heading text-base font-bold text-brand-navy">
              Filtres
            </DrawerTitle>
            <DrawerDescription className="text-xs text-muted-foreground">
              {filtered.length} conseil{filtered.length > 1 ? "s" : ""} correspondant
              {filtered.length > 1 ? "s" : ""}. Bibliothèque mise à jour chaque mardi.
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <FilterGroup title="Thème" icon={Lightbulb}>
              <div className="flex flex-wrap gap-2 px-1 pt-1">
                {chipsDefs.map((c) => (
                  <ChipFiltre key={c.code} {...c} actif={cat} onSelect={setCat} />
                ))}
              </div>
            </FilterGroup>

            <div className="mt-6 border-t border-outline-variant/40 pt-5">
              <FilterGroup title="Trier par" icon={ArrowUpDown}>
                <div className="grid grid-cols-2 gap-2 px-1">
                  {[
                    { k: "recents", l: "Plus récents" },
                    { k: "populaires", l: "Plus lus" },
                    { k: "courts", l: "Lecture courte" },
                  ].map((s) => (
                    <button
                      key={s.k}
                      type="button"
                      onClick={() => setSort(s.k)}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 text-xs font-bold transition-all",
                        sort === s.k
                          ? "border-brand-navy bg-brand-navy text-white shadow-soft"
                          : "border-outline-variant/60 bg-white text-on-surface-variant hover:border-brand-navy/40 hover:text-brand-navy"
                      )}
                    >
                      {s.l}
                    </button>
                  ))}
                </div>
              </FilterGroup>
            </div>
          </div>

          <DrawerFooter className="border-t border-outline-variant/40 px-5 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={resetFilters}
                className="text-[13px] font-bold text-muted-foreground transition-colors hover:text-brand-navy"
              >
                Réinitialiser
              </button>

              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex-1 rounded-lg bg-brand-orange py-3 text-sm font-bold text-white shadow-soft transition-all hover:brightness-110 active:scale-[0.98]"
              >
                Voir {filtered.length} conseil{filtered.length > 1 ? "s" : ""}
              </button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Grille + sidebar */}
      <section ref={grilleRef} className="scroll-mt-28 bg-background py-10 md:py-12">
        <div className="mx-auto max-w-7xl px-6 md:px-12">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              {filtered.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-dashed border-outline-variant/60 bg-white p-12 text-center"
                >
                  <SearchX className="mx-auto size-10 text-muted-foreground/50" />

                  <h3 className="mt-4 font-heading text-lg font-bold text-brand-navy">
                    Aucun conseil trouvé
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Essayez « CV », « entretien », « salaire »…
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setQueryLocale("");
                      setCat("tous");
                    }}
                    className="mt-5 inline-flex items-center gap-2 rounded-lg border border-brand-navy/20 px-5 py-2.5 text-sm font-bold text-brand-navy transition-all hover:border-brand-navy hover:bg-brand-navy hover:text-white"
                  >
                    Tout réafficher
                  </button>
                </motion.div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <AnimatePresence mode="popLayout">
                      {visibles.map((a, i) => (
                        <CarteArticle
                          key={a.slug}
                          a={a}
                          index={i}
                          large={
                            pageCourante === 1 &&
                            i === 0 &&
                            cat === "tous" &&
                            !queryLocale.trim()
                          }
                        />
                      ))}
                    </AnimatePresence>
                  </div>

                  <Pagination
                    page={pageCourante}
                    totalPages={totalPages}
                    depart={depart}
                    nbVisibles={visibles.length}
                    total={filtered.length}
                    onChange={changerPage}
                  />
                </>
              )}

              <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-brand-orange" />
                Nouveau conseil chaque mardi à 6h02 · écrit à partir des offres collectées la veille
              </p>
            </div>

            <aside className="flex flex-col gap-6 self-start lg:sticky lg:top-32">
              <PlusLus popular={popular} articles={articles} />
              <Series series={series} />
              <MiniAlerte />
            </aside>
          </div>
        </div>
      </section>
    </>
  );
};

/* ════════════════════════════════════════════════════════════════════
BANDE DATA
════════════════════════════════════════════════════════════════════ */

const BandeDonnees = ({ articlesCount, categoriesCount, daily }) => (
  <section className="bg-surface-container-lowest pb-16 md:pb-20">
    <div className="mx-auto max-w-7xl px-6 md:px-12">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-xl bg-brand-navy px-6 py-10 sm:px-10 lg:py-12"
      >
        <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />
        <div className="pointer-events-none absolute -right-24 -top-24 size-105 rounded-full bg-brand-orange/15 blur-3xl" aria-hidden />
        <TrendingUp
          className="pointer-events-none absolute -bottom-10 -right-6 size-56 rotate-12 text-white/5"
          strokeWidth={1}
          aria-hidden
        />

        <div className="relative grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
              <TrendingUp className="size-3" />
              Nourri par la collecte
            </span>

            <h2 className="mt-4 font-heading text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
              Nos conseils ne sortent pas de nulle part.
            </h2>

            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-white/70">
              Chaque matin, nous analysons les offres collectées sur plusieurs sources :
              intitulés qui reviennent, compétences demandées, entreprises qui recrutent.
              C’est cette donnée qui nourrit nos conseils, pas l’inverse.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { v: articlesCount || 0, l: "conseils analysés" },
              { v: daily, l: "conseils du jour" },
              { v: categoriesCount || 0, l: "thèmes observés" },
            ].map((s) => (
              <div
                key={s.l}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-4 text-center"
              >
                <p className="font-heading text-3xl font-black text-brand-orange">
                  <CountUp to={s.v} />
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  {s.l}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/60">Curieux de voir la machine tourner ?</p>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <CtaLink to="/comment-ca-marche" size="md" iconRight={ArrowRight}>
              Voir le fonctionnement
            </CtaLink>

            <CtaLink to="/inscription" size="md" icon={Bell} animateIcon>
              Recevoir le brief
            </CtaLink>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);

/* ════════════════════════════════════════════════════════════════════
PAGE
════════════════════════════════════════════════════════════════════ */

const Conseils = () => {
  const {
    statut,
    articles,
    featured,
    dailyTips,
    series,
    popular,
    categoriesIndex,
    erreurs,
    retry,
  } = useConseilsData();


  const moyenneLecture = useMemo(() => {
    if (!articles.length) return 5;

    const somme = articles.reduce((acc, a) => acc + (Number(a.reading_minutes) || 0), 0);
    return Math.max(1, Math.round(somme / articles.length));
  }, [articles]);

  if (statut === "loading") {
    return (
      <>
        <Seo
          {...conseilsSeo({
            total: 0,
            categories: CATEGORIES,
            featuredArticles: [],
          })}
        />

        <main aria-busy="true">
          <HeroSkeleton />
          <ConseilDuJourSkeleton />
          <GrilleSkeleton />
          <BandeDonnees articlesCount={0} categoriesCount={categoriesIndex?.length ?? 0} daily={0} />
        </main>
      </>
    );
  }

  if (statut === "error" && !articles.length && !featured.length) {
    return (
      <>
        <Seo
          {...conseilsSeo({
            total: 0,
            categories: CATEGORIES,
            featuredArticles: [],
          })}
        />

        <main>
          <PageErreur onRetry={retry} />
        </main>
      </>
    );
  }

  return (
    <>
      <Seo
        {...conseilsSeo({
          total: articles.length,
          categories: CATEGORIES,
          featuredArticles: featured.length ? featured : articles.slice(0, 3),
        })}
      />

      <main>
        <HeroConseils
          featured={featured}
          articlesCount={articles.length}
          categoriesCount={categoriesIndex?.length ?? 0}
          moyenneLecture={moyenneLecture}
          erreurs={erreurs}
          retry={retry}
        />

        <ConseilDuJour tips={dailyTips} />

        <GrilleArticles
          articles={articles}
          series={series}
          popular={popular}
          categoriesIndex={categoriesIndex}
          erreurs={erreurs}
          retry={retry}
        />

        <BandeDonnees
          articlesCount={articles.length}
          categoriesCount={categoriesIndex?.length ?? 0}
          daily={dailyTips.length}
        />
      </main>
    </>
  );
};

export default Conseils;