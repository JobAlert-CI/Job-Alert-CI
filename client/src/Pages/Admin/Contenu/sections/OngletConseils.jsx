import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CalendarCheck, CalendarDays, CheckCircle2, Lightbulb, Pencil, Plus, Trash2 } from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminDailyTipsQuery, useCreateDailyTip, useUpdateDailyTip,
  useDeleteDailyTip, messageErreurContenu,
} from "@/features/admin-contenu.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet 14.3 — Conseils du jour : CRUD + créneau de rotation + tri.
   MIGRATION 0015 : PLUSIEURS conseils peuvent partager un créneau
   (409 supprimé). Le site public choisit déterministement dans le
   créneau (day_of_year % nb). La table regroupe par jour, le dialog
   montre combien de tips occupent chaque créneau.
   ───────────────────────────────────────────────────────────────────── */
const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]

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

/* Colonnes triables. */
const COLONNES = [
  { cle: "jour", libelle: "Jour", directionInitiale: "asc", triValeur: (t) => t.rotation_order ?? 0 },
  { cle: "conseil", libelle: "Conseil", directionInitiale: "asc", triValeur: (t) => (t.text ?? "").toLowerCase() },
  { cle: "statut", libelle: "Statut", directionInitiale: "desc", triValeur: (t) => (t.is_active ? 1 : 0) },
]

const LigneSkeletonConseil = () => (
  <TableRow className="hover:bg-transparent">
    <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
    <TableCell><Skeleton className="h-3.5 w-72" /></TableCell>
    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
    <TableCell>
      <div className="flex justify-end gap-1">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
      </div>
    </TableCell>
  </TableRow>
)

