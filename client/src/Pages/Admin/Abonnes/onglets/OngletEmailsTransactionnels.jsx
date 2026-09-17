import { memo, useCallback, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Mail } from "lucide-react"
import { useAdminAbonneEmailsTx } from "@/features/admin-abonnes.tools"
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
  SectionVide,
  TransitionEtat,
} from "@/components/admin/EtatsSection"
import { dateHeure } from "@/lib/dates"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"

/* ─────────────────────────────────────────────────────────────────────
Onglet Emails transactionnels — Détail abonné
Améliorations :
- loading fidèle desktop + mobile
- entêtes triables
- cartes mobile
- animation de changement d'état
───────────────────────────────────────────────────────────────────── */

const PURPOSE_TX = {
  confirm_email: "Confirmation d'inscription",
  digest_manual: "Envoi personnalisé",
  alerte: "Alerte",
  unsubscribe: "Désinscription",
}

const VARIANTE_TX = {
  sent: "secondary",
  failed: "destructive",
  queued: "outline",
  pending: "outline",
}

const LIBELLE_STATUT_TX = {
  sent: "Envoyé",
  failed: "Échoué",
  queued: "En file",
  pending: "En attente",
}

const RANG_STATUT_TX = {
  sent: 1,
  queued: 2,
  pending: 3,
  failed: 4,
}

/* Tri « français » robuste : nombres, textes, dates ISO ; vides en fin. */
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
    triValeur: (e) => e.sent_at ?? e.created_at ?? "",
  },
  {
    cle: "motif",
    libelle: "Motif",
    directionInitiale: "asc",
    triValeur: (e) =>
      (PURPOSE_TX[e.purpose] ?? e.purpose ?? "").toLowerCase(),
  },
  {
    cle: "statut",
    libelle: "Statut",
    directionInitiale: "asc",
    triValeur: (e) => RANG_STATUT_TX[e.status] ?? 0,
  },
  {
    cle: "tentatives",
    libelle: "Tentatives",
    directionInitiale: "desc",
    className: "hidden text-center md:table-cell",
    triValeur: (e) => e.attempts ?? 0,
  },
]

const OPTIONS_TRI_MOBILE = COLONNES.map((colonne) => ({
  valeur: colonne.cle,
  libelle: colonne.libelle,
}))

/* ─── Entêtes partagées loading / succès ─── */
const EntetesTableEmailsTx = ({ tri, onTri }) => (
  <TableHeader>
    <TableRow className="hover:bg-transparent">
      <EnteteTriable
        colonne={COLONNES.find((c) => c.cle === "date")}
        tri={tri}
        onTri={onTri}
      />

      <EnteteTriable
        colonne={COLONNES.find((c) => c.cle === "motif")}
        tri={tri}
        onTri={onTri}
      />

      <EnteteTriable
        colonne={COLONNES.find((c) => c.cle === "statut")}
        tri={tri}
        onTri={onTri}
      />

      <EnteteTriable
        colonne={COLONNES.find((c) => c.cle === "tentatives")}
        tri={tri}
        onTri={onTri}
      />

      <TableHead className="hidden lg:table-cell">Erreur</TableHead>
    </TableRow>
  </TableHeader>
)

/* ─── Skeleton desktop fidèle ─── */
const LigneSkeletonEmail = () => (
  <TableRow className="hover:bg-transparent" aria-hidden="true">
    <TableCell>
      <Skeleton className="h-3.5 w-28" />
    </TableCell>

    <TableCell>
      <Skeleton className="h-3.5 w-36" />
    </TableCell>

    <TableCell>
      <Skeleton className="h-5 w-16 rounded-full" />
    </TableCell>

    <TableCell className="hidden text-center md:table-cell">
      <Skeleton className="mx-auto h-3.5 w-6" />
    </TableCell>

    <TableCell className="hidden lg:table-cell">
      <Skeleton className="h-3 w-40" />
    </TableCell>
  </TableRow>
)

/* ─── Skeleton mobile fidèle ─── */
const CarteSkeletonEmailMobile = () => (
  <div className="p-4" aria-hidden="true">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-4 w-[72%]" />
        <Skeleton className="h-3 w-[58%]" />
      </div>

      <Skeleton className="h-5 w-16 rounded-full" />
    </div>

    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-3 w-24" />
    </div>
  </div>
)

/* ─── Ligne desktop réelle ─── */
const LigneEmail = memo(({ email }) => {
  const statutVariant = VARIANTE_TX[email.status] ?? "outline"
  const statutLabel = LIBELLE_STATUT_TX[email.status] ?? email.status

  return (
    <TableRow className="transition-colors hover:bg-muted/50">
      <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
        {dateHeure(email.sent_at ?? email.created_at)}
      </TableCell>

      <TableCell className="text-sm">
        {PURPOSE_TX[email.purpose] ?? email.purpose}
      </TableCell>

      <TableCell>
        <Badge variant={statutVariant}>{statutLabel}</Badge>
      </TableCell>

      <TableCell className="hidden text-center tabular-nums md:table-cell">
        {email.attempts ?? 0}
      </TableCell>

      <TableCell
        className="hidden max-w-48 truncate text-xs text-muted-foreground lg:table-cell"
        title={email.last_error ?? ""}
      >
        {email.last_error ?? "—"}
      </TableCell>
    </TableRow>
  )
})

