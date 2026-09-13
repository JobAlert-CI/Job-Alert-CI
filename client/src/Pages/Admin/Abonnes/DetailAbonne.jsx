import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, Ban, Check, Copy, FileText, Mail, Pause, Pencil, Save,
  Send, ShieldAlert, User2, X,
} from "lucide-react"
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, XAxis, YAxis,
} from "recharts"
import { cn } from "cn"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { SectionErreur } from "./components/EtatsSection"
import HeroAdmin from "@/components/admin/HeroAdmin"
import BtnAction from "@/components/admin/BtnAction"

/* ─────────────────────────────────────────────────────────────────────
   Page Détail utilisateur — /admin/utilisateurs/:id (doc v3 §8).
   Refonte :
   • Onglets (Profil / Statistiques / Envois / Emails transactionnels)
     avec fondu enchaîné AnimatePresence mode="wait" ;
   • Copie rapide de l'email (en-tête + carte Identité) ;
   • Historique des envois : les paliers de REPLI (T2-T5) deviennent
     de simples points colorés avec infobulle — seuls primary/secondary
     gardent un badge plein (réduction du bruit visuel) ;
   • Skeletons fidèles : fausses lignes de table, anneau pour le donut.
   Audit 4 : C.4 notes après coup, C.6 filtre niveau SQL-side, H.1
   palier global du digest distinct des match_kind par offre.
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

// match_kind du modèle EmailDigestOffer → libellé + ton + couleur.
// `repli` : true pour les fallbacks (T2-T5) → rendu en simple point.
const KIND_MATCH = {
  primary: { libelle: "Filière principale", ton: "default", couleur: "#2563eb", repli: false },
  secondary: { libelle: "Filière secondaire (T1)", ton: "secondary", couleur: "#10b981", repli: false },
  fallback_contract: { libelle: "Même contrat (T2)", ton: "secondary", couleur: "#f59e0b", repli: true },
  fallback_freshness: { libelle: "Offre récente (T3)", ton: "secondary", couleur: "#a855f7", repli: true },
  fallback_experience: { libelle: "Profil proche (T4)", ton: "outline", couleur: "#ec4899", repli: true },
  fallback_city: { libelle: "Même ville (T5)", ton: "outline", couleur: "#64748b", repli: true },
}

// Audit 4, H.1 : palier GLOBAL du digest (EmailDigestRead.match_tier).
const TIER_DIGEST = {
  T0: { libelle: "T0 — Filière exacte", ton: "default", titre: "Digest rempli sur les filières exactes de l'abonné" },
  T1: { libelle: "T1 — Filière élargie", ton: "secondary", titre: "Digest rempli via les filières secondaires (T1)" },
  T2: { libelle: "T2 — Fallback contrat", ton: "secondary", titre: "Digest rempli via le fallback contrat (T2)" },
  T3: { libelle: "T3 — Fallback fraîcheur", ton: "secondary", titre: "Digest rempli via le fallback fraîcheur (T3)" },
  T4: { libelle: "T4 — Fallback expérience", ton: "outline", titre: "Digest rempli via le fallback expérience (T4)" },
  T5: { libelle: "T5 — Fallback ville", ton: "outline", titre: "Digest rempli via le fallback ville (T5)" },
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

const ONGLETS = [
  { valeur: "profil", libelle: "Profil" },
  { valeur: "stats", libelle: "Statistiques" },
  { valeur: "envois", libelle: "Envois" },
  { valeur: "emails", libelle: "Emails transactionnels" },
]

const dateHeureFr = (iso) =>
  iso
    ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—"

/* Bouton copie presse-papiers avec feedback « Copié ! ». */
const BoutonCopie = ({ texte, libelle }) => {
  const [copie, setCopie] = useState(false)
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte)
      setCopie(true)
      window.setTimeout(() => setCopie(false), 1600)
    } catch {
      /* Presse-papiers indisponible : on ignore. */
    }
  }
  return (
    <button
      type="button"
      onClick={copier}
      aria-label={libelle ?? `Copier ${texte}`}
      title={copie ? "Copié !" : "Copier"}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copie ? <Check className="size-3 text-emerald-600" aria-hidden /> : <Copy className="size-3" aria-hidden />}
    </button>
  )
}

