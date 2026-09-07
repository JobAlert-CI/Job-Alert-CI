import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Ban, Check, FileText, Mail, Pause, Pencil, Save, Send, ShieldAlert, X } from "lucide-react"
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import {
  STATUTS_ABONNE, useAdminSubscriberDetailQuery, useAdminSubscriberSendsQuery,
  useAdminAbonneEmailsTx, useModifierAbonne, useChangerStatutAbonne,
  useAnonymiserAbonne, useCompteOffresActivesFiliere, messageErreurAbonne,
} from "@/features/admin-abonnes.tools"
import { useReferentialsQuery } from "@/lib/referentiels-query"
import { useNotify } from "@/contexts/Notify.context"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import { SectionErreur } from "./components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Page Détail utilisateur — /admin/utilisateurs/:id (doc v3 §8).

   Objectif : tout ce qu'on sait sur un abonné pour le support
   (« pourquoi je ne reçois plus d'offres ? ») et l'intervention ciblée.

   super_admin + gestionnaire_utilisateurs (guard par route).

   Bandeau de compteurs (cycle 8+) :
   - digests reçus, offres reçues, taux de succès (depuis sends,
     déjà chargé par l'onglet) ;
   - ancienneté (subscribed_at) ;
   - offres actives correspondant à ses filières (endpoint dédié
     /stats/matching-offers-count — cas support « digest vide »).

   Onglets :
   1. Profil — identité, filières (priorité, lecture seule : le choix
      reste au candidat via son lien email, doc v3 §8), contrats
      préférés, canal, préférence conseils + édition administrative.
   2. Statistiques — donut paliers de matching agrégés (match_kind)
      + timeline des envois (offres par digest dans le temps).
   3. Envois — historique des digests (statut + paliers par envoi).
   4. Emails transactionnels — route page 16 filtrée sur l'abonné.

   Actions : changement de statut (motif pour désinscription),
   « Envoyer une sélection » → cycle 9, anonymisation RGPD explicite.
   ───────────────────────────────────────────────────────────────────── */

const LIBELLE_STATUT = Object.fromEntries(STATUTS_ABONNE.map((s) => [s.valeur, s.libelle]))

const VARIANTE_STATUT = {
  active: "secondary",
  unsubscribed: "outline",
  bouncing: "destructive",
  paused: "outline",
  pending: "outline",
  deleted: "outline",
}

// match_kind du modèle EmailDigestOffer → libellé + ton + couleur (doc v3 §8).
const KIND_MATCH = {
  primary: { libelle: "Filière principale", ton: "default", couleur: "#2563eb" },
  secondary: { libelle: "Filière secondaire (T1)", ton: "secondary", couleur: "#10b981" },
  fallback_contract: { libelle: "Même contrat (T2)", ton: "secondary", couleur: "#f59e0b" },
  fallback_freshness: { libelle: "Offre récente (T3)", ton: "secondary", couleur: "#a855f7" },
  fallback_experience: { libelle: "Profil proche (T4)", ton: "outline", couleur: "#ec4899" },
  fallback_city: { libelle: "Même ville (T5)", ton: "outline", couleur: "#64748b" },
}

const STATUT_DIGEST = {
  sent: { libelle: "Envoyé", variante: "secondary" },
  failed: { libelle: "Échoué", variante: "destructive" },
  skipped_empty: { libelle: "Sans offre", variante: "outline" },
  queued: { libelle: "En file", variante: "outline" },
  sending: { libelle: "Envoi…", variante: "outline" },
  cancelled: { libelle: "Annulé", variante: "outline" },
}

const PURPOSE_TX = {
  confirm_email: "Confirmation d'inscription",
  digest_manual: "Envoi personnalisé",
  alerte: "Alerte",
  unsubscribe: "Désinscription",
}

const dateHeureFr = (iso) =>
  iso
    ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—"

const DetailAbonne = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const notify = useNotify()

  const { data: abonne, isLoading, isError, refetch } = useAdminSubscriberDetailQuery(id)
  const { data: referentiels } = useReferentialsQuery()

  const [editionOuverte, setEditionOuverte] = useState(false)
  const [dialogStatutOuvert, setDialogStatutOuvert] = useState(false)
  const [nouveauStatut, setNouveauStatut] = useState("")
  const [motif, setMotif] = useState("")
  const [anonymOuvert, setAnonymOuvert] = useState(false)

  const statutMutation = useChangerStatutAbonne()
  const anonymiserMutation = useAnonymiserAbonne()

  // Résolutions UUID → labels (référentiel public en cache).
  const filiereParId = useMemo(
    () => new Map((referentiels?.filieres ?? []).map((f) => [f.id, f])),
    [referentiels]
  )
  const contratParId = useMemo(
    () => new Map((referentiels?.contrats ?? []).map((c) => [c.id, c])),
    [referentiels]
  )

  if (isError) {
    return <SectionErreur onRetry={refetch} message="Impossible de charger cet abonné." />
  }

  if (isLoading || !abonne) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  const estAnonymise = abonne.status === "deleted"

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/utilisateurs")} aria-label="Retour à la liste">
            <ArrowLeft aria-hidden />
          </Button>
          <div className="flex flex-col gap-0.5">
            <h1 className="font-heading truncate text-lg font-bold" title={abonne.email}>
              {abonne.full_name || abonne.email}
            </h1>
            <p className="text-xs text-muted-foreground">
              {abonne.email} · inscrit le {dateHeureFr(abonne.subscribed_at).split(" à ")[0]}
              {abonne.source && ` · via ${abonne.source}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={VARIANTE_STATUT[abonne.status] ?? "outline"} data-testid="statut-abonne">
            {LIBELLE_STATUT[abonne.status] ?? abonne.status}
          </Badge>
          {!estAnonymise && (
            <>
              <Button
                size="sm"
                variant="outline"
                render={<Link to={`/admin/utilisateurs/${abonne.id}/envoyer`} />}
              >
                <Send aria-hidden /> Envoyer une sélection
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditionOuverte(true)}>
                <Pencil aria-hidden /> Modifier
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setAnonymOuvert(true)}>
                <ShieldAlert aria-hidden /> Anonymiser…
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Bandeau de compteurs (données sends + matching déjà chargées
          par les onglets — les hooks ci-dessous partagent le cache). */}
      <BandeauCompteurs abonneId={abonne.id} filiereParId={filiereParId} subscribedAt={abonne.subscribed_at} />

      {/* Rappel anonymisation */}
      {estAnonymise && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Cet abonné a été anonymisé (RGPD) : ses données personnelles ont été effacées.
          L'historique d'envois est conservé pour la cohérence des statistiques.
        </div>
      )}

      {/* Onglets */}
      <Tabs defaultValue="profil">
        <TabsList>
          <TabsTrigger value="profil">Profil</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
          <TabsTrigger value="envois">Envois</TabsTrigger>
          <TabsTrigger value="emails">Emails transactionnels</TabsTrigger>
        </TabsList>

        {/* ── Onglet Profil ── */}
        <TabsContent value="profil" className="mt-3">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Carte identité */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Identité</h3>
              <Ligne label="Nom complet">{abonne.full_name || "—"}</Ligne>
              <Ligne label="Ville">{abonne.city || "—"}</Ligne>
              <Ligne label="Fuseau horaire">{abonne.timezone}</Ligne>
              <Ligne label="Source d'inscription">{abonne.source || "—"}</Ligne>
              <Ligne label="Conseils carrière">
                <Switch checked={abonne.wants_career_tips} disabled aria-label="Préférence conseils carrière (modifiable via Modifier)" />
              </Ligne>
              {abonne.unsubscribe_reason && (
                <Ligne label="Motif de désinscription">{abonne.unsubscribe_reason}</Ligne>
              )}
            </div>

            {/* Carte filières + contrats (lecture seule — choix du candidat) */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Abonnements ({abonne.filiere_links.length}/3)
              </h3>
              {abonne.filiere_links.length ? (
                <ul className="flex flex-col gap-1.5">
                  {abonne.filiere_links.map((lien) => {
                    const filiere = filiereParId.get(lien.filiere_id)
                    return (
                      <li key={lien.id} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="tabular-nums">#{lien.priority}</Badge>
                        {filiere?.label ?? `Filière ${lien.filiere_id.slice(0, 8)}…`}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Aucune filière — cet abonné ne recevra pas d'offres ciblées.
                </p>
              )}
              <h3 className="mt-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Contrats préférés ({abonne.contract_preferences.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {abonne.contract_preferences.map((pref) => (
                  <Badge key={pref.id} variant="secondary">
                    {contratParId.get(pref.contract_type_id)?.label ?? pref.contract_type_id.slice(0, 8)}
                  </Badge>
                ))}
                {!abonne.contract_preferences.length && (
                  <span className="text-xs text-muted-foreground">Aucune préférence.</span>
                )}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Les filières et contrats restent sous le contrôle du candidat (lien email) —
                ils ne sont pas modifiables ici (doc v3 §8).
              </p>
            </div>

            {/* Notes internes */}
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 md:col-span-2">
              <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                <FileText className="size-3.5" aria-hidden /> Notes internes
              </h3>
              {abonne.admin_notes ? (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{abonne.admin_notes}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Aucune note interne.</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Onglet Statistiques ── */}
        <TabsContent value="stats" className="mt-3">
          <StatistiquesAbonne abonneId={abonne.id} />
        </TabsContent>

        {/* ── Onglet Envois ── */}
        <TabsContent value="envois" className="mt-3">
          <HistoriqueEnvois abonneId={abonne.id} />
        </TabsContent>

        {/* ── Onglet Emails transactionnels ── */}
        <TabsContent value="emails" className="mt-3">
          <EmailsTransactionnels abonneId={abonne.id} />
        </TabsContent>
      </Tabs>

      {/* Changement de statut (barre d'actions contextuelle) */}
      {!estAnonymise && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <span className="text-xs font-semibold text-muted-foreground">Changer le statut :</span>
          {[
            { statut: "active", icone: Check, libelle: "Réactiver" },
            { statut: "paused", icone: Pause, libelle: "Mettre en pause" },
            { statut: "bouncing", icone: Ban, libelle: "Marquer en rebond" },
            { statut: "unsubscribed", icone: X, libelle: "Marquer désinscrit" },
          ].map(({ statut, icone: Icone, libelle }) => (
            <Button
              key={statut}
              size="sm"
              variant={abonne.status === statut ? "secondary" : "outline"}
              disabled={abonne.status === statut || statutMutation.isPending}
              onClick={() => {
                setNouveauStatut(statut)
                setMotif("")
                setDialogStatutOuvert(true)
              }}
            >
              <Icone aria-hidden /> {libelle}
            </Button>
          ))}
        </div>
      )}

      {/* ── Dialogs ── */}

      {/* Édition administrative */}
      {editionOuverte && (
        <DialogEditionAbonne
          abonne={abonne}
          onFermer={() => setEditionOuverte(false)}
        />
      )}

      {/* Confirmation changement de statut (motif pour désinscription) */}
      <Dialog open={dialogStatutOuvert} onOpenChange={setDialogStatutOuvert}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {nouveauStatut === "unsubscribed" ? "Marquer désinscrit" : "Confirmer le changement de statut"}
            </DialogTitle>
            <DialogDescription>
              {LIBELLE_STATUT[nouveauStatut]} pour « {abonne.email} ».
              {nouveauStatut === "unsubscribed" && " Un motif peut être enregistré (recommandé pour le support)."}
            </DialogDescription>
          </DialogHeader>
          {nouveauStatut === "unsubscribed" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="motif-desinscription">Motif (optionnel, 500 max)</Label>
              <Textarea
                id="motif-desinscription"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Ex. demande par email du 05/09…"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogStatutOuvert(false)}>Annuler</Button>
            <Button
              size="sm"
              onClick={() => {
                statutMutation.mutate(
                  { subscriberId: abonne.id, status: nouveauStatut, raison: motif.trim() || undefined },
                  {
                    onSuccess: () => {
                      notify("Statut mis à jour", "success")
                      setDialogStatutOuvert(false)
                    },
                    onError: (err) => notify(messageErreurAbonne(err) || "Action impossible", "error"),
                  }
                )
              }}
              disabled={statutMutation.isPending}
            >
              {statutMutation.isPending ? "…" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation anonymisation RGPD — libellé explicite (doc v3 §8) */}
      <Dialog open={anonymOuvert} onOpenChange={setAnonymOuvert}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Anonymiser cet abonné ?</DialogTitle>
            <DialogDescription>
              Conformément au RGPD, « {abonne.email} » sera <strong>anonymisé</strong> :
              email remplacé par une valeur technique, nom, ville et notes internes effacés,
              statut « Supprimé ». L'historique d'envois reste conservé pour la cohérence des
              statistiques. Cette action est définitive.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setAnonymOuvert(false)}>Annuler</Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                anonymiserMutation.mutate(abonne.id, {
                  onSuccess: () => {
                    notify("Abonné anonymisé — historique conservé", "success")
                    setAnonymOuvert(false)
                    navigate("/admin/utilisateurs")
                  },
                  onError: (err) => notify(messageErreurAbonne(err) || "Anonymisation impossible", "error"),
                })
              }}
              disabled={anonymiserMutation.isPending}
            >
              {anonymiserMutation.isPending ? "Anonymisation…" : "Anonymiser définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ─── Bandeau de compteurs ──────────────────────────────────────────── */

const BandeauCompteurs = ({ abonneId, filiereParId, subscribedAt }) => {
  // sends + matching partagent le cache avec les onglets : zéro requête
  // supplémentaire quand ils sont déjà consultés.
  const { data: envois, isLoading: envoisChargement } = useAdminSubscriberSendsQuery(abonneId, { limit: 100 })
  const { data: matching, isLoading: matchingChargement } = useCompteOffresActivesFiliere(abonneId)

  // Ancienneté : Date.now() figée au montage (initialiseur paresseux —
  // pas d'impureté pendant le rendu, la valeur ne bouge pas au refetch).
  const [maintenant] = useState(() => Date.now())
  const ancienneteTexte = useMemo(() => {
    if (!subscribedAt) return "—"
    const jours = Math.max(0, Math.floor((maintenant - new Date(subscribedAt).getTime()) / 86400000))
    if (jours < 31) return `${jours} j`
    if (jours < 365) return `${Math.round(jours / 30)} mois`
    return `${(jours / 365).toFixed(jours % 365 < 60 ? 0 : 1)} an(s)`
  }, [subscribedAt, maintenant])

  if (envoisChargement) {
    return (
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    )
  }

  const digests = envois ?? []
  const digestsRecus = digests.filter((e) => e.status === "sent").length
  const offresRecues = digests.reduce((somme, e) => somme + (e.offer_count ?? 0), 0)
  const reussis = digestsRecus
  const echecs = digests.filter((e) => e.status === "failed").length
  const tauxSucces = reussis + echecs > 0 ? Math.round((reussis / (reussis + echecs)) * 100) : null
  const sansOffre = digests.filter((e) => e.status === "skipped_empty").length

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <CarteCompteur
        label="Digests reçus"
        valeur={digestsRecus}
      />
      <CarteCompteur
        label="Offres reçues"
        valeur={offresRecues}
      />
      <CarteCompteur
        label="Taux de succès"
        texte={tauxSucces === null ? "—" : `${tauxSucces} %`}
        valeur={tauxSucces ?? 0}
      />
      <CarteCompteur
        label="Offres actives (ses filières)"
        valeur={matchingChargement ? undefined : (matching?.total ?? 0)}
        chargement={matchingChargement}
      />
      {/* Ancienneté remplace le taux si pas de digests ? Non : les 4
          ci-dessus + l'ancienneté en sous-titre des compteurs. */}
      <p className="col-span-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground xl:col-span-4">
        <span>Ancienneté : <strong className="text-foreground">{ancienneteTexte}</strong></span>
        {sansOffre > 0 && (
          <span>Digests sans offre : <strong className="text-foreground">{sansOffre}</strong></span>
        )}
        {matching?.by_filiere?.length > 0 && (
          <span>
            Par filière :{" "}
            {matching.by_filiere
              .map((f) => `${filiereParId.get(f.filiere_id)?.label ?? "—"} (${f.active_offers_count})`)
              .join(" · ")}
          </span>
        )}
      </p>
    </div>
  )
}

/* ─── Onglet Statistiques (donut paliers + timeline) ────────────────── */

const StatistiquesAbonne = ({ abonneId }) => {
  const { data: envois, isLoading, isError, refetch } = useAdminSubscriberSendsQuery(abonneId, { limit: 100 })

  // Donut : agrégation de TOUS les match_kind reçus.
  const donneesPaliers = useMemo(() => {
    const compteurs = {}
    for (const envoi of envois ?? []) {
      for (const lien of envoi.offer_links ?? []) {
        const kind = lien.match_kind ?? "primary"
        compteurs[kind] = (compteurs[kind] ?? 0) + 1
      }
    }
    return Object.entries(compteurs).map(([kind, total]) => ({
      name: KIND_MATCH[kind]?.libelle ?? kind,
      value: total,
      couleur: KIND_MATCH[kind]?.couleur ?? "#94a3b8",
    }))
  }, [envois])

  // Timeline : offres par digest (barres) dans l'ordre chronologique.
  const donneesTimeline = useMemo(
    () =>
      [...(envois ?? [])]
        .sort((a, b) => String(a.digest_date).localeCompare(String(b.digest_date)))
        .map((envoi) => ({
          day: envoi.digest_date,
          offres: envoi.offer_count ?? 0,
          statut: envoi.status,
        })),
    [envois]
  )

  if (isError) return <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques." />
  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />

  const jourCourt = (iso) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Donut paliers de matching */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
          Paliers de matching reçus (tous digests)
        </h3>
        {donneesPaliers.length ? (
          <>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donneesPaliers} dataKey="value" nameKey="name"
                    innerRadius="55%" outerRadius="80%" paddingAngle={2} isAnimationActive={false}
                  >
                    {donneesPaliers.map((entree, i) => (
                      <Cell key={i} fill={entree.couleur} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Un abonné alimenté surtout en « Même ville (T5) » reçoit des offres hors sa filière —
              pensez à vérifier ses abonnements.
            </p>
          </>
        ) : (
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon" />
              <EmptyTitle>Aucune offre reçue</EmptyTitle>
              <EmptyDescription>
                Le donut apparaîtra dès qu'un digest contenant des offres sera envoyé.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>

      {/* Timeline des envois */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
          Offres reçues par digest
        </h3>
        {donneesTimeline.length ? (
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={donneesTimeline} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="day" tickFormatter={jourCourt} fontSize={10} tickLine={false} />
                <YAxis allowDecimals={false} fontSize={10} tickLine={false} />
                <Tooltip
                  labelFormatter={(d) => jourCourt(d)}
                  formatter={(valeur, nom, entry) => [
                    `${valeur} offre(s) — ${STATUT_DIGEST[entry?.payload?.statut]?.libelle ?? entry?.payload?.statut}`,
                    "Reçues",
                  ]}
                />
                <Bar dataKey="offres" name="Offres" fill="#2563eb" isAnimationActive={false} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon" />
              <EmptyTitle>Aucun envoi</EmptyTitle>
              <EmptyDescription>La timeline apparaîtra dès le premier digest.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  )
}

/* ─── Sous-composants existants ────────────────────────────────────── */

const Ligne = ({ label, children }) => (
  <div className="flex items-center justify-between gap-2 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="truncate font-medium">{children}</span>
  </div>
)

/** Historique des envois (digests) — avec palier de matching par offre. */
const HistoriqueEnvois = ({ abonneId }) => {
  const { data: envois, isLoading, isError, refetch } = useAdminSubscriberSendsQuery(abonneId, { limit: 50 })

  if (isError) return <SectionErreur onRetry={refetch} message="Impossible de charger l'historique d'envois." />
  if (isLoading) return <Skeleton className="h-48 w-full rounded-xl" />

  if (!envois?.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Aucun envoi pour cet abonné.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Sujet</TableHead>
            <TableHead className="text-center">Offres</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="hidden md:table-cell">Paliers de matching</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {envois.map((envoi) => {
            const statut = STATUT_DIGEST[envoi.status] ?? { libelle: envoi.status, variante: "outline" }
            const kinds = [...new Set((envoi.offer_links ?? []).map((o) => o.match_kind))]
            return (
              <TableRow key={envoi.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                  {dateHeureFr(envoi.sent_at ?? envoi.scheduled_for)}
                </TableCell>
                <TableCell className="max-w-56 truncate" title={envoi.subject ?? ""}>
                  {envoi.template_version === "manual" && (
                    <Mail className="mr-1 inline size-3 text-primary" aria-label="Envoi personnalisé" />
                  )}
                  {envoi.subject ?? "—"}
                </TableCell>
                <TableCell className="text-center tabular-nums">{envoi.offer_count}</TableCell>
                <TableCell>
                  <Badge variant={statut.variante}>{statut.libelle}</Badge>
                  {envoi.skipped_reason && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground" title={envoi.skipped_reason}>
                      {envoi.skipped_reason}
                    </p>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {kinds.map((kind) => {
                      const info = KIND_MATCH[kind] ?? { libelle: kind, ton: "outline" }
                      return (
                        <Badge key={kind} variant={info.ton} className="text-[10px]">
                          {info.libelle}
                        </Badge>
                      )
                    })}
                    {!kinds.length && <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/** Emails transactionnels reçus par l'abonné (route page 16 filtrée). */
const EmailsTransactionnels = ({ abonneId }) => {
  const { data: emails, isLoading, isError, refetch } = useAdminAbonneEmailsTx(abonneId)

  if (isError) return <SectionErreur onRetry={refetch} message="Impossible de charger les emails transactionnels." />
  if (isLoading) return <Skeleton className="h-48 w-full rounded-xl" />

  if (!emails?.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Aucun email transactionnel pour cet abonné.
      </div>
    )
  }

  const VARIANTE_TX = {
    sent: "secondary",
    failed: "destructive",
    queued: "outline",
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Motif</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="hidden md:table-cell">Tentatives</TableHead>
            <TableHead className="hidden lg:table-cell">Erreur</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {emails.map((email) => (
            <TableRow key={email.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                {dateHeureFr(email.created_at)}
              </TableCell>
              <TableCell className="text-sm">{PURPOSE_TX[email.purpose] ?? email.purpose}</TableCell>
              <TableCell>
                <Badge variant={VARIANTE_TX[email.status] ?? "outline"}>{email.status}</Badge>
              </TableCell>
              <TableCell className="hidden text-center tabular-nums md:table-cell">{email.attempts}</TableCell>
              <TableCell className="hidden max-w-48 truncate text-xs text-muted-foreground lg:table-cell" title={email.last_error ?? ""}>
                {email.last_error ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Dialog d'édition administrative (nom, ville, notes, conseils). */
const DialogEditionAbonne = ({ abonne, onFermer }) => {
  const notify = useNotify()
  const modifierMutation = useModifierAbonne()

  const [valeurs, setValeurs] = useState(() => ({
    full_name: abonne.full_name ?? "",
    city: abonne.city ?? "",
    admin_notes: abonne.admin_notes ?? "",
    wants_career_tips: abonne.wants_career_tips,
  }))

  const set = (champ) => (v) => setValeurs((prev) => ({ ...prev, [champ]: v }))

  const soumettre = async (e) => {
    e.preventDefault()
    try {
      await modifierMutation.mutateAsync({
        subscriberId: abonne.id,
        data: {
          full_name: valeurs.full_name.trim() || null,
          city: valeurs.city.trim() || null,
          admin_notes: valeurs.admin_notes.trim() || null,
          wants_career_tips: valeurs.wants_career_tips,
        },
      })
      notify("Fiche mise à jour", "success")
      onFermer()
    } catch (err) {
      notify(messageErreurAbonne(err) || "Enregistrement impossible", "error")
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onFermer()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier la fiche administrative</DialogTitle>
          <DialogDescription>
            {abonne.email} — les filières et contrats restent sous le contrôle du candidat.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={soumettre} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="abo-nom">Nom complet</Label>
            <Input id="abo-nom" value={valeurs.full_name} onChange={(e) => set("full_name")(e.target.value)} maxLength={180} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="abo-ville">Ville</Label>
            <Input id="abo-ville" value={valeurs.city} onChange={(e) => set("city")(e.target.value)} maxLength={120} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="abo-notes">Notes internes</Label>
            <Textarea
              id="abo-notes"
              rows={3}
              value={valeurs.admin_notes}
              onChange={(e) => set("admin_notes")(e.target.value)}
              placeholder="Contexte de support, échanges…"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex flex-col">
              <Label htmlFor="abo-conseils" className="text-xs">Conseils carrière</Label>
              <span className="text-[10px] text-muted-foreground">Inclut les conseils dans le digest.</span>
            </div>
            <Switch id="abo-conseils" checked={valeurs.wants_career_tips} onCheckedChange={set("wants_career_tips")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onFermer}>Annuler</Button>
            <Button type="submit" size="sm" disabled={modifierMutation.isPending}>
              {modifierMutation.isPending ? <SpinnerMini /> : <Save aria-hidden />}
              {modifierMutation.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const SpinnerMini = () => (
  <span className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
)

export default DetailAbonne
