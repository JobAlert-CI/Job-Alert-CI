import { memo, useCallback, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Check, Loader2, Pencil, Plus, RotateCcw, Save, Search, Settings2, X,
} from "lucide-react"
import { ErrorBoundary } from "react-error-boundary"
import { cn } from "cn"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { useNotify } from "@/contexts/Notify.context"
import {
  CLES_NUMERIQUES, groupeDe, messageErreurParametres, normaliserValeur, typeCle,
  useParametresQuery, useSauvegarderBulk, useSauvegarderParametre, validerValeur,
} from "@/features/admin-parametres.tools"
import { SectionErreur, SectionVide, SectionAucunResultat } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Table des paramètres (cycle 18, doc v3 §18) — édition inline par
   ligne + dirty-tracking + sauvegarde groupée POST /bulk (barre
   flottante animée) ou unitaire PUT /{key} (upsert transparent).
   Refonte :
   • Le dialog de création n'est PLUS géré ici : l'action arrive via
     la prop `onNouvelleCle` (état centralisé dans index.jsx).
   • Ligne MÉMOÏSÉE recevant uniquement SA valeur de brouillon et SON
     erreur : la frappe dans une ligne ne re-rend pas les autres.
   • Feedback de sauvegarde unitaire : spinner Loader2 à la place du
     Check pendant la mutation.
   • Recherche responsive (w-full sm:w-64) + loupe + bouton effacer.
   • Skeleton adaptatif : nombre de lignes calculé d'après la hauteur
     d'écran, structure fidèle (en-tête de groupe) — zéro saut brutal.
   • Barre de sauvegarde groupée : apparition/disparition animée par
     le bas (AnimatePresence + motion.div), sticky conservé.
   Rendu par TYPE de clé (validation miroir serveur) : booléennes en
   Switch, numériques bornées en input number, texte en input.
   ───────────────────────────────────────────────────────────────────── */
const dateHeure = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

const LIBELLE_TYPE = { booleen: "bool", nombre: "num", texte: "texte" }

/* ─── Ligne mémoïsée : ne reçoit QUE sa valeur de brouillon et son
   erreur → la frappe dans une ligne épargne toutes les autres. ─── */
