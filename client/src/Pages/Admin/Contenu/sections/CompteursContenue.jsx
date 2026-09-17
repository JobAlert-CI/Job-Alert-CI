import { CalendarDays, CheckCircle2, FileEdit, FileText, FolderTree, Layers, Lightbulb, Star, Tag } from "lucide-react"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { useAdminArticlesQuery, useAdminCategoriesQuery, useAdminDailyTipsQuery, useAdminPagesQuery, useAdminSeriesQuery } from "@/features/admin-contenu.tools"

const CompteursArticles = () => {
  const { data: articles, isError, refetch } = useAdminArticlesQuery()

  const listeBrute = articles ?? []
  const nbPublies = listeBrute.filter((a) => a.status === "published").length
  const nbBrouillons = listeBrute.filter((a) => a.status === "draft").length
  const nbALaUne = listeBrute.filter((a) => a.is_featured).length

  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"} >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CarteCompteur label="Articles" valeur={listeBrute.length} icone={FileText} />
          <CarteCompteur label="Publiés" valeur={nbPublies} icone={CheckCircle2} />
          <CarteCompteur label="Brouillons" valeur={nbBrouillons} icone={FileEdit} />
          <CarteCompteur label="À la une" valeur={nbALaUne} icone={Star} />
        </div>
      )}
    </TransitionEtat>
  )
}

const CompteursCategories = () => {
  const { data: categories, isError, refetch } = useAdminCategoriesQuery()
  const { data: articles } = useAdminArticlesQuery({ limit: 100 })

  const idsUtilisees = new Set((articles ?? []).map((a) => a.category_id).filter(Boolean))
  const nbActives = (categories ?? []).filter((c) => c.is_active).length
  const nbVides = (categories ?? []).filter((c) => !idsUtilisees.has(c.id)).length

  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"} >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <CarteCompteur label="Catégories" valeur={categories?.length ?? 0} icone={FolderTree} />
          <CarteCompteur label="Actives" valeur={nbActives} icone={CheckCircle2} />
          <CarteCompteur label="Sans article" valeur={nbVides} icone={Tag} className="col-span-2 sm:col-span-1" />
        </div>
      )}
    </TransitionEtat>
  )
}

const CompteursSeries = () => {
  const { data: series, isError, refetch } = useAdminSeriesQuery()
  const { data: articles } = useAdminArticlesQuery({ limit: 100 })


  const nbActives = (series ?? []).filter((s) => s.is_active).length

  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"} >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <CarteCompteur label="Séries" valeur={series?.length ?? 0} icone={Layers} />
          <CarteCompteur label="Actives" valeur={nbActives} icone={CheckCircle2} />
          <CarteCompteur label="Articles disponibles" valeur={articles?.length ?? 0} icone={FileText} className="col-span-2 sm:col-span-1" />
        </div>
      )}
    </TransitionEtat>
  )
}

const CompteursConseil = () => {
  const { data: conseils, isError, refetch } = useAdminDailyTipsQuery()

  const parCreneau = new Map()
  for (const tip of conseils ?? []) {
    parCreneau.set(tip.rotation_order, (parCreneau.get(tip.rotation_order) ?? 0) + 1)
  }
  const nbActifs = (conseils ?? []).filter((t) => t.is_active).length
  const nbJoursOccupes = parCreneau.size

  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"} >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <CarteCompteur label="Conseils" valeur={conseils?.length ?? 0} icone={Lightbulb} />
          <CarteCompteur label="Actifs" valeur={nbActifs} icone={CheckCircle2} />
          <CarteCompteur
            label="Jours occupés"
            valeur={nbJoursOccupes}
            suffixe="/7"
            icone={CalendarDays}
            className="col-span-2 sm:col-span-1"
          />
        </div>
      )}
    </TransitionEtat>
  )
}

const CompteursPage = () => {
  const { data: pages, isError, refetch } = useAdminPagesQuery()

  const nbPubliees = (pages ?? []).filter((p) => p.status === "published").length
    const nbBrouillons = (pages ?? []).filter((p) => p.status === "draft").length

  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"} >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <CarteCompteur label="Pages" valeur={pages?.length ?? 0} icone={FileText} />
          <CarteCompteur label="Publiées" valeur={nbPubliees} icone={CheckCircle2} />
          <CarteCompteur label="Brouillons" valeur={nbBrouillons} icone={FileEdit} className="col-span-2 sm:col-span-1" />
        </div>
      )}
    </TransitionEtat>
  )
}


export { CompteursArticles, CompteursCategories, CompteursSeries, CompteursConseil, CompteursPage }