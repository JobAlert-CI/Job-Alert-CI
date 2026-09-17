import { memo, useMemo, useState } from "react"
import { KeyRound, Loader2, Plug, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  messageErreurIa, useClesIaQuery, useCreerCleIa, useModifierCleIa,
  useSupprimerCleIa, useTesterCleIa,
} from "@/features/admin-ia.tools"
import { useNotify } from "@/contexts/Notify.context"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { SectionErreur, SectionVide, TransitionEtat } from "@/components/admin/EtatsSection"
import DialogCleIA from "@/components/dialog/DialogCleIA"
import BtnAction from "@/components/admin/BtnAction"
import DialogSupprCleIA from "@/components/dialog/DialogSupprCleIA"
import { dateHeure } from "@/lib/dates"

const FOURNISSEURS = [
  { valeur: "openai_compatible", libelle: "OpenAI-compatible" },
  { valeur: "openai", libelle: "OpenAI" },
  { valeur: "mistral", libelle: "Mistral" },
  { valeur: "groq", libelle: "Groq" },
  { valeur: "anthropic", libelle: "Anthropic" },
  { valeur: "google_gemini", libelle: "Google Gemini" },
  { valeur: "ollama", libelle: "Ollama (local)" },
  { valeur: "mock", libelle: "Mock (démo/tests)" },
]

const libelleFournisseur = (v) => FOURNISSEURS.find((f) => f.valeur === v)?.libelle ?? v

/* Tri « français » robuste : nombres, textes, dates ISO ; vides en fin. */
const comparerValeurs = (a, b) => {
  const videA = a === null || a === undefined || a === ""
  const videB = b === null || b === undefined || b === ""
  if (videA && videB) return 0
  if (videA) return 1
  if (videB) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" })
}

/* Sentinelle ISO : une clé JAMAIS utilisée reste en fin de liste en desc. */
const JAMAIS = "0000-01-01T00:00:00"

/* Colonnes triables — « Quotas » (affichage multi-valeurs) et
   « Connexion » (résultat de test interactif) sont exclus. */
const COLONNES = [
  { cle: "nom", libelle: "Nom", directionInitiale: "asc", triValeur: (c) => (c.name ?? "").toLowerCase() },
  { cle: "fournisseur", libelle: "Fournisseur", directionInitiale: "asc", triValeur: (c) => libelleFournisseur(c.provider_type) },
  { cle: "priorite", libelle: "Priorité", directionInitiale: "asc", triValeur: (c) => c.priority ?? 0 },
  { cle: "statut", libelle: "Statut", directionInitiale: "desc", triValeur: (c) => (c.is_active ? 1 : 0) },
  { cle: "activite", libelle: "Dernière activité", directionInitiale: "desc", triValeur: (c) => c.last_used_at ?? JAMAIS },
]

/* ── Carte mobile (miroir de la ligne desktop) ────────────────────────
   Les colonnes masquées en desktop (Quotas < md, Activité < lg) sont
   exposées en tuiles : aucune information perdue en mobile. */
