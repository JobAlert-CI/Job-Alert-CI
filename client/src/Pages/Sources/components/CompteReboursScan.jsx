// src/pages/sources/components/CompteReboursScan.jsx
import { useEffect, useState } from "react"

/** Compte à rebours vers le prochain scan de 6h00. */
export const CompteReboursScan = () => {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const target = new Date(now)
  target.setHours(6, 0, 0, 0)
  if (target <= now) target.setDate(target.getDate() + 1)
  const diff = Math.max(0, target - now)

  const unites = [
    { v: Math.floor(diff / 3.6e6), l: "h" },
    { v: Math.floor((diff % 3.6e6) / 6e4), l: "min" },
    { v: Math.floor((diff % 6e4) / 1e3), l: "s" },
  ]

  return (
    <div className="flex items-center gap-1.5" aria-live="off">
      {unites.map((u, i) => (
        <span key={u.l} className="flex items-center gap-1.5">
          {i > 0 && (
            <span className="font-heading text-base font-black text-white/30" aria-hidden>
              :
            </span>
          )}
          <span className="grid min-w-9 place-items-center rounded-md bg-white/10 px-1.5 py-0.5 font-heading text-base font-extrabold tabular-nums">
            {String(u.v).padStart(2, "0")}
          </span>
          <span className="text-[10px] font-bold uppercase text-white/50">{u.l}</span>
        </span>
      ))}
    </div>
  )
}