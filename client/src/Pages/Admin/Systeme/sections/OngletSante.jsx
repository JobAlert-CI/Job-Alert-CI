import { Activity, CircleCheck, CircleX, Cog, Database, HeartPulse, Layers, Mail, RefreshCw, ShieldCheck, TriangleAlert, Bot } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useSystemeSanteQuery, adminSystemeKeys } from "@/features/admin-systeme.tools"
import { useNotify } from "@/contexts/Notify.context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Santé — vue d'ensemble technique (audit 4 : H.3 + O.4).

   SEPT indicateurs servis par GET /api/admin/system/health :
   - Base de données (SELECT COUNT simple) ;
   - Workers Celery (control.inspect, timeout 2 s) ;
   - Files d'attente (VRAIES profondeurs broker LLEN — ingestion, IA,
     emails, défaut — plus de « N/A » depuis l'audit 4, H.3 ;
     « N/A » ne subsiste que si le broker est injoignable) ;
   - Heartbeat (dernière offre créée = signal que la collecte vit) ;
   - Fournisseur email Resend (santé DÉRIVÉE des échecs < 15 min,
     aucun ping — audit 4, O.4) ;
   - Fournisseur IA (clés actives, cooldown, erreurs récentes — O.4) ;
   - Session admin (auto-diagnostic rôle/actif).

   ⚠️ Rafraîchissement MANUEL uniquement (doc §20 : l'inspection
   Celery est coûteuse, jamais de polling). L'horodatage de la
   dernière vérification est affiché.

   Vocabulaire serveur vérifié live 2026-09-10 : status ok|warning|error|
   degraded|disabled, overall_status ok|degraded|error.
   ───────────────────────────────────────────────────────────────────── */

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

/* ok → vert, warning → orange, degraded → orange soutenu, disabled → gris, error → rouge.
   (C6 : les statuts des providers dérivés O.4 sortaient tous en amber fallback.) */
const COULEUR_STATUT = {
  ok: { carte: "border-emerald-500/30 bg-emerald-500/5", icone: "text-emerald-600", badge: "secondary" },
  warning: { carte: "border-amber-500/30 bg-amber-500/5", icone: "text-amber-600", badge: "secondary" },
  degraded: { carte: "border-orange-500/40 bg-orange-500/10", icone: "text-orange-600", badge: "secondary" },
  disabled: { carte: "border-muted-foreground/25 bg-muted/40", icone: "text-muted-foreground", badge: "outline" },
  error: { carte: "border-destructive/40 bg-destructive/10", icone: "text-destructive", badge: "destructive" },
}

const LIBELLE_STATUT = { ok: "OK", warning: "Attention", degraded: "Dégradé", disabled: "Désactivé", error: "Erreur" }

const IconeStatut = ({ statut }) =>
  statut === "ok" ? (
    <CircleCheck className="size-5 text-emerald-600" aria-hidden />
  ) : statut === "error" ? (
    <CircleX className="size-5 text-destructive" aria-hidden />
  ) : (
    <TriangleAlert className={`size-5 ${statut === "degraded" ? "text-orange-600" : statut === "disabled" ? "text-muted-foreground" : "text-amber-600"}`} aria-hidden />
  )

/** « il y a 3 h », « il y a 2 j » — la fraîcheur du heartbeat parle mieux qu'une date brute. */
const ilYA = (iso) => {
  if (!iso) return "jamais"
  const secondes = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secondes < 60) return "à l'instant"
  if (secondes < 3600) return `il y a ${Math.floor(secondes / 60)} min`
  if (secondes < 86400) return `il y a ${Math.floor(secondes / 3600)} h`
  return `il y a ${Math.floor(secondes / 86400)} j`
}

const OVERALL = {
  ok: {
    titre: "Système opérationnel",
    texte: "Tous les indicateurs sont au vert.",
    classe: "border-emerald-500/30 bg-emerald-500/5",
  },
  degraded: {
    titre: "Système dégradé",
    texte: "Le site fonctionne, mais au moins un service d'arrière-plan ou un fournisseur externe (email Resend, IA) est en difficulté — workers Celery injoignables dans le délai, broker Redis down, échec d'envoi récent ou toutes les clés IA en cooldown. Les emails programmés peuvent être retardés.",
    classe: "border-amber-500/30 bg-amber-500/5",
  },
  error: {
    titre: "Système en erreur",
    texte: "La base de données est injoignable — le site ne peut pas fonctionner normalement.",
    classe: "border-destructive/40 bg-destructive/10",
  },
}

