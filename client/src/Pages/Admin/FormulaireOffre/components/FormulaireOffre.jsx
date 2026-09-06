import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Copy, Save } from "lucide-react"
import {
  useCreerOffre, useModifierOffre, messageErreurMutation, estOffreExistante,
} from "@/features/admin-offres.tools"
import { useNotify } from "@/contexts/Notify.context"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import ListeDynamique from "@/components/admin/ListeDynamique"

/* ─────────────────────────────────────────────────────────────────────
   Formulaire création/édition d'offre (composant piloté par la page
   parente FormulaireOffre/index.jsx qui fournit offre + référentiels).

   Contrat serveur (schemas/offers.py) :
   - requis : title (2-300), company_name (1-255), source_code (1-80),
     source_url (5-1000) ;
   - codes référentiel : filiere_code, contract_type_code,
     experience_level_code, education_level_code (TEXTES, pas UUID) ;
   - location_label : texte libre (get-or-create) ;
   - dates ISO : published_at, expires_at, application_deadline_at ;
   - salary_raw : texte libre (255 max) — salaire tel que publié ;
   - listes : missions, profile_requirements, benefits, tags ;
   - intro : texte.

   Dédoublonnage (services/offers.py::create_offer) : si le hash
   existe, l'API renvoie l'offre existante SANS erreur. Détection :
   origin !== "manuel" (ou admin_id absent) → bandeau « existe déjà »
   + redirection vers la fiche existante.
   ───────────────────────────────────────────────────────────────────── */

const SELECT_VIDE = "__vide__"

const valeursInitiales = (offre) => ({
  title: offre?.title ?? "",
  company_name: offre?.company?.name ?? "",
  source_code: offre?.source?.code ?? "",
  source_url: offre?.source_url ?? "",
  source_reference: offre?.source_reference ?? "",
  filiere_code: offre?.primary_filiere?.code ?? "",
  location_label: offre?.location?.label ?? "",
  contract_type_code: offre?.contract_type?.code ?? "",
  experience_level_code: offre?.experience_level?.code ?? "",
  education_level_code: offre?.education_level?.code ?? "",
  published_at: offre?.published_at ? offre.published_at.slice(0, 10) : "",
  salary_raw: offre?.salary_raw ?? "",
  intro: offre?.detail?.intro ?? "",
  missions: offre?.detail?.missions ?? [],
  profile_requirements: offre?.detail?.profile_requirements ?? [],
  benefits: offre?.detail?.benefits ?? [],
  tags: offre?.detail?.tags ?? [],
})

const FormulaireOffre = ({ edition, offre, chargementOffre, referentiels, onRetour }) => {
  const navigate = useNavigate()
  const notify = useNotify()

  // Initialisation UNE fois au montage : le parent passe key={offre?.id ?? "nouvelle"}
  // → tout changement d'identité d'offre remonte le composant, pas de
  // setState dans un effect (règle react-hooks/set-state-in-effect).
  const [valeurs, setValeurs] = useState(() => valeursInitiales(offre))
  const [doublonDetecte, setDoublonDetecte] = useState(null)

  const creerMutation = useCreerOffre()
  const modifierMutation = useModifierOffre()

  const set = (champ) => (v) => setValeurs((prev) => ({ ...prev, [champ]: v }))
  const setListe = (champ) => (nouvelles) => setValeurs((prev) => ({ ...prev, [champ]: nouvelles }))

  const sources = referentiels?.sources ?? []
  const filieres = referentiels?.filieres ?? []
  const contrats = referentiels?.contrats ?? []
  const experiences = referentiels?.experiences ?? []
  const niveaux = referentiels?.niveaux ?? []

  // Payload : codes référentiel, listes nettoyées (vides retirées),
  // dates ISO — exactement le contrat OfferCreate.
  const construirePayload = () => {
    const listesPropres = (l) => l.map((v) => v.trim()).filter(Boolean)
    return {
      title: valeurs.title.trim(),
      company_name: valeurs.company_name.trim(),
      source_code: valeurs.source_code,
      source_url: valeurs.source_url.trim(),
      source_reference: valeurs.source_reference.trim() || null,
      filiere_code: valeurs.filiere_code || null,
      location_label: valeurs.location_label.trim() || null,
      contract_type_code: valeurs.contract_type_code || null,
      experience_level_code: valeurs.experience_level_code || null,
      education_level_code: valeurs.education_level_code || null,
      published_at: valeurs.published_at ? new Date(valeurs.published_at).toISOString() : null,
      salary_raw: valeurs.salary_raw.trim() || null,
      intro: valeurs.intro.trim() || null,
      missions: listesPropres(valeurs.missions),
      profile_requirements: listesPropres(valeurs.profile_requirements),
      benefits: listesPropres(valeurs.benefits),
      tags: listesPropres(valeurs.tags),
    }
  }

  const soumettre = async (e) => {
    e.preventDefault()
    setDoublonDetecte(null)

    const payload = construirePayload()
    try {
      if (edition) {
        await modifierMutation.mutateAsync({ offerId: offre.id, data: payload })
        notify("Offre mise à jour", "success")
        onRetour()
      } else {
        const resultat = await creerMutation.mutateAsync(payload)
        // Dédoublonnage silencieux : l'API renvoie l'offre EXISTANTE si
        // le hash correspond. Détection par created_at (une création
        // fraîche date de moins d'une minute, cf. estOffreExistante).
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

  if (chargementOffre) {
    return (
      <div className="flex min-h-64 items-center justify-center" role="status">
        <Spinner className="size-5" />
      </div>
    )
  }

  const enCours = creerMutation.isPending || modifierMutation.isPending
  const requisComplets =
    valeurs.title.trim().length >= 2 &&
    valeurs.company_name.trim() &&
    valeurs.source_code &&
    valeurs.source_url.trim().length >= 5

  return (
    <form onSubmit={soumettre} className="flex flex-col gap-6" noValidate>
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={onRetour} aria-label="Retour à la liste">
            <ArrowLeft aria-hidden />
          </Button>
          <h1 className="font-heading text-lg font-bold">
            {edition ? "Modifier l'offre" : "Nouvelle offre"}
          </h1>
          {edition && offre && (
            <Badge variant="outline">{offre.title}</Badge>
          )}
        </div>
        <Button type="submit" size="sm" disabled={enCours || !requisComplets}>
          {enCours ? <Spinner /> : <Save aria-hidden />}
          {enCours ? "Enregistrement…" : edition ? "Enregistrer" : "Créer l'offre"}
        </Button>
      </div>

      {/* Bandeau dédoublonnage silencieux */}
      {doublonDetecte && (
        <Alert variant="destructive">
          <Copy />
          <AlertTitle>Cette offre existe déjà</AlertTitle>
          <AlertDescription>
            Une offre identique (même titre, entreprise et URL source) figure déjà en base.
            Vous êtes redirigé vers sa fiche : « {doublonDetecte.title} » (origine {doublonDetecte.origin}).
            <button
              type="button"
              onClick={() => navigate(`/admin/offres/${doublonDetecte.id}`)}
              className="ml-1 font-semibold underline underline-offset-4"
            >
              Y aller maintenant
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Bloc 1 : identification */}
      <fieldset className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <legend className="px-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">
          Identification
        </legend>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="offre-title">Titre *</Label>
          <Input
            id="offre-title"
            value={valeurs.title}
            onChange={(e) => set("title")(e.target.value)}
            required
            minLength={2}
            maxLength={300}
            placeholder="Ex. Développeur Full Stack React/Node"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="offre-entreprise">Entreprise *</Label>
          <Input
            id="offre-entreprise"
            value={valeurs.company_name}
            onChange={(e) => set("company_name")(e.target.value)}
            required
            maxLength={255}
            placeholder="Ex. Abidjan Digital Labs"
          />
          <p className="text-[10px] text-muted-foreground">
            Texte libre — l'entreprise est créée ou réutilisée automatiquement.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="offre-source">Source *</Label>
          <Select value={valeurs.source_code} onValueChange={set("source_code")}>
            <SelectTrigger id="offre-source" className="w-full">
              <SelectValue placeholder="Choisir une source" />
            </SelectTrigger>
            <SelectContent>
              {sources.map((s) => (
                <SelectItem key={s.code} value={s.code}>{s.label ?? s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="offre-source-url">URL de l'offre *</Label>
          <Input
            id="offre-source-url"
            type="url"
            value={valeurs.source_url}
            onChange={(e) => set("source_url")(e.target.value)}
            required
            placeholder="https://…"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="offre-source-ref">Référence source (optionnel)</Label>
          <Input
            id="offre-source-ref"
            value={valeurs.source_reference}
            onChange={(e) => set("source_reference")(e.target.value)}
            placeholder="Ex. offre-154816"
          />
          <p className="text-[10px] text-muted-foreground">
            Utilisée par le dédoublonnage : deux offres avec la même référence sont considérées identiques.
          </p>
        </div>
      </fieldset>

      {/* Bloc 2 : référentiels */}
      <fieldset className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <legend className="px-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">
          Classement (codes du référentiel)
        </legend>

        <div className="flex flex-col gap-1.5">
          <Label>Filière</Label>
          <Select value={valeurs.filiere_code} onValueChange={set("filiere_code")}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Choisir une filière" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_VIDE}>— Aucune —</SelectItem>
              {filieres.map((f) => (
                <SelectItem key={f.code} value={f.code}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Type de contrat</Label>
          <Select value={valeurs.contract_type_code} onValueChange={set("contract_type_code")}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Choisir un contrat" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_VIDE}>— Aucun —</SelectItem>
              {contrats.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Expérience</Label>
          <Select value={valeurs.experience_level_code} onValueChange={set("experience_level_code")}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Choisir un niveau" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_VIDE}>— Aucun —</SelectItem>
              {experiences.map((x) => (
                <SelectItem key={x.code} value={x.code}>{x.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Niveau d'études</Label>
          <Select value={valeurs.education_level_code} onValueChange={set("education_level_code")}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Choisir un diplôme" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_VIDE}>— Aucun —</SelectItem>
              {niveaux.map((n) => (
                <SelectItem key={n.code} value={n.code}>{n.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="offre-ville">Ville</Label>
          <Input
            id="offre-ville"
            value={valeurs.location_label}
            onChange={(e) => set("location_label")(e.target.value)}
            placeholder="Ex. Abidjan"
          />
          <p className="text-[10px] text-muted-foreground">
            Texte libre — normalisée puis créée ou réutilisée automatiquement.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="offre-salaire">Salaire</Label>
          <Input
            id="offre-salaire"
            value={valeurs.salary_raw}
            onChange={(e) => set("salary_raw")(e.target.value)}
            maxLength={255}
            placeholder="Ex. 400 000 - 600 000 FCFA"
          />
          <p className="text-[10px] text-muted-foreground">
            Texte libre tel que publié — non structuré (ex. « 400 000 - 600 000 FCFA », « selon profil »).
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="offre-publiee">Date de publication</Label>
          <Input
            id="offre-publiee"
            type="date"
            value={valeurs.published_at}
            onChange={(e) => set("published_at")(e.target.value)}
          />
        </div>
      </fieldset>

      {/* Bloc 3 : contenu détaillé */}
      <fieldset className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <legend className="px-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">
          Contenu détaillé
        </legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="offre-intro">Intro</Label>
          <Textarea
            id="offre-intro"
            value={valeurs.intro}
            onChange={(e) => set("intro")(e.target.value)}
            rows={3}
            placeholder="Présentation courte de l'offre…"
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ListeDynamique
            label="Missions"
            valeurs={valeurs.missions}
            onChange={setListe("missions")}
            placeholder="Ex. Développer le front office…"
          />
          <ListeDynamique
            label="Profil recherché"
            valeurs={valeurs.profile_requirements}
            onChange={setListe("profile_requirements")}
            placeholder="Ex. 3 ans d'expérience React…"
          />
          <ListeDynamique
            label="Avantages"
            valeurs={valeurs.benefits}
            onChange={setListe("benefits")}
            placeholder="Ex. Mutuelle prise en charge…"
          />
          <ListeDynamique
            label="Tags"
            valeurs={valeurs.tags}
            onChange={setListe("tags")}
            placeholder="Ex. remote"
          />
        </div>
      </fieldset>

      {/* Barre d'actions finale */}
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onRetour}>
          Annuler
        </Button>
        <Button type="submit" size="sm" disabled={enCours || !requisComplets}>
          {enCours ? <Spinner /> : <Save aria-hidden />}
          {enCours ? "Enregistrement…" : edition ? "Enregistrer" : "Créer l'offre"}
        </Button>
      </div>
    </form>
  )
}

export default FormulaireOffre
