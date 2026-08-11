// src/pages/home/sections/Testimonials.jsx
import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { SectionHeading, TemoignageCard } from "@/components/shared"
import { TEMOIGNAGES } from "@/data/constanteMetier"

const Testimonials = () => (
  <section className="overflow-hidden border-t border-outline-variant/30 bg-background py-20 md:py-24">
    <div className="mx-auto max-w-7xl px-6 md:px-12">
      <SectionHeading
        eyebrow="Témoignages"
        title={
          <>
            Ils ont arrêté de chercher.{" "}
            <span className="text-brand-orange">Ils ont été trouvés.</span>
          </>
        }
        sub="Le push, ça marche : voici ce que racontent ceux qui reçoivent leur récap chaque matin."
      />
    </div>
    <div
      className="group relative mt-12"
      role="region"
      aria-label="Témoignages d'abonnés"
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-linear-to-r from-background via-background/80 to-transparent sm:w-28 lg:w-40"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-linear-to-l from-background via-background/80 to-transparent sm:w-28 lg:w-40"
        aria-hidden
      />
      <div className="overflow-hidden">
        <div className="flex w-max will-change-transform motion-safe:animate-marquee group-hover:paused">
          {[0, 1].map((copie) => (
            <div
              key={copie}
              className="flex shrink-0 gap-5 pr-5"
              aria-hidden={copie === 1}
            >
              {TEMOIGNAGES.map((temoignage) => (
                <TemoignageCard
                  key={`${copie}-${temoignage.nom}`}
                  t={temoignage}
                  variant={temoignage.vedette ? "vedette" : "standard"}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
    <div className="mx-auto mt-10 flex max-w-7xl flex-col items-center justify-center gap-2.5 px-6 text-center sm:flex-row sm:gap-4">
      <p className="text-xs text-muted-foreground">
        Qu'est-ce que vous attendez ?
      </p>
      <span
        className="hidden size-1 rounded-full bg-outline-variant sm:block"
        aria-hidden
      />
      <Link
        to="/inscription"
        className="group inline-flex items-center gap-1.5 text-sm font-bold text-brand-navy transition-colors hover:text-brand-orange"
      >
        Rejoindre les abonnés du récap
        <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
      </Link>
    </div>
  </section>
)

export default Testimonials