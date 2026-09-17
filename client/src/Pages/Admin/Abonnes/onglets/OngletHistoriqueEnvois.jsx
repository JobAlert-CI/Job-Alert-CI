import { memo, useCallback, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Inbox, Mail } from "lucide-react"
import { useAdminSubscriberSendsQuery } from "@/features/admin-abonnes.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import {
  SectionErreur,
  TransitionEtat,
} from "@/components/admin/EtatsSection"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { SectionVide } from "../components/EtatsSection"
import EnteteTriable from "@/components/admin/EnteteTriable"

/* ─────────────────────────────────────────────────────────────────────
Onglet Historique d'envois
Améliorations :
- loading fidèle desktop + mobile
- entêtes triables
- cartes mobile
- animation de changement d'état
───────────────────────────────────────────────────────────────────── */

const KIND_MATCH = {
  primary: {
    libelle: "Filière principale",
    ton: "default",
    couleur: "#2563eb",
    repli: false,
  },
  secondary: {
    libelle: "Filière secondaire (T1)",
    ton: "secondary",
    couleur: "#10b981",
    repli: false,
  },
  fallback_contract: {
    libelle: "Même contrat (T2)",
    ton: "secondary",
    couleur: "#f59e0b",
    repli: true,
  },
  fallback_freshness: {
    libelle: "Offre récente (T3)",
    ton: "secondary",
    couleur: "#a855f7",
    repli: true,
  },
  fallback_experience: {
    libelle: "Profil proche (T4)",
    ton: "outline",
    couleur: "#ec4899",
    repli: true,
  },
  fallback_city: {
    libelle: "Même ville (T5)",
    ton: "outline",
    couleur: "#64748b",
    repli: true,
  },
}

const TIER_DIGEST = {
  T0: {
    libelle: "T0 — Filière exacte",
    ton: "default",
    titre: "Digest rempli sur les filières exactes de l'abonné",
  },
  T1: {
    libelle: "T1 — Filière élargie",
    ton: "secondary",
    titre: "Digest rempli via les filières secondaires (T1)",
  },
  T2: {
    libelle: "T2 — Fallback contrat",
    ton: "secondary",
    titre: "Digest rempli via le fallback contrat (T2)",
  },
  T3: {
    libelle: "T3 — Fallback fraîcheur",
    ton: "secondary",
    titre: "Digest rempli via le fallback fraîcheur (T3)",
  },
  T4: {
    libelle: "T4 — Fallback expérience",
    ton: "outline",
    titre: "Digest rempli via le fallback expérience (T4)",
  },
  T5: {
    libelle: "T5 — Fallback ville",
    ton: "outline",
    titre: "Digest rempli via le fallback ville (T5)",
  },
}

const STATUT_DIGEST = {
  sent: { libelle: "Envoyé", variante: "secondary" },
  failed: { libelle: "Échoué", variante: "destructive" },
  skipped_empty: { libelle: "Sans offre", variante: "outline" },
  queued: { libelle: "En file", variante: "outline" },
  sending: { libelle: "Envoi…", variante: "outline" },
  cancelled: { libelle: "Annulé", variante: "outline" },
}

const RANG_STATUT_DIGEST = {
  sent: 1,
  sending: 2,
  queued: 3,
  failed: 4,
  cancelled: 5,
  skipped_empty: 6,
}

const dateHeureFr = (iso) =>
  iso
    ? new Date(iso).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—"

/* Tri « français » robuste. */
const comparerValeurs = (a, b) => {
  const videA = a === null || a === undefined || a === ""
  const videB = b === null || b === undefined || b === ""

  if (videA && videB) return 0
  if (videA) return 1
  if (videB) return -1

  if (typeof a === "number" && typeof b === "number") return a - b

  return String(a).localeCompare(String(b), "fr", {
    numeric: true,
    sensitivity: "base",
  })
}

