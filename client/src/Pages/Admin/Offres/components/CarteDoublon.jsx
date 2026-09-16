import { useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeftRight, Check, X } from "lucide-react"
import {
  useMarquerDoublon, useRejeterDoublon, messageErreurMutation,
} from "@/features/admin-offres.tools"
import { useNotify } from "@/contexts/Notify.context"
import { ApercuOffre, BoutonApercu } from "@/components/admin/ApercuOffre"
import { Badge } from "@/components/ui/badge"
import BtnAction from "@/components/admin/BtnAction"
import DialogFusionOffre from "@/components/dialog/DialogFusionOffre"

/* ─────────────────────────────────────────────────────────────────────
   Carte d'une paire de doublons potentiels.
   Mode mobile intégré en responsive interne (pas de composant dupliqué) :
   la carte porte des mutations + un Dialog + un aperçu — une version
   mobile séparée les monterait deux fois.
     • Comparaison A|B : empilée avec séparateur à lignes en < sm,
       côte à côte en sm+.
     • Actions : boutons pleine largeur empilés en mobile (cibles
       tactiles larges), alignés à droite en sm+.
───────────────────────────────────────────────────────────────────── */

/* Panneau d'une offre (A ou B) — mutualisé. */
const BlocOffre = ({ libelle, offreId, titre, onApercu }) => (
  <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 p-2.5">
    <span className="text-[9px] font-bold tracking-wider text-muted-foreground/70 uppercase">{libelle}</span>
    <div className="flex items-center gap-1.5">
      <BoutonApercu
        onClick={() => onApercu(offreId)}
        libelle={`Aperçu de ${titre}`}
      />
      <Link
        to={`/admin/offres/${offreId}`}
        className="min-w-0 truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
        title={titre}
      >
        {titre}
      </Link>
    </div>
  </div>
)

const CarteDoublon = ({ paire, onTraitee }) => {
  const notify = useNotify()
  const [dialogOuvert, setDialogOuvert] = useState(false)
  const [motif, setMotif] = useState("")
  const [apercuOffreId, setApercuOffreId] = useState(null)
  const marquerMutation = useMarquerDoublon()
  const rejeterMutation = useRejeterDoublon()

  const score = paire.similarity_score ?? 0

  const fusionner = () => {
    marquerMutation.mutate(
      { offerBId: paire.offer_b_id, duplicateOfId: paire.offer_a_id, raison: motif.trim() || undefined },
      {
        onSuccess: (res) => {
          notify(res?.message || "Offre marquée comme doublon", "success")
          setDialogOuvert(false)
          onTraitee?.()
        },
        onError: (err) => notify(messageErreurMutation(err) || "Fusion impossible", "error"),
      }
    )
  }

  const rejeter = () => {
    rejeterMutation.mutate(
      { offerAId: paire.offer_a_id, offerBId: paire.offer_b_id },
      {
        onSuccess: (res) => {
          notify(res?.message || "Paire rejetée — elle ne reviendra plus dans les scans", "success")
          onTraitee?.()
        },
        onError: (err) => notify(messageErreurMutation(err) || "Rejet impossible", "error"),
      }
    )
  }

  const mutationEnCours = marquerMutation.isPending || rejeterMutation.isPending

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/25"
      data-testid="paire-doublon"
    >
      {/* En-tête : score + entreprise + raison
          (la raison prend sa propre ligne en mobile). */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={score >= 90 ? "destructive" : score >= 80 ? "warning" : "secondary"}
          className="tabular-nums"
        >
          {score}% similaire
        </Badge>
        <span className="text-xs font-medium text-muted-foreground">
          {paire.offer_a_company || "Entreprise inconnue"}
        </span>
        <span
          className="ml-auto flex w-full items-center justify-end gap-1 truncate text-[10px] text-muted-foreground/70 sm:w-auto"
          title={paire.reason}
        >
          {paire.reason}
        </span>
      </div>

      {/* Comparaison A | B : empilée en mobile avec séparateur à lignes,
          côte à côte en sm+. */}
      <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <BlocOffre
          libelle="Offre A (conservée)"
          offreId={paire.offer_a_id}
          titre={paire.offer_a_title}
          onApercu={setApercuOffreId}
        />
        {/* Séparateur : lignes horizontales + icône en mobile, icône seule en sm+ */}
        <div className="flex items-center justify-center gap-2 text-muted-foreground/50" aria-hidden="true">
          <span className="h-px flex-1 bg-border sm:hidden" />
          <ArrowLeftRight className="size-4 shrink-0" />
          <span className="h-px flex-1 bg-border sm:hidden" />
        </div>
        <BlocOffre
          libelle="Offre B (candidate au doublon)"
          offreId={paire.offer_b_id}
          titre={paire.offer_b_title}
          onApercu={setApercuOffreId}
        />
      </div>

      {/* Actions : pleine largeur empilées en mobile (cibles tactiles),
          alignées à droite en sm+. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <BtnAction variant="outline" size="sm" onClick={rejeter} disabled={mutationEnCours} className="w-full sm:w-auto">
          <Check aria-hidden /> Ce n'est pas un doublon
        </BtnAction>
        <BtnAction size="sm" variant="danger" onClick={() => setDialogOuvert(true)} disabled={mutationEnCours} className="w-full sm:w-auto">
          <X aria-hidden /> Fusionner
        </BtnAction>
      </div>

      {/* Confirmation fusion (motif optionnel). */}
      <DialogFusionOffre
        open={dialogOuvert}
        setOpen={setDialogOuvert}
        paire={paire}
        marquerMutation={marquerMutation}
        motif={motif}
        setMotif={setMotif}
        fusionner={fusionner}
      />


      {/* Aperçu rapide de l'offre A ou B (comparaison avant décision). */}
      <ApercuOffre
        ouvert={!!apercuOffreId}
        onOpenChange={(o) => !o && setApercuOffreId(null)}
        offerId={apercuOffreId}
      />
    </motion.article>
  )
}



export default CarteDoublon