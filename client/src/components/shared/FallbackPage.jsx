// Fallback de chargement pour les routes en lazy-loading (Cf. Audit.md P1-13).
import { motion } from "framer-motion"

const FallbackPage = () => (
  <div
    role="status"
    aria-live="polite"
    className="flex min-h-[90vh] w-full flex-col items-center justify-center gap-6 bg-background"
  >
    {/* Logo avec animation d'apparition et pulsation subtile */}
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      {/* Halo pulsant derrière le logo */}
      <motion.div
        className="absolute inset-0 rounded-full bg-brand-orange/20 blur-2xl"
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 2.4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        aria-hidden
      />
      <motion.img
        src="/logo2.svg"
        alt=""
        aria-hidden
        className="relative size-77 w-full drop-shadow-sm"
        animate={{
          y: [0, -4, 0],
        }}
        transition={{
          duration: 2.4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </motion.div>

    {/* Texte de chargement avec points animés */}
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      className="flex items-center gap-1.5"
    >
      <span className="font-heading text-sm font-bold text-brand-navy">
        Chargement
      </span>
      <span className="flex gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-brand-orange"
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.15,
            }}
          />
        ))}
      </span>
    </motion.div>

    <span className="sr-only">Chargement de la page…</span>
  </div>
)

export default FallbackPage