const COLONNES = [
  {
    cle: "date",
    libelle: "Date",
    directionInitiale: "desc",
    triValeur: (e) => e.sent_at ?? e.scheduled_for ?? "",
  },
  {
    cle: "sujet",
    libelle: "Sujet",
    directionInitiale: "asc",
    triValeur: (e) => (e.subject ?? "").toLowerCase(),
  },
  {
    cle: "offres",
    libelle: "Offres",
    directionInitiale: "desc",
    className: "text-center",
    triValeur: (e) => e.offer_count ?? 0,
  },
  {
    cle: "statut",
    libelle: "Statut",
    directionInitiale: "asc",
    triValeur: (e) => RANG_STATUT_DIGEST[e.status] ?? 0,
  },
  {
    cle: "palier",
    libelle: "Palier global",
    directionInitiale: "asc",
    className: "hidden md:table-cell",
    triValeur: (e) => e.match_tier ?? "",
  },
]

const OPTIONS_TRI_MOBILE = COLONNES.map((colonne) => ({
  valeur: colonne.cle,
  libelle: colonne.libelle,
}))

/* ─── Skeleton desktop fidèle ─── */
const LigneSkeletonEnvoi = () => (
  <TableRow className="hover:bg-transparent" aria-hidden="true">
    <TableCell>
      <Skeleton className="h-3.5 w-28" />
    </TableCell>

    <TableCell>
      <Skeleton className="h-3.5 w-56" />
    </TableCell>

    <TableCell className="text-center">
      <Skeleton className="mx-auto h-3.5 w-8" />
    </TableCell>

    <TableCell>
      <Skeleton className="h-5 w-20 rounded-full" />
    </TableCell>

    <TableCell className="hidden md:table-cell">
      <Skeleton className="h-5 w-24 rounded-full" />
    </TableCell>

    <TableCell className="hidden md:table-cell">
      <div className="flex flex-wrap items-center gap-1.5">
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="size-2.5 rounded-full" />
        <Skeleton className="size-2.5 rounded-full" />
      </div>
    </TableCell>
  </TableRow>
)

/* ─── Skeleton mobile fidèle ─── */
const CarteSkeletonEnvoiMobile = () => (
  <div className="p-4" aria-hidden="true">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-4 w-[80%]" />
      </div>

      <Skeleton className="h-5 w-20 rounded-full" />
    </div>

    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-5 w-24 rounded-full" />
    </div>

    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <Skeleton className="h-4 w-16 rounded-full" />
      <Skeleton className="size-2.5 rounded-full" />
      <Skeleton className="size-2.5 rounded-full" />
    </div>
  </div>
)

