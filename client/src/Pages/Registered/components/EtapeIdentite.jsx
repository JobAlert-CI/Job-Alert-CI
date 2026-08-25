import { AnimatePresence, motion } from "framer-motion"
import { Check, CheckCircle2, Mail, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRegistered } from "@/contexts/Registered.context"

const REASSURANCES = ["Sans mot de passe", "100 % gratuit", "Désinscription en 1 clic"]

export const EtapeIdentite = () => {
  const { form, setField, emailOk, goNext } = useRegistered()

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && emailOk) {
      e.preventDefault()
      goNext()
    }
  }

  return (
    <div>
      <h2 className="font-heading text-2xl font-extrabold tracking-tight text-brand-navy sm:text-3xl">
        On vous envoie les offres, <span className="text-brand-orange">vous postulez</span>.
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">
        Pas de mot de passe, pas de formulaire à rallonge. Votre email suffit.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Votre email <span className="text-brand-orange">*</span>
          </label>
          <div className="relative mt-1.5">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="prenom.nom@email.com"
              className={cn(
                "h-12 w-full rounded-lg border bg-card pl-11 pr-11 text-sm outline-none transition-all placeholder:text-muted-foreground/60",
                form.email && !emailOk
                  ? "border-red-400 focus:ring-2 focus:ring-red-200"
                  : "border-outline-variant/60 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
              )}
            />
            <AnimatePresence>
              {emailOk && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2"
                >
                  <CheckCircle2 className="size-5 text-emerald-500" />
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          {form.email && !emailOk && (
            <p className="mt-1.5 text-xs font-medium text-red-500">Ce format d'email semble invalide.</p>
          )}
        </div>

        <div>
          <label htmlFor="nom" className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Votre nom complet <span className="font-medium normal-case text-muted-foreground">(optionnel)</span>
          </label>
          <div className="relative mt-1.5">
            <User className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" />
            <input
              id="nom"
              type="text"
              autoComplete="name"
              value={form.nom}
              onChange={(e) => setField("nom", e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ex: Awa Diabaté"
              className="h-12 w-full rounded-lg border border-outline-variant/60 bg-card pl-11 pr-4 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {REASSURANCES.map((r) => (
          <span
            key={r}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-700"
          >
            <Check className="size-3" strokeWidth={3} />
            {r}
          </span>
        ))}
      </div>
    </div>
  )
}

export default EtapeIdentite
