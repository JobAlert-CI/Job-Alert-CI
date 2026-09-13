import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { KeyRound, Loader2, Plug, Plus, Trash2 } from "lucide-react"
import {
  messageErreurIa, useClesIaQuery, useCreerCleIa, useModifierCleIa,
  useSupprimerCleIa, useTesterCleIa,
} from "@/features/admin-ia.tools"
import { useNotify } from "@/contexts/Notify.context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { SectionErreur, SectionVide } from "../components/EtatsSection"
import DialogCleIA from "@/components/dialog/DialogCleIA"
import BtnAction from "@/components/admin/BtnAction"
import DialogSupprCleIA from "@/components/dialog/DialogSupprCleIA"

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

const dateHeure = (iso) => {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

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

/* ─── Section ─── */
const SectionCles = () => {
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

  return (
    <>
      <SectionCardAdmin
        title="Clés API"
        description={`${cles?.length ?? "…"} clé${(cles?.length ?? 0) > 1 ? "s" : ""} configurée${(cles?.length ?? 0) > 1 ? "s" : ""} — ${nbActives} active${nbActives > 1 ? "s" : ""}. Le pipeline refuse de tourner sans clé active. Tri par colonne.`}
        icon={KeyRound}
        contentClassName="p-0 sm:p-0"
        action={
          <BtnAction variant="outline" size="sm" onClick={() => setEdition({})}>
            <Plus aria-hidden="true" className="size-3.5" /> Nouvelle clé
          </BtnAction>
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={isLoading ? "chargement" : isError ? "erreur" : "donnees"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les clés." />
              </div>
            ) : isLoading ? (
              <div className="flex flex-col gap-2 p-4" aria-busy="true">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
              </div>
            ) : !cles?.length ? (
              <div className="p-4">
                <SectionVide message="Aucune clé API configurée — le pipeline IA ne peut pas tourner. Créez-en une pour activer la normalisation." />
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
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
                              <span className={`flex flex-col text-[11px] ${test.ok ? "text-emerald-600" : "text-destructive"}`}>
                                <span>{test.ok ? `OK${test.model ? ` · ${test.model}` : ""}` : "Échec"}</span>
                                {!test.ok && test.message && (
                                  <span className="block max-w-40 truncate text-destructive" title={test.message}>
                                    {test.message}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => testerCle(cle)}
                                aria-label={`Tester la connexion de ${cle.name}`}
                              >
                                <Plug className="size-3.5" aria-hidden="true" /> Tester
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEdition(cle)}
                                aria-label={`Modifier la clé ${cle.name}`}
                                className="text-xs"
                              >
                                Modifier
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
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
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
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

export default SectionCles