const LigneParametre = memo(function LigneParametre({
  parametre, valeurBrouillon, erreur, setBrouillon,
}) {
  const notify = useNotify()
  const sauvegarder = useSauvegarderParametre()
  const type = typeCle(parametre.key)
  const valeurServeur = parametre.value
  const modifie = valeurBrouillon !== undefined && valeurBrouillon !== valeurServeur
  const enCours = sauvegarder.isPending && sauvegarder.variables?.cle === parametre.key

  const confirmer = () => {
    if (erreur) return
    sauvegarder.mutate(
      { cle: parametre.key, valeur: normaliserValeur(parametre.key, valeurBrouillon) },
      {
        onSuccess: () => {
          setBrouillon(parametre.key, undefined) // quitte le mode édition
          notify(`« ${parametre.key} » enregistré`, "success")
        },
        onError: (err) => notify(messageErreurParametres(err) || "Enregistrement impossible", "error"),
      }
    )
  }

  return (
    <TableRow className={cn("transition-colors hover:bg-muted/50", modifie && "bg-amber-500/5")}>
      <TableCell>
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] font-medium">{parametre.key}</span>
          <Badge variant="outline" className="text-[9px] font-normal">
            {LIBELLE_TYPE[type] ?? type}
          </Badge>
        </span>
        {parametre.description && (
          <span className="block max-w-72 text-[10px] text-muted-foreground">{parametre.description}</span>
        )}
      </TableCell>
      <TableCell>
        {type === "booleen" ? (
          <div className="flex items-center gap-2">
            <Switch
              checked={String(valeurBrouillon ?? valeurServeur).toLowerCase() === "true"}
              disabled={enCours}
              onCheckedChange={(coche) => setBrouillon(parametre.key, coche ? "true" : "false")}
              aria-label={`Paramètre ${parametre.key}`}
            />
            <Badge variant={String(valeurBrouillon ?? valeurServeur).toLowerCase() === "true" ? "outline" : "secondary"}>
              {String(valeurBrouillon ?? valeurServeur).toLowerCase() === "true" ? "Activé" : "Désactivé"}
            </Badge>
          </div>
        ) : type === "nombre" ? (
          <Input
            type="number"
            className="h-8 w-24 text-xs"
            min={CLES_NUMERIQUES[parametre.key]?.min}
            max={CLES_NUMERIQUES[parametre.key]?.max}
            value={valeurBrouillon ?? valeurServeur}
            disabled={enCours}
            aria-label={`Valeur de ${parametre.key}`}
            onChange={(e) => setBrouillon(parametre.key, e.target.value)}
          />
        ) : (
          <Input
            type="text"
            className="h-8 max-w-64 text-xs"
            value={valeurBrouillon ?? valeurServeur}
            disabled={enCours}
            aria-label={`Valeur de ${parametre.key}`}
            onChange={(e) => setBrouillon(parametre.key, e.target.value)}
          />
        )}
        {erreur && <p className="mt-1 text-[10px] text-destructive" role="alert">{erreur}</p>}
      </TableCell>
      <TableCell className="whitespace-nowrap text-[10px] text-muted-foreground">
        {dateHeure(parametre.updated_at)}
        <span className="block">{parametre.updated_by_admin_id ? "admin" : "seed"}</span>
      </TableCell>
      <TableCell className="w-24">
        <div className="flex items-center gap-1">
          {modifie ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={confirmer}
                disabled={!!erreur || enCours}
                aria-label={`Enregistrer ${parametre.key}`}
              >
                {enCours ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Check className="size-3.5 text-emerald-600" aria-hidden />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setBrouillon(parametre.key, undefined)}
                disabled={enCours}
                aria-label={`Annuler la modification de ${parametre.key}`}
              >
                <X className="size-3.5" aria-hidden />
              </Button>
            </>
          ) : (
            <Badge variant="outline">À jour</Badge>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
})

/* ─── Skeleton adaptatif : nombre de lignes dérivé de la hauteur
   d'écran (borné 4-10) + structure fidèle (en-tête de groupe) pour
   éviter tout saut de hauteur à l'arrivée des données. ─── */
const useNbSquelettes = () =>
  useMemo(() => {
    if (typeof window === "undefined") return 6
    return Math.min(10, Math.max(4, Math.round(window.innerHeight / 64)))
  }, [])

const TableauParametres = ({ onNouvelleCle }) => {
  const notify = useNotify()
  const { data: parametres, isLoading, isError, refetch } = useParametresQuery()
  const bulk = useSauvegarderBulk()
  const [brouillons, setBrouillons] = useState({})      // { [cle]: valeurEnCours }
  const [recherche, setRecherche] = useState("")
  const nbSquelettes = useNbSquelettes()

  const setBrouillon = useCallback((cle, valeur) =>
    setBrouillons((precedent) => {
      const suivant = { ...precedent }
      if (valeur === undefined) delete suivant[cle]
      else suivant[cle] = valeur
      return suivant
    }), [])

  // Erreurs de validation par ligne (dérivées, pas d'état parallèle).
  const invaliderLigne = useMemo(() => {
    const erreurs = {}
    for (const [cle, valeur] of Object.entries(brouillons)) {
      if (valeur === undefined) continue
      const message = validerValeur(cle, valeur)
      if (message) erreurs[cle] = message
    }
    return erreurs
  }, [brouillons])

  const listeFiltree = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    const base = parametres ?? []
    if (!terme) return base
    return base.filter(
      (p) => p.key.toLowerCase().includes(terme) || (p.description ?? "").toLowerCase().includes(terme)
    )
  }, [parametres, recherche])

  const groupes = useMemo(() => {
    const parGroupe = new Map()
    for (const parametre of listeFiltree) {
      const nom = groupeDe(parametre.key)
      if (!parGroupe.has(nom)) parGroupe.set(nom, [])
      parGroupe.get(nom).push(parametre)
    }
    return parGroupe
  }, [listeFiltree])

  /* Modifications réellement sauvegardables : valeur changée ET valide. */
  const nbModifications = useMemo(
    () =>
      Object.entries(brouillons).filter(([cle, valeur]) => {
        if (valeur === undefined || invaliderLigne[cle]) return false
        const parametre = (parametres ?? []).find((p) => p.key === cle)
        return parametre && valeur !== parametre.value
      }).length,
    [brouillons, invaliderLigne, parametres]
  )

  const sauvegarderTout = () => {
    const charge = {}
    for (const [cle, valeur] of Object.entries(brouillons)) {
      if (valeur === undefined || invaliderLigne[cle]) continue
      const parametre = (parametres ?? []).find((p) => p.key === cle)
      if (parametre && valeur !== parametre.value) charge[cle] = normaliserValeur(cle, valeur)
    }
    if (!Object.keys(charge).length) return
    bulk.mutate(charge, {
      onSuccess: () => {
        setBrouillons({})
        notify(`${Object.keys(charge).length} paramètre${Object.keys(charge).length > 1 ? "s" : ""} enregistré${Object.keys(charge).length > 1 ? "s" : ""}`, "success")
      },
      onError: (err) => notify(messageErreurParametres(err) || "Sauvegarde impossible", "error"),
    })
  }

  const annulerModifications = () => setBrouillons({})

  return (
    <div className="flex flex-col gap-4">
      <SectionCardAdmin
        title="Paramètres"
        description="Édition inline par ligne — les valeurs s'appliquent au site en direct, sans redéploiement."
        icon={Settings2}
        contentClassName="p-0 sm:p-0"
        badge={
          !isLoading && !isError && (
            <Badge variant="secondary" className="tabular-nums">
              {parametres?.length ?? 0} clé{(parametres?.length ?? 0) > 1 ? "s" : ""}
            </Badge>
          )
        }
      >
        {/* ─── Barre recherche + création (responsive) ─── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher une clé ou une description…"
              aria-label="Rechercher un paramètre"
              className={cn("h-8 pl-8 text-xs", recherche && "pr-8")}
            />
            {recherche && (
              <button
                type="button"
                onClick={() => setRecherche("")}
                aria-label="Effacer la recherche"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onNouvelleCle}>
            <Plus aria-hidden /> Nouvelle clé
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Les valeurs s'appliquent au site en direct (sans redéploiement).
          </p>
        </div>

        {/* ─── Corps : erreur / skeleton adaptatif / vide / groupes ─── */}
        {isError ? (
          <div className="p-4">
            <SectionErreur onRetry={refetch} message="Impossible de charger les paramètres." />
          </div>
        ) : isLoading ? (
          <div className="p-4" aria-busy="true">
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="border-b border-border bg-muted/40 px-4 py-2">
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="divide-y divide-border">
                {[...Array(nbSquelettes)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex w-1/3 min-w-40 flex-col gap-1.5">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-2.5 w-56" />
                    </div>
                    <Skeleton className="h-8 w-full max-w-64" />
                    <Skeleton className="hidden h-3 w-24 sm:block" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : !listeFiltree.length ? (
          <div className="p-4">
            {recherche ? (
              <SectionAucunResultat onReset={() => setRecherche("")} message="Aucun paramètre ne correspond à la recherche." />
            ) : (
              <SectionVide message="Aucun paramètre en base — le seed « email settings » n'a pas été joué." />
            )}
          </div>
        ) : (
          /* key = fondu léger à chaque changement de recherche */
          <div key={recherche} className="animate-in fade-in duration-200 motion-reduce:animate-none">
            {[...groupes.entries()].map(([nom, liste]) => (
              <ErrorBoundary key={nom} FallbackComponent={AdminSectionFallback}>
                <section aria-label={`Groupe ${nom}`} className="border-b border-border last:border-b-0">
                  <header className="flex items-center justify-between bg-muted/40 px-4 py-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{nom}</h3>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {liste.length} clé{liste.length > 1 ? "s" : ""}
                    </span>
                  </header>
                  <div className="overflow-x-auto scrollbar-thin">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Clé</TableHead>
                          <TableHead>Valeur</TableHead>
                          <TableHead className="whitespace-nowrap">Mise à jour</TableHead>
                          <TableHead className="w-24">État</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {liste.map((parametre) => (
                          <LigneParametre
                            key={parametre.key}
                            parametre={parametre}
                            valeurBrouillon={brouillons[parametre.key]}
                            erreur={invaliderLigne[parametre.key]}
                            setBrouillon={setBrouillon}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              </ErrorBoundary>
            ))}
          </div>
        )}

        {/* ─── Pied : compteur de résultats sous recherche active ─── */}
        {!isLoading && !isError && recherche && (
          <div className="border-t border-border px-4 py-2.5 text-xs tabular-nums text-muted-foreground">
            {listeFiltree.length} clé{listeFiltree.length > 1 ? "s" : ""} affichée{listeFiltree.length > 1 ? "s" : ""} sur {parametres?.length ?? 0}
          </div>
        )}
      </SectionCardAdmin>

      {/* ─── Barre flottante de sauvegarde groupée — apparition/disparition
         animée par le bas (rendue HORS de la carte : le sticky a besoin
         du défilement de la page, pas d'un ancêtre en overflow-hidden). ─── */}
      <AnimatePresence>
        {nbModifications > 0 && (
          <motion.div
            key="barre-bulk"
            role="toolbar"
            aria-label="Modifications en cours"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300/50 bg-card/95 p-3 shadow-hover backdrop-blur"
          >
            <p className="flex items-center gap-2 text-xs font-medium">
              <Pencil className="size-3.5 text-amber-500" aria-hidden />
              {nbModifications} modification{nbModifications > 1 ? "s" : ""} en cours
            </p>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={annulerModifications}>
                <RotateCcw aria-hidden /> Annuler mes modifications
              </Button>
              <Button
                size="sm"
                onClick={sauvegarderTout}
                disabled={bulk.isPending}
              >
                {bulk.isPending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Save aria-hidden />
                )}
                {bulk.isPending ? "Enregistrement…" : "Enregistrer tout"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default TableauParametres