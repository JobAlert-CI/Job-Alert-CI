import { useMemo, useState } from "react"
import { Check, Pencil, Plus, RotateCcw, Save, X } from "lucide-react"
import { ErrorBoundary } from "react-error-boundary"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { useNotify } from "@/contexts/Notify.context"
import {
  CLES_NUMERIQUES, groupeDe, messageErreurParametres, normaliserValeur, typeCle,
  useParametresQuery, useSauvegarderBulk, useSauvegarderParametre, validerValeur,
} from "@/features/admin-parametres.tools"
import { SectionErreur, SectionVide, SectionAucunResultat } from "../components/EtatsSection"
import DialogCreationParametre from "../components/DialogCreationParametre"

/* ─────────────────────────────────────────────────────────────────────
   Table des paramètres (cycle 18, doc v3 §18) — édition inline par
   ligne + dirty-tracking + sauvegarde groupée POST /bulk (barre
   flottante « N modifications ») ou unitaire PUT /{key} (upsert
   transparent : jamais distinguer créer/modifier).

   Rendu par TYPE de clé (validation miroir serveur) :
   - booléennes → Switch ; numériques bornées → input number ;
   - texte → input (textarea pour les longues valeurs).

   Groupes par préfixe (Email/Confirmation, Expéditeur, Support,
   Autres) + recherche locale (la liste est petite, GET renvoie TOUT).

   Cycle 18 : les valeurs sont CONSOMMÉES au runtime (résolveur
   serveur) — rappel discret dans l'en-tête : modifier ici change le
   comportement du site SANS redéploiement.
   ───────────────────────────────────────────────────────────────────── */

const dateHeure = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

/** Une ligne de paramètre : affichage + édition inline + save unitaire. */
const LigneParametre = ({ parametre, brouillons, setBrouillon, invaliderLigne }) => {
  const notify = useNotify()
  const sauvegarder = useSauvegarderParametre()

  const type = typeCle(parametre.key)
  const valeurServeur = parametre.value
  const valeurBrouillon = brouillons[parametre.key]
  const modifie = valeurBrouillon !== undefined && valeurBrouillon !== valeurServeur
  const erreur = invaliderLigne[parametre.key]
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
    <TableRow className={modifie ? "bg-amber-500/5" : undefined}>
      <TableCell>
        <span className="block font-mono text-[11px] font-medium">{parametre.key}</span>
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
            <Badge variant={String(valeurBrouillon ?? valeurServeur).toLowerCase() === "true" ? "default" : "secondary"}>
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
        {erreur && <p className="mt-1 text-[10px] text-destructive">{erreur}</p>}
      </TableCell>
      <TableCell className="whitespace-nowrap text-[10px] text-muted-foreground">
        {dateHeure(parametre.updated_at)}
        <span className="block">
          {parametre.updated_by_admin_id ? "admin" : "seed"}
        </span>
      </TableCell>
      <TableCell className="w-24">
        <div className="flex items-center gap-1">
          {modifie ? (
            <>
              <Button variant="ghost" size="icon-sm" onClick={confirmer} disabled={!!erreur || enCours}
                aria-label={`Enregistrer ${parametre.key}`}>
                <Check className="size-3.5 text-emerald-600" aria-hidden />
              </Button>
              <Button variant="ghost" size="icon-sm"
                onClick={() => setBrouillon(parametre.key, undefined)}
                aria-label={`Annuler la modification de ${parametre.key}`}>
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
}

const TableauParametres = () => {
  const notify = useNotify()
  const { data: parametres, isLoading, isError, refetch } = useParametresQuery()
  const bulk = useSauvegarderBulk()

  const [brouillons, setBrouillons] = useState({})      // { [cle]: valeurEnCours }
  const [recherche, setRecherche] = useState("")
  const [creationOuverte, setCreationOuverte] = useState(false)

  const setBrouillon = (cle, valeur) =>
    setBrouillons((precedent) => {
      const suivant = { ...precedent }
      if (valeur === undefined) delete suivant[cle]
      else suivant[cle] = valeur
      return suivant
    })

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

  // Groupes ordonnés : groupes connus d'abord (ordre de GROUPES_PARAMETRES), « Autres » en fin.
  const groupes = useMemo(() => {
    const parGroupe = new Map()
    for (const parametre of listeFiltree) {
      const nom = groupeDe(parametre.key)
      if (!parGroupe.has(nom)) parGroupe.set(nom, [])
      parGroupe.get(nom).push(parametre)
    }
    return parGroupe
  }, [listeFiltree])

  const nbModifications = useMemo(
    () =>
      Object.entries(brouillons).filter(([cle, valeur]) => {
        const parametre = (parametres ?? []).find((p) => p.key === cle)
        return valeur !== undefined && parametre && valeur !== parametre.value
      }).length,
    [brouillons, parametres]
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

  if (isError) {
    return <SectionErreur onRetry={refetch} message="Impossible de charger les paramètres." />
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barre recherche + création */}
      <section aria-label="Recherche et actions" className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher une clé ou une description…"
          aria-label="Rechercher un paramètre"
          className="h-9 w-64 text-xs"
        />
        <Button variant="outline" size="sm" onClick={() => setCreationOuverte(true)}>
          <Plus aria-hidden /> Nouvelle clé
        </Button>
        <p className="text-[10px] text-muted-foreground">
          Les valeurs s'appliquent au site en direct (sans redéploiement).
        </p>
      </section>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : !listeFiltree.length ? (
        recherche ? (
          <SectionAucunResultat onReset={() => setRecherche("")} />
        ) : (
          <SectionVide message="Aucun paramètre en base — le seed « email settings » n'a pas été joué." />
        )
      ) : (
        [...groupes.entries()].map(([nom, liste]) => (
          <ErrorBoundary key={nom} FallbackComponent={AdminSectionFallback}>
            <section aria-label={`Groupe ${nom}`} className="overflow-x-auto rounded-xl border border-border">
              <header className="border-b border-border bg-muted/40 px-3 py-2">
                <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{nom}</h3>
              </header>
              <Table>
                <TableHeader>
                  <TableRow>
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
                      brouillons={brouillons}
                      setBrouillon={setBrouillon}
                      invaliderLigne={invaliderLigne}
                    />
                  ))}
                </TableBody>
              </Table>
            </section>
          </ErrorBoundary>
        ))
      )}

      {/* Barre flottante de sauvegarde groupée */}
      {nbModifications > 0 && (
        <div role="toolbar" aria-label="Modifications en cours"
          className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300/50 bg-card/95 p-3 shadow-lg backdrop-blur">
          <p className="flex items-center gap-2 text-xs font-medium">
            <Pencil className="size-3.5 text-amber-500" aria-hidden />
            {nbModifications} modification{nbModifications > 1 ? "s" : ""} en cours
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={annulerModifications}>
              <RotateCcw aria-hidden /> Annuler mes modifications
            </Button>
            <Button size="sm" onClick={sauvegarderTout}
              disabled={bulk.isPending || Object.keys(invaliderLigne).length > 0}>
              <Save aria-hidden /> Enregistrer tout
            </Button>
          </div>
        </div>
      )}

      {/* Dialog création (upsert : PUT direct) */}
      {creationOuverte && (
        <DialogCreationParametre ouverte onFermer={() => setCreationOuverte(false)} />
      )}
    </div>
  )
}

export default TableauParametres
