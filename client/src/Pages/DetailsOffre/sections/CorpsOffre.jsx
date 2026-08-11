// src/pages/offres/detail/sections/CorpsOffre.jsx
import SectionDescription from "../components/SectionDescription"
import CarteEntreprise from "../components/CarteEntreprise"
import CarteAlerte from "../components/CarteAlerte"
import MiniCollecte from "../components/MiniCollecte"

/* Corps — description + entreprise | sidebar alerte 8h00 (sticky desktop). */
const CorpsOffre = () => (
  <section className="border-b border-outline-variant/30 bg-background py-18 max-md:py-14">
    {/* Desktop-first : 2 colonnes en base, une seule en repli */}
    <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_360px] gap-10 px-12 max-lg:grid-cols-1 max-md:px-6">
      <div className="min-w-0">
        <SectionDescription />
        <CarteEntreprise />
      </div>
      <aside
        className="sticky top-24 flex flex-col gap-6 self-start max-lg:static"
        aria-label="Alerte email et collecte du jour"
      >
        <CarteAlerte />
        <MiniCollecte />
      </aside>
    </div>
  </section>
)

export default CorpsOffre