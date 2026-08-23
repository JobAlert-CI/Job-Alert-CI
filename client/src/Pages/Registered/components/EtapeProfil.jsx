import { BookOpen, Briefcase, MapPin, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRegistered } from "@/contexts/Registered.context"

export const EtapeProfil = () => {
  const { form, setField, toggleContrat, passer, experiences, contrats, villes } = useRegistered()

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-extrabold tracking-tight text-brand-navy sm:text-3xl">
            Affinez votre <span className="text-brand-orange">profil</span>.
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">
            Optionnel, mais ça nous aide à mieux trier vos offres dès demain.
          </p>
        </div>
        <button
          type="button"
          onClick={passer}
          className="shrink-0 text-xs font-bold text-muted-foreground underline-offset-2 transition-colors hover:text-brand-orange hover:underline cursor-pointer"
        >
          Passer cette étape →
        </button>
      </div>

      <div className="mt-6 space-y-5">
        {/* Expérience (Données dynamiques du backend) */}
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            <Zap className="size-3.5 text-brand-orange" />
            Votre niveau d'expérience
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {experiences.map((item) => {
              const code = typeof item === "string" ? item : item.code || item.label
              const label = typeof item === "string" ? item : item.label || item.code
              const isSelected = form.experience === code || form.experience === label

              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setField("experience", isSelected ? "" : code)}
                  aria-pressed={isSelected}
                  className={cn(
                    "rounded-full border px-4 py-2 text-[13px] font-semibold transition-all duration-200 cursor-pointer",
                    isSelected
                      ? "border-brand-navy bg-brand-navy text-white shadow-soft"
                      : "border-outline-variant/60 bg-white text-on-surface-variant hover:-translate-y-0.5 hover:border-brand-navy/40 hover:text-brand-navy"
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Contrats recherchés (Données dynamiques du backend) */}
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            <Briefcase className="size-3.5 text-brand-orange" />
            Contrats recherchés
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {contrats.map((item) => {
              const code = typeof item === "string" ? item : item.code || item.label
              const label = typeof item === "string" ? item : item.label || item.code
              const isSelected = form.contrats.includes(code) || form.contrats.includes(label)

              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggleContrat(code)}
                  aria-pressed={isSelected}
                  className={cn(
                    "rounded-full border px-4 py-2 text-[13px] font-semibold transition-all duration-200 cursor-pointer",
                    isSelected
                      ? "border-brand-orange bg-brand-orange/15 text-[#B45309] ring-1 ring-brand-orange/30 font-bold"
                      : "border-outline-variant/60 bg-white text-on-surface-variant hover:-translate-y-0.5 hover:border-brand-orange/50 hover:text-[#B45309]"
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Ville / Localisation (Données dynamiques du backend) */}
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            <MapPin className="size-3.5 text-brand-orange" />
            Votre localisation
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {villes.map((v) => {
              const villeName = typeof v === "string" ? v : v.label || v.city || v.code
              const isSelected = form.ville === villeName

              return (
                <button
                  key={villeName}
                  type="button"
                  onClick={() => setField("ville", isSelected ? "" : villeName)}
                  aria-pressed={isSelected}
                  className={cn(
                    "rounded-full border px-4 py-2 text-[13px] font-semibold transition-all duration-200 cursor-pointer",
                    isSelected
                      ? "border-brand-navy bg-brand-navy text-white shadow-soft"
                      : "border-outline-variant/60 bg-white text-on-surface-variant hover:-translate-y-0.5 hover:border-brand-navy/40 hover:text-brand-navy"
                  )}
                >
                  {villeName}
                </button>
              )
            })}
          </div>
        </div>

        {/* Option conseils du mardi */}
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-low/50 p-3.5 transition-colors hover:border-brand-orange/40">
          <input
            type="checkbox"
            checked={form.conseils}
            onChange={(e) => setField("conseils", e.target.checked)}
            className="size-4 accent-[#F5A623] cursor-pointer"
          />
          <span className="flex items-center gap-2 text-[13px] font-medium text-on-surface-variant">
            <BookOpen className="size-4 text-brand-orange" />
            Recevoir aussi le conseil carrière du mardi
          </span>
        </label>
      </div>
    </div>
  )
}

export default EtapeProfil
