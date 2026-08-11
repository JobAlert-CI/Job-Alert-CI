// src/pages/sources/components/SectionSources.jsx
import { AlertTriangle, RefreshCw } from "lucide-react"
import { SectionHeading } from "@/components/shared"
import { useSourcesContext } from "@/contexts/Sources.context"
import { SourcesSkeleton } from "./Etats"
import CarteSource from "./CarteSource"

const SectionSources = () => {
  const { sources, sourcesQuery } = useSourcesContext()

  const isLoading = sourcesQuery.isPending && sources.length === 0
  const hasError = sourcesQuery.isError && sources.length === 0

  return (
    <section className="bg-background py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-12 max-md:px-6">
        <SectionHeading
          eyebrow="Les partenaires"
          title={
            <>
              Ils publient,{" "}
              <span className="text-brand-orange">on collecte</span>.
            </>
          }
          sub="Plusieurs plateformes, plusieurs personnalités. Chacune alimente votre récapitulatif à sa manière et aucune n'est laissée de côté."
        />

        <div className="mt-10">
          {isLoading ? (
            <SourcesSkeleton />
          ) : hasError ? (
            <div
              role="alert"
              className="rounded-xl border border-error/30 bg-error-container/20 p-10 text-center"
            >
              <AlertTriangle className="mx-auto size-10 text-error" aria-hidden />
              <h3 className="mt-4 font-heading text-lg font-bold text-brand-navy">
                Impossible de charger les sources
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Vérifiez votre connexion, puis réessayez.
              </p>
              <button
                type="button"
                onClick={() => sourcesQuery.refetch()}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RefreshCw className="size-4" aria-hidden />
                Réessayer
              </button>
            </div>
          ) : sources.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant/60 bg-white p-10 text-center text-sm text-muted-foreground">
              Aucune source active pour le moment — revenez bientôt.
            </p>
          ) : (
            /* Desktop-first : 6 colonnes en base, 2 en tablette, 1 en mobile */
            <div className="grid gap-4 md:grid-cols-6">
              {sources.map((s, i) => (
                <CarteSource
                  key={s.rawCode}
                  s={s}
                  index={i}
                  featured={s.principal}
                  className={s.principal ? "md:col-span-6" : "md:col-span-3 lg:col-span-2"}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default SectionSources