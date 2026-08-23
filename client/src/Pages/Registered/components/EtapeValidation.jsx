import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { CheckCircle2, Mail, MapPin, SlidersHorizontal, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { HUES } from "@/lib/hues"
import { useRegistered } from "@/contexts/Registered.context"

export const EtapeValidation = () => {
  const { form, total, consent, setConsent, filieres } = useRegistered()

  const heures = new Date()
    .toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .toLowerCase()
  const isAutreDay = heures > "08:00:00"

  return (
    <div>
      <h2 className="font-heading text-2xl font-extrabold tracking-tight text-brand-navy sm:text-3xl">
        Un dernier coup d'<span className="text-brand-orange">œil</span>.
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">
        Voici votre alerte. Tout est modifiable plus tard, en un clic depuis chaque email.
      </p>

      {/* Carte Récapitulative */}
      <div className="mt-6 divide-y divide-outline-variant/40 overflow-hidden rounded-lg border border-outline-variant/50 bg-white shadow-soft">
        {[
          { icon: Mail, label: "Email", value: form.email },
          { icon: User, label: "Nom", value: form.nom.trim() || "—" },
          { icon: MapPin, label: "Ville", value: form.ville || "—" },
        ].map((r) => (
          <div key={r.label} className="flex items-center gap-3 px-4 py-3">
            <r.icon className="size-4 shrink-0 text-brand-orange" />
            <span className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {r.label}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-navy">{r.value}</span>
          </div>
        ))}

        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="size-4 shrink-0 text-brand-orange" />
            <span className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Filières
            </span>
            <span className="text-[11px] font-bold text-muted-foreground">{form.filieres.length}/3</span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {form.filieres.map((code) => {
              const f = filieres.find((x) => x.code === code || x.slug === code)
              const hue = HUES[f?.hue] || HUES.blue
              const Icon = f?.icon || SlidersHorizontal
              const label = f?.label || code

              return (
                <span
                  key={code}
                  className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold", hue?.tile || "bg-blue-100 text-blue-800")}
                >
                  <Icon className="size-3.5" />
                  {label}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      {/* Message dynamique sur le volume d'offres */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-5 flex items-center gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4"
      >
        <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
        <p className="text-[13px] font-semibold text-emerald-800">
          {total} offre{total > 1 ? "s" : ""} correspondent déjà à vos filières. Votre premier récap part{" "}
          {isAutreDay ? "demain" : "aujourd'hui"} à 8h00 pile.
        </p>
      </motion.div>

      {/* Consentement RGPD */}
      <label className="mt-5 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 size-4 accent-[#F5A623] cursor-pointer"
        />
        <span className="text-[13px] leading-relaxed text-on-surface-variant">
          J'accepte de recevoir le récapitulatif quotidien à 8h00. Mon email ne sera jamais partagé
          et je peux me désinscrire en 1 clic.{" "}
          <Link
            to="/mentions-legales"
            className="font-semibold text-brand-navy underline underline-offset-2 hover:text-brand-orange"
          >
            En savoir plus
          </Link>
          .
        </span>
      </label>
    </div>
  )
}

export default EtapeValidation