LigneEmail.displayName = "LigneEmail"

/* ─── Carte mobile réelle ─── */
const CarteEmailMobile = memo(({ email }) => {
  const statutVariant = VARIANTE_TX[email.status] ?? "outline"
  const statutLabel = LIBELLE_STATUT_TX[email.status] ?? email.status

  return (
    <article className="p-4 transition-colors hover:bg-muted/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground tabular-nums">
            {dateHeure(email.sent_at ?? email.created_at)}
          </p>

          <h3 className="mt-1 text-sm font-medium">
            {PURPOSE_TX[email.purpose] ?? email.purpose}
          </h3>

          {email.last_error && (
            <p
              className="mt-1 line-clamp-2 text-xs text-destructive/80"
              title={email.last_error}
            >
              {email.last_error}
            </p>
          )}
        </div>

        <Badge variant={statutVariant}>{statutLabel}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          Tentatives : {email.attempts ?? 0}
        </span>
      </div>
    </article>
  )
})

CarteEmailMobile.displayName = "CarteEmailMobile"

const OngletEmailsTransactionnels = ({ abonneId }) => {
  const {
    data: emails,
    isLoading,
    isError,
    refetch,
  } = useAdminAbonneEmailsTx(abonneId)

  /* Tri INITIALISÉ : date descendante. */
  const [tri, setTri] = useState({ cle: "date", direction: "desc" })

  const listeBrute = useMemo(
    () => (Array.isArray(emails) ? emails : []),
    [emails]
  )

  const emailsTries = useMemo(() => {
    if (!tri) return listeBrute

    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return listeBrute

    const copie = [...listeBrute].sort((a, b) =>
      comparerValeurs(colonne.triValeur(a), colonne.triValeur(b))
    )

    return tri.direction === "asc" ? copie : copie.reverse()
  }, [listeBrute, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun. */
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

  const cleCorps = `${abonneId}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  const etat = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !listeBrute.length
        ? "vide"
        : "donnees"

  const afficherControles = !isError && (isLoading || listeBrute.length > 0)

  return (
    <SectionCardAdmin
      title="Emails transactionnels"
      description="Vérifier les emails transactionnels envoyés à l'abonné."
      icon={Mail}
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
              message="Impossible de charger les emails transactionnels."
            />
          </div>
        ) : isLoading ? (
          <div
            key={`${cleCorps}-${etat}`}
            aria-busy="true"
            className="animate-in fade-in duration-300 motion-reduce:animate-none"
          >
            {/* ─── Vue mobile ─── */}
            <div className="md:hidden">
              <div
                className="divide-y divide-border"
                role="status"
                aria-label="Chargement des emails transactionnels"
              >
                <span className="sr-only">
                  Chargement des emails transactionnels…
                </span>

                {[...Array(5)].map((_, index) => (
                  <CarteSkeletonEmailMobile key={index} />
                ))}
              </div>
            </div>

            {/* ─── Vue desktop ─── */}
            <div className="hidden md:block">
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <EntetesTableEmailsTx tri={tri} onTri={basculerTri} />

                  <TableBody
                    key={`${cleCorps}-${etat}-desktop`}
                    className="animate-in fade-in duration-200 motion-reduce:animate-none"
                  >
                    {[...Array(5)].map((_, index) => (
                      <LigneSkeletonEmail key={index} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ) : !listeBrute.length ? (
          <div className="p-4">
            <SectionVide message="Aucun email transactionnel pour cet abonné." />
          </div>
        ) : (
          <div
            key={`${cleCorps}-${etat}`}
            className="animate-in fade-in duration-300 motion-reduce:animate-none"
          >
            {/* ─── Vue mobile ─── */}
            <div className="md:hidden">
              <div
                key={`${cleCorps}-${etat}-mobile`}
                className="divide-y divide-border animate-in fade-in duration-200 motion-reduce:animate-none"
              >
                {emailsTries.map((email, index) => (
                  <CarteEmailMobile
                    key={email.id ?? index}
                    email={email}
                  />
                ))}
              </div>
            </div>

            {/* ─── Vue desktop ─── */}
            <div className="hidden md:block">
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <EntetesTableEmailsTx tri={tri} onTri={basculerTri} />

                  <TableBody
                    key={`${cleCorps}-${etat}-desktop`}
                    className="animate-in fade-in duration-200 motion-reduce:animate-none"
                  >
                    {emailsTries.map((email, index) => (
                      <LigneEmail key={email.id ?? index} email={email} />
                    ))}
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

export default OngletEmailsTransactionnels