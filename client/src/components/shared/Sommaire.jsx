
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Clock, List } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Sommaire avec scroll-spy : surligne la section visible de l'article.
 * sections → [{ id, titre }] — les ancres doivent exister dans la page.
 */
const Sommaire = ({ sections, lecture, className, onNavigate }) => {
  const [actif, setActif] = useState(sections[0]?.id)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActif(e.target.id) }),
      { rootMargin: "-25% 0px -60% 0px" }
    )
    sections.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 240) {
        setActif(sections[sections.length - 1]?.id)
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => { observer.disconnect(); window.removeEventListener("scroll", onScroll) }
  }, [sections])

  const aller = (e, id) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    onNavigate?.()
  }

  return (
    <nav className={cn("rounded-xl border border-outline-variant/40 bg-card p-5 shadow-soft", className)} aria-label="Sommaire de l'article">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <List className="size-3.5 text-brand-orange" />
        Sommaire
      </p>
      <ol className="relative mt-4 space-y-0.5 border-l border-outline-variant/40">
        {sections.map((s, i) => (
          <li key={s.id} className="relative">
            {actif === s.id && (
              <motion.span
                layoutId="sommaire-rail"
                className="absolute -left-px bottom-1 top-1 w-0.5 rounded-full bg-brand-orange"
                transition={{ duration: 0.25 }}
              />
            )}
            <a
              href={`#${s.id}`}
              onClick={(e) => aller(e, s.id)}
              className={cn(
                "block rounded-r-lg py-2 pl-3.5 pr-2 text-[13px] leading-snug transition-colors duration-200",
                actif === s.id
                  ? "bg-brand-orange/8 font-bold text-on-primary"
                  : "font-medium text-muted-foreground hover:bg-surface-container-low hover:text-brand-navy"
              )}
            >
              <span className="mr-1.5 font-heading text-[10px] font-black text-brand-orange/70">0{i + 1}</span>
              {s.titre}
            </a>
          </li>
        ))}
      </ol>
      {lecture != null && (
        <p className="mt-4 flex items-center gap-2 border-t border-outline-variant/40 pt-3.5 text-[11px] font-semibold text-muted-foreground">
          <Clock className="size-3 text-brand-orange" />
          ~{lecture} min de lecture
        </p>
      )}
    </nav>
  )
}
export default Sommaire