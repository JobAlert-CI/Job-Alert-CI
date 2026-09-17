import { memo } from "react"
import Bloc from "@/components/admin/Bloc"
import CadreChart from "@/components/admin/CadreChart"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"

/**
 * ChartAbonnes — enveloppe générique d'un graphique admin (section Abonnés ou autre). Encapsule le cycle complet des états (erreur / chargement / vide / données) via TransitionEtat et délègue le rendu à CadreChart.
 * 
 * @param {sting} title : titre de la carte (SectionCardAdmin)
 * @param {string} icon : icône Lucide (SectionCardAdmin)
 * @param {string} description : description optionnelle (SectionCardAdmin)
 * @param {string} etat : état pour TransitionEtat ("erreur" | "chargement" | "vide" | "donnees"). Optionnel : dérivé automatiquement s'il est omis.
 * @param {boolean} isError : une erreur est survenue
 * @param {boolean} isLoading : chargement en cours
 * @param {array} donnees : tableau de données du graphique
 * @param {function} refetch : relance apres erreur (SectionErreur)
 * @param {string} messageErreur : message d'erreur personnalisé
 * @param {string} messageVide : message quand aucune donnée (CadreChart)
 * @param {component} skeletonChart : composant Skeleton affiché pendant le chargement
 * @param {number} minHeight : hauteur minimale du CadreChart (défaut 220)
 * @param {string} className : classe additionnelle pour le Bloc
 * @param {component} children : le graphique Recharts à rendre
 * @return {component}
 */
const ChartAbonnes = ({
  title,
  icon,
  description,
  etat,
  isError = false,
  isLoading = false,
  donnees,
  refetch,
  messageErreur = "Impossible de charger le graphique.",
  messageVide = "Aucune donnée à afficher.",
  skeletonChart,
  minHeight = 220,
  className = "",
  children,
}) => {
  const aDonnees = Array.isArray(donnees) && donnees.length > 0

  /* État effectif : utilisé tel quel s'il est fourni, sinon dérivé
     des booléens isError / isLoading et de la présence de données. */
  const etatEffectif =
    etat ?? (isError ? "erreur" : isLoading ? "chargement" : aDonnees ? "donnees" : "vide")

  return (
    <Bloc className={className}>
      <SectionCardAdmin title={title} icon={icon} description={description}>
        <TransitionEtat etat={etatEffectif}>
          {isError ? (
            <div className="p-4">
              <SectionErreur onRetry={refetch} message={messageErreur} />
            </div>
          ) : isLoading ? (
            <div
              role="status"
              aria-busy="true"
              aria-label={`Chargement du graphique « ${title} »`}
            >
              {skeletonChart}
            </div>
          ) : (
            <CadreChart vide={!aDonnees} videMessage={messageVide} minHeight={minHeight}>
              {children}
            </CadreChart>
          )}
        </TransitionEtat>
      </SectionCardAdmin>
    </Bloc>
  )
}

// export default memo(ChartAbonnes)

export default ChartAbonnes