import { useMemo } from "react"
import { motion } from "framer-motion"
import { BookOpen, FileText, User } from "lucide-react"
import {
  useAdminSubscriberDetailQuery,
  useCompteOffresActivesFiliere,
} from "@/features/admin-abonnes.tools"
import { useReferentialsQuery } from "@/lib/referentiels-query"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import Ligne from "../components/Ligne"
import Bloc, { VARIANTS_CONTENEUR } from "@/components/admin/Bloc"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import {
  SectionErreur,
  SectionVide,
  TransitionEtat,
} from "@/components/admin/EtatsSection"
import BoutonCopie from "../components/BoutonCopie"

/* ─────────────────────────────────────────────────────────────────────
Onglet Profil — Détail abonné
Améliorations :
- gestion loading / error / vide
- skeleton fidèle aux 3 cartes
- responsive mobile
───────────────────────────────────────────────────────────────────── */

const SkeletonCarteIdentite = () => (
  <SectionCardAdmin
    title="Identité"
    description="Les informations personnelles de l'abonné."
    icon={User}
    contentClassName="pt-0 sm:pt-0"
  >
    <Bloc className="flex flex-col gap-3">
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
    </Bloc>
  </SectionCardAdmin>
)

const SkeletonCarteAbonnements = () => (
  <SectionCardAdmin
    title="Abonnements"
    description="Les filières et contrats actifs de l'abonné."
    icon={BookOpen}
    badge={<Skeleton className="h-5 w-12 rounded-full" />}
    contentClassName="pt-0 sm:pt-0"
  >
    <Bloc className="flex flex-col gap-3">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-5 w-8 rounded-full" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}

      <Skeleton className="mt-2 h-3 w-40" />

      <div className="flex flex-wrap gap-1.5">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-5 w-16 rounded-full" />
        ))}
      </div>
    </Bloc>
  </SectionCardAdmin>
)

const SkeletonCarteNotes = () => (
  <SectionCardAdmin
    title="Notes internes"
    description="Notes internes de l'abonné."
    icon={FileText}
    className="md:col-span-2"
    contentClassName="pt-0 sm:pt-0"
  >
    <Bloc className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
    </Bloc>
  </SectionCardAdmin>
)

const OngletProfil = ({ id }) => {
  const {
    data: abonne,
    isLoading,
    isError,
    refetch,
  } = useAdminSubscriberDetailQuery(id)

  const { data: matching } = useCompteOffresActivesFiliere(id)
  const { data: referentiels } = useReferentialsQuery()

  const filiereParId = useMemo(
    () => new Map((referentiels?.filieres ?? []).map((f) => [f.id, f])),
    [referentiels]
  )

  const contratParId = useMemo(
    () => new Map((referentiels?.contrats ?? []).map((c) => [c.id, c])),
    [referentiels]
  )

  const filieres = abonne?.filiere_links ?? []
  const contrats = abonne?.contract_preferences ?? []

  const etat = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !abonne
        ? "vide"
        : "donnees"

  return (
    <TransitionEtat etat={`${id}-${etat}`}>
      {isError ? (
        <SectionErreur
          onRetry={refetch}
          message="Impossible de charger le profil de l'abonné."
        />
      ) : isLoading ? (
        <div
          className="grid gap-4 md:grid-cols-2"
          aria-busy="true"
        >
          <SkeletonCarteIdentite />
          <SkeletonCarteAbonnements />
          <SkeletonCarteNotes />
        </div>
      ) : !abonne ? (
        <SectionVide message="Abonné introuvable." />
      ) : (
        <motion.div
          variants={VARIANTS_CONTENEUR}
          initial="cache"
          animate="visible"
          className="grid gap-4 md:grid-cols-2"
        >
          {/* Carte identité — email copiable */}
          <SectionCardAdmin
            title="Identité"
            description="Les informations personnelles de l'abonné."
            icon={User}
            contentClassName="pt-0 sm:pt-0"
          >
            <Bloc className="flex flex-col gap-3">
              <Ligne label="Nom complet">
                {abonne.full_name ?? "—"}
              </Ligne>

              <Ligne label="Email">
                <span className="inline-flex items-center gap-1">
                  {abonne.email}
                  <BoutonCopie
                    texte={abonne.email}
                    libelle="Copier l'adresse email"
                  />
                </span>
              </Ligne>

              <Ligne label="Ville">{abonne.city || "—"}</Ligne>
              <Ligne label="Fuseau horaire">
                {abonne.timezone ?? "—"}
              </Ligne>
              <Ligne label="Source d'inscription">
                {abonne.source || "—"}
              </Ligne>

              <Ligne label="Conseils carrière">
                <Switch
                  checked={!!abonne.wants_career_tips}
                  disabled
                  aria-label="Préférence conseils carrière (modifiable via Modifier)"
                />
              </Ligne>

              {abonne.unsubscribe_reason && (
                <Ligne label="Motif de désinscription">
                  {abonne.unsubscribe_reason}
                </Ligne>
              )}
            </Bloc>
          </SectionCardAdmin>

          {/* Carte filières + contrats (lecture seule) */}
          <SectionCardAdmin
            title="Abonnements"
            description="Les filières et contrats actifs de l'abonné."
            icon={BookOpen}
            badge={
              <Badge variant="outline" className="tabular-nums">
                {filieres.length}/3
              </Badge>
            }
            contentClassName="pt-0 sm:pt-0"
          >
            <Bloc className="flex flex-col gap-3">
              {filieres.length ? (
                <ul className="flex flex-col gap-1.5">
                  {filieres.map((lien) => {
                    const filiere = filiereParId.get(lien.filiere_id)

                    const label =
                      lien.filiere_label ??
                      filiere?.label ??
                      `Filière ${String(
                        lien.filiere_id ?? lien.filiere_code ?? ""
                      ).slice(0, 8)}…`

                    const count = matching?.by_filiere?.find(
                      (l) =>
                        l.filiere_id === lien.filiere_id ||
                        l.filiere_code === lien.filiere_code
                    )?.active_offers_count

                    return (
                      <li
                        key={lien.id ?? `${lien.filiere_id}-${lien.priority}`}
                        className="flex flex-wrap items-center gap-2 text-sm"
                      >
                        <Badge variant="outline" className="tabular-nums">
                          #{lien.priority}
                        </Badge>

                        {label}

                        {count != null && (
                          <span className="font-bold text-muted-foreground">
                            ({count} offre{count === 1 ? "" : "s"})
                          </span>
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
                Contrats préférés ({contrats.length})
              </h3>

              <div className="flex flex-wrap gap-1.5">
                {contrats.map((pref) => (
                  <Badge key={pref.id} variant="secondary">
                    {contratParId.get(pref.contract_type_id)?.label ??
                      String(pref.contract_type_id ?? "").slice(0, 8)}
                  </Badge>
                ))}

                {!contrats.length && (
                  <span className="text-xs text-muted-foreground">
                    Aucune préférence.
                  </span>
                )}
              </div>
            </Bloc>
          </SectionCardAdmin>

          {/* Notes internes */}
          <SectionCardAdmin
            title="Notes internes"
            description="Notes internes de l'abonné."
            icon={FileText}
            className="md:col-span-2"
            contentClassName="pt-0 sm:pt-0"
          >
            <Bloc>
              {abonne.admin_notes ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {abonne.admin_notes}
                </p>
              ) : (
                <SectionVide message="Aucune note interne pour le moment." />
              )}
            </Bloc>
          </SectionCardAdmin>
        </motion.div>
      )}
    </TransitionEtat>
  )
}

export default OngletProfil