const CarteCleMobile = memo(function CarteCleMobile({
  cle, test, nbActives, onTester, onEditer, onSupprimer,
}) {
  const derniereActive = cle.is_active && nbActives <= 1
  return (
    <article
      aria-label={`Clé API ${cle.name}`}
      className="rounded-xl border border-border bg-card p-4 shadow-soft"
    >
      {/* En-tête : nom + clé masquée / badge de statut */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{cle.name}</p>
          {cle.api_key_masked && (
            <p className="font-mono text-[10px] text-muted-foreground">{cle.api_key_masked}</p>
          )}
        </div>
        <Badge variant={cle.is_active ? "secondary" : "outline"}>
          {cle.is_active ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Tuiles : fournisseur / priorité / quotas / activité */}
      <dl className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/40 px-2 py-1.5">
          <dt className="truncate text-[10px] text-muted-foreground">Fournisseur</dt>
          <dd className="truncate text-sm font-medium">{libelleFournisseur(cle.provider_type)}</dd>
        </div>
        <div className="rounded-lg bg-muted/40 px-2 py-1.5">
          <dt className="truncate text-[10px] text-muted-foreground">Priorité</dt>
          <dd className="text-sm font-medium tabular-nums">{cle.priority}</dd>
        </div>
        <div className="col-span-2 rounded-lg bg-muted/40 px-2 py-1.5">
          <dt className="truncate text-[10px] text-muted-foreground">Quotas</dt>
          <dd className="text-[11px] text-muted-foreground">
            {cle.max_concurrent_requests}// · {cle.timeout_seconds}s · {cle.max_retries}r
            {cle.rate_limit_per_minute ? ` · ${cle.rate_limit_per_minute}/min` : ""}
          </dd>
        </div>
        <div className="col-span-2 rounded-lg bg-muted/40 px-2 py-1.5">
          <dt className="truncate text-[10px] text-muted-foreground">Dernière activité</dt>
          <dd className="text-[11px] text-muted-foreground">
            util. {dateHeure(cle.last_used_at)} · err. {dateHeure(cle.last_error_at)}
          </dd>
        </div>
      </dl>

      {/* Test de connexion — mêmes états que la table */}
      <div className="mt-2.5 border-t border-border pt-2">
        {test?.enCours ? (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Test en cours…
          </span>
        ) : test ? (
          <span className={cn("flex flex-col text-[11px]", test.ok ? "text-emerald-600" : "text-destructive")}>
            <span>{test.ok ? `OK${test.model ? ` · ${test.model}` : ""}` : "Échec"}</span>
            {!test.ok && test.message && (
              <span className="block truncate text-destructive" title={test.message}>{test.message}</span>
            )}
          </span>
        ) : (
          <BtnAction
            variant="ghost"
            size="xs"
            onClick={onTester}
            aria-label={`Tester la connexion de ${cle.name}`}
          >
            <Plug className="size-3.5" aria-hidden="true" /> Tester
          </BtnAction>
        )}
      </div>

      {/* Pied : actions modifier / supprimer */}
      <div className="mt-2 flex items-center justify-end gap-1">
        <BtnAction
          variant="ghost"
          size="xs"
          onClick={onEditer}
          aria-label={`Modifier la clé ${cle.name}`}
          className="text-xs"
        >
          Modifier
        </BtnAction>
        <BtnAction
          variant="ghost"
          size="xs"
          disabled={derniereActive}
          title={derniereActive
            ? "Dernière clé active — le serveur refuse sa suppression (400)"
            : `Supprimer la clé ${cle.name}`}
          aria-label={derniereActive
            ? "Suppression impossible : dernière clé active"
            : `Supprimer la clé ${cle.name}`}
          onClick={onSupprimer}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </BtnAction>
      </div>
    </article>
  )
})

/* ── SKELETONS FIDÈLES ───────────────────────────────────────────── */

const Bloc = ({ className, delay = 0 }) => (
  <Skeleton className={className} style={delay ? { animationDelay: `${delay}ms` } : undefined} />
)

/* Ligne desktop : 8 cellules — Quotas masquée < md, Activité < lg. */
const SkeletonLigneCle = ({ delay = 0 }) => (
  <TableRow className="hover:bg-transparent">
    <TableCell>
      <Bloc className="h-3.5 w-28" delay={delay} />
      <Bloc className="mt-1 h-2.5 w-24" delay={delay} />
    </TableCell>
    <TableCell><Bloc className="h-3 w-24" delay={delay} /></TableCell>
    <TableCell className="text-right"><Bloc className="ml-auto h-3 w-6" delay={delay} /></TableCell>
    <TableCell className="hidden md:table-cell"><Bloc className="h-3 w-32" delay={delay} /></TableCell>
    <TableCell><Bloc className="h-5 w-16 rounded-full" delay={delay} /></TableCell>
    <TableCell className="hidden lg:table-cell">
      <Bloc className="h-2.5 w-24" delay={delay} />
      <Bloc className="mt-1 h-2.5 w-24" delay={delay} />
    </TableCell>
    <TableCell><Bloc className="h-7 w-16 rounded-md" delay={delay} /></TableCell>
    <TableCell><Bloc className="h-7 w-20 rounded-md" delay={delay} /></TableCell>
  </TableRow>
)

/* Carte mobile : miroir de CarteCleMobile. */
const SkeletonCarteCleMobile = ({ delay = 0 }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-soft" aria-hidden="true">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 space-y-1.5">
        <Bloc className="h-3.5 w-28" delay={delay} />
        <Bloc className="h-2.5 w-24" delay={delay} />
      </div>
      <Bloc className="h-5 w-16 shrink-0 rounded-full" delay={delay} />
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2">
      {[0, 1, 2, 3].map((k) => (
        <div key={k} className={cn("rounded-lg bg-muted/40 px-2 py-1.5", k >= 2 && "col-span-2")}>
          <Bloc className="h-2 w-16" delay={delay} />
          <Bloc className="mt-1 h-3 w-24" delay={delay} />
        </div>
      ))}
    </div>
    <div className="mt-2.5 border-t border-border pt-2">
      <Bloc className="h-7 w-16 rounded-md" delay={delay} />
    </div>
    <div className="mt-2 flex justify-end">
      <Bloc className="h-7 w-20 rounded-md" delay={delay} />
    </div>
  </div>
)

const ClesAPISkeleton = ({ nbLignes = 3 }) => {
  const lignes = Array.from({ length: nbLignes }, (_, i) => i)
  return (
    <div role="status" aria-label="Chargement des clés API">
      {/* ── Mobile : cartes ─────────────────────────────── */}
      <ul className="flex flex-col gap-3 px-4 pb-2 md:hidden" aria-hidden="true">
        {lignes.map((i) => (
          <li key={i}><SkeletonCarteCleMobile delay={i * 80} /></li>
        ))}
      </ul>

      {/* ── Desktop : table ─────────────────────────────── */}
      <div className="hidden overflow-x-auto scrollbar-thin md:block">
        <Table aria-hidden="true">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><Bloc className="h-3 w-10" /></TableHead>
              <TableHead><Bloc className="h-3 w-20" /></TableHead>
              <TableHead className="text-right"><Bloc className="ml-auto h-3 w-12" /></TableHead>
              <TableHead className="hidden text-right md:table-cell"><Bloc className="ml-auto h-3 w-12" /></TableHead>
              <TableHead><Bloc className="h-3 w-10" /></TableHead>
              <TableHead className="hidden lg:table-cell"><Bloc className="h-3 w-24" /></TableHead>
              <TableHead><Bloc className="h-3 w-16" /></TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((i) => <SkeletonLigneCle key={i} delay={i * 80} />)}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/* ── COMPOSANT PRINCIPAL ─────────────────────────────────────────── */

const ClesAPI = () => {
  const notify = useNotify()
  const { data: cles, isLoading, isError, refetch } = useClesIaQuery()
  const creer = useCreerCleIa()
  const modifier = useModifierCleIa()
  const supprimer = useSupprimerCleIa()
  const tester = useTesterCleIa()
  const [edition, setEdition] = useState(null)          // null | {} (création) | cle
  const [confirmation, setConfirmation] = useState(null) // cle à supprimer
  // Résultats de test inline : { [cleId]: { ok, model?, message?, enCours } }
  const [tests, setTests] = useState({})

  /* Tri INITIALISÉ : « Priorité » ascendante = ordre serveur (0 en
     premier) — aucun saut visuel au chargement, chevron actif visible. */
  const [tri, setTri] = useState({ cle: "priorite", direction: "asc" })

  const nbActives = (cles ?? []).filter((c) => c.is_active).length

  const clesAffichees = useMemo(() => {
    const base = cles ?? []
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [cles, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  const testerCle = (cle) => {
    setTests((t) => ({ ...t, [cle.id]: { enCours: true } }))
    tester.mutate(cle.id, {
      onSuccess: (resultat) => setTests((t) => ({ ...t, [cle.id]: resultat })),
      onError: (err) => setTests((t) => ({ ...t, [cle.id]: { ok: false, message: messageErreurIa(err) } })),
    })
  }

  const supprimerCle = (cle) => {
    supprimer.mutate(cle.id, {
      onSuccess: () => {
        notify(`Clé « ${cle.name} » supprimée`, "success")
        setConfirmation(null)
      },
      onError: (err) => notify(messageErreurIa(err), "error"),
    })
  }

  /* key = fondu léger du corps à chaque changement de tri. */
  const cleCorps = `${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  const etat = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !cles?.length
        ? "vide"
        : "donnees"

  return (
    <>
      <SectionCardAdmin
        title="Clés API"
        description={`${cles?.length ?? "…"} clé${(cles?.length ?? 0) > 1 ? "s" : ""} configurée${(cles?.length ?? 0) > 1 ? "s" : ""} — ${nbActives} active${nbActives > 1 ? "s" : ""}. Le pipeline refuse de tourner sans clé active. Tri par colonne.`}
        icon={KeyRound}
        contentClassName="p-0 sm:p-0"
        action={
          <BtnAction variant="outline" size="xs" onClick={() => setEdition({})}>
            <Plus aria-hidden="true" className="size-3.5" /> Nouvelle clé
          </BtnAction>
        }
      >
        {/* Fondu enchaîné au changement d'état. */}
        <TransitionEtat etat={etat}>
          {isError ? (
            <div className="p-4">
              <SectionErreur onRetry={refetch} message="Impossible de charger les clés." />
            </div>
          ) : isLoading ? (
            <ClesAPISkeleton nbLignes={4} />
          ) : !cles?.length ? (
            <div className="p-4">
              <SectionVide message="Aucune clé API configurée — le pipeline IA ne peut pas tourner. Créez-en une pour activer la normalisation." />
            </div>
          ) : (
            <>
              {/* ── Mobile : cartes ─────────────────────────── */}
              <ul
                key={cleCorps}
                className="flex animate-in flex-col gap-3 px-4 pb-2 duration-200 motion-reduce:animate-none md:hidden"
              >
                {clesAffichees.map((cle) => (
                  <li key={cle.id}>
                    <CarteCleMobile
                      cle={cle}
                      test={tests[cle.id]}
                      nbActives={nbActives}
                      onTester={() => testerCle(cle)}
                      onEditer={() => setEdition(cle)}
                      onSupprimer={() => setConfirmation(cle)}
                    />
                  </li>
                ))}
              </ul>

              {/* ── Desktop : table ─────────────────────────── */}
              <div className="hidden overflow-x-auto scrollbar-thin md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "nom")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "fournisseur")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "priorite")} tri={tri} onTri={basculerTri} aligneDroite />
                      <TableHead className="hidden text-right md:table-cell">Quotas</TableHead>
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "statut")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable
                        colonne={COLONNES.find((c) => c.cle === "activite")}
                        tri={tri}
                        onTri={basculerTri}
                        className="hidden lg:table-cell"
                      />
                      <TableHead>Connexion</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                    {clesAffichees.map((cle) => {
                      const test = tests[cle.id]
                      const derniereActive = cle.is_active && nbActives <= 1
                      return (
                        <TableRow key={cle.id} className="transition-colors hover:bg-muted/50">
                          <TableCell>
                            <span className="block text-xs font-medium">{cle.name}</span>
                            {cle.api_key_masked && (
                              <span className="block font-mono text-[10px] text-muted-foreground">{cle.api_key_masked}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{libelleFournisseur(cle.provider_type)}</TableCell>
                          <TableCell className="text-right tabular-nums">{cle.priority}</TableCell>
                          <TableCell className="hidden text-[11px] text-muted-foreground md:table-cell">
                            {cle.max_concurrent_requests}// · {cle.timeout_seconds}s · {cle.max_retries}r
                            {cle.rate_limit_per_minute ? ` · ${cle.rate_limit_per_minute}/min` : ""}
                          </TableCell>
                          <TableCell>
                            <Badge variant={cle.is_active ? "secondary" : "outline"}>
                              {cle.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden text-[11px] text-muted-foreground lg:table-cell">
                            <span className="block">util. {dateHeure(cle.last_used_at)}</span>
                            <span className="block">err. {dateHeure(cle.last_error_at)}</span>
                          </TableCell>
                          <TableCell>
                            {test?.enCours ? (
                              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                Test en cours…
                              </span>
                            ) : test ? (
                              <span className={cn("flex flex-col text-[11px]", test.ok ? "text-emerald-600" : "text-destructive")}>
                                <span>{test.ok ? `OK${test.model ? ` · ${test.model}` : ""}` : "Échec"}</span>
                                {!test.ok && test.message && (
                                  <span className="block max-w-40 truncate text-destructive" title={test.message}>
                                    {test.message}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <BtnAction
                                variant="ghost"
                                size="xs"
                                onClick={() => testerCle(cle)}
                                aria-label={`Tester la connexion de ${cle.name}`}
                              >
                                <Plug className="size-3.5" aria-hidden="true" /> Tester
                              </BtnAction>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <BtnAction
                                variant="ghost"
                                size="xs"
                                onClick={() => setEdition(cle)}
                                aria-label={`Modifier la clé ${cle.name}`}
                                className="text-xs"
                              >
                                Modifier
                              </BtnAction>
                              <BtnAction
                                variant="ghost"
                                size="xs"
                                disabled={derniereActive}
                                title={derniereActive
                                  ? "Dernière clé active — le serveur refuse sa suppression (400)"
                                  : `Supprimer la clé ${cle.name}`}
                                aria-label={derniereActive
                                  ? "Suppression impossible : dernière clé active"
                                  : `Supprimer la clé ${cle.name}`}
                                onClick={() => setConfirmation(cle)}
                                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" aria-hidden="true" />
                              </BtnAction>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TransitionEtat>
      </SectionCardAdmin>

      {/* Dialog création / édition */}
      {edition && (
        <DialogCleIA
          cle={edition.id ? edition : null}
          mutation={edition.id ? modifier : creer}
          onFermer={() => setEdition(null)}
        />
      )}
      {/* Confirmation suppression */}
      {confirmation && (
        <DialogSupprCleIA
          confirmation={confirmation}
          setConfirmation={setConfirmation}
          supprimerCle={supprimerCle}
          supprimer={supprimer}
        />
      )}
    </>
  )
}

export default ClesAPI