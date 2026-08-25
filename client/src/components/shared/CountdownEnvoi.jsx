
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Clock, Mail } from "lucide-react"
import { cn } from "@/lib/utils"

/* ── Variante « barre » — progression du prochain run (Offres, Filieres) ── */
const Barre = ({ className, targetHour = 8, label }) => {
  const [progress, setProgress] = useState({ percentage: 0, timeLeft: "Calcul…" })
  useEffect(() => {
    const calculate = () => {
      const now = new Date()
      const start = new Date(now); start.setHours(targetHour, 0, 0, 0)
      const target = new Date(now); target.setHours(targetHour, 0, 0, 0)
      if (now.getHours() >= targetHour) target.setDate(target.getDate() + 1)
      else start.setDate(start.getDate() - 1)
      const total = target.getTime() - start.getTime()
      const remaining = target.getTime() - now.getTime()
      const percentage = Math.max(0, Math.min(100, ((now.getTime() - start.getTime()) / total) * 100))
      const h = Math.floor(remaining / 3_600_000)
      const m = Math.floor((remaining % 3_600_000) / 60_000)
      setProgress({ percentage, timeLeft: `${h}h ${m.toString().padStart(2, "0")}m` })
    }
    calculate()
    const id = setInterval(calculate, 60_000)
    return () => clearInterval(id)
  }, [targetHour])

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between text-[11px] font-semibold">
        <span className="text-muted-foreground">Progression du prochain run</span>
        <span className="font-heading text-brand-navy">{Math.round(progress.percentage)} %</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container">
        <motion.div
          initial={{ width: "0%" }}
          animate={{ width: `${progress.percentage}%` }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full bg-brand-orange"
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Mail className="size-3 text-brand-orange" />
          {label ?? `Rendez-vous à ${targetHour}h00`}
        </p>
        <span className="font-medium text-brand-orange/80">Il reste {progress.timeLeft}</span>
      </div>
    </div>
  )
}

/* ── Variante « horloge » — compte à rebours H : min : s (HowItWorks) ── */
const Horloge = ({ className, targetHour=8, label }) => {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const target = new Date(now)
  target.setHours(targetHour, 0, 0, 0)
  if (target <= now) target.setDate(target.getDate() + 1)
  const diff = Math.max(0, target - now)
  const unites = [
    { v: Math.floor(diff / 3.6e6), l: "h" },
    { v: Math.floor((diff % 3.6e6) / 6e4), l: "min" },
    { v: Math.floor((diff % 6e4) / 1e3), l: "s" },
  ]
  return (
    <div className={cn("flex items-center gap-4 rounded-xl border border-white/10 bg-brand-navy px-4 py-3.5 text-white shadow-hover", className)}>
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-orange/15">
        <Clock className="size-5 text-brand-orange" />
      </span>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">
          {label ?? "Prochain envoi dans"}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          {unites.map((u, i) => (
            <span key={u.l} className="flex items-center gap-1.5">
              {i > 0 && <span className="font-heading text-lg font-black text-white/30">:</span>}
              <span className="grid min-w-11 place-items-center rounded-md bg-card/10 px-2 py-1 font-heading text-xl font-extrabold tabular-nums">
                {String(u.v).padStart(2, "0")}
              </span>
              <span className="text-[10px] font-bold uppercase text-white/60">{u.l}</span>
            </span>
          ))}
        </div>
      </div>
      <span className="ml-auto hidden shrink-0 text-[11px] font-semibold text-white/60 sm:block">
        {targetHour}h00 précises, <br /> chaque jour
      </span>
    </div>
  )
}

/**
 * variant="barre"   → barre de progression du run (Offres, Filieres)
 * variant="horloge" → compte à rebours H:min:s (hero HowItWorks)
 */
const CountdownEnvoi = ({ variant = "barre", ...props }) =>
  variant === "horloge" ? <Horloge {...props} /> : <Barre {...props} />

export default CountdownEnvoi