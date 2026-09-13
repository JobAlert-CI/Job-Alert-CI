import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  Activity, ArrowUpRight, Bot, CircleCheck, CircleX, Cog, Database,
  HeartPulse, Layers, Mail, ShieldCheck, TriangleAlert,
} from "lucide-react"
import { cn } from "cn"
import { useSystemeSanteQuery } from "@/features/admin-systeme.tools"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"


const ICONES = {
  database: Database,
  celery: Cog,
  redis_queues: Layers,
  heartbeat: HeartPulse,
  email_provider: Mail,
  ai_provider: Bot,
  admin_auth: ShieldCheck,
}

const TITRES = {
  database: "Base de données",
  celery: "Workers Celery",
  redis_queues: "Files d'attente",
  heartbeat: "Heartbeat",
  email_provider: "Fournisseur email",
  ai_provider: "Fournisseur IA",
  admin_auth: "Session admin",
}

const DESCRIPTIONS = {
  database: "Connexion et exécution d'une requête simple sur PostgreSQL.",
  celery: "Tâches de fond (digests, ingestion, IA) — inspection avec délai de 2 s.",
  redis_queues: "Digests en attente d'envoi + profondeurs réelles des files du broker Redis (LLEN).",
  heartbeat: "Dernière offre créée : signal indirect que le pipeline de collecte est vivant.",
  email_provider: "Santé Resend dérivée des échecs d'envoi des 15 dernières minutes (aucun ping — audit 4, O.4).",
  ai_provider: "Santé des clés IA : erreurs récentes, cooldown global, clés actives (aucun ping).",
  admin_auth: "Auto-diagnostic de votre session courante (rôle, statut).",
}

/* ok → vert, warning → orange, degraded → orange soutenu, disabled → gris, error → rouge. */
const COULEUR_STATUT = {
  ok: { carte: "border-emerald-500/30 bg-emerald-500/5", lisere: "border-l-emerald-500", icone: "text-emerald-600", badge: "secondary" },
  warning: { carte: "border-amber-500/30 bg-amber-500/5", lisere: "border-l-amber-500", icone: "text-amber-600", badge: "secondary" },
  degraded: { carte: "border-orange-500/40 bg-orange-500/10", lisere: "border-l-orange-500", icone: "text-orange-600", badge: "secondary" },
  disabled: { carte: "border-border bg-muted/40", lisere: "border-l-muted-foreground/40", icone: "text-muted-foreground", badge: "outline" },
  error: { carte: "border-destructive/40 bg-destructive/10", lisere: "border-l-destructive", icone: "text-destructive", badge: "destructive" },
}

const LIBELLE_STATUT = { ok: "OK", warning: "Attention", degraded: "Dégradé", disabled: "Désactivé", error: "Erreur" }

/* Raccourcis de résolution : un fournisseur en difficulté → sa page de gestion. */
const LIENS_RACCOURCIS = {
  ai_provider: { href: "/admin/ia", libelle: "Gérer les clés IA" },
  email_provider: { href: "/admin/parametres", libelle: "Gérer les paramètres d'envoi" },
}

const VARIANTS_GRILLE = {
  cache: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.03 } },
}

const VARIANTS_TUILE = {
  cache: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
}

const formatNombre = (v) => (v ?? 0).toLocaleString("fr-FR")

/** « il y a 3 h », « il y a 2 j » — la fraîcheur du heartbeat parle mieux qu'une date brute. */
const ilYA = (iso) => {
  if (!iso) return "jamais"
  const secondes = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secondes < 60) return "à l'instant"
  if (secondes < 3600) return `il y a ${Math.floor(secondes / 60)} min`
  if (secondes < 86400) return `il y a ${Math.floor(secondes / 3600)} h`
  return `il y a ${Math.floor(secondes / 86400)} j`
}

const dateHeure = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return (
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  )
}

const IconeStatut = ({ statut }) =>
  statut === "ok" ? (
    <CircleCheck className="size-4 text-emerald-600" aria-hidden="true" />
  ) : statut === "error" ? (
    <CircleX className="size-4 text-destructive" aria-hidden="true" />
  ) : (
    <TriangleAlert
      className={cn("size-4", statut === "disabled" ? "text-muted-foreground" : statut === "degraded" ? "text-orange-600" : "text-amber-600")}
      aria-hidden="true"
    />
  )

