import { motion } from "framer-motion"
import { Mail, CheckCircle2, Radar, Send } from "lucide-react"
import { CtaLink } from "@/components/shared"
import { useRegistered } from "@/contexts/Registered.context"

const SUITE_PIPELINE = [
  { icon: Mail, t: "Maintenant", l: "Email de confirmation envoyé" },
  { icon: CheckCircle2, t: "Action requise", l: "Cliquez sur le lien reçu" },
  { icon: Radar, t: "06h00", l: "Collecte des 4 sources" },
  { icon: Send, t: "08h00", l: "Votre premier récap arrive" },
]

export const EcranSucces = () => {
  const { form } = useRegistered()
  const prenom = form.nom?.trim() ? form.nom.trim().split(" ")[0] : ""

  return (
    <div className="mx-auto max-w-2xl py-10 text-center md:py-16">
      {/* Animation Email / Check */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative mx-auto mb-8 flex size-24 items-center justify-center rounded-full bg-brand-orange/10"
      >
        <Mail className="size-12 text-brand-orange" />
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-white"
        >
          <CheckCircle2 className="size-5 text-white" />
        </motion.div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="font-heading text-3xl font-black tracking-tight text-brand-navy sm:text-4xl"
      >
        Dernière étape{prenom ? `, ${prenom}` : ""} !
      </motion.h1>
      
      <motion.p
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.5 }}
        className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-on-surface-variant"
      >
        Un email de confirmation vient d'être envoyé à{" "}
        <strong className="font-semibold text-brand-navy">{form.email}</strong>.
        <br className="hidden sm:block" />
        Cliquez sur le lien à l'intérieur pour activer définitivement vos alertes.
      </motion.p>

      {/* Pipeline des étapes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="mt-10 grid gap-3 sm:grid-cols-4"
      >
        {SUITE_PIPELINE.map((s, i) => (
          <motion.div
            key={s.t}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 + i * 0.1, duration: 0.4 }}
            className="rounded-xl border border-outline-variant/50 bg-white p-4 shadow-soft"
          >
            <s.icon className="mx-auto size-5 text-brand-orange" />
            <p className="mt-2 font-heading text-sm font-extrabold text-brand-navy">{s.t}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{s.l}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Liens d'action */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.4 }}
        className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
      >
        <CtaLink to="/comment-ca-marche" variant="secondary">
          Comment ça marche
        </CtaLink>
      </motion.div>
    </div>
  )
}

export default EcranSucces