import { useCallback, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Loader2, Pencil, Plus, RotateCcw, Save, Search, Settings2
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableHeader, TableBody, TableHead, TableRow } from "@/components/ui/table"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { useNotify } from "@/contexts/Notify.context"
import {
  groupeDe, messageErreurParametres, normaliserValeur,
  useParametresQuery, useSauvegarderBulk, validerValeur,
} from "@/features/admin-parametres.tools"
import { SectionErreur, SectionVide, SectionAucunResultat, TransitionEtat } from "@/components/admin/EtatsSection"
import BtnAction from "@/components/admin/BtnAction"
import Bloc from "@/components/admin/Bloc"
import { CarteParametreMobile, SkeletonCarteParametre } from "../components/CarteParametreMobile"
import { BlocSkel } from "../components/utils"
import { LigneParametre, SkeletonLigneParametre } from "../components/LigneParametre"


/* Skeleton complet : en-tête de groupe (partagé) + cartes mobile +
   table desktop. `nbLignes` = valeur adaptative (useNbSquelettes). */
const TableauParametresSkeleton = ({ nbLignes }) => {
  const lignes = Array.from({ length: nbLignes }, (_, i) => i)
  return (
    <div role="status" aria-label="Chargement des paramètres">
      {/* En-tête de groupe — commun aux deux vues */}
      <div className="border-b border-border bg-muted/40 px-4 py-2" aria-hidden="true">
        <Skeleton className="h-3 w-32" />
      </div>

      {/* Mobile : cartes */}
      <div className="divide-y divide-border md:hidden" aria-hidden="true">
        {lignes.map((i) => <SkeletonCarteParametre key={i} delay={i * 70} />)}
      </div>

      {/* Desktop : table */}
      <div className="hidden overflow-x-auto scrollbar-thin md:block">
        <Table aria-hidden="true">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><BlocSkel className="h-3 w-10" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-14" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-20" /></TableHead>
              <TableHead className="w-24"><BlocSkel className="h-3 w-10" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((i) => <SkeletonLigneParametre key={i} delay={i * 70} />)}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/* Skeleton adaptatif : nombre de lignes dérivé de la hauteur d'écran
   (borné 4–10) pour éviter tout saut de hauteur à l'arrivée des données. */
const useNbSquelettes = () =>
  useMemo(() => {
    if (typeof window === "undefined") return 6
    return Math.min(10, Math.max(4, Math.round(window.innerHeight / 64)))
  }, [])

/* ─── COMPOSANT PRINCIPAL ────────────────────────────────────────── */
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

  /* ⚠️ Clé d'état : les modifications en cours n'en font PAS partie —
     l'ancienne clé « modifications » rejouait le fondu global à chaque
     frappe. La barre bulk possède sa propre animation (AnimatePresence). */
  const etat = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !listeFiltree.length
        ? recherche ? "aucun-resultat" : "vide"
        : "donnees"

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
        <div className="mx-4 my-2 flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            {isLoading ? (
              <Spinner
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-primary"
                aria-label="Recherche en cours"
              />
            ) : (
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
            )}
            <Input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher une clé ou une description…"
              aria-label="Rechercher un paramètre par clé ou description"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <BtnAction size="sm" onClick={onNouvelleCle}>
            <Plus aria-hidden /> Nouvelle clé
          </BtnAction>
        </div>

        {/* ─── Corps : erreur / skeleton / vide / groupes ─── */}
        <Bloc>
          <TransitionEtat etat={etat} className="animate-in fade-in duration-200 motion-reduce:animate-none">
            {isError ? (
              <SectionErreur onRetry={refetch} message="Impossible de charger les paramètres." className="m-4" />
            ) : isLoading ? (
              <TableauParametresSkeleton nbLignes={nbSquelettes} />
            ) : !listeFiltree.length ? (
              <>
                {recherche ? (
                  <SectionAucunResultat onReset={() => setRecherche("")} message="Aucun paramètre ne correspond à la recherche." className="m-4" />
                ) : (
                  <SectionVide message="Aucun paramètre en base — le seed « email settings » n'a pas été joué." className="m-4" />
                )}
              </>
            ) : (
              /* key = fondu léger à chaque changement de recherche */
              <div key={recherche} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                {[...groupes.entries()].map(([nom, liste]) => (
                  <section aria-label={`Groupe ${nom}`} className="border-b border-border last:border-b-0">
                    {/* En-tête de groupe — commun aux deux vues */}
                    <header className="flex items-center justify-between bg-muted/40 px-4 py-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{nom}</h3>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {liste.length} clé{liste.length > 1 ? "s" : ""}
                      </span>
                    </header>

                    {/* ── Mobile : cartes ─────────────────────────── */}
                    <div className="flex flex-col divide-y divide-border md:hidden">
                      {liste.map((parametre) => (
                        <CarteParametreMobile
                          key={parametre.key}
                          parametre={parametre}
                          valeurBrouillon={brouillons[parametre.key]}
                          erreur={invaliderLigne[parametre.key]}
                          setBrouillon={setBrouillon}
                        />
                      ))}
                    </div>

                    {/* ── Desktop : table ─────────────────────────── */}
                    <div className="hidden overflow-x-auto scrollbar-thin md:block">
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
                ))}
              </div>
            )}
          </TransitionEtat>
        </Bloc>

        {/* ─── Pied : compteur de résultats sous recherche active ─── */}
        {!isLoading && !isError && recherche && (
          <div className="border-t border-border px-4 py-2.5 text-xs tabular-nums text-muted-foreground">
            {listeFiltree.length} clé{listeFiltree.length > 1 ? "s" : ""} affichée{listeFiltree.length > 1 ? "s" : ""} sur {parametres?.length ?? 0}
          </div>
        )}
      </SectionCardAdmin>

      {/* ─── Barre flottante de sauvegarde groupée (inchangée) ─── */}
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
              <BtnAction variant="ghost" size="sm" onClick={annulerModifications}>
                <RotateCcw aria-hidden /> Annuler mes modifications
              </BtnAction>
              <BtnAction size="sm" onClick={sauvegarderTout} disabled={bulk.isPending}>
                {bulk.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
                {bulk.isPending ? "Enregistrement…" : "Enregistrer tout"}
              </BtnAction>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default TableauParametres