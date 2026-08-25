import { AnimatePresence, motion } from "framer-motion"
import { Clock, Fingerprint, Sparkles } from "lucide-react"
import { FaLinkedin } from "react-icons/fa6"
import { cn } from "@/lib/utils"
import { paletteDepuisHex } from "@/lib/hues"
import { SOURCES } from "@/lib/referentiels"
import { getImgSource } from "@/utils/utilsSource"
import { useRegistered } from "@/contexts/Registered.context"

const LogoSrc = ({ code, className = "size-4" }) => {
  const s = SOURCES.find((x) => x.code === code)
  if (!s) return null
  return s.linkedin ? (
    <FaLinkedin className={cn(className, "text-[#0A66C2]")} />
  ) : (
    <img src={getImgSource(code)} alt={code} className={cn(className, "object-contain")} />
  )
}

export const ApercuRecap = () => {
  const { form, offresApercu, total, filieres } = useRegistered()

  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      {/* Halo lumineux */}
      <div className="absolute -inset-8 rounded-full bg-brand-orange/10 blur-3xl" aria-hidden />

      {/* Carte décorative inclinée arrière */}
      <div
        className="absolute inset-0 translate-x-4 translate-y-5 rotate-2 overflow-hidden rounded-2xl bg-brand-navy"
        aria-hidden
      >
        <div className="absolute inset-0 bg-pattern opacity-20" />
      </div>

      {/* Badges flottants */}
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, y: [0, -7, 0] }}
        transition={{
          delay: 0.6,
          opacity: { duration: 0.4 },
          scale: { duration: 0.4 },
          y: { duration: 4.6, repeat: Infinity, ease: "easeInOut" },
        }}
        className="absolute -top-4 left-4 z-20 inline-flex -rotate-3 items-center gap-1.5 rounded-full bg-brand-orange px-3.5 py-1.5 text-[11px] font-bold text-white shadow-lg"
      >
        <Clock className="size-3" />
        Demain, 8h00 pile
      </motion.span>

      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        className="absolute -bottom-4 right-8 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3.5 py-1.5 text-[11px] font-bold text-emerald-600 shadow-hover"
      >
        <Fingerprint className="size-3" />
        0 doublon
      </motion.span>

      {/* Cadre Email principal */}
      <div className="relative overflow-hidden rounded-2xl border border-outline-variant/40 bg-white shadow-[0_24px_48px_-16px_rgba(15,45,77,0.22)]">
        {/* En-tête Client Email */}
        <div className="flex items-center gap-3 border-b border-outline-variant/40 bg-surface-container-low/60 px-5 py-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-navy font-heading text-[11px] font-black text-white">
            JA
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-on-surface">
              JobAlert CI <span className="font-medium text-muted-foreground">&lt;bonjour@jobalert.ci&gt;</span>
            </p>
            <p className="truncate text-[11px] text-muted-foreground">Objet : Votre récapitulatif quotidien</p>
          </div>
          <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">08:00</span>
        </div>

        {/* Contenu de l'email */}
        <div className="px-5 py-4">
          <p className="text-sm text-on-surface-variant">
            Bonjour {form.nom.trim() ? <strong className="font-semibold text-on-surface">{form.nom.trim().split(" ")[0]}</strong> : "👋"}
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">
            <AnimatePresence mode="wait" initial={false}>
              <motion.strong
                key={total}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="inline-block font-semibold text-on-surface"
              >
                {total} offre{total > 1 ? "s" : ""}
              </motion.strong>
            </AnimatePresence>{" "}
            correspondent à vos filières :
          </p>

          {offresApercu.length === 0 ? (
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex h-11 animate-pulse items-center gap-2.5 rounded-lg border border-outline-variant/40 px-3"
                  style={{ animationDelay: `${i * 0.18}s` }}
                >
                  <span className="size-1.5 rounded-full bg-muted-foreground/20" />
                  <span
                    className="h-2 rounded-full bg-muted-foreground/15"
                    style={{ width: `${64 - i * 14}%` }}
                  />
                </div>
              ))}
              <p className="pt-1 text-center text-[11px] text-muted-foreground">
                Vos offres apparaîtront ici dès la 2ᵉ étape.
              </p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              <AnimatePresence initial={false}>
                {offresApercu.map((o) => {
                  const filiereCode = o.filiere || o.filiere_code || o.primary_filiere?.code
                  const filiereObj = filieres.find((f) => f.code === filiereCode || f.slug === filiereCode)
                  const hue = paletteDepuisHex(filiereObj?.color_hex ?? filiereObj?.colorHex)
                  const sourceCode = o.source?.code || o.source || "EmploiDakar CI"
                  const entrepriseName = o.company?.name || o.entreprise || "Entreprise"

                  return (
                    <motion.li
                      key={o.uid || o.id || o.slug}
                      layout
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 14 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="flex items-center gap-2.5 rounded-lg border border-outline-variant/40 bg-white px-3 py-2.5 shadow-xs"
                    >
                      <span className={cn("size-1.5 shrink-0 rounded-full", hue?.dot || "bg-blue-500")} style={hue.style} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-on-surface">{o.title || o.titre}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{entrepriseName}</p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 rounded-full border border-outline-variant/50 bg-surface-container-low/60 px-2 py-0.5 text-[9px] font-semibold text-on-surface-variant">
                        <LogoSrc code={sourceCode} className="size-2.5" />
                        {sourceCode}
                      </span>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          )}

          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-surface-container-low px-3.5 py-2.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              + {Math.max(total - offresApercu.length, 0)} autres offres dans votre email
            </span>
            <span className="shrink-0 rounded-md bg-brand-navy px-3 py-1.5 text-[11px] font-bold text-white">
              Ouvrir le récap'
            </span>
          </div>

          {(form.experience || form.contrats.length > 0) && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700"
            >
              <Sparkles className="size-3.5" />
              Tri affiné selon votre profil{form.experience ? ` · ${form.experience}` : ""}
            </motion.p>
          )}
        </div>

        {/* Pied de l'email */}
        <div className="flex items-center gap-2 border-t border-outline-variant/40 bg-surface-container-low/40 px-5 py-2.5 text-[10px] font-medium text-muted-foreground">
          <span>Gérer mes filières</span>
          <span aria-hidden>·</span>
          <span>Me désinscrire en 1 clic</span>
        </div>
      </div>
    </div>
  )
}

export default ApercuRecap