/* ─── Skeletons fidèles ─── */
const SkeletonTableau = ({ lignes = 5, colonnes = 6 }) => (
  <div className="flex flex-col gap-3 rounded-xl border border-border p-4" aria-hidden="true">
    {[...Array(lignes)].map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        {[...Array(colonnes)].map((_, j) => (
          <Skeleton key={j} className={cn("h-4", j === 0 ? "w-24" : "flex-1")} />
        ))}
      </div>
    ))}
  </div>
)

const SkeletonDonut = () => (
  <div className="flex items-center justify-center py-6" aria-hidden="true">
    <div className="relative size-40">
      <Skeleton className="size-40 rounded-full" />
      <div className="absolute inset-8 rounded-full bg-card" />
    </div>
  </div>
)

const DetailAbonne = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const notify = useNotify()
  const { data: abonne, isLoading, isError, refetch } = useAdminSubscriberDetailQuery(id)
  const { data: matching } = useCompteOffresActivesFiliere(id)
  const { data: referentiels } = useReferentialsQuery()

  const [onglet, setOnglet] = useState("profil")
  const [editionOuverte, setEditionOuverte] = useState(false)
  const [dialogStatutOuvert, setDialogStatutOuvert] = useState(false)
  const [nouveauStatut, setNouveauStatut] = useState("")
  const [motif, setMotif] = useState("")
  const [anonymOuvert, setAnonymOuvert] = useState(false)

  const statutMutation = useChangerStatutAbonne()
  const anonymiserMutation = useAnonymiserAbonne()

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
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <SkeletonTableau lignes={6} colonnes={5} />
      </div>
    )
  }

  const estAnonymise = abonne.status === "deleted"

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div>
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/utilisateurs")} aria-label="Retour à la liste">
          <ArrowLeft aria-hidden />
        </Button>
      </div>

      {/* ─── En-tête : email copiable ─── */}
      <HeroAdmin
        title={abonne.full_name || abonne.email}
        titleBdge="Abonné"
        icon={User2}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1">
              {abonne.email}
              <BoutonCopie texte={abonne.email} libelle="Copier l'adresse email" />
            </span>
            <span>
              · inscrit le <span className="font-bold">{dateHeureFr(abonne.subscribed_at).split(" à ")[0]}</span>
            </span>
            {abonne.source && <span>· via {abonne.source}</span>}
          </span>
        }
        badges={
          <Badge variant={VARIANTE_STATUT[abonne.status] ?? "outline"} className="text-xs font-bold" data-testid="statut-abonne">
            {LIBELLE_STATUT[abonne.status] ?? abonne.status}
          </Badge>
        }
      >
        {!estAnonymise && (
          <div className="flex flex-wrap items-center gap-1.5">
            <BtnAction size="xs" variant="outline" onClick={() => navigate(`/admin/utilisateurs/${abonne.id}/envoyer`)}>
              <Send aria-hidden className="size-4" /> Envoyer une sélection
            </BtnAction>
            <BtnAction size="xs" variant="outline" onClick={() => setEditionOuverte(true)}>
              <Pencil aria-hidden className="size-4" /> Modifier
            </BtnAction>
            <BtnAction size="xs" variant="danger" onClick={() => setAnonymOuvert(true)}>
              <ShieldAlert aria-hidden className="size-4" /> Anonymiser…
            </BtnAction>
          </div>
        )}
      </HeroAdmin>

      {/* Bandeau de compteurs */}
      <BandeauCompteurs abonneId={abonne.id} subscribedAt={abonne.subscribed_at} />

      {estAnonymise && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Cet abonné a été anonymisé (RGPD) : ses données personnelles ont été effacées.
          L'historique d'envois est conservé pour la cohérence des statistiques.
        </div>
      )}

      {/* ─── Onglets avec fondu enchaîné ─── */}
      <Tabs value={onglet} onValueChange={setOnglet} className="w-full">
        <TabsList
          className={cn(
            "flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border border-border bg-muted/20 p-1",
            "scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          )}
        >
          {ONGLETS.map(({ valeur, libelle }) => (
            <TabsTrigger
              key={valeur}
              value={valeur}
              className={cn(
                "whitespace-nowrap rounded-md px-4 py-2 text-xs font-semibold transition-colors",
                onglet === valeur
                  ? "bg-brand-orange text-brand-navy shadow-soft"
                  : "text-muted-foreground hover:bg-card hover:text-foreground"
              )}
            >
              {libelle}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={onglet}
          role="tabpanel"
          aria-label={ONGLETS.find((o) => o.valeur === onglet)?.libelle}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {onglet === "profil" && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Carte identité — email copiable */}
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Identité</h3>
                <Ligne label="Nom complet">{abonne.full_name || "—"}</Ligne>
                <Ligne label="Email">
                  <span className="inline-flex items-center gap-1">
                    {abonne.email}
                    <BoutonCopie texte={abonne.email} libelle="Copier l'adresse email" />
                  </span>
                </Ligne>
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

              {/* Carte filières + contrats (lecture seule) */}
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Abonnements ({abonne.filiere_links.length}/3)
                </h3>
                {abonne.filiere_links.length ? (
                  <ul className="flex flex-col gap-1.5">
                    {abonne.filiere_links.map((lien) => {
                      const filiere = filiereParId.get(lien.filiere_id)
                      const count = matching?.by_filiere?.find((l) => l.filiere_id === lien.filiere_id)?.active_offers_count
                      return (
                        <li key={lien.id} className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="tabular-nums">#{lien.priority}</Badge>
                          {filiere?.label ?? `Filière ${lien.filiere_id.slice(0, 8)}…`}
                          {count != null && (
                            <span className="font-bold text-muted-foreground">({count} offre{count === 1 ? "" : "s"})</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Aucune filière — cet abonné ne recevra pas d'offres ciblées.
                  </p>
                )}
                <h3 className="mt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
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
              </div>

              {/* Notes internes */}
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 md:col-span-2">
                <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  <FileText className="size-3.5" aria-hidden /> Notes internes
                </h3>
                {abonne.admin_notes ? (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{abonne.admin_notes}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Aucune note interne.</p>
                )}
              </div>
            </div>
          )}

          {onglet === "stats" && <StatistiquesAbonne abonneId={abonne.id} />}
          {onglet === "envois" && <HistoriqueEnvois abonneId={abonne.id} />}
          {onglet === "emails" && <EmailsTransactionnels abonneId={abonne.id} />}
        </motion.div>
      </AnimatePresence>

      {/* Changement de statut */}
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

      {/* Édition administrative */}
      {editionOuverte && <DialogEditionAbonne abonne={abonne} onFermer={() => setEditionOuverte(false)} />}

      {/* Confirmation changement de statut */}
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

      {/* Confirmation anonymisation RGPD */}
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

/* ─── Bandeau de compteurs ─── */
const BandeauCompteurs = ({ abonneId, subscribedAt }) => {
  const { data: envois, isLoading: envoisChargement } = useAdminSubscriberSendsQuery(abonneId, { limit: 100 })
  const { data: matching, isLoading: matchingChargement } = useCompteOffresActivesFiliere(abonneId)
  const [maintenant] = useState(() => Date.now())

  const anciennete = useMemo(() => {
    if (!subscribedAt) return "—"
    const jours = Math.max(0, Math.floor((maintenant - new Date(subscribedAt).getTime()) / 86400000))
    if (jours < 31) return [jours, "jours"]
    if (jours < 365) return [Math.round(jours / 30), "mois"]
    return [(jours / 365).toFixed(jours % 365 < 60 ? 0 : 1), "ans"]
  }, [subscribedAt, maintenant])

  if (envoisChargement) {
    return (
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-busy="true">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    )
  }

  const digests = envois ?? []
  const digestsRecus = digests.filter((e) => e.status === "sent").length
  const offresRecues = digests.reduce((somme, e) => somme + (e.offer_count ?? 0), 0)
  const echecs = digests.filter((e) => e.status === "failed").length
  const tauxSucces = digestsRecus + echecs > 0 ? Math.round((digestsRecus / (digestsRecus + echecs)) * 100) : null
  const sansOffre = digests.filter((e) => e.status === "skipped_empty").length

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <CarteCompteur label="Digests reçus" valeur={digestsRecus} />
      <CarteCompteur label="Offres reçues" valeur={offresRecues} />
      <CarteCompteur label="Taux de succès" valeur={tauxSucces ?? 0} suffixe="%" />
      <CarteCompteur
        label="Offres actives (ses filières)"
        valeur={matchingChargement ? undefined : matching?.total ?? 0}
        chargement={matchingChargement}
      />
      <CarteCompteur label="Ancienneté" valeur={anciennete?.[0]} suffixe={anciennete?.[1]} />
      <CarteCompteur label="Digests sans offre" valeur={sansOffre} />
    </div>
  )
}

/* ─── Onglet Statistiques (donut paliers + timeline) ─── */
const StatistiquesAbonne = ({ abonneId }) => {
  const { data: envois, isLoading, isError, refetch } = useAdminSubscriberSendsQuery(abonneId, { limit: 100 })

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
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
        <div className="rounded-xl border border-border bg-card p-4"><SkeletonDonut /></div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex h-44 items-end gap-2 px-2" aria-hidden="true">
            {[40, 65, 50, 85, 60, 70].map((h, i) => <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${h}%` }} />)}
          </div>
        </div>
      </div>
    )
  }

  const jourCourt = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Donut paliers de matching */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
          Paliers de matching reçus (tous digests)
        </h3>
        {donneesPaliers.length ? (
          <>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donneesPaliers}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {donneesPaliers.map((entree, i) => <Cell key={i} fill={entree.couleur} />)}
                  </Pie>
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
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Aucune offre reçue — le donut apparaîtra dès qu'un digest contenant des offres sera envoyé.
          </div>
        )}
      </div>

      {/* Timeline des envois */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
          Offres reçues par digest
        </h3>
        {donneesTimeline.length ? (
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={donneesTimeline} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="day" tickFormatter={jourCourt} fontSize={10} tickLine={false} />
                <YAxis allowDecimals={false} fontSize={10} tickLine={false} />
                <Bar dataKey="offres" name="Offres" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Aucun envoi — la timeline apparaîtra dès le premier digest.
          </div>
        )}
      </div>
    </div>
  )
}

const Ligne = ({ label, children }) => (
  <div className="flex items-center justify-between gap-2 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="truncate font-medium">{children}</span>
  </div>
)

/** Historique des envois — paliers de REPLI en simples points colorés (tooltip). */
const HistoriqueEnvois = ({ abonneId }) => {
  const { data: envois, isLoading, isError, refetch } = useAdminSubscriberSendsQuery(abonneId, { limit: 50 })

  if (isError) return <SectionErreur onRetry={refetch} message="Impossible de charger l'historique d'envois." />
  if (isLoading) return <SkeletonTableau lignes={6} colonnes={6} />
  if (!envois?.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Aucun envoi pour cet abonné.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border scrollbar-thin">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Date</TableHead>
            <TableHead>Sujet</TableHead>
            <TableHead className="text-center">Offres</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="hidden md:table-cell">Palier global</TableHead>
            <TableHead className="hidden md:table-cell">Paliers de matching</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {envois.map((envoi) => {
            const statut = STATUT_DIGEST[envoi.status] ?? { libelle: envoi.status, variante: "outline" }
            const kinds = [...new Set((envoi.offer_links ?? []).map((o) => o.match_kind))]
            return (
              <TableRow key={envoi.id} className="transition-colors hover:bg-muted/50">
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
                {/* Audit 4, H.1 : tier GLOBAL du digest, distinct des paliers par offre. */}
                <TableCell className="hidden md:table-cell">
                  {envoi.match_tier && Number(envoi.offer_count) > 0 ? (
                    <Badge
                      variant={(TIER_DIGEST[envoi.match_tier] ?? { ton: "outline" }).ton}
                      className="text-[10px]"
                      title={(TIER_DIGEST[envoi.match_tier] ?? { titre: `Palier ${envoi.match_tier}` }).titre}
                    >
                      {(TIER_DIGEST[envoi.match_tier] ?? { libelle: envoi.match_tier }).libelle}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {kinds.map((kind) => {
                      const info = KIND_MATCH[kind] ?? { libelle: kind, ton: "outline", couleur: "#94a3b8", repli: true }
                      // Paliers de repli (T2-T5) : simple point coloré + infobulle.
                      return info.repli ? (
                        <span
                          key={kind}
                          title={info.libelle}
                          aria-label={info.libelle}
                          className="inline-block size-2.5 rounded-full"
                          style={{ backgroundColor: info.couleur }}
                        />
                      ) : (
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
  if (isLoading) return <SkeletonTableau lignes={5} colonnes={5} />
  if (!emails?.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Aucun email transactionnel pour cet abonné.
      </div>
    )
  }

  const VARIANTE_TX = { sent: "secondary", failed: "destructive", queued: "outline" }

  return (
    <div className="overflow-x-auto rounded-xl border border-border [scrollbar-width:thin]">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Date</TableHead>
            <TableHead>Motif</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="hidden md:table-cell">Tentatives</TableHead>
            <TableHead className="hidden lg:table-cell">Erreur</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {emails.map((email) => (
            <TableRow key={email.id} className="transition-colors hover:bg-muted/50">
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