// src/pages/offres/detail/components/CarteAlerte.jsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Bell, Mail } from "lucide-react"
import { cn } from "@/lib/utils"
import { ReassuranceList } from "@/components/shared"
import { ALERTE_REASSURANCES } from "@/tools/offre-detail.tools"
import { useOffreDetail } from "@/contexts/DetailsOffre.context"

const CarteAlerte = () => {
  const { meta, hue } = useOffreDetail()
  const [email, setEmail] = useState("")
  const navigate = useNavigate()

  const submit = (e) => {
    e.preventDefault()
    if (!email.trim()) return
    navigate(`/inscription?filieres=${meta.code}&email=${encodeURIComponent(email.trim())}`)
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-brand-navy text-white">
      <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />
      <div
        className={cn("pointer-events-none absolute -right-20 -top-20 size-80 rounded-full blur-3xl", hue.glow)}
        aria-hidden
      />
      <div className="relative p-6">
        <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em]", hue.solid)}>
          <Bell className="size-3" aria-hidden />
          Alerte {meta.label}
        </span>
        <h3 className="mt-3.5 font-heading text-xl font-extrabold leading-snug">
          Ces offres, demain à <span className="text-brand-orange">8h00</span>{" "}
          dans votre boîte mail.
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-white/70">
          1 à 3 filières, zéro mot de passe. Votre premier récapitulatif arrive
          demain matin.
        </p>
        <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40" aria-hidden />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              aria-label="Votre adresse email"
              autoComplete="email"
              className="h-11 w-full rounded-md border border-white/15 bg-white/10 pl-10 pr-3.5 text-sm text-white outline-none transition-all duration-300 placeholder:text-white/40 focus:border-brand-orange focus:bg-white/[0.14] focus:ring-2 focus:ring-brand-orange/30"
            />
          </div>
          <button
            type="submit"
            className={cn(
              "group inline-flex h-11 items-center justify-center gap-2 rounded-md text-sm font-bold text-white transition-all duration-300 hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60",
              hue.solid
            )}
          >
            Créer mon alerte
            <Bell className="size-4 transition-transform duration-300 group-hover:rotate-12" aria-hidden />
          </button>
        </form>
        <div className="mt-3.5 border-t border-white/10 pt-3.5">
          <ReassuranceList items={ALERTE_REASSURANCES} tone="dark" className="gap-x-4 gap-y-1.5" />
        </div>
      </div>
    </div>
  )
}

export default CarteAlerte