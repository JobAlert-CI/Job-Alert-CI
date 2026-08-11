// src/pages/sources/components/BandeauDedup.jsx
import { motion } from "framer-motion"
import { Check, Fingerprint, X } from "lucide-react"
import { CountUp } from "@/components/shared"

const BandeauDedup = () => (
  <section className="bg-background py-16 md:py-20">
    <div className="mx-auto max-w-7xl px-12 max-md:px-6">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-xl bg-brand-navy"
      >
        <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-105 rounded-full bg-brand-orange/15 blur-3xl"
          aria-hidden
        />
        <Fingerprint
          className="pointer-events-none absolute -bottom-10 -right-6 size-56 rotate-12 text-white/5"
          strokeWidth={1}
          aria-hidden
        />

        {/* Desktop-first : 2 colonnes en base */}
        <div className="relative grid items-center gap-10 px-6 py-12 sm:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-14 lg:py-14 max-lg:grid-cols-1">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
              <Fingerprint className="size-3" aria-hidden />
              Dédoublonnage par hash
            </span>
            <h2 className="mt-4 font-heading text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
              La même offre ne passe jamais deux fois.
            </h2>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-white/70">
              Chaque annonce reçoit une empreinte unique calculée depuis son lien. Si elle
              est repérée sur deux sources, une seule version entre en base. Résultat :
              votre boîte mail reste propre, et chaque offre n'apparaît qu'une fois.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
              {[
                { v: 0, l: "doublon envoyé" },
                { v: 1, l: "hash unique par offre" },
                { v: 4, l: "sources croisées" },
              ].map((s) => (
                <div key={s.l}>
                  <p className="font-heading text-2xl font-black text-brand-orange">
                    <CountUp to={s.v} />
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                    {s.l}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0 rounded-xl bg-white p-5 shadow-hover">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Même annonce, deux sources
            </p>
            <div className="mt-3.5 space-y-2.5">
              <motion.div
                initial={{ opacity: 0, x: -14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-50/40 p-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-outline-variant/40 bg-white font-heading text-[10px] font-black text-brand-navy">
                  ED
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-brand-navy">
                    Comptable senior
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Groupe SIFCA · via EmploiDakar CI
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  <Check className="size-3" strokeWidth={4} aria-hidden />
                  Insérée
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.35 }}
                className="relative flex items-center gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-low/50 p-3 opacity-80"
              >
                <motion.span
                  initial={{ scale: 1.7, opacity: 0, rotate: 16 }}
                  whileInView={{ scale: 1, opacity: 1, rotate: 6 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.75, duration: 0.3, ease: "backOut" }}
                  className="absolute right-2.5 top-2.5 rounded border-2 border-red-500/70 bg-white/80 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-red-600"
                >
                  Doublon
                </motion.span>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-outline-variant/40 bg-white font-heading text-[10px] font-black text-teal-700">
                  GA
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-on-surface-variant line-through decoration-red-400/70">
                    Comptable senior
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Groupe SIFCA · via GoAfrica
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600">
                  <X className="size-3" strokeWidth={4} aria-hidden />
                  Écartée
                </span>
              </motion.div>
            </div>

            <p className="mt-3.5 rounded-lg bg-surface-container px-3.5 py-2.5 font-mono text-[11px] text-on-surface-variant">
              hash_unique : <span className="font-bold text-brand-navy">a3f8…9c2</span>
              <span className="ml-2 text-emerald-600">✓ contrainte UNIQUE</span>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
)

export default BandeauDedup