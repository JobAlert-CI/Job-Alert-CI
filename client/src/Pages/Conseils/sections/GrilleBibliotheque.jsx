// src/pages/conseils/sections/GrilleBibliotheque.jsx
import { useCallback, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Bell, SearchX } from "lucide-react"
import { formatApiError } from "@/api/errors"
import { CarteArticle, CtaLink } from "@/components/shared"
import { useBibliotheque } from "@/contexts/Conseils.context"
import { EtatErreur, EtatVide } from "../components/Etats"
import { GrilleSkeleton } from "../components/SkeletonsConseils"
import Pagination from "../components/Pagination"

/* Grille + états — consomme le contexte, gère ses propres squelettes/erreurs. */
const GrilleBibliotheque = () => {
  const {
    articles, articlesPending, articlesError, refetchArticles,
    filtered, visibles, cat, setCat, queryLocale, setQueryLocale,
    page, setPage, totalPages, depart,
  } = useBibliotheque()
  const grilleRef = useRef(null)

  const changerPage = useCallback(
    (p) => {
      if (p < 1 || p > totalPages || p === page) return
      setPage(p)
      grilleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    },
    [page, totalPages, setPage]
  )

  /* Erreur bloquante : aucune donnée disponible */
  if (articlesError && (!articles || articles.length === 0)) {
    return (
      <EtatErreur
        title="Impossible de charger la bibliothèque"
        detail={formatApiError(articlesError)}
        onRetry={() => refetchArticles()}
      />
    )
  }

  /* Chargement délégué */
  if (articlesPending && articles.length === 0) return <GrilleSkeleton />

  /* Vide global : rien n'est publié */
  if (!articles.length) {
    return (
      <EtatVide
        title="Aucun conseil publié pour le moment"
        description="Nos analystes préparent les prochains contenus. Revenez bientôt ou créez votre alerte pour être informé dès la publication."
        action={
          <CtaLink to="/inscription" icon={Bell}>Créer mon alerte</CtaLink>
        }
      />
    )
  }

  return (
    <div ref={grilleRef} className="scroll-mt-28">
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
          className="rounded-xl border border-dashed border-outline-variant/60 bg-white p-12 text-center"
        >
          <SearchX className="mx-auto size-10 text-muted-foreground/50" aria-hidden />
          <h3 className="mt-4 font-heading text-lg font-bold text-brand-navy">Aucun conseil trouvé</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Essayez « CV », « entretien », « salaire »…
          </p>
          <button
            type="button"
            onClick={() => { setQueryLocale(""); setCat("tous") }}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-brand-navy/20 px-5 py-2.5 text-sm font-bold text-brand-navy transition-all hover:border-brand-navy hover:bg-brand-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Tout réafficher
          </button>
        </motion.div>
      ) : (
        <>
          {/* Desktop-first : 2 colonnes en base, une seule en repli */}
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <AnimatePresence mode="popLayout">
              {visibles.map((a, i) => (
                <CarteArticle
                  key={a.slug}
                  a={a}
                  index={i}
                  large={page === 1 && i === 0 && cat === "tous" && !queryLocale.trim()}
                />
              ))}
            </AnimatePresence>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            depart={depart}
            nbVisibles={visibles.length}
            total={filtered.length}
            onChange={changerPage}
          />
        </>
      )}

      <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="size-1.5 rounded-full bg-brand-orange" aria-hidden />
        Nouveau conseil chaque mardi à 6h02 · écrit à partir des offres collectées la veille
      </p>
    </div>
  )
}

export default GrilleBibliotheque