import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Loader2, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "../components/PageHeader"
import { extractErrorMessage } from "@/api/admin/adminAxios"
import { useAdminMutations, useFilieresSafe, useOfferSafe, useSourcesSafe } from "./adminHooks"

/* Champ liste éditable réutilisé : missions, prérequis, avantages, tags */
const ListField = ({ label, hint, values, onChange }) => {
  const [input, setInput] = useState("")
  const add = () => {
    const v = input.trim()
    if (!v || values.includes(v)) return
    onChange([...values, v])
    setInput("")
  }
  return (
    <div>
      <span className="adm-label">{label}</span>
      <div className="flex items-center gap-2">
        <input
          className="adm-input h-9 flex-1 text-sm"
          value={input}
          placeholder={hint}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
        />
        <button type="button" className="adm-btn-outline !h-9 px-2.5" onClick={add} aria-label={`Ajouter à ${label}`}>
          <Plus className="size-4" />
        </button>
      </div>
      {values.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {values.map((value, index) => (
            <li key={`${value}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((_, i) => i !== index))}
                className="rounded-full p-0.5 hover:bg-black/10"
                aria-label={`Retirer ${value}`}
              >
                <Trash2 className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const EMPTY_FORM = {
  title: "",
  company_name: "",
  source_code: "",
  source_url: "",
  filiere_code: "",
  location_label: "",
  contract_type_code: "",
  experience_level_code: "",
  education_level_code: "",
  published_at: "",
  expires_at: "",
  application_deadline_at: "",
  intro: "",
}
const EMPTY_LISTS = { missions: [], profile_requirements: [], benefits: [], tags: [] }

/**
 * Page 9 — /admin/offres/nouvelle et /admin/offres/:id.
 * POST /offers · PUT /offers/{id} · GET /offers/{id} (préremplissage).
 * ⚠ Les référentiels se soumettent par **code**, jamais par UUID.
 * Après création → redirection en mode édition.
 */
export const OfferFormPage = () => {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const offerQuery = useOfferSafe(isEdit ? id : null)
  const m = useAdminMutations()
  const filieresQuery = useFilieresSafe()
  const sourcesQuery = useSourcesSafe()

  const filieres = filieresQuery.data || []
  const sources = sourcesQuery.data || []

  const [form, setForm] = useState(EMPTY_FORM)
  const [lists, setLists] = useState(EMPTY_LISTS)

  /* Préremplissage en mode édition */
  useEffect(() => {
    const offer = offerQuery.data
    if (!isEdit || !offer) return
    /* Synchronisation des données serveur vers le formulaire */
    // eslint-disable-next-line react-hooks/set-state-in-effect -- données serveur → formulaire
    setForm({
      title: offer.title ?? "",
      company_name: offer.company?.name ?? "",
      source_code: offer.source?.code ?? "",
      source_url: offer.source_url ?? "",
      filiere_code: offer.primary_filiere?.code ?? "",
      location_label: offer.location?.label ?? "",
      contract_type_code: offer.contract_type?.code ?? "",
      experience_level_code: offer.experience_level?.code ?? "",
      education_level_code: offer.education_level?.code ?? "",
      published_at: offer.published_at?.slice(0, 10) ?? "",
      expires_at: offer.expires_at?.slice(0, 10) ?? "",
      application_deadline_at: offer.application_deadline_at?.slice(0, 10) ?? "",
      intro: offer.detail?.intro ?? "",
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect -- données serveur → listes
    setLists({
      missions: offer.detail?.missions ?? [],
      profile_requirements: offer.detail?.profile_requirements ?? [],
      benefits: offer.detail?.benefits ?? [],
      tags: offer.detail?.tags ?? [],
    })
  }, [isEdit, offerQuery.data])

  const set = (name) => (event) => setForm((prev) => ({ ...prev, [name]: event.target.value }))

  /** Payload API — référentiels par code + dates ISO ou null. */
  const buildPayload = () => ({
    title: form.title.trim(),
    company_name: form.company_name.trim(),
    source_code: form.source_code,
    source_url: form.source_url.trim(),
    filiere_code: form.filiere_code || null,
    location_label: form.location_label || null,
    contract_type_code: form.contract_type_code || null,
    experience_level_code: form.experience_level_code || null,
    education_level_code: form.education_level_code || null,
    published_at: form.published_at ? new Date(form.published_at).toISOString() : null,
    expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    application_deadline_at: form.application_deadline_at ? new Date(form.application_deadline_at).toISOString() : null,
    ...lists,
  })

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      if (!isEdit) {
        const created = await m.createOfferMutation.mutateAsync(buildPayload())
        toast.success("Offre créée", "Redirection en mode édition…")
        navigate(`/admin/offres/${created.id}`, { replace: true })
      } else {
        await m.updateOfferMutation.mutateAsync({ id, data: buildPayload() })
        toast.success("Offre enregistrée", form.title)
      }
    } catch (error) {
      toast.error("Enregistrement impossible", extractErrorMessage(error))
    }
  }

  if (isEdit && offerQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Chargement de l'offre…
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <PageHeader
        title={isEdit ? "Éditer l'offre" : "Nouvelle offre"}
        description={
          isEdit
            ? `Origine : ${offerQuery.data?.origin ?? "inconnue"} — dernière collecte ${offerQuery.data?.collected_at ? new Date(offerQuery.data.collected_at).toLocaleString("fr-FR") : "—"}`
            : "L'offre sera créée avec l'origine « manual » puis vous serez redirigé en mode édition."
        }
        crumbs={[
          { label: "Accueil", to: "/admin" },
          { label: "Offres", to: "/admin/offres" },
          { label: isEdit ? "Édition" : "Création" },
        ]}
        actions={
          <>
            {isEdit && (
              <span className="mr-auto inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-secondary-foreground">
                origin = {offerQuery.data?.origin ?? "—"}
              </span>
            )}
            <button type="submit" className="adm-btn-primary" disabled={m.createOfferMutation.isPending || m.updateOfferMutation.isPending}>
              {(m.createOfferMutation.isPending || m.updateOfferMutation.isPending) && <Loader2 className="size-4 animate-spin" />}
              <Save className="size-4" />
              {isEdit ? "Enregistrer" : "Créer l'offre"}
            </button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Colonne principale */}
        <div className="flex flex-col gap-4">
          <section className="adm-card grid gap-3 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="off-title" className="adm-label">Titre de l'offre *</label>
              <input id="off-title" required minLength={2} className="adm-input" value={form.title} onChange={set("title")} placeholder="Ex : Développeur Fullstack React / Python" />
            </div>
            <div>
              <label htmlFor="off-company" className="adm-label">Entreprise *</label>
              <input id="off-company" required className="adm-input" value={form.company_name} onChange={set("company_name")} placeholder="Ex : Orange Côte d'Ivoire" />
            </div>
            <div>
              <label htmlFor="off-location" className="adm-label">Localisation</label>
              <input id="off-location" className="adm-input" value={form.location_label} onChange={set("location_label")} placeholder="Ex : Abidjan, Plateau" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="off-intro" className="adm-label">Introduction</label>
              <textarea id="off-intro" rows={3} className="adm-input" value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} placeholder="Résumé accrocheur du poste…" />
            </div>
          </section>

          <section className="adm-card grid gap-4 p-5 sm:grid-cols-2">
            <ListField label="Missions" hint="Ex : Concevoir les API REST…" values={lists.missions} onChange={(v) => setLists({ ...lists, missions: v })} />
            <ListField label="Profil recherché" hint="Ex : 3 ans d'expérience React…" values={lists.profile_requirements} onChange={(v) => setLists({ ...lists, profile_requirements: v })} />
            <ListField label="Avantages" hint="Ex : Assurance santé…" values={lists.benefits} onChange={(v) => setLists({ ...lists, benefits: v })} />
            <ListField label="Tags" hint="Ex : remote, python…" values={lists.tags} onChange={(v) => setLists({ ...lists, tags: v })} />
          </section>
        </div>

        {/* Colonne latérale : référentiels par CODE + dates */}
        <div className="flex flex-col gap-4">
          <section className="adm-card grid gap-3 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Source & référentiels (par code)</h3>
            <div>
              <label htmlFor="off-source" className="adm-label">Source *</label>
              <select id="off-source" required className="adm-input" value={form.source_code} onChange={set("source_code")}>
                <option value="">— Choisir une source —</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.code}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="off-url" className="adm-label">URL d'origine *</label>
              <input id="off-url" required type="url" minLength={5} className="adm-input" value={form.source_url} onChange={set("source_url")} placeholder="https://…" />
            </div>
            <div>
              <label htmlFor="off-filiere" className="adm-label">Filière</label>
              <select id="off-filiere" className="adm-input" value={form.filiere_code} onChange={set("filiere_code")}>
                <option value="">— Aucune —</option>
                {filieres.map((f) => (
                  <option key={f.id} value={f.code}>{f.label}</option>
                ))}
              </select>
            </div>
            <p className="rounded-lg bg-surface-container px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              ⚠ L'API attend les <strong>codes</strong> des référentiels (ex. « tech-dev »), jamais leurs UUID.
              Les listes ci-dessus transmettent automatiquement le code.
            </p>
          </section>

          <section className="adm-card grid gap-3 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Classification & dates</h3>
            <div>
              <label htmlFor="off-contract" className="adm-label">Type de contrat</label>
              <input id="off-contract" className="adm-input" value={form.contract_type_code} onChange={set("contract_type_code")} placeholder="code : cdi, cdd, stage…" />
            </div>
            <div>
              <label htmlFor="off-exp" className="adm-label">Niveau d'expérience</label>
              <input id="off-exp" className="adm-input" value={form.experience_level_code} onChange={set("experience_level_code")} placeholder="code : junior, senior…" />
            </div>
            <div>
              <label htmlFor="off-edu" className="adm-label">Niveau d'études</label>
              <input id="off-edu" className="adm-input" value={form.education_level_code} onChange={set("education_level_code")} placeholder="code : licence, master…" />
            </div>
            <div>
              <label htmlFor="off-pub" className="adm-label">Publiée le</label>
              <input id="off-pub" type="date" className="adm-input" value={form.published_at} onChange={set("published_at")} />
            </div>
            <div>
              <label htmlFor="off-exp2" className="adm-label">Expire le</label>
              <input id="off-exp2" type="date" className="adm-input" value={form.expires_at} onChange={set("expires_at")} />
            </div>
            <div>
              <label htmlFor="off-deadline" className="adm-label">Date limite de candidature</label>
              <input id="off-deadline" type="date" className="adm-input" value={form.application_deadline_at} onChange={set("application_deadline_at")} />
            </div>
          </section>
        </div>
      </div>
    </form>
  )
}