const OngletSante = () => {
  const { data: sante, isFetching } = useSystemeSanteQuery()
  const chargement = !sante && isFetching

  return (
    <SectionCardAdmin
      title="Vue d'ensemble technique"
      description="Sept indicateurs servis par /system/health — vérification manuelle uniquement (l'inspection Celery coûte ~2 s, jamais de polling)."
      icon={Activity}
    >
      <div className="flex flex-col gap-4">
        {/* ─── 7 tuiles indicateurs, en cascade ─── */}
        <motion.div
          variants={VARIANTS_GRILLE}
          initial="cache"
          animate="visible"
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          {Object.entries(ICONES).map(([cle, Icone]) => {
            const indicateur = sante?.[cle]
            const statut = indicateur?.status ?? "warning"
            const style = COULEUR_STATUT[statut] ?? COULEUR_STATUT.warning
            const raccourci = LIENS_RACCOURCIS[cle]

            return (
              <motion.div
                key={cle}
                variants={VARIANTS_TUILE}
                aria-label={`${TITRES[cle]} : ${LIBELLE_STATUT[statut] ?? statut}`}
                className={cn("flex flex-col gap-2 rounded-xl border border-l-4 p-4", style.carte, style.lisere)}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <Icone className={cn("size-4", style.icone)} aria-hidden="true" /> {TITRES[cle]}
                  </p>
                  <span className="flex items-center gap-1.5">
                    <IconeStatut statut={statut} />
                    <Badge variant={style.badge}>{LIBELLE_STATUT[statut] ?? "Attention"}</Badge>
                  </span>
                </div>

                <p className="text-[11px] leading-relaxed text-muted-foreground">{DESCRIPTIONS[cle]}</p>

                {chargement ? (
                  /* Skeleton fidèle : bloc épais (chiffre) + bloc fin (texte). */
                  <div className="flex flex-col gap-1.5" aria-hidden="true">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ) : (
                  <ContenuIndicateur cle={cle} indicateur={indicateur} />
                )}

                {/* Raccourci de résolution si le fournisseur est en difficulté. */}
                {!chargement && raccourci && statut !== "ok" && (
                  <Link
                    to={raccourci.href}
                    className="mt-auto inline-flex w-fit items-center gap-1 pt-1 text-[11px] font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {raccourci.libelle} <ArrowUpRight className="size-3" aria-hidden="true" />
                  </Link>
                )}
              </motion.div>
            )
          })}
        </motion.div>

        {/* ─── Note pédagogique ─── */}
        <p className="text-[11px] text-muted-foreground">
          Lecture : « Attention » sur les workers signifie <em>aucun worker détecté dans le délai imparti</em> (2 s) —
          un worker lent répond peut-être simplement en retard, ce n'est pas nécessairement une panne. Les fournisseurs
          email/IA sont évalués <em>sans ping</em> : un « Dégradé » reflète un échec réel des 15 dernières minutes
          (audit 4, O.4) ; les profondeurs affichées sont lues directement dans le broker Redis (LLEN — audit 4, H.3),
          « N/A » ne survient que si le broker est injoignable.
        </p>
      </div>
    </SectionCardAdmin>
  )
}

/** Détail propre à chaque indicateur (message serveur + enrichissement front). */
const ContenuIndicateur = ({ cle, indicateur }) => {
  if (!indicateur) return <p className="text-xs">—</p>

  if (cle === "celery") {
    return (
      <p className="text-xs">
        <strong className="tabular-nums">{formatNombre(indicateur.workers_active ?? 0)}</strong> worker
        {(indicateur.workers_active ?? 0) > 1 ? "s" : ""} actif{(indicateur.workers_active ?? 0) > 1 ? "s" : ""} —{" "}
        <span className="text-muted-foreground">
          {indicateur.status === "ok"
            ? "digests, ingestion et IA opérationnels"
            : "aucun worker détecté dans le délai imparti (2 s)"}
        </span>
      </p>
    )
  }

  if (cle === "redis_queues") {
    const file = indicateur.queues ?? {}
    const profondeur = (v) => (v === undefined || v === null ? "N/A" : v)
    return (
      <p className="text-xs">
        <strong className="tabular-nums">{formatNombre(file.emails_queued ?? 0)}</strong> digest
        {(file.emails_queued ?? 0) > 1 ? "s" : ""} en attente d'envoi —{" "}
        <span className="text-muted-foreground">
          ingestion : {profondeur(file.ingestion_depth)} · IA : {profondeur(file.ai_depth)} · emails :{" "}
          {profondeur(file.emails_depth)} · défaut : {profondeur(file.default_depth)}
        </span>
      </p>
    )
  }

  if (cle === "heartbeat") {
    return (
      <p className="text-xs">
        Dernière offre créée <strong>{indicateur.last_heartbeat_at ? ilYA(indicateur.last_heartbeat_at) : "jamais"}</strong>
        {indicateur.last_heartbeat_at && (
          <span className="block text-[10px] text-muted-foreground">
            {new Date(indicateur.last_heartbeat_at).toLocaleString("fr-FR")}
          </span>
        )}
      </p>
    )
  }

  if (cle === "admin_auth") {
    return (
      <p className="text-xs">
        Connecté en <strong>{indicateur.current_role ?? "—"}</strong> — session{" "}
        <strong>{indicateur.is_active ? "active" : "inactive"}</strong>
      </p>
    )
  }

  // database / email_provider / ai_provider + fallback : message serveur,
  // enrichi de l'horodatage d'erreur éventuel (O.4 : last_error_at).
  return (
    <p className="text-xs text-muted-foreground">
      {indicateur.message ?? "—"}
      {indicateur.last_error_at && (
        <span className="block text-[10px]">Dernier échec : {dateHeure(indicateur.last_error_at)}</span>
      )}
      {indicateur.disabled_until && (
        <span className="block text-[10px]">Cooldown jusqu'au : {dateHeure(indicateur.disabled_until)}</span>
      )}
    </p>
  )
}

export default OngletSante