import { useState } from "react"
import { UserX, Copy, Check, ChevronDown, ChevronRight, } from "lucide-react"
import { cn } from "cn"
import { useNotify } from "@/contexts/Notify.context"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { LIBELLE_COURT_ACTION } from "@/Pages/Admin/Journal/components/CONSTANTES"


const dateHeure = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

/* ─── Arborescence JSON du détail : objets/tableaux repliables,
   valeurs typées mises en forme — les payloads imbriqués restent
   lisibles, sans « break-all » monolithique. ─── */
const formaterValeurJson = (valeur) => {
  if (valeur === null) return "null"
  if (valeur === undefined) return "undefined"
  if (typeof valeur === "string") return valeur
  return String(valeur)
}

const classeValeurJson = (valeur) => {
  if (valeur === null || valeur === undefined) return "italic text-muted-foreground"
  if (typeof valeur === "boolean") return "font-semibold text-primary"
  if (typeof valeur === "number") return "tabular-nums text-primary"
  return ""
}

const NoeudJson = ({ cle, valeur, profondeur }) => {
  const estConteneur = valeur !== null && typeof valeur === "object"
  /* Premier niveau ouvert d'office, les niveaux imbriqués repliés. */
  const [ouvert, setOuvert] = useState(profondeur < 1)

  if (!estConteneur) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-2 py-0.5 pl-5">
        {cle !== null && <span className="text-xs font-medium text-muted-foreground">{cle} :</span>}
        <span className={cn("font-mono text-[11px] break-all", classeValeurJson(valeur))}>
          {formaterValeurJson(valeur)}
        </span>
      </div>
    )
  }

  const entreesObjet = Object.entries(valeur)
  return (
    <div className="py-0.5">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex items-center gap-1 rounded-sm py-0.5 pl-1 text-left transition-colors hover:text-foreground"
      >
        {ouvert ? <ChevronDown className="size-3 shrink-0" aria-hidden /> : <ChevronRight className="size-3 shrink-0" aria-hidden />}
        {cle !== null && <span className="text-xs font-medium text-muted-foreground">{cle} :</span>}
        <span className="text-[10px] text-muted-foreground">
          {Array.isArray(valeur)
            ? `${entreesObjet.length} élément${entreesObjet.length > 1 ? "s" : ""}`
            : `${entreesObjet.length} clé${entreesObjet.length > 1 ? "s" : ""}`}
        </span>
      </button>
      {ouvert && (
        <div className="ml-2 border-l border-border pl-1">
          {entreesObjet.map(([k, v]) => (
            <NoeudJson key={k} cle={k} valeur={v} profondeur={profondeur + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Dialog : détail d'une entrée (arborescence JSON + copie) ────── */
const DialogDetailsJournal = ({ entree, onFermer }) => {
  const notify = useNotify()
  const [copie, setCopie] = useState(false)

  const copierJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entree.details ?? {}, null, 2))
      setCopie(true)
      notify("JSON copié dans le presse-papiers", "success")
      setTimeout(() => setCopie(false), 2000)
    } catch {
      notify("Copie impossible — sélectionnez le texte manuellement", "warning")
    }
  }

  const details = entree.details ?? {}
  const aDesDetails = Object.keys(details).length > 0

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {LIBELLE_COURT_ACTION[entree.action] ?? entree.action} — {entree.target_table}
          </DialogTitle>
          <DialogDescription>
            {dateHeure(entree.created_at)}
            {entree.target_id && (
              <> · cible <code className="font-mono text-[10px]">{entree.target_id}</code></>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {entree.admin_id ? (
            <p className="text-xs text-muted-foreground">
              Auteur : <code className="font-mono text-[10px]">{entree.admin_id}</code>
            </p>
          ) : (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <UserX className="size-3.5" aria-hidden /> Auteur : compte supprimé (entrées préservées)
            </p>
          )}
          {aDesDetails ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold">Détails (payload JSON)</p>
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={copierJson}>
                  {copie ? (
                    <Check className="size-3.5 text-emerald-600" aria-hidden />
                  ) : (
                    <Copy className="size-3.5" aria-hidden />
                  )}
                  {copie ? "Copié" : "Copier le JSON"}
                </Button>
              </div>
              <div className="max-h-72 overflow-auto rounded-lg border border-border bg-muted/30 p-2 scrollbar-thin">
                {Object.entries(details).map(([cle, valeur]) => (
                  <NoeudJson key={cle} cle={cle} valeur={valeur} profondeur={0} />
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Aucun détail supplémentaire pour cette action.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default DialogDetailsJournal