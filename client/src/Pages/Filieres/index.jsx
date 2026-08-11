// src/pages/filieres/index.jsx
import Seo from "@/components/seo/Seo"
import { filieresSeo } from "@/lib/seo"
import { useFilieresAdapted } from "@/tools/filieres.tools"
import HeroFilieres from "./sections/HeroFilieres"
import ReferentielFilieres from "./sections/ReferentielFilieres"
import BandeMechanique from "./sections/BandeMechanique"
import FilieresTicker from "./components/FilieresTicker"

/** SEO alimenté par le cache — mêmes clés que les sections, zéro fetch dupliqué. */
const FilieresSeo = () => {
  const { filieres } = useFilieresAdapted()
  return <Seo {...filieresSeo(filieres)} />
}

/**
 * Orchestrateur pur : aucun fetch, aucune prop transmise.
 * Chaque section se sert dans le cache TanStack Query et gère
 * elle-même ses états de chargement / erreur / vide.
 */
const Filieres = () => (
  <>
    <FilieresSeo />
    <main>      
      <FilieresTicker />
      <HeroFilieres />
      <ReferentielFilieres />
      <BandeMechanique />
    </main>
  </>
)

export default Filieres