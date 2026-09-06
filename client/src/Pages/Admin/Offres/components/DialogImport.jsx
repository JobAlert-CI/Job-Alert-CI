import { useRef, useState } from "react"
import { FileDown, FileUp, Upload } from "lucide-react"
import { COLONNES_IMPORT, useImportOffres, messageErreurMutation } from "@/features/admin-offres.tools"
import { useNotify } from "@/contexts/Notify.context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"

/* ─────────────────────────────────────────────────────────────────────
   Dialog d'import en masse (CSV ou JSON).

   Contraintes serveur réelles (api/v1/admin/offers.py) :
   - 5 Mo max, extensions .csv/.json, MIME csv/json/octet-stream ;
   - traitement par lots de 50 : une erreur sur une ligne n'annule
     pas tout le fichier ;
   - réponse { message, created, ignored, errors: [{line, error, data}] }
     → le rapport ligne par ligne est affiché intégralement, pas juste
     un message de succès global (doc v3 §3).

   Le modèle CSV téléchargeable documente EXACTEMENT les colonnes de
   _row_to_payload (allowed_keys) — pas une colonne de plus.
   ───────────────────────────────────────────────────────────────────── */

const TAILLE_MAX_MO = 5

/** Génère et télécharge un modèle CSV avec les en-têtes exacts. */
const telechargerModele = () => {
  const entetes = COLONNES_IMPORT.map((c) => c.colonne).join(",")
  const ligneExemple = [
    "Développeur React", "Tech CI", "goafrica", "https://exemple.ci/offre-1",
    "ref-001", "https://exemple.ci/offre-1", "tech-dev", "Abidjan",
    "cdd", "1-3", "bac-2", "2026-09-01", "2026-10-01",
    "Poste passionnant au sein d'une équipe agile", "Développer le front office",
  ].map((v) => `"${v}"`).join(",")
  const blob = new Blob(["\uFEFF" + entetes + "\n" + ligneExemple + "\n"], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "modele-import-offres.csv"
  a.click()
  URL.revokeObjectURL(url)
}

const DialogImport = ({ ouvert, onFermer }) => {
  const notify = useNotify()
  const inputRef = useRef(null)
  const [fichier, setFichier] = useState(null)
  const [rapport, setRapport] = useState(null)
  const importMutation = useImportOffres()

  const choisirFichier = (e) => {
    const f = e.target.files?.[0]
    setRapport(null)
    if (!f) return
    if (f.size > TAILLE_MAX_MO * 1024 * 1024) {
      notify(`Fichier trop volumineux (${(f.size / 1048576).toFixed(1)} Mo) — maximum ${TAILLE_MAX_MO} Mo.`, "error")
      return
    }
    if (!/\.(csv|json)$/i.test(f.name)) {
      notify("Seuls les fichiers .csv et .json sont acceptés.", "error")
      return
    }
    setFichier(f)
  }

  const lancerImport = () => {
    if (!fichier) return
    importMutation.mutate(fichier, {
      onSuccess: (res) => {
        setRapport(res)
        notify(res?.message || `Import terminé : ${res?.created ?? 0} créée(s), ${res?.ignored ?? 0} ignorée(s)`, "success")
      },
      onError: (err) => notify(messageErreurMutation(err) || "Import impossible", "error"),
    })
  }

  const fermer = () => {
    setFichier(null)
    setRapport(null)
    onFermer()
  }

  return (
    <Dialog open={ouvert} onOpenChange={(o) => !o && fermer()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importer des offres en masse</DialogTitle>
          <DialogDescription>
            Fichier CSV ou JSON, 5 Mo maximum. Chaque ligne passe par le même dédoublonnage que la création manuelle — une offre identique à une existante est ignorée, pas dupliquée. Une erreur sur une ligne n'annule pas le reste du fichier.
          </DialogDescription>
        </DialogHeader>

        {/* Zone de dépôt / sélection */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center transition-colors hover:border-primary/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <FileUp className="size-6 text-muted-foreground" aria-hidden />
          {fichier ? (
            <p className="text-sm font-medium">
              {fichier.name}{" "}
              <span className="text-muted-foreground">({(fichier.size / 1024).toFixed(0)} Ko)</span>
            </p>
          ) : (
            <>
              <p className="text-sm font-medium">Cliquez pour choisir un fichier .csv ou .json</p>
              <p className="text-xs text-muted-foreground">ou glissez-le ici</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.json"
            className="sr-only"
            onChange={choisirFichier}
            aria-label="Choisir un fichier CSV ou JSON à importer"
          />
        </div>

        {/* Modèle téléchargeable + colonnes attendues */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Besoin du format ? Téléchargez le modèle avec les {COLONNES_IMPORT.length} colonnes acceptées.
          </p>
          <Button variant="outline" size="sm" onClick={telechargerModele}>
            <FileDown aria-hidden /> Modèle CSV
          </Button>
        </div>

        <details className="rounded-lg border border-border">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
            Colonnes attendues (détail)
          </summary>
          <div className="overflow-x-auto p-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colonne</TableHead>
                  <TableHead>Requis</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {COLONNES_IMPORT.map((c) => (
                  <TableRow key={c.colonne}>
                    <TableCell className="font-mono text-xs">{c.colonne}</TableCell>
                    <TableCell>
                      {c.requis ? <Badge variant="destructive">Oui</Badge> : <Badge variant="outline">Non</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>

        {/* Rapport d'import (erreurs ligne par ligne) */}
        {rapport && (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3" data-testid="rapport-import">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{rapport.created ?? 0} créée(s)</Badge>
              <Badge variant="outline">{rapport.ignored ?? 0} ignorée(s)</Badge>
              {rapport.errors?.length > 0 && (
                <Badge variant="destructive">{rapport.errors.length} erreur(s)</Badge>
              )}
            </div>
            {rapport.errors?.length > 0 && (
              <ul className="max-h-40 overflow-y-auto text-xs">
                {rapport.errors.map((e, i) => (
                  <li key={i} className="border-t border-border/60 pt-1.5 text-muted-foreground">
                    <span className="font-semibold text-destructive">Ligne {e.line}</span> — {e.error}
                    {e.data?.title && <span> (offre : {e.data.title})</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={fermer}>
            Fermer
          </Button>
          <Button size="sm" onClick={lancerImport} disabled={!fichier || importMutation.isPending}>
            {importMutation.isPending ? <Spinner /> : <Upload aria-hidden />}
            {importMutation.isPending ? "Import en cours…" : "Importer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DialogImport
