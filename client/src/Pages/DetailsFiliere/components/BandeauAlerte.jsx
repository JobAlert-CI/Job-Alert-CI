// src/pages/filieres/detail/components/BandeauAlerte.jsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Bell, Check, Mail } from "lucide-react"
import { cn } from "@/lib/utils"
import { ALERTE_REASSURANCES } from "@/tools/filiere-detail.tools"
import { useFiliereDetail } from "@/contexts/DetailsFiliere.context"

/* Bandeau alerte — autonome (meta + hue depuis le contexte). */
const BandeauAlerte = () => {
  const { meta, hue } = useFiliereDetail()
  const [email, setEmail] = useState("")
  const navigate = useNavigate()

  const submit = (e) => {
    e.preventDefault()
    if (!email.trim()) return
    navigate(`/inscription?filieres=${meta.code}&email=${encodeURIComponent(email.trim())}`)
  }

  return (
    <section className="bg-surface-container-lowest py-20 max-md:py-16">
      <div className="mx-auto max-w-7xl px-12 max-md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-xl bg-brand-navy"
        >
          <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />
          <div className={cn("pointer-events-none absolute -right-24 -top-24 size-105 rounded-full blur-3xl", hue.glow)} aria-hidden />
          <meta.icon
            className="pointer-events-none absolute -bottom-10 -right-6 size-56 rotate-12 text-white/5"
            strokeWidth={1}
            aria-hidden
          />
          {/* Desktop-first : 2 colonnes en base, empilé en repli */}
          <div className="relative grid grid-cols-[1.1fr_0.9fr] items-center gap-10 px-14 py-14 max-lg:grid-cols-1 max-lg:px-6 max-lg:py-12">
            <div>
              <span className={cn("inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white", hue.solid)}>
                <Bell className="size-3" aria-hidden />
                Alerte {meta.label}
              </span>
              <h2 className="mt-4 font-heading text-4xl font-black leading-tight tracking-tight text-white max-sm:text-3xl">
                Soyez le premier à postuler.
              </h2>
              <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-white/70">
                Les offres {meta.label.toLowerCase()} partent vite : les abonnés les
                reçoivent à 8h00, avant qu'elles n'apparaissent partout ailleurs.
                Votre premier récapitulatif arrive demain matin.
              </p>
            </div>
            <div>
              <form onSubmit={submit} className="flex flex-row gap-2.5 max-sm:flex-col">
                <div className="relative flex-1">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40" aria-hidden />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    aria-label="Votre adresse email"
                    autoComplete="email"
                    className="h-12 w-full rounded-md border border-white/15 bg-white/10 pl-10 pr-4 text-sm text-white outline-none transition-all duration-300 placeholder:text-white/40 focus:border-brand-orange focus:bg-white/[0.14] focus:ring-2 focus:ring-brand-orange/30"
                  />
                </div>
                <button
                  type="submit"
                  className={cn(
                    "group inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-5 text-sm font-bold text-white transition-all duration-300 hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60",
                    hue.solid
                  )}
                >
                  <Bell className="size-4 transition-transform duration-300 group-hover:rotate-12" aria-hidden />
                  Créer l'alerte
                </button>
              </form>
              <p className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/50">
                {ALERTE_REASSURANCES.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <Check className="size-3.5 text-emerald-400" aria-hidden />
                    {t}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default BandeauAlerte