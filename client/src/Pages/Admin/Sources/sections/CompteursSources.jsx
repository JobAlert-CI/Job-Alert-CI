import CarteCompteur from "@/components/admin/CarteCompteur"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { useAdminSourcesQuery } from "@/features/admin-sources.tools"
import { Globe, PauseCircle, PlayCircle, ShieldCheck } from "lucide-react"
import { useMemo } from "react"


const CompteursSources = () => {
  const { data: sources, isError, refetch } = useAdminSourcesQuery()

  /* Compteurs dérivés — UN seul passage (reduce), zéro appel réseau. */
  const compteurs = useMemo(
    () =>
      (sources ?? []).reduce(
        (acc, s) => {
          acc.total += 1
          if (s.status === "active") acc.actives += 1
          else if (s.status === "paused") acc.enPause += 1
          if (s.supports_scraping) acc.scrapables += 1
          if ((s.anti_scraping_level ?? 0) >= 4) acc.protectionForte += 1
          return acc
        },
        { total: 0, actives: 0, enPause: 0, scrapables: 0, protectionForte: 0 }
      ),
    [sources]
  )

  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"} >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les sources." />
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <CarteCompteur
            label="Sources actives"
            valeur={compteurs.actives}
            suffixe={`/${compteurs.total}`}
            icone={Globe}
          />
          <CarteCompteur label="En pause" valeur={compteurs.enPause} icone={PauseCircle} />
          <CarteCompteur label="Scrapables" valeur={compteurs.scrapables} icone={PlayCircle} />
          <CarteCompteur
            label="Protection forte"
            valeur={compteurs.protectionForte}
            description="anti-scraping ≥ 4/5"
            icone={ShieldCheck}
          />
        </div>
      )}
    </TransitionEtat>
  )
}

export default CompteursSources