const OngletSante = () => {
  const notify = useNotify()
  const queryClient = useQueryClient()

  // Rafraîchissement MANUEL uniquement (staleTime infinie = jamais de
  // refetch auto ; refetchOnWindowFocus déjà désactivé globalement).
  const { data: sante, isFetching, isError } = useSystemeSanteQuery()

  const verifier = () => {
    queryClient.invalidateQueries({ queryKey: adminSystemeKeys.sante })
    notify("Vérification en cours (inspection Celery ~2 s)…", "info", 3000)
  }

  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <CircleX className="size-8 text-destructive" aria-hidden />
        <p className="text-sm font-semibold">Impossible de joindre le point de santé.</p>
        <p className="max-w-md text-xs text-muted-foreground">
          L'API ne répond pas ou la session a expiré — rechargez la page ou reconnectez-vous.
        </p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Recharger la page</Button>
      </div>
    )
  }

  const overall = OVERALL[sante?.overall_status] ?? OVERALL.degraded
  const chargement = !sante && isFetching

  return (
    <div className="flex flex-col gap-6">
      {/* ─── En-tête + bouton vérification manuelle ─── */}
      <section aria-label="En-tête santé système" className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-sm font-bold">
            <Activity className="size-4 text-primary" aria-hidden /> Vue d'ensemble
          </h2>
          <p className="text-xs text-muted-foreground">
            Base de données, workers Celery, files du broker, heartbeat de collecte, fournisseurs email/IA.
            Vérification manuelle — l'inspection des workers coûte ~2 s, aucun rafraîchissement automatique.
          </p>
        </div>
        <Button size="sm" onClick={verifier} disabled={isFetching}>
          <RefreshCw className={isFetching ? "animate-spin" : undefined} aria-hidden />
          {isFetching ? "Vérification…" : "Vérifier maintenant"}
        </Button>
      </section>

      {/* ─── Bandeau global ─── */}
      {chargement ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : (
        <div role="status" aria-live="polite" className={`flex items-start gap-3 rounded-xl border p-4 ${overall.classe}`}>
          <IconeStatut statut={sante.overall_status === "ok" ? "ok" : sante.overall_status === "error" ? "error" : "warning"} />
          <div>
            <p className="text-sm font-bold">{overall.titre}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{overall.texte}</p>
          </div>
        </div>
      )}

      {/* ─── 7 cartes indicateurs ─── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(ICONES).map(([cle, Icone]) => {
          const indicateur = sante?.[cle]
          const statut = indicateur?.status ?? "warning"
          const style = COULEUR_STATUT[statut] ?? COULEUR_STATUT.warning
          return (
            <div
              key={cle}
              className={`flex flex-col gap-2 rounded-xl border p-4 ${style.carte} ${chargement ? "animate-pulse" : ""}`}
              aria-label={`${TITRES[cle]} : ${LIBELLE_STATUT[statut] ?? statut}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-bold">
                  <Icone className={`size-4 ${style.icone}`} aria-hidden /> {TITRES[cle]}
                </p>
                <Badge variant={style.badge}>{LIBELLE_STATUT[statut] ?? "Attention"}</Badge>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{DESCRIPTIONS[cle]}</p>
              {chargement ? (
                <Skeleton className="h-4 w-2/3 rounded" />
              ) : (
                <ContenuIndicateur cle={cle} indicateur={indicateur} />
              )}
            </div>
          )
        })}
      </div>

      {/* ─── Note pédagogique ─── */}
      <p className="text-[11px] text-muted-foreground">
        Lecture : « Attention » sur les workers signifie <em>aucun worker détecté dans le délai imparti</em> (2 s) —
        un worker lent répond peut-être simplement en retard, ce n'est pas nécessairement une panne. Les fournisseurs
        email/IA sont évalués <em>sans ping</em> : un « Dégradé » reflète un échec réel des 15 dernières minutes
        (audit 4, O.4) ; les profondeurs affichées sont lues directement dans le broker Redis (LLEN — audit 4, H.3),
        « N/A » ne survient que si le broker est injoignable.
      </p>
    </div>
  )
}

/** Détail propre à chaque indicateur (message serveur + enrichissement front). */
const ContenuIndicateur = ({ cle, indicateur }) => {
  if (!indicateur) return <p className="text-xs">—</p>

  if (cle === "celery") {
    return (
      <p className="text-xs">
        <strong className="tabular-nums">{indicateur.workers_active ?? 0}</strong> worker{(indicateur.workers_active ?? 0) > 1 ? "s" : ""} actif{(indicateur.workers_active ?? 0) > 1 ? "s" : ""} —{" "}
        <span className="text-muted-foreground">
          {indicateur.status === "ok"
            ? "digests, ingestion et IA opérationnels"
            : "aucun worker détecté dans le délai imparti (2 s) — pas forcément une panne"}
        </span>
      </p>
    )
  }

  if (cle === "redis_queues") {
    const file = indicateur.queues ?? {}
    const profondeur = (v) => (v === undefined || v === null ? "N/A" : v)
    return (
      <p className="text-xs">
        <strong className="tabular-nums">{file.emails_queued ?? 0}</strong> digest{(file.emails_queued ?? 0) > 1 ? "s" : ""} en attente d'envoi —{" "}
        <span className="text-muted-foreground">
          ingestion : {profondeur(file.ingestion_depth)} · IA : {profondeur(file.ai_depth)} · emails : {profondeur(file.emails_depth)} · défaut : {profondeur(file.default_depth)}
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

const dateHeure = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

export default OngletSante