/* ─── Ligne desktop réelle ─── */
const LigneEnvoi = memo(({ envoi }) => {
  const statut = STATUT_DIGEST[envoi.status] ?? {
    libelle: envoi.status,
    variante: "outline",
  }

  const kinds = [
    ...new Set((envoi.offer_links ?? []).map((o) => o.match_kind)),
  ]

  return (
    <TableRow className="transition-colors hover:bg-muted/50">
      <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
        {dateHeureFr(envoi.sent_at ?? envoi.scheduled_for)}
      </TableCell>

      <TableCell className="max-w-56 truncate" title={envoi.subject ?? ""}>
        {envoi.template_version === "manual" && (
          <Mail
            className="mr-1 inline size-3 text-primary"
            aria-label="Envoi personnalisé"
          />
        )}
        {envoi.subject ?? "—"}
      </TableCell>

      <TableCell className="text-center tabular-nums">
        {envoi.offer_count}
      </TableCell>

      <TableCell>
        <Badge variant={statut.variante}>{statut.libelle}</Badge>

        {envoi.skipped_reason && (
          <p
            className="mt-0.5 text-[10px] text-muted-foreground"
            title={envoi.skipped_reason}
          >
            {envoi.skipped_reason}
          </p>
        )}
      </TableCell>

      <TableCell className="hidden md:table-cell">
        {envoi.match_tier && Number(envoi.offer_count) > 0 ? (
          <Badge
            variant={(TIER_DIGEST[envoi.match_tier] ?? { ton: "outline" }).ton}
            className="text-[10px]"
            title={
              (TIER_DIGEST[envoi.match_tier] ?? {
                titre: `Palier ${envoi.match_tier}`,
              }).titre
            }
          >
            {(TIER_DIGEST[envoi.match_tier] ?? { libelle: envoi.match_tier })
              .libelle}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell className="hidden md:table-cell">
        <div className="flex flex-wrap items-center gap-1.5">
          {kinds.map((kind) => {
            const info = KIND_MATCH[kind] ?? {
              libelle: kind,
              ton: "outline",
              couleur: "#94a3b8",
              repli: true,
            }

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

          {!kinds.length && (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
})

LigneEnvoi.displayName = "LigneEnvoi"

/* ─── Carte mobile réelle ─── */
const CarteEnvoiMobile = memo(({ envoi }) => {
  const statut = STATUT_DIGEST[envoi.status] ?? {
    libelle: envoi.status,
    variante: "outline",
  }

  const kinds = [
    ...new Set((envoi.offer_links ?? []).map((o) => o.match_kind)),
  ]

  return (
    <article className="p-4 transition-colors hover:bg-muted/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground tabular-nums">
            {dateHeureFr(envoi.sent_at ?? envoi.scheduled_for)}
          </p>

          <h3
            className="mt-1 line-clamp-2 text-sm font-medium"
            title={envoi.subject ?? ""}
          >
            {envoi.template_version === "manual" && (
              <Mail
                className="mr-1 inline size-3 text-primary"
                aria-label="Envoi personnalisé"
              />
            )}
            {envoi.subject ?? "—"}
          </h3>
        </div>

        <Badge variant={statut.variante}>{statut.libelle}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {envoi.offer_count} offre{envoi.offer_count === 1 ? "" : "s"}
        </span>

        {envoi.match_tier && Number(envoi.offer_count) > 0 && (
          <Badge
            variant={(TIER_DIGEST[envoi.match_tier] ?? { ton: "outline" }).ton}
            className="text-[10px]"
            title={
              (TIER_DIGEST[envoi.match_tier] ?? {
                titre: `Palier ${envoi.match_tier}`,
              }).titre
            }
          >
            {(TIER_DIGEST[envoi.match_tier] ?? { libelle: envoi.match_tier })
              .libelle}
          </Badge>
        )}
      </div>

      {envoi.skipped_reason && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          {envoi.skipped_reason}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {kinds.map((kind) => {
          const info = KIND_MATCH[kind] ?? {
            libelle: kind,
            ton: "outline",
            couleur: "#94a3b8",
            repli: true,
          }

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

        {!kinds.length && (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
    </article>
  )
})

CarteEnvoiMobile.displayName = "CarteEnvoiMobile"

const OngletHistoriqueEnvois = ({ id }) => {
  const {
    data: envois,
    isLoading,
    isError,
    refetch,
  } = useAdminSubscriberSendsQuery(id, { limit: 50 })

  /* Tri INITIALISÉ : date descendante. */
  const [tri, setTri] = useState({ cle: "date", direction: "desc" })

  const envoisTries = useMemo(() => {
    const base = envois ?? []

    if (!tri) return base

    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base

    const copie = [...base].sort((a, b) =>
      comparerValeurs(colonne.triValeur(a), colonne.triValeur(b))
    )

    return tri.direction === "asc" ? copie : copie.reverse()
  }, [envois, tri])

  const basculerTri = useCallback((colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) {
        return {
          cle: colonne.cle,
          direction: colonne.directionInitiale ?? "desc",
        }
      }

      if (prec.direction === (colonne.directionInitiale ?? "desc")) {
        return {
          cle: colonne.cle,
          direction: prec.direction === "asc" ? "desc" : "asc",
        }
      }

      return null
    })
  }, [])

  const changerTriMobile = useCallback((valeur) => {
    if (valeur === "aucun") {
      setTri(null)
      return
    }

    const colonne = COLONNES.find((c) => c.cle === valeur)

    setTri({
      cle: valeur,
      direction: colonne?.directionInitiale ?? "desc",
    })
  }, [])

  const inverserTriMobile = useCallback(() => {
    setTri((prec) => {
      if (!prec) return prec

      return {
        ...prec,
        direction: prec.direction === "asc" ? "desc" : "asc",
      }
    })
  }, [])

  const cleCorps = `${id}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  const etat = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !envois?.length
        ? "vide"
        : "donnees"

  const afficherControles = !isError && (isLoading || !!envois?.length)

  return (
    <SectionCardAdmin
      title="Historique d'envois"
      description="Historique des envois de digest pour cet abonné."
      icon={Inbox}
      contentClassName="p-0 sm:p-0"
    >
      {/* ─── Tri mobile ─── */}
      {afficherControles && (
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3 md:hidden">
          <p className="text-xs font-medium text-muted-foreground">Tri</p>

          <div className="flex items-center gap-2">
            <Select value={tri?.cle ?? "aucun"} onValueChange={changerTriMobile}>
              <SelectTrigger
                className="h-8 flex-1 text-xs"
                aria-label="Choisir la colonne de tri"
              >
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="aucun">Tri par défaut</SelectItem>
                {OPTIONS_TRI_MOBILE.map((option) => (
                  <SelectItem key={option.valeur} value={option.valeur}>
                    {option.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 text-xs"
              onClick={inverserTriMobile}
              disabled={!tri}
              aria-label="Inverser le sens du tri"
            >
              {tri?.direction === "asc" ? (
                <ArrowUp aria-hidden className="size-3.5" />
              ) : (
                <ArrowDown aria-hidden className="size-3.5" />
              )}
              {tri?.direction === "asc" ? "Croissant" : "Décroissant"}
            </Button>
          </div>
        </div>
      )}

      <TransitionEtat etat={`${cleCorps}-${etat}`}>
        {isError ? (
          <div className="p-4">
            <SectionErreur
              onRetry={refetch}
              message="Impossible de charger l'historique d'envois."
            />
          </div>
        ) : !envois?.length && !isLoading ? (
          <div className="p-4">
            <SectionVide message="Aucun envoi pour cet abonné." />
          </div>
        ) : (
          <div
            key={`${cleCorps}-${etat}`}
            aria-busy={isLoading}
            className="animate-in fade-in duration-300 motion-reduce:animate-none"
          >
            {/* ─── Vue mobile ─── */}
            <div className="md:hidden">
              {isLoading ? (
                <div
                  className="divide-y divide-border"
                  role="status"
                  aria-label="Chargement de l'historique d'envois"
                >
                  <span className="sr-only">
                    Chargement de l'historique d'envois…
                  </span>

                  {[...Array(5)].map((_, index) => (
                    <CarteSkeletonEnvoiMobile key={index} />
                  ))}
                </div>
              ) : (
                <div
                  key={`${cleCorps}-${etat}-mobile`}
                  className="divide-y divide-border animate-in fade-in duration-200 motion-reduce:animate-none"
                >
                  {envoisTries.map((envoi) => (
                    <CarteEnvoiMobile key={envoi.id} envoi={envoi} />
                  ))}
                </div>
              )}
            </div>

            {/* ─── Vue desktop ─── */}
            <div className="hidden md:block">
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <EnteteTriable
                        colonne={COLONNES.find((c) => c.cle === "date")}
                        tri={tri}
                        onTri={basculerTri}
                      />

                      <EnteteTriable
                        colonne={COLONNES.find((c) => c.cle === "sujet")}
                        tri={tri}
                        onTri={basculerTri}
                      />

                      <EnteteTriable
                        colonne={COLONNES.find((c) => c.cle === "offres")}
                        tri={tri}
                        onTri={basculerTri}
                      />

                      <EnteteTriable
                        colonne={COLONNES.find((c) => c.cle === "statut")}
                        tri={tri}
                        onTri={basculerTri}
                      />

                      <EnteteTriable
                        colonne={COLONNES.find((c) => c.cle === "palier")}
                        tri={tri}
                        onTri={basculerTri}
                      />

                      <TableHead className="hidden md:table-cell">
                        Paliers de matching
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody
                    key={`${cleCorps}-${etat}-desktop`}
                    className="animate-in fade-in duration-200 motion-reduce:animate-none"
                  >
                    {isLoading ? (
                      [...Array(5)].map((_, index) => (
                        <LigneSkeletonEnvoi key={index} />
                      ))
                    ) : (
                      envoisTries.map((envoi) => (
                        <LigneEnvoi key={envoi.id} envoi={envoi} />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </TransitionEtat>
    </SectionCardAdmin>
  )
}

export default OngletHistoriqueEnvois