const OngletConseils = () => {
  const notify = useNotify()
  const { data: conseils, isLoading, isError, refetch } = useAdminDailyTipsQuery()
  const [edition, setEdition] = useState(null)
  const [suppression, setSuppression] = useState(null)
  /* Tri INITIALISÉ : « Jour » ascendant = ordre de la semaine. */
  const [tri, setTri] = useState({ cle: "jour", direction: "asc" })

  const creerMutation = useCreateDailyTip()
  const modifierMutation = useUpdateDailyTip()
  const supprimerMutation = useDeleteDailyTip()

  // Compte par créneau (affiché en table + dialog) + compteurs onglet.
  const parCreneau = new Map()
  for (const tip of conseils ?? []) {
    parCreneau.set(tip.rotation_order, (parCreneau.get(tip.rotation_order) ?? 0) + 1)
  }
  const nbActifs = (conseils ?? []).filter((t) => t.is_active).length
  const nbJoursOccupes = parCreneau.size

  const conseilsTries = useMemo(() => {
    const base = conseils ?? []
    if (!tri) return [...base].sort((a, b) => a.rotation_order - b.rotation_order)
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [conseils, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun. */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  /* key = fondu léger du corps à chaque changement de tri. */
  const cleCorps = `${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  return (
    <div className="flex flex-col gap-3">
      {/* ─── Compteurs ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CarteCompteur label="Conseils" valeur={conseils?.length ?? 0} icone={Lightbulb} chargement={isLoading} />
        <CarteCompteur label="Actifs" valeur={nbActifs} icone={CheckCircle2} chargement={isLoading} />
        <CarteCompteur
          label="Jours occupés"
          valeur={nbJoursOccupes}
          texte={`${nbJoursOccupes}/7`}
          icone={CalendarDays}
          chargement={isLoading}
        />
        <CarteCompteur
          label="Semaine complète"
          valeur={nbJoursOccupes}
          texte={nbJoursOccupes === 7 ? "Oui" : "Non"}
          icone={CalendarCheck}
          chargement={isLoading}
        />
      </div>

      <SectionCardAdmin
        title="Conseils du jour"
        description="Plusieurs conseils peuvent partager un jour — le site public les fait tourner déterministement. Tri par colonne."
        icon={Lightbulb}
        contentClassName="p-0 sm:p-0"
        action={
          <Button size="sm" onClick={() => setEdition({})}>
            <Plus aria-hidden /> Nouveau conseil
          </Button>
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
                <SectionErreur onRetry={refetch} message="Impossible de charger les conseils." />
              </div>
            ) : isLoading ? (
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableBody>
                    {[...Array(5)].map((_, i) => <LigneSkeletonConseil key={i} />)}
                  </TableBody>
                </Table>
              </div>
            ) : !conseils?.length ? (
              <div className="p-4">
                <SectionVide message="Aucun conseil pour le moment." />
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "jour")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "conseil")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "statut")} tri={tri} onTri={basculerTri} />
                      <TableHead className="w-20"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                    {conseilsTries.map((tip) => (
                      <TableRow key={tip.id} className="transition-colors hover:bg-muted/50">
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline">{JOURS[tip.rotation_order] ?? `#${tip.rotation_order}`}</Badge>
                          {(parCreneau.get(tip.rotation_order) ?? 0) > 1 && (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              ({parCreneau.get(tip.rotation_order)} ce jour)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-96">
                          <span className="block truncate text-xs" title={tip.text}>{tip.text}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={tip.is_active ? "secondary" : "outline"}>
                            {tip.is_active ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => setEdition(tip)} aria-label="Modifier le conseil">
                              <Pencil aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setSuppression(tip)}
                              aria-label="Supprimer le conseil"
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </SectionCardAdmin>

      {/* Dialog création / édition */}
      {edition && (
        <DialogConseil
          conseil={edition.id ? edition : null}
          parCreneau={parCreneau}
          creer={creerMutation}
          modifier={modifierMutation}
          onFermer={() => setEdition(null)}
        />
      )}

      {/* Confirmation suppression */}
      {suppression && (
        <Dialog open onOpenChange={(ouvert) => !ouvert && setSuppression(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Supprimer ce conseil {JOURS[suppression.rotation_order] ?? ""} ?
              </DialogTitle>
              <DialogDescription>
                {(parCreneau.get(suppression.rotation_order) ?? 0) > 1
                  ? "D'autres conseils restent sur ce créneau — la rotation continue."
                  : "Le créneau redeviendra vide."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
              <Button
                variant="destructive"
                disabled={supprimerMutation.isPending}
                onClick={() =>
                  supprimerMutation.mutate(suppression.id, {
                    onSuccess: () => { notify("Conseil supprimé", "success"); setSuppression(null) },
                    onError: (err) => notify(messageErreurContenu(err), "error"),
                  })
                }
              >
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

const DialogConseil = ({ conseil, parCreneau, creer, modifier, onFermer }) => {
  const notify = useNotify()
  const edit = !!conseil
  const [valeurs, setValeurs] = useState(() => ({
    text: conseil?.text ?? "",
    rotation_order: String(conseil?.rotation_order ?? ""),
    is_active: conseil?.is_active ?? true,
  }))
  const set = (c, v) => setValeurs((p) => ({ ...p, [c]: v }))
  const nbSurCreneau = valeurs.rotation_order !== "" ? (parCreneau.get(Number(valeurs.rotation_order)) ?? 0) : 0

  const enregistrer = () => {
    const data = {
      text: valeurs.text.trim(),
      rotation_order: Number(valeurs.rotation_order),
      is_active: valeurs.is_active,
    }
    const appel = edit
      ? modifier.mutateAsync({ id: conseil.id, data })
      : creer.mutateAsync(data)
    appel
      .then(() => { notify(edit ? "Conseil mis à jour" : "Conseil créé", "success"); onFermer() })
      .catch((err) => notify(messageErreurContenu(err), "error"))
  }

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? `Modifier le conseil ${JOURS[conseil.rotation_order] ?? ""}` : "Nouveau conseil du jour"}</DialogTitle>
          <DialogDescription>
            Plusieurs conseils par jour autorisés — ils tournent automatiquement sur le site public.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tip-texte">Texte du conseil</Label>
            <Textarea id="tip-texte" value={valeurs.text} onChange={(e) => set("text", e.target.value)} rows={3} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tip-creneau">Jour</Label>
            <Select value={valeurs.rotation_order} onValueChange={(v) => set("rotation_order", v)}>
              <SelectTrigger id="tip-creneau" className="w-full">
                <SelectValue placeholder="Choisir un jour…" />
              </SelectTrigger>
              <SelectContent>
                {JOURS.map((jour, i) => {
                  const nb = parCreneau.get(i) ?? 0
                  return (
                    <SelectItem key={i} value={String(i)}>
                      {jour}{nb > 0 ? ` (${nb} conseil${nb > 1 ? "s" : ""})` : ""}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {!edit && nbSurCreneau > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {nbSurCreneau} conseil{nbSurCreneau > 1 ? "s" : ""} occupe{nbSurCreneau > 1 ? "nt" : ""} déjà ce jour —
                ils tourneront automatiquement.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tip-actif">Actif</Label>
            <Select value={valeurs.is_active ? "1" : "0"} onValueChange={(v) => set("is_active", v === "1")}>
              <SelectTrigger id="tip-actif" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Oui — affiché</SelectItem>
                <SelectItem value="0">Non — masqué</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={enregistrer} disabled={creer.isPending || modifier.isPending || !valeurs.text.trim() || valeurs.rotation_order === ""}>
            {creer.isPending || modifier.isPending ? "Enregistrement…" : edit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default OngletConseils