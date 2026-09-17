import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  Ban,
  Check,
  Pause,
  Pencil,
  Send,
  ShieldAlert,
  User2,
  X,
} from "lucide-react"
import { cn } from "cn"
import {
  STATUTS_ABONNE,
  useAdminSubscriberDetailQuery,
  useChangerStatutAbonne,
} from "@/features/admin-abonnes.tools"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SectionErreur } from "./components/EtatsSection"
import { TransitionEtat } from "@/components/admin/EtatsSection"
import HeroAdmin from "@/components/admin/HeroAdmin"
import BtnAction from "@/components/admin/BtnAction"
import Bloc, {
  VARIANTS_PAGE,
  VARIANTS_PANNEAU,
  VARIANTS_SECTION,
} from "@/components/admin/Bloc"
import CompteursDetailAbonne from "./sections/CompteursDetailAbonne"
import OngletProfil from "./onglets/OngletProfil"
import OngletStatistiquesAbonne from "./onglets/OngletStatistiquesAbonne"
import OngletHistoriqueEnvois from "./onglets/OngletHistoriqueEnvois"
import BoutonCopie from "./components/BoutonCopie"
import { dateHeure } from "@/lib/dates"
import OngletEmailsTransactionnels from "./onglets/OngletEmailsTransactionnels"
import DialogEditionAbonne from "@/components/dialog/DialogEditionAbonne"
import DialogConfirmChangeStatusAbonne from "@/components/dialog/DialogConfirmChangeStatusAbonne"
import DialogConfirmAnonymisation from "@/components/dialog/DialogConfirmAnonymisation"

/* ─────────────────────────────────────────────────────────────────────
Page Détail utilisateur — /admin/utilisateurs/:id
Améliorations :
- loading fidèle : hero, compteurs, tabs, contenu profil
- animation de changement d'état via TransitionEtat
- responsive mobile
───────────────────────────────────────────────────────────────────── */

const LIBELLE_STATUT = Object.fromEntries(
  STATUTS_ABONNE.map((s) => [s.valeur, s.libelle])
)

const VARIANTE_STATUT = {
  active: "secondary",
  unsubscribed: "outline",
  bouncing: "destructive",
  paused: "outline",
  pending: "outline",
  deleted: "outline",
}

const ONGLETS = [
  { valeur: "profil", libelle: "Profil" },
  { valeur: "stats", libelle: "Statistiques" },
  { valeur: "envois", libelle: "Envois" },
  { valeur: "emails", libelle: "Emails transactionnels" },
]

const LienRetour = () => (
  <Link
    to="/admin/utilisateurs"
    className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
  >
    <ArrowLeft className="size-4" aria-hidden="true" /> Retour aux abonnés
  </Link>
)

/* ─── Skeletons fidèles ─── */
const SkeletonHeroAbonne = () => (
  <Bloc>
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="size-12 shrink-0 rounded-full" />

        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-6 w-56 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-44 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
    </div>
  </Bloc>
)

const SkeletonCompteurs = () => (
  <Bloc>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  </Bloc>
)

const SkeletonTabs = () => (
  <div className="flex w-full gap-1 overflow-hidden rounded-lg border border-border bg-muted/20 p-1">
    {[...Array(4)].map((_, i) => (
      <Skeleton key={i} className="h-9 flex-1 rounded-md" />
    ))}
  </div>
)

const SkeletonOngletProfil = () => (
  <Bloc>
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-border p-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 flex-1 max-w-44" />
          </div>
        ))}

        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-5 w-10 rounded-full" />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border p-4">
        <Skeleton className="h-5 w-16 rounded-full" />

        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-5 w-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}

        <Skeleton className="h-3 w-40" />

        <div className="flex flex-wrap gap-1.5">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-5 w-16 rounded-full" />
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border p-4 md:col-span-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  </Bloc>
)

const DetailAbonne = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const {
    data: abonne,
    isLoading,
    isError,
    refetch,
  } = useAdminSubscriberDetailQuery(id)

  const [onglet, setOnglet] = useState("profil")
  const [editionOuverte, setEditionOuverte] = useState(false)
  const [dialogStatutOuvert, setDialogStatutOuvert] = useState(false)
  const [nouveauStatut, setNouveauStatut] = useState("")
  const [motif, setMotif] = useState("")
  const [anonymOuvert, setAnonymOuvert] = useState(false)

  const statutMutation = useChangerStatutAbonne()

  const etat = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !abonne
        ? "erreur"
        : "donnees"

  const estAnonymise = abonne?.status === "deleted"

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <motion.div variants={VARIANTS_SECTION}>
        <LienRetour />
      </motion.div>

      <TransitionEtat etat={`${id}-${etat}`}>
        {isError || (!isLoading && !abonne) ? (
          <Bloc>
            <SectionErreur
              onRetry={refetch}
              message="Impossible de charger cet abonné."
            />
          </Bloc>
        ) : isLoading ? (
          <div className="flex flex-col gap-6" aria-busy="true">
            <SkeletonHeroAbonne />
            <SkeletonCompteurs />
            <SkeletonTabs />
            <SkeletonOngletProfil />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* ─── En-tête : email copiable ─── */}
            <HeroAdmin
              title={abonne.full_name || abonne.email}
              titleBdge="Abonné"
              icon={User2}
              description={
                <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    {abonne.email}
                    <BoutonCopie
                      texte={abonne.email}
                      libelle="Copier l'adresse email"
                    />
                  </span>

                  <span>
                    · inscrit le{" "}
                    <span className="font-bold">
                      {dateHeure(abonne.subscribed_at).split(" à ")[0]}
                    </span>
                  </span>

                  {abonne.source && <span>· via {abonne.source}</span>}
                </span>
              }
              badges={
                <Badge
                  variant={VARIANTE_STATUT[abonne.status] ?? "outline"}
                  className="text-xs font-bold"
                  data-testid="statut-abonne"
                >
                  {LIBELLE_STATUT[abonne.status] ?? abonne.status}
                </Badge>
              }
            >
              {!estAnonymise && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <BtnAction
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      navigate(`/admin/utilisateurs/${abonne.id}/envoyer`)
                    }
                  >
                    <Send aria-hidden className="size-4" /> Envoyer une
                    sélection
                  </BtnAction>

                  <BtnAction
                    size="xs"
                    variant="outline"
                    onClick={() => setEditionOuverte(true)}
                  >
                    <Pencil aria-hidden className="size-4" /> Modifier
                  </BtnAction>

                  <BtnAction
                    size="xs"
                    variant="danger"
                    onClick={() => setAnonymOuvert(true)}
                  >
                    <ShieldAlert aria-hidden className="size-4" /> Anonymiser…
                  </BtnAction>
                </div>
              )}
            </HeroAdmin>

            {/* Bandeau de compteurs */}
            <Bloc key="compteurs">
              <CompteursDetailAbonne
                abonneId={abonne.id}
                subscribedAt={abonne.subscribed_at}
              />
            </Bloc>

            {estAnonymise && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                Cet abonné a été anonymisé (RGPD) : ses données personnelles
                ont été effacées. L'historique d'envois est conservé pour la
                cohérence des statistiques.
              </div>
            )}

            {/* ─── Onglets avec fondu enchaîné ─── */}
            <Tabs value={onglet} onValueChange={setOnglet} className="mt-1 w-full">
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
                aria-label={
                  ONGLETS.find((o) => o.valeur === onglet)?.libelle
                }
                variants={VARIANTS_PANNEAU}
                initial="cache"
                animate="visible"
                exit="cache"
                className="mt-4"
              >
                {onglet === "profil" ? (
                  <Bloc>
                    <OngletProfil id={abonne.id} />
                  </Bloc>
                ) : onglet === "stats" ? (
                  <Bloc>
                    <OngletStatistiquesAbonne id={abonne.id} />
                  </Bloc>
                ) : onglet === "envois" ? (
                  <Bloc>
                    <OngletHistoriqueEnvois id={abonne.id} />
                  </Bloc>
                ) : (
                  <Bloc>
                    <OngletEmailsTransactionnels abonneId={abonne.id} />
                  </Bloc>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Changement de statut */}
            {!estAnonymise && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
                <span className="text-xs font-semibold text-muted-foreground">
                  Changer le statut :
                </span>

                {[
                  { statut: "active", icone: Check, libelle: "Réactiver" },
                  { statut: "paused", icone: Pause, libelle: "Mettre en pause" },
                  { statut: "bouncing", icone: Ban, libelle: "Marquer en rebond" },
                  { statut: "unsubscribed", icone: X, libelle: "Marquer désinscrit" },
                ].map(({ statut, icone: Icone, libelle }) => (
                  <BtnAction
                    key={statut}
                    size="xs"
                    variant={abonne.status === statut ? "secondary" : "outline"}
                    disabled={abonne.status === statut || statutMutation.isPending}
                    onClick={() => {
                      setNouveauStatut(statut)
                      setMotif("")
                      setDialogStatutOuvert(true)
                    }}
                  >
                    <Icone aria-hidden /> {libelle}
                  </BtnAction>
                ))}
              </div>
            )}

            {/* Édition administrative */}
            {editionOuverte && (
              <DialogEditionAbonne
                abonne={abonne}
                onFermer={() => setEditionOuverte(false)}
              />
            )}

            {/* Confirmation changement de statut */}
            <DialogConfirmChangeStatusAbonne
              open={dialogStatutOuvert}
              setOpen={setDialogStatutOuvert}
              abonne={abonne}
              nouveauStatut={nouveauStatut}
              motif={motif}
              setMotif={setMotif}
            />

            {/* Confirmation anonymisation RGPD */}
            <DialogConfirmAnonymisation
              open={anonymOuvert}
              setOpen={setAnonymOuvert}
              abonne={abonne}
            />
          </div>
        )}
      </TransitionEtat>
    </motion.div>
  )
}

export default DetailAbonne