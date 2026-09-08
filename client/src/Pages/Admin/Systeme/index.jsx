import { Activity, CircleCheck, CircleX, Cog, Database, HeartPulse, Layers, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getSystemHealth } from "@/api/admin/system"
import { useNotify } from "@/contexts/Notify.context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

/* ─────────────────────────────────────────────────────────────────────
   Page Santé du système — /admin/systeme (super_admin, doc v3 §20).

   Point de vérité unique pour savoir si l'infrastructure tourne :
   « aucun email envoyé ce matin » se diagnostique ici sans SSH.

   CINQ indicateurs servis par GET /api/admin/system/health :
   - Base de données (SELECT COUNT simple) ;
   - Workers Celery (control.inspect, timeout 2 s) ;
   - Files d'attente (digests queued ; ingestion/IA = N/A — pas de
     file Redis exposee, la doc interdit tout graphique dessus) ;
   - Heartbeat (derniere offre creee = signal que la collecte vit) ;
   - Session admin (auto-diagnostic role/actif).

   ⚠️ Rafraichissement MANUEL uniquement (doc §20 : l'inspection
   Celery est couteuse, jamais de polling). L'horodatage de la
   derniere verification est affiche.

   Vocabulaire serveur verifie live : status ok|warning|error,
   overall_status ok|degraded|error.
   ───────────────────────────────────────────────────────────────────── */

const ICONES = {
  database: Database,
  celery: Cog,
  redis_queues: Layers,
  heartbeat: HeartPulse,
  admin_auth: ShieldCheck,
}

const TITRES = {
  database: "Base de données",
  celery: "Workers Celery",
  redis_queues: "Files d'attente",
  heartbeat: "Heartbeat",
  admin_auth: "Session admin",
}

const DESCRIPTIONS = {
  database: "Connexion et exécution d'une requête simple sur PostgreSQL.",
  celery: "Tâches de fond (digests, ingestion, IA) — inspection avec délai de 2 s.",
  redis_queues: "Digests en file d'attente d'envoi. Profondeur Redis ingestion/IA non exposée actuellement (texte seul, pas de graphique — doc §20).",
  heartbeat: "Dernière offre créée : signal indirect que le pipeline de collecte est vivant.",
  admin_auth: "Auto-diagnostic de votre session courante (rôle, statut).",
}

/* ok → vert, warning → orange, error → rouge. */
const COULEUR_STATUT = {
  ok: { carte: "border-emerald-500/30 bg-emerald-500/5", icone: "text-emerald-600", badge: "secondary" },
  warning: { carte: "border-amber-500/30 bg-amber-500/5", icone: "text-amber-600", badge: "secondary" },
  error: { carte: "border-destructive/40 bg-destructive/10", icone: "text-destructive", badge: "destructive" },
}

const IconeStatut = ({ statut }) =>
  statut === "ok" ? (
    <CircleCheck className="size-5 text-emerald-600" aria-hidden />
  ) : statut === "error" ? (
    <CircleX className="size-5 text-destructive" aria-hidden />
  ) : (
    <TriangleAlert className="size-5 text-amber-600" aria-hidden />
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
    texte: "Le site fonctionne, mais au moins un service d'arrière-plan ne répond pas dans le délai imparti (workers Celery, files). Les emails programmés peuvent être retardés.",
    classe: "border-amber-500/30 bg-amber-500/5",
  },
  error: {
    titre: "Système en erreur",
    texte: "La base de données est injoignable — le site ne peut pas fonctionner normalement.",
    classe: "border-destructive/40 bg-destructive/10",
  },
}

const PageSysteme = () => {
  const notify = useNotify()
  const queryClient = useQueryClient()

  // Rafraîchissement MANUEL uniquement (staleTime infinie = jamais de
  // refetch auto ; refetchOnWindowFocus déjà désactivé globalement).
  const { data: sante, isFetching, isError } = useQuery({
    queryKey: ["admin", "systeme", "sante"],
    queryFn: ({ signal }) => getSystemHealth({ signal }),
    staleTime: Infinity,
    retry: 0,
  })

  const verifier = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "systeme", "sante"] })
    notify("Vérification en cours (inspection Celery ~2 s)…", "info", 3000)
  }

  if (isError) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <h1 className="flex items-center gap-2 font-heading text-lg font-bold">
          <Activity className="size-5 text-primary" aria-hidden /> Santé du système
        </h1>
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <CircleX className="size-8 text-destructive" aria-hidden />
          <p className="text-sm font-semibold">Impossible de joindre le point de santé.</p>
          <p className="max-w-md text-xs text-muted-foreground">
            L'API ne répond pas ou la session a expiré — rechargez la page ou reconnectez-vous.
          </p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Recharger la page</Button>
        </div>
      </div>
    )
  }

  const overall = OVERALL[sante?.overall_status] ?? OVERALL.degraded
  const chargement = !sante && isFetching

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* ─── En-tête + bouton vérification manuelle ─── */}
      <section aria-label="En-tête santé système" className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-lg font-bold">
            <Activity className="size-5 text-primary" aria-hidden /> Santé du système
          </h1>
          <p className="text-xs text-muted-foreground">
            Supervision technique : base de données, workers Celery, files d'attente, heartbeat de collecte.
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

      {/* ─── 5 cartes indicateurs ─── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(ICONES).map(([cle, Icone]) => {
          const indicateur = sante?.[cle]
          const statut = indicateur?.status ?? "warning"
          const style = COULEUR_STATUT[statut] ?? COULEUR_STATUT.warning
          return (
            <div
              key={cle}
              className={`flex flex-col gap-2 rounded-xl border p-4 ${style.carte} ${chargement ? "animate-pulse" : ""}`}
              aria-label={`${TITRES[cle]} : ${statut}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-bold">
                  <Icone className={`size-4 ${style.icone}`} aria-hidden /> {TITRES[cle]}
                </p>
                <Badge variant={style.badge}>{statut === "ok" ? "OK" : statut === "warning" ? "Attention" : "Erreur"}</Badge>
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
        un worker lent répond peut-être simplement en retard, ce n'est pas nécessairement une panne. La profondeur
        réelle des files Redis ingestion/IA n'est pas encore exposée par l'API (« N/A »), elle le restera en texte
        simple tant que le backend ne la mesure pas.
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
    return (
      <p className="text-xs">
        <strong className="tabular-nums">{file.emails_queued ?? 0}</strong> digest{(file.emails_queued ?? 0) > 1 ? "s" : ""} en file d'attente —{" "}
        <span className="text-muted-foreground">
          ingestion : {file.ingestion_depth ?? "N/A"} · IA : {file.ai_depth ?? "N/A"}
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

  // database + fallback
  return <p className="text-xs text-muted-foreground">{indicateur.message ?? "—"}</p>
}

export default PageSysteme
