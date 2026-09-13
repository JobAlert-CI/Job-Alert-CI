import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { FormProvider, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Copy } from "lucide-react"
import {
  useCreerOffre, useModifierOffre, messageErreurMutation, estOffreExistante,
} from "@/features/admin-offres.tools"
import { useNotify } from "@/contexts/Notify.context"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { schemaOffre } from "../formulaire/schemaOffre"
import { valeursInitiales, construirePayload } from "../formulaire/utilsFormulaire"
import IdentificationSection from "../formulaire/IdentificationSection"
import ClassementSection from "../formulaire/ClassementSection"
import LocalisationRemunerationSection from "../formulaire/LocalisationRemunerationSection"
import ContenuDetailleSection from "../formulaire/ContenuDetailleSection"
import ActionsBar from "../formulaire/ActionsBar"

/* ─────────────────────────────────────────────────────────────────────
   Formulaire création/édition d'offre — React Hook Form + Zod.
   ⚠️ Fiabilité : `control` est passé EXPLICITEMENT en prop à chaque
   section et à chaque <Controller> — plus aucune dépendance à
   useFormContext (immunisé contre le contexte null / doublons de
   versions react-hook-form, et l'export <Form> absent avant v7.43).
   On garde <FormProvider> (API garantie depuis toujours) par sécurité.
───────────────────────────────────────────────────────────────────── */

/* Bandeau affiché quand le dédoublonnage silencieux renvoie une offre
   existante (create_offer retourne l'offre SANS erreur si le hash matche). */
const BandeauDoublon = ({ doublon, onYAller }) => (
  <Alert variant="destructive">
    <Copy aria-hidden />
    <AlertTitle>Cette offre existe déjà</AlertTitle>
    <AlertDescription>
      Une offre identique (même titre, entreprise et URL source) figure déjà en base. Vous êtes
      redirigé vers sa fiche : « {doublon.title} » (origine {doublon.origin}).
      <button
        type="button"
        onClick={onYAller}
        className="ml-1 font-semibold underline underline-offset-4"
      >
        Y aller maintenant
      </button>
    </AlertDescription>
  </Alert>
)

const FormulaireOffre = ({ edition, offre, referentiels, onRetour }) => {
  const navigate = useNavigate()
  const notify = useNotify()
  const creerMutation = useCreerOffre()
  const modifierMutation = useModifierOffre()
  const [doublonDetecte, setDoublonDetecte] = useState(null)

  const form = useForm({
    resolver: zodResolver(schemaOffre),
    defaultValues: valeursInitiales(offre),
    mode: "onBlur",
    shouldFocusError: true,
  })
  const {
    formState: { isDirty },
    handleSubmit,
    control,
  } = form

  const enCours = creerMutation.isPending || modifierMutation.isPending

  const surSoumissionValide = async (valeurs) => {
    setDoublonDetecte(null)
    const payload = construirePayload(valeurs)
    try {
      if (edition) {
        await modifierMutation.mutateAsync({ offerId: offre.id, data: payload })
        notify("Offre mise à jour", "success")
        onRetour()
      } else {
        const resultat = await creerMutation.mutateAsync(payload)
        // Dédoublonnage silencieux : l'API renvoie l'offre EXISTANTE si le
        // hash correspond. Détection via created_at très récent.
        if (estOffreExistante(resultat)) {
          setDoublonDetecte(resultat)
          notify("Cette offre existe déjà — vous êtes redirigé vers sa fiche.", "warning", 0)
        } else {
          notify("Offre créée", "success")
          navigate(`/admin/offres/${resultat.id}`)
        }
      }
    } catch (err) {
      notify(messageErreurMutation(err) || "Enregistrement impossible", "error")
    }
  }

  /* Scroll vers la première erreur (en complément du focus automatique). */
  const surSoumissionInvalide = (errors) => {
    const premiereCle = Object.keys(errors)[0]
    if (!premiereCle) return
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-champ="${premiereCle}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }

  return (
    <FormProvider {...form}>
      <form
        onSubmit={handleSubmit(surSoumissionValide, surSoumissionInvalide)}
        noValidate
        className="flex flex-col gap-6"
      >
        {/* En-tête compact : retour + titre + badge édition */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" size="icon" onClick={onRetour} aria-label="Retour à la liste">
              <ArrowLeft aria-hidden />
            </Button>
            <h1 className="font-heading text-lg font-bold">
              {edition ? "Modifier l'offre" : "Nouvelle offre"}
            </h1>
            {edition && offre && (
              <Badge variant="outline" className="max-w-56 truncate">{offre.title}</Badge>
            )}
          </div>
        </div>

        {doublonDetecte && (
          <BandeauDoublon
            doublon={doublonDetecte}
            onYAller={() => navigate(`/admin/offres/${doublonDetecte.id}`)}
          />
        )}

        {/* control passé en prop : zéro dépendance au contexte RHF */}
        <IdentificationSection sources={referentiels?.sources ?? []} control={control} />
        <ClassementSection referentiels={referentiels} control={control} />
        <LocalisationRemunerationSection control={control} />
        <ContenuDetailleSection control={control} />

        <ActionsBar edition={edition} isDirty={isDirty} enCours={enCours} onRetour={onRetour} />
      </form>
    </FormProvider>
  )
}

export default FormulaireOffre