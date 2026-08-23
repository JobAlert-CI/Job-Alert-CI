import { motion } from "framer-motion"
import { ArrowRight, Mail, Radar, Send, SlidersHorizontal } from "lucide-react"
import { CountdownEnvoi, CtaLink } from "@/components/shared"
import { useRegistered } from "@/contexts/Registered.context"

const SUITE_PIPELINE = [
  { icon: Mail, t: "Maintenant", l: "Email de confirmation envoyé" },
  { icon: Radar, t: "06h00", l: "Collecte des 4 sources" },
  { icon: SlidersHorizontal, t: "07h15", l: "Filtrage sur vos filières" },
  { icon: Send, t: "08h00", l: "Votre premier récap arrive" },
]

export const EcranSucces = () => {
  const { form, total } = useRegistered()

  const heures = new Date()
    .toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .toLowerCase()
  const isAutreDay = heures > "08:00:00"

  const prenom = form.nom?.trim() ? form.nom.trim().split(" ")[0] : ""

  return (
    <div className="mx-auto max-w-2xl py-10 text-center md:py-16">
      {/* Animation du Checkmark de validation */}
      <motion.svg viewBox="0 0 52 52" className="mx-auto size-20" aria-hidden>
        <motion.circle
          cx="26"
          cy="26"
          r="24"
          fill="none"
          stroke="#10b981"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
        <motion.path
          d="M14 27l8 8 16-16"
          fill="none"
          stroke="#10b981"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
        />
      </motion.svg>

      <motion.h1
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="mt-6 font-heading text-3xl font-black tracking-tight text-brand-navy sm:text-4xl"
      >
        Bienvenue à bord{prenom ? `, ${prenom}` : ""} !
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85, duration: 0.5 }}
        className="mx-auto mt-3 max-w-md text-base leading-relaxed text-on-surface-variant"
      >
        Votre alerte est active pour{" "}
        <strong className="font-semibold text-brand-navy">
          {form.filieres.length} filière{form.filieres.length > 1 ? "s" : ""}
        </strong>
        . {total} offre{total > 1 ? "s" : ""} vous attendent déjà, les prochaines arrivent{" "}
        {isAutreDay ? "demain" : "aujourd'hui"} à 8h00 pile.
      </motion.p>

      {/* Compte à rebours */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="mx-auto mt-8 max-w-sm"
      >
        <CountdownEnvoi variant="horloge" label="Votre premier récap dans" />
      </motion.div>

      {/* Pipeline des étapes de distribution */}
      <div className="mt-10 grid gap-3 sm:grid-cols-4">
        {SUITE_PIPELINE.map((s, i) => (
          <motion.div
            key={s.t}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.15 + i * 0.12, duration: 0.4 }}
            className="rounded-lg border border-outline-variant/50 bg-white p-4 shadow-soft"
          >
            <s.icon className="mx-auto size-5 text-brand-orange" />
            <p className="mt-2 font-heading text-sm font-extrabold text-brand-navy">{s.t}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{s.l}</p>
          </motion.div>
        ))}
      </div>

      {/* Liens d'action */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.7, duration: 0.4 }}
        className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
      >
        <CtaLink to="/offres" iconRight={ArrowRight}>
          Voir les offres du jour
        </CtaLink>
        <CtaLink to="/comment-ca-marche" variant="secondary">
          Comment ça marche
        </CtaLink>
      </motion.div>
    </div>
  )
}

export default EcranSucces
