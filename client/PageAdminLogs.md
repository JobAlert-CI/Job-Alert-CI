This file is a merged representation of a subset of the codebase, containing specifically included files, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of a subset of the repository's contents that is considered the most important context.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Only files matching these patterns are included: src/Pages/Admin/LogsPage/**/*
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
src/
  Pages/
    Admin/
      LogsPage/
        components/
          BlocSkel.jsx
          CarteEmailMobile.jsx
          CarteEventMobile.jsx
          CarteMessageMobile.jsx
          EtatsSection.jsx
          LigneEvent.jsx
          SelectStatutContact.jsx
          SkeletonEmail.jsx
          SkeletonMessage.jsx
          TooltipChart.jsx
        onglets/
          OngletContacts.jsx
          OngletEmailsTx.jsx
          OngletEvents.jsx
        sections/
          ChartEnvoieEmail.jsx
          ChartEnvoisMotif.jsx
          ChartEvenementAction.jsx
          ChartEvenements.jsx
          CompteursContacts.jsx
          CompteursEmailsTx.jsx
          CompteursEvents.jsx
          ListeEmailsTx.jsx
          ListeEvenements.jsx
          ListeMessages.jsx
        index.jsx
```

# Files

## File: src/Pages/Admin/LogsPage/components/BlocSkel.jsx
```javascript
import { Skeleton } from "@/components/ui/skeleton"


const BlocSkel = ({ className, delay = 0 }) => (
  <Skeleton className={className} style={delay ? { animationDelay: `${delay}ms` } : undefined} />
)

export default BlocSkel
```

## File: src/Pages/Admin/LogsPage/components/CarteEmailMobile.jsx
```javascript
import { memo } from "react"
import { Link } from "react-router-dom"
import { Eye, User } from "lucide-react"
import { dateHeure } from "@/lib/dates"
import { VARIANTE_STATUT_EMAIL, libelleMotif, libelleStatutEmail } from "@/features/admin-logs.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

/* ─── Carte mobile (miroir de la ligne desktop) ─────────────────────
   Toutes les actions restent accessibles : badge statut, erreur inline,
   lien abonné, bouton détail (Dialog). */
const CarteEmailMobile = memo(function CarteEmailMobile({ email, onDetail }) {
  return (
    <article
      aria-label={`Email à ${email.to_email}`}
      className="rounded-xl border border-border bg-card p-4 shadow-soft"
    >
      {/* En-tête : date + badge statut + détail */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {dateHeure(email.created_at)}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={VARIANTE_STATUT_EMAIL[email.status] ?? "outline"}>
            {libelleStatutEmail(email.status)}
          </Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDetail(email)}
            aria-label={`Détails de l'email à ${email.to_email}`}
          >
            <Eye className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Destinataire + lien abonné */}
      <div className="mt-2">
        <p className="truncate text-sm font-medium" title={email.to_email}>
          {email.to_email}
        </p>
        {email.subscriber_id && (
          <Link
            to={`/admin/utilisateurs/${email.subscriber_id}`}
            className="inline-flex items-center gap-1 text-[10px] text-primary underline-offset-2 hover:underline"
          >
            <User className="size-3" aria-hidden /> Fiche abonné
          </Link>
        )}
      </div>

      {/* Motif */}
      <p className="mt-1.5 text-xs text-muted-foreground">
        {libelleMotif(email.purpose)}
      </p>

      {/* Erreur (si failed) */}
      {email.status === "failed" && email.last_error && (
        <p className="mt-1.5 line-clamp-2 rounded-md bg-destructive/10 p-1.5 font-mono text-[10px] text-destructive" title={email.last_error}>
          {email.last_error}
        </p>
      )}

      {/* Pied : tentatives */}
      <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {email.attempts} tentative{email.attempts > 1 ? "s" : ""}
        </span>
      </div>
    </article>
  )
})

export default CarteEmailMobile
```

## File: src/Pages/Admin/LogsPage/components/CarteEventMobile.jsx
```javascript
import { memo } from "react"
import { Link } from "react-router-dom"
import {Copy, ExternalLink} from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import { dateHeure } from "@/lib/dates"
import {LIBELLE_ACTION_EVENT, VARIANTE_NIVEAU,} from "@/features/admin-logs.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import BlocSkel from "./BlocSkel"

/* ─── Carte mobile (miroir de la ligne desktop) ─────────────────────
   Toutes les actions restent accessibles : copie de hash, lien offre,
   lien croisé vers le run parent. */
const CarteEventMobile = memo(function CarteEventMobile({ evt, runParent }) {
  const notify = useNotify()
  return (
    <article
      aria-label={`Événement du ${dateHeure(evt.created_at)}`}
      className="rounded-xl border border-border bg-card p-4 shadow-soft"
    >
      {/* En-tête : date / badge de niveau */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] tabular-nums text-muted-foreground">{dateHeure(evt.created_at)}</p>
        <Badge variant={VARIANTE_NIVEAU[evt.niveau] ?? "outline"}>{evt.niveau}</Badge>
      </div>

      {/* Action */}
      <p className="mt-2 text-sm font-medium">{LIBELLE_ACTION_EVENT[evt.action] ?? evt.action}</p>

      {/* Message (tronqué sur 2 lignes, title complet) */}
      {evt.message && (
        <p className="mt-1.5 line-clamp-2 font-mono text-[10px] text-muted-foreground" title={evt.message}>
          {evt.message}
        </p>
      )}

      {/* Lien croisé vers le run parent */}
      <div className="mt-2 text-xs">
        {runParent ? (
          <Link to={`/admin/scraping/runs/${runParent}`} className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
            Voir le run <ExternalLink className="size-3" aria-hidden />
          </Link>
        ) : evt.source_scrape_run_id ? (
          <span
            className="text-[10px] text-muted-foreground"
            title="Run trop ancien pour le lien (hors des 100 derniers runs) — voir l'historique Scraping"
          >
            Run #… <ExternalLink className="inline size-3 opacity-40" aria-hidden />
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>

      {/* Pied : copie de hash + offre liée (si présentes) */}
      {(evt.hash_unique || evt.offer_id) && (
        <div className="mt-2.5 flex items-center justify-end gap-1 border-t border-border pt-2">
          {evt.hash_unique && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copier le hash"
              onClick={() => { navigator.clipboard?.writeText(evt.hash_unique); notify("Hash copié", "success") }}
            >
              <Copy className="size-3.5" aria-hidden />
            </Button>
          )}
          {evt.offer_id && (
            <Link
              to={`/admin/offres/${evt.offer_id}`}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Voir l'offre liée"
            >
              <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      )}
    </article>
  )
})


/* Carte mobile : miroir de CarteEventMobile. */
const SkeletonCarteEventMobile = ({ delay = 0 }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-soft" aria-hidden="true">
    <div className="flex items-start justify-between gap-2">
      <BlocSkel className="h-2.5 w-24" delay={delay} />
      <BlocSkel className="h-5 w-16 shrink-0 rounded-full" delay={delay} />
    </div>
    <BlocSkel className="mt-2 h-3.5 w-28" delay={delay} />
    <div className="mt-1.5 space-y-1.5">
      <BlocSkel className="h-2.5 w-full" delay={delay} />
      <BlocSkel className="h-2.5 w-4/5" delay={delay} />
    </div>
    <BlocSkel className="mt-2 h-3 w-20" delay={delay} />
    <div className="mt-2.5 flex justify-end gap-1 border-t border-border pt-2">
      <BlocSkel className="size-7 rounded-md" delay={delay} />
      <BlocSkel className="size-7 rounded-md" delay={delay} />
    </div>
  </div>
)

export { CarteEventMobile, SkeletonCarteEventMobile }

export default CarteEventMobile
```

## File: src/Pages/Admin/LogsPage/components/CarteMessageMobile.jsx
```javascript
import { memo } from "react"
import { Eye } from "lucide-react"
import { dateHeure } from "@/lib/dates"
import {CONTACT_INTERNE_VERS_API, STATUTS_CONTACT, VARIANTE_CONTACT,} from "@/features/admin-logs.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import SelectStatutContact from "./SelectStatutContact"

const statutApi = (statut) => CONTACT_INTERNE_VERS_API[statut] ?? statut

/* ── Carte mobile (miroir de la ligne desktop) ─────────────────────
   Toutes les actions restent accessibles : badge de statut, changement
   de statut inline (Select + spinner), bouton détail (Dialog). */
const CarteMessageMobile = memo(function CarteMessageMobile({ message, enCours, onChanger, onDetail }) {
  const cleApi = statutApi(message.status)
  return (
    <article
      aria-label={`Message de ${message.full_name}`}
      className="rounded-xl border border-border bg-card p-4 shadow-soft"
    >
      {/* En-tête : date / identité + badge statut + détail */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] tabular-nums text-muted-foreground">
            Reçu le {dateHeure(message.created_at)}
          </p>
          <p className="mt-0.5 truncate text-sm font-medium" title={message.full_name}>
            {message.full_name}
          </p>
          <p className="truncate text-[10px] text-muted-foreground" title={message.email}>
            {message.email}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={VARIANTE_CONTACT[cleApi] ?? "outline"}>
            {STATUTS_CONTACT.find((s) => s.valeur === cleApi)?.libelle ?? cleApi}
          </Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDetail(message)}
            aria-label={`Détails du message de ${message.full_name}`}
          >
            <Eye className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Sujet (tronqué sur 2 lignes, title complet) */}
      <p className="mt-2 line-clamp-2 text-xs" title={message.subject_label}>
        {message.subject_label}
      </p>
      {message.replied_at && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          répondu le {dateHeure(message.replied_at)}
        </p>
      )}

      {/* Pied : changement de statut */}
      <div className="mt-3 border-t border-border pt-2">
        <SelectStatutContact message={message} enCours={enCours} onChanger={onChanger} />
      </div>
    </article>
  )
})

export default CarteMessageMobile
```

## File: src/Pages/Admin/LogsPage/components/EtatsSection.jsx
```javascript
import { AlertTriangle, Inbox, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"

/* États de section — page Logs & emails (même pattern que Journal/Sources). */

export const SectionErreur = ({ onRetry, message = "Chargement impossible." }) => (
  <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
    <AlertTriangle className="size-5 text-destructive" aria-hidden />
    <p className="text-sm font-medium text-destructive">{message}</p>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry}>
        Réessayer
      </Button>
    )}
  </div>
)

export const SectionVide = ({ message = "Aucune donnée pour le moment." }) => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
      <EmptyTitle>Rien à afficher</EmptyTitle>
      <EmptyDescription>{message}</EmptyDescription>
    </EmptyHeader>
  </Empty>
)

export const SectionAucunResultat = ({ message = "Aucun résultat ne correspond aux critères.", onReset }) => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
      <EmptyTitle>Aucun résultat</EmptyTitle>
      <EmptyDescription>{message}</EmptyDescription>
    </EmptyHeader>
    {onReset && (
      <Button variant="outline" size="sm" onClick={onReset}>
        Réinitialiser
      </Button>
    )}
  </Empty>
)
```

## File: src/Pages/Admin/LogsPage/components/LigneEvent.jsx
```javascript
import { memo } from "react"
import { Link } from "react-router-dom"
import { Copy, ExternalLink,} from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import { dateHeure } from "@/lib/dates"
import {
  LIBELLE_ACTION_EVENT, VARIANTE_NIVEAU,
} from "@/features/admin-logs.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TableRow, TableCell } from "@/components/ui/table"
import BlocSkel from "./BlocSkel"

/* ─── Ligne desktop mémoïsée ─────────────────────────────────────── */
const LigneEvent = memo(function LigneEvent({ evt, runParent }) {
  const notify = useNotify()
  return (
    <TableRow className="transition-colors hover:bg-muted/50">
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{dateHeure(evt.created_at)}</TableCell>
      <TableCell><Badge variant={VARIANTE_NIVEAU[evt.niveau] ?? "outline"}>{evt.niveau}</Badge></TableCell>
      <TableCell className="text-xs">{LIBELLE_ACTION_EVENT[evt.action] ?? evt.action}</TableCell>
      <TableCell className="max-w-72 truncate font-mono text-[10px] text-muted-foreground" title={evt.message ?? ""}>
        {evt.message ?? "—"}
      </TableCell>
      <TableCell className="text-xs">
        {/* Résolution sous-run → run PARENT (fix cycle 17). */}
        {runParent ? (
          <Link to={`/admin/scraping/runs/${runParent}`} className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
            Voir le run <ExternalLink className="size-3" aria-hidden />
          </Link>
        ) : evt.source_scrape_run_id ? (
          <span
            className="text-[10px] text-muted-foreground"
            title="Run trop ancien pour le lien (hors des 100 derniers runs) — voir l'historique Scraping"
          >
            Run #… <ExternalLink className="inline size-3 opacity-40" aria-hidden />
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {evt.hash_unique && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copier le hash"
              onClick={() => { navigator.clipboard?.writeText(evt.hash_unique); notify("Hash copié", "success") }}
            >
              <Copy className="size-3.5" aria-hidden />
            </Button>
          )}
          {evt.offer_id && (
            <Link
              to={`/admin/offres/${evt.offer_id}`}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Voir l'offre liée"
            >
              <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
})

/* Ligne desktop : 6 cellules aux largeurs des vraies colonnes. */
const SkeletonLigneEvent = ({ delay = 0 }) => (
  <TableRow className="hover:bg-transparent">
    <TableCell><BlocSkel className="h-3.5 w-24" delay={delay} /></TableCell>
    <TableCell><BlocSkel className="h-5 w-16 rounded-full" delay={delay} /></TableCell>
    <TableCell><BlocSkel className="h-3.5 w-20" delay={delay} /></TableCell>
    <TableCell><BlocSkel className="h-3 w-56" delay={delay} /></TableCell>
    <TableCell><BlocSkel className="h-3.5 w-24" delay={delay} /></TableCell>
    <TableCell>
      <div className="flex justify-end gap-1">
        <BlocSkel className="size-7 rounded-md" delay={delay} />
        <BlocSkel className="size-7 rounded-md" delay={delay} />
      </div>
    </TableCell>
  </TableRow>
)

export { LigneEvent, SkeletonLigneEvent }

export default LigneEvent
```

## File: src/Pages/Admin/LogsPage/components/SelectStatutContact.jsx
```javascript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CONTACT_INTERNE_VERS_API, STATUTS_CONTACT } from "@/features/admin-logs.tools"
import { cn } from "cn"
import { Loader2 } from "lucide-react"
import { memo } from "react"


const statutApi = (statut) => CONTACT_INTERNE_VERS_API[statut] ?? statut

/* ── Select de changement de statut — partagé desktop + mobile ──────
   Extrait pour zéro duplication : spinner + opacité pendant la mutation. */
const SelectStatutContact = memo(function SelectStatutContact({ message, enCours, onChanger }) {
  const cleApi = statutApi(message.status)
  return (
    <div className="relative inline-flex items-center">
      <Select value={cleApi} onValueChange={(v) => onChanger(message, v)} disabled={enCours}>
        <SelectTrigger
          className={cn("h-8 w-full text-xs sm:w-36", enCours && "opacity-60")}
          aria-label={`Changer le statut du message de ${message.full_name}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUTS_CONTACT.map((s) => (
            <SelectItem key={s.valeur} value={s.valeur}>{s.libelle}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {enCours && (
        <Loader2
          className="pointer-events-none absolute right-8 size-3.5 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      )}
    </div>
  )
})

export default SelectStatutContact
```

## File: src/Pages/Admin/LogsPage/components/SkeletonEmail.jsx
```javascript
import { TableCell, TableRow } from "@/components/ui/table"
import BlocSkel from "./BlocSkel"

/* Ligne desktop : 6 cellules aux largeurs des vraies colonnes. */
const SkeletonLigneEmail = ({ delay = 0 }) => (
  <TableRow className="hover:bg-transparent">
    <TableCell><BlocSkel className="h-3.5 w-24" delay={delay} /></TableCell>
    <TableCell>
      <div className="flex flex-col gap-1.5 py-0.5">
        <BlocSkel className="h-3.5 w-44" delay={delay} />
        <BlocSkel className="h-2.5 w-24" delay={delay} />
      </div>
    </TableCell>
    <TableCell><BlocSkel className="h-3.5 w-28" delay={delay} /></TableCell>
    <TableCell><BlocSkel className="h-5 w-16 rounded-full" delay={delay} /></TableCell>
    <TableCell className="hidden lg:table-cell"><BlocSkel className="ml-auto h-3.5 w-8" delay={delay} /></TableCell>
    <TableCell>
      <div className="flex justify-end"><BlocSkel className="size-7 rounded-md" delay={delay} /></div>
    </TableCell>
  </TableRow>
)

/* Carte mobile : miroir de CarteEmailMobile. */
const SkeletonCarteEmailMobile = ({ delay = 0 }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-soft" aria-hidden="true">
    <div className="flex items-start justify-between gap-2">
      <BlocSkel className="h-2.5 w-32" delay={delay} />
      <div className="flex shrink-0 items-center gap-1.5">
        <BlocSkel className="h-5 w-20 rounded-full" delay={delay} />
        <BlocSkel className="size-7 rounded-md" delay={delay} />
      </div>
    </div>
    <div className="mt-2 space-y-1.5">
      <BlocSkel className="h-3.5 w-48" delay={delay} />
      <BlocSkel className="h-2.5 w-24" delay={delay} />
    </div>
    <BlocSkel className="mt-1.5 h-3 w-32" delay={delay} />
    <div className="mt-2.5 flex justify-between border-t border-border pt-2">
      <BlocSkel className="h-2.5 w-20" delay={delay} />
    </div>
  </div>
)

export { SkeletonLigneEmail, SkeletonCarteEmailMobile }
```

## File: src/Pages/Admin/LogsPage/components/SkeletonMessage.jsx
```javascript
import { TableCell, TableRow } from "@/components/ui/table"
import BlocSkel from "./BlocSkel"


/* Ligne desktop : 6 cellules aux largeurs des vraies colonnes. */
const SkeletonLigneContact = ({ delay = 0 }) => (
  <TableRow className="hover:bg-transparent">
    <TableCell><BlocSkel className="h-3.5 w-24" delay={delay} /></TableCell>
    <TableCell>
      <div className="flex flex-col gap-1.5 py-0.5">
        <BlocSkel className="h-3.5 w-28" delay={delay} />
        <BlocSkel className="h-2.5 w-36" delay={delay} />
      </div>
    </TableCell>
    <TableCell><BlocSkel className="h-3.5 w-40" delay={delay} /></TableCell>
    <TableCell><BlocSkel className="h-5 w-20 rounded-full" delay={delay} /></TableCell>
    <TableCell><BlocSkel className="h-8 w-36 rounded-md" delay={delay} /></TableCell>
    <TableCell>
      <div className="flex justify-end"><BlocSkel className="size-7 rounded-md" delay={delay} /></div>
    </TableCell>
  </TableRow>
)

/* Carte mobile : miroir de CarteMessageMobile. */
const SkeletonCarteContactMobile = ({ delay = 0 }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-soft" aria-hidden="true">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-1.5">
        <BlocSkel className="h-2.5 w-32" delay={delay} />
        <BlocSkel className="h-3.5 w-28" delay={delay} />
        <BlocSkel className="h-2.5 w-44" delay={delay} />
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <BlocSkel className="h-5 w-20 rounded-full" delay={delay} />
        <BlocSkel className="size-7 rounded-md" delay={delay} />
      </div>
    </div>
    <BlocSkel className="mt-2 h-3 w-3/4" delay={delay} />
    <div className="mt-3 border-t border-border pt-2">
      <BlocSkel className="h-8 w-full rounded-md" delay={delay} />
    </div>
  </div>
)

export { SkeletonLigneContact, SkeletonCarteContactMobile }
```

## File: src/Pages/Admin/LogsPage/components/TooltipChart.jsx
```javascript
export const TooltipChart = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null

  const hasLabel = label != null && label !== ""

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-popover p-3.5 text-sm shadow-lg min-w-55">
      {/* En-tête conditionnel et séparé proprement */}
      {hasLabel && (
        <div className="font-semibold text-foreground border-b border-border/40 pb-2">
          {label}
        </div>
      )}

      {/* Grille de données : Alignement parfait gauche (Libellé) / droite (Valeur) */}
      <div className="flex flex-col gap-2.5">
        {payload.map((p, i) => (
          <div 
            key={`${p.dataKey ?? p.name}-${i}`} 
            className="flex items-center justify-between gap-6"
          >
            {/* Colonne de gauche : Pastille + Nom de la série */}
            <div className="flex items-center gap-2.5">
              <span
                className="h-2 w-2 shrink-0 rounded-sm shadow-sm"
                style={{ backgroundColor: p.fill || p.color || p.stroke || "currentColor" }}
                aria-hidden="true"
              />
              <span className="text-muted-foreground truncate max-w-35" title={p.name}>
                {p.name}
              </span>
            </div>

            {/* Colonne de droite : Valeur formatée sécurisée (fallback à 0) */}
            <span className="font-medium text-foreground tabular-nums">
              {(p.value ?? 0).toLocaleString("fr-FR")}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TooltipChart
```

## File: src/Pages/Admin/LogsPage/onglets/OngletContacts.jsx
```javascript
import { motion } from "framer-motion"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"
import CompteursContacts from "../sections/CompteursContacts"
import ListeMessages from "../sections/ListeMessages"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Messages de contact (cycle 17, doc v3 §17.2).
   Refonte :
   • FILTRE CORRIGÉ : sentinelle « tous » (Radix refuse la valeur
     vide qui verrouillait l'ancien SelectItem value="") + filtrage
     client de GARANTIE sur la page chargée.
   • Tri par en-tête initialisé (« Reçu » desc).
   • Changement de statut inline : Select shadcn + SPINNER pendant la
     mutation (au lieu d'un simple disabled grisé).
   • Retour en haut du tableau au changement de page, skeleton fidèle
     (limite de page), transition framer-motion uniforme, animations
     du donut conditionnées par prefers-reduced-motion.
   ⚠️ La réponse du PATCH renvoie le statut STOCKÉ — CONTACT_INTERNE_
   VERS_API traduit pour les badges.
   ───────────────────────────────────────────────────────────────────── */


const OngletContacts = () => {
  
  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* ─── Compteurs C1-C4 : chips cliquables ─── */}
      <Bloc>
        <CompteursContacts />
      </Bloc>
      
      <Bloc>
        <ListeMessages />
      </Bloc>      
    </motion.div>
  )
}

export default OngletContacts
```

## File: src/Pages/Admin/LogsPage/onglets/OngletEmailsTx.jsx
```javascript
import { motion } from "framer-motion"
import { AlertTriangle } from "lucide-react"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"
import { useEmailsTxStatsQuery } from "@/features/admin-logs.tools"
import CompteursEmailsTx from "../sections/CompteursEmailsTx"
import ListeEmailsTx from "../sections/ListeEmailsTx"
import ChartEnvoieEmail from "../sections/ChartEnvoieEmail"
import ChartEnvoisMotif from "../sections/ChartEnvoisMotif"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Emails transactionnels (cycle 17, doc v3 §17.3).
   Refonte alignée sur OngletEvents / OngletContacts :
   • Orchestrateur fin — sections autonomes (compteurs, charts, liste).
   • Mode mobile : cartes + tri par Select dans ListeEmailsTx.
   • TransitionEtat pour les animations d'état.
   • Skeleton fidèle (mobile + desktop).
   • Retour en haut du tableau au changement de page.
   • Alerte opérationnelle : taux d'échec = signal Resend.
───────────────────────────────────────────────────────────────────── */
const OngletEmailsTx = () => {
  const { data: statsJour } = useEmailsTxStatsQuery(1)
  const echecsJour = statsJour?.echecs_fenetre ?? 0

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* ─── Compteurs M1-M4 ─── */}
      <Bloc>
        <CompteursEmailsTx />
      </Bloc>

      {/* Alerte opérationnelle doc v3 §17.3 : taux d'échec = signal Resend. */}
      {echecsJour > 0 && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-brand-orange px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          {echecsJour} échec{echecsJour > 1 ? "s" : ""} aujourd'hui — un taux élevé peut indiquer un problème
          côté fournisseur d'email (Resend) plutôt qu'un problème d'inscription.
        </p>
      )}

      {/* ─── Charts M5-M6 ─── */}
      <div className="grid gap-4 xl:grid-cols-3">
      <Bloc className="xl:col-span-2">
        <ChartEnvoieEmail />
      </Bloc>

      <Bloc>
        <ChartEnvoisMotif />
      </Bloc>
    </div>

      {/* ─── Table des emails ─── */}
      <Bloc>
        <ListeEmailsTx />
      </Bloc>
    </motion.div>
  )
}

export default OngletEmailsTx
```

## File: src/Pages/Admin/LogsPage/onglets/OngletEvents.jsx
```javascript
import { motion } from "framer-motion"
import Bloc, { VARIANTS_CONTENEUR } from "@/components/admin/Bloc"
import CompteursEvents from "../sections/CompteursEvents"
import ChartEvenements from "../sections/ChartEvenements"
import ChartEvenementAction from "../sections/ChartEvenementAction"
import ListeEvenements from "../sections/ListeEvenements"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Événements techniques (cycle 17, doc v3 §17.1) — module
   scraping seul (source: OfferIngestionEvent).
   Compteurs E1-E4 + charts E5-E6 servis par UN SEUL appel /logs/stats ;
   table via /logs/events (liste plate → pagination heuristique).
   Refonte : tri par en-tête initialisé (« Date » desc), selects shadcn
   avec surbrillance, période via MiniCalendar, retour en haut du
   tableau au changement de page, skeleton fidèle (limite de page),
   animations Recharts conditionnées par prefers-reduced-motion.
───────────────────────────────────────────────────────────────────── */

const OngletEvents = () => {

  return (
    <motion.div variants={VARIANTS_CONTENEUR} initial="cache" animate="visible" className="flex flex-col gap-4">
      <Bloc>
        <CompteursEvents />
      </Bloc>

      {/* ─── Charts E5-E6 (animations conditionnées reduced-motion) ─── */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Bloc className="xl:col-span-2">
          <ChartEvenements />
        </Bloc>

        <Bloc>
          <ChartEvenementAction />
        </Bloc>
      </div>

      <Bloc>
        <ListeEvenements />
      </Bloc>
    </motion.div>
  )
}

export default OngletEvents
```

## File: src/Pages/Admin/LogsPage/sections/ChartEnvoieEmail.jsx
```javascript
import { useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import {
  Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis,
} from "recharts"
import { useEmailsTxStatsQuery } from "@/features/admin-logs.tools"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { CalendarDays } from "lucide-react"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import TooltipChart from "../components/TooltipChart"
import CadreChart from "@/components/admin/CadreChart"
import { cn } from "cn"

const COULEURS_STATUT = { sent: "#0F2D4D", failed: "#ef4444", queued: "#F5A623" }

/* ─────────────────────────────────────────────────────────────────────
   Profil réaliste d'emails transactionnels sur 30 j : envoyés très
   largement dominants, échecs marginaux, file d'attente réduite.
   Segments par barre, du BAS vers le HAUT (ordre d'empilement Recharts
   avec stackId="s" : Envoyés → Échecs → En file).
───────────────────────────────────────────────────────────────────── */
const SEGMENTS_BARRES_EMAILS = [
  [62],
  [55],
  [68],
  [58],
  [64],
  [70],
  [60],
]

/* Nuances neutres par segment (bas → haut) pour rendre l'empilement
   lisible sans préjuger des couleurs réelles des séries. */
const TONS_SEGMENTS = [
  "bg-surface-container-high",    // Envoyés (bas)
  "bg-surface-container-highest", // Échecs (milieu)
  "bg-muted",                     // En file (haut)
]

/**
 * État de chargement du BarChart empilé « Envois par jour (30 j) ».
 * Reprend la géométrie du chart réel :
 *  - 3 segments empilés par jour (Envoyés en bas, Échecs au milieu,
 *    En file en haut), séparés par un gap de 1px ;
 *  - arrondi [4, 4, 0, 0] appliqué UNIQUEMENT au segment du haut
 *    (En file), comme sur le <Bar radius={[4, 4, 0, 0]}> réel ;
 *  - axe Y à gauche (marge left:-20 du chart), libellés de jours en
 *    dessous, grille horizontale en pointillé (border-b) ;
 *  - légende 3 séries en bas (fontSize 11).
 * `height` doit correspondre à la hauteur du CadreChart réel pour
 * éviter tout layout shift.
 */
const ChartEmailsParJourSkeleton = ({ height = 220 }) => (
  <div
    role="status"
    aria-label="Chargement du graphique des envois par jour"
    className="flex w-full flex-col gap-3 p-2"
    style={{ height }}
  >
    <div className="flex flex-1 gap-2">
      {/* Axe Y : 3 graduations fictives */}
      <div className="flex w-6 flex-col justify-between py-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-2 w-full rounded-sm" />
        ))}
      </div>
      {/* Zone du graphique */}
      <div className="flex flex-1 flex-col">
        {/* Barres empilées, alignées en bas comme le BarChart */}
        <div className="flex flex-1 items-end gap-3 border-b border-border pb-px">
          {SEGMENTS_BARRES_EMAILS.map((segments, i) => (
            <div key={i} className="flex h-full flex-1 flex-col justify-end gap-px">
              {/* Rendu haut → bas : on inverse l'ordre des segments.
                  Le PREMIER rendu (En file, segment du haut) porte
                  l'arrondi [4,4,0,0] comme le <Bar radius> réel. */}
              {[...segments].reverse().map((h, k) => (
                <Skeleton
                  key={k}
                  className={cn(
                    "w-full",
                    k === 0 && "rounded-t-sm",
                    TONS_SEGMENTS[segments.length - 1 - k]
                  )}
                  style={{
                    height: `${h}%`,
                    animationDelay: `${i * 70 + k * 30}ms`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        {/* Libellés de l'axe X (jours) */}
        <div className="mt-2 flex gap-3" aria-hidden="true">
          {SEGMENTS_BARRES_EMAILS.map((_, i) => (
            <Skeleton key={i} className="h-2 flex-1 rounded-sm" />
          ))}
        </div>
      </div>
    </div>
    {/* Légende : équivalent du <Legend wrapperStyle={{ fontSize: 11 }}>
        — 3 séries (Envoyés, Échecs, En file). */}
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Skeleton className="h-2.5 w-2.5 rounded-xs" />
          <Skeleton className="h-2 w-16 rounded-xs" />
        </div>
      ))}
    </div>
  </div>
)

const ChartEnvoieEmail = () => {
  const mouvementReduit = useReducedMotion()
  const { data: stats, isLoading, isError, refetch } = useEmailsTxStatsQuery(30)

  // M5 : par jour empilé par statut.
  const parJour = useMemo(
    () =>
      (stats?.par_jour ?? []).map((j) => ({
        jour: new Date(`${j.jour}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        Envoyés: j.par_statut?.sent ?? 0,
        Échecs: j.par_statut?.failed ?? 0,
        "En file": j.par_statut?.queued ?? 0,
      })),
    [stats]
  )

  const etat = isError ? "erreur" : isLoading ? "chargement" : !stats?.jobs_par_jour?.length ? "vide" : "donnees"

  return (
    <SectionCardAdmin
      title="Envois par jour (30 j)"
      description="Comparaison des envois par jour sur les derniers 30 jours."
      icon={CalendarDays}
    >
      <TransitionEtat etat={etat}>
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger l'état du croisement." />
        ) : isLoading ? (
          <ChartEmailsParJourSkeleton />
        ) : (
          <CadreChart vide={!parJour.length} videMessage="Aucun envoi dans la fenêtre.">
            <BarChart data={parJour} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="jour" fontSize={10} tickLine={false} />
              <YAxis allowDecimals={false} fontSize={10} tickLine={false} />
              <Tooltip content={<TooltipChart />} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Envoyés" stackId="s" fill={COULEURS_STATUT.sent} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" />
              <Bar dataKey="Échecs" stackId="s" fill={COULEURS_STATUT.failed} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" />
              <Bar dataKey="En file" stackId="s" fill={COULEURS_STATUT.queued} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" radius={[4, 4, 0, 0]} />
            </BarChart>
          </CadreChart>
        )}
      </TransitionEtat>
    </SectionCardAdmin>
  )
}

export default ChartEnvoieEmail
```

## File: src/Pages/Admin/LogsPage/sections/ChartEnvoisMotif.jsx
```javascript
import { useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import {
  Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis,
} from "recharts"
import { libelleMotif, useEmailsTxStatsQuery } from "@/features/admin-logs.tools"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { ListOrdered } from "lucide-react"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import TooltipChart from "../components/TooltipChart"
import CadreChart from "@/components/admin/CadreChart"

const COULEUR_MOTIF = "#0F2D4D"

/* Barres horizontales du chart « Envois par motif » (layout="vertical") :
   largeurs relatives triées par ordre décroissant — le chart réel trie
   parMotif par total décroissant. 6 barres = les 6 valeurs de l'enum des
   motifs d'email transactionnel. `libelle` = largeur du libellé de
   catégorie dans la colonne de gauche. */
const BARRES_MOTIF = [
  { barre: 88, libelle: 64 },
  { barre: 64, libelle: 48 },
  { barre: 47, libelle: 56 },
]

/**
 * État de chargement du BarChart horizontal « Envois par motif ».
 * Reprend la géométrie du chart réel (layout="vertical") :
 *  - axe des catégories (motifs) à GAUCHE, colonne de largeur fixe
 *    (YAxis width={120}, rognée par margin left:-50), libellés alignés
 *    à droite comme le textAnchor="end" par défaut de Recharts ;
 *  - barres horizontales alignées à gauche, arrondi [0, 4, 4, 0]
 *    appliqué à l'extrémité DROITE comme sur le <Bar radius> réel ;
 *  - axe numérique en bas (XAxis type="number") ;
 *  - PAS de légende sur ce chart (contrairement au chart empilé).
 * `height` doit correspondre à la hauteur du CadreChart réel
 * (minHeight={240} ici) pour éviter tout layout shift.
 */
const ChartMotifSkeleton = ({ height = 240 }) => (
  <div
    role="status"
    aria-label="Chargement du graphique des envois par motif"
    className="flex w-full flex-col gap-3 p-2"
    style={{ height }}
  >
    {/* Zone du graphique : barres horizontales alignées à gauche */}
    <div className="flex flex-1 flex-col justify-around gap-2">
      {BARRES_MOTIF.map(({ barre, libelle }, i) => (
        <div key={i} className="flex items-center gap-2">
          {/* Axe Y : colonne de largeur FIXE (toutes les barres démarrent
              au même x, comme le YAxis width={120} réel). Libellé aligné
              à droite dans cette colonne. */}
          <div className="flex w-18 shrink-0 justify-end">
            <Skeleton
              className="h-2.5 rounded-sm"
              style={{ width: libelle, animationDelay: `${i * 70}ms` }}
            />
          </div>
          {/* Barre horizontale : arrondi à droite comme radius=[0,4,4,0] */}
          <div className="flex-1">
            <Skeleton
              className="h-16 rounded-r-sm"
              style={{ width: `${barre}%`, animationDelay: `${i * 70 + 30}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
    {/* Axe X : graduations numériques, alignées sur le départ des barres */}
    <div className="flex justify-between pl-20" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-2 w-6 rounded-sm" />
      ))}
    </div>
  </div>
)

const ChartEnvoisMotif = () => {
  const mouvementReduit = useReducedMotion()
  const { data: stats, isLoading, isError, refetch } = useEmailsTxStatsQuery(30)

  const parMotif = useMemo(
    () =>
      Object.entries(stats?.par_motif ?? {})
        .map(([valeur, total]) => ({ motif: libelleMotif(valeur), total }))
        .sort((a, b) => b.total - a.total),
    [stats]
  )

  const etat = isError ? "erreur" : isLoading ? "chargement" : !stats?.jobs_par_jour?.length ? "vide" : "donnees"

  return (
    <SectionCardAdmin
      title="Envois par motif (historique)"
      icon={ListOrdered}
    >
      <TransitionEtat etat={etat}>
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger l'état du croisement." />
        ) : isLoading ? (
          <ChartMotifSkeleton />
        ) : (
          <CadreChart vide={!parMotif.length} videMessage="Aucun email transactionnel envoyé." minHeight={240}>
            <BarChart data={parMotif} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: -50 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
              <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} />
              <YAxis type="category" dataKey="motif" width={120} fontSize={10} tickLine={false} />
              <Tooltip content={<TooltipChart />} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
              <Bar dataKey="total" name="Envois" fill={COULEUR_MOTIF} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" radius={[0, 4, 4, 0]} />
            </BarChart>
          </CadreChart>
        )}
      </TransitionEtat>
    </SectionCardAdmin>
  )
}

export default ChartEnvoisMotif
```

## File: src/Pages/Admin/LogsPage/sections/ChartEvenementAction.jsx
```javascript
import { useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts"
import { useLogsStatsQuery, LIBELLE_ACTION_EVENT } from "@/features/admin-logs.tools"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { Activity } from "lucide-react"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import TooltipChart from "../components/TooltipChart"
import CadreChart from "@/components/admin/CadreChart"

const COULEURS_ACTION = ["#0F2D4D", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"]

/**
 * État de chargement du PieChart « Répartition par action » (journal d'audit).
 * Reprend la géométrie du chart réel :
 *  - rayons absolus innerRadius=50 / outerRadius=75 → pour un carré
 *    de 150px (max-w-[150px]), le trou fait 100px de diamètre,
 *    soit inset: 16.7% ;
 *  - gaps de 2° entre segments (paddingAngle) ;
 *  - 4 segments correspondant aux 4 actions réellement instrumentées
 *    (creation, modification, suppression, envoi — « connexion »
 *     n'est jamais émise côté backend, cf. cahier des charges §2.3).
 * Proportions réalistes d'un journal d'audit :
 *  - modification ≈ 40 % (la plus fréquente)
 *  - creation ≈ 30 %
 *  - envoi ≈ 20 %
 *  - suppression ≈ 10 % (rare, avec confirmation)
 * `height` doit correspondre à la hauteur du CadreChart / ResponsiveContainer réel.
 */
const ChartActionsAuditSkeleton = ({ height = 220 }) => (
  <div
    role="status"
    aria-label="Chargement du graphique de répartition par action"
    className="flex h-full w-full animate-pulse flex-col items-center justify-center gap-3"
    style={{ height }}
  >
    {/* Donut : 4 segments neutres séparés par des gaps de 2° */}
    <div className="relative aspect-square w-full max-w-37.5">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(
            var(--color-muted) 0deg 141deg,
            transparent 141deg 143deg,
            var(--color-surface-container-high) 143deg 249deg,
            transparent 249deg 251deg,
            var(--color-muted) 251deg 321deg,
            transparent 321deg 323deg,
            var(--color-surface-container-high) 323deg 358deg,
            transparent 358deg 360deg
          )`,
        }}
      />
      {/* Trou central : ratio innerRadius/outerRadius = 50/75 = 0.667,
          soit un trou de 100px dans un carré de 150px → inset 16.7% */}
      <div className="absolute rounded-full bg-card" style={{ inset: "16.7%" }} />
    </div>

    {/* Légende : équivalent du <Legend wrapperStyle={{ fontSize: 11 }}>
        — 4 actions (creation, modification, suppression, envoi).
        Légèrement plus grande que les fontSize:10 des autres charts. */}
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Skeleton className="h-2.5 w-2.5 rounded-xs" />
          <Skeleton className="h-2.5 w-16 rounded-xs" />
        </div>
      ))}
    </div>
  </div>
);

const ChartEvenementAction = () => {
  const mouvementReduit = useReducedMotion()
  const { data: stats, isLoading, isError, refetch } = useLogsStatsQuery(30)

  const parAction = useMemo(
    () =>
      (stats?.events_par_action ?? []).map((a) => ({
        action: LIBELLE_ACTION_EVENT[a.action] ?? a.action,
        total: a.total,
      })),
    [stats]
  )

  const etat = isError ? "erreur" : isLoading ? "chargement" : !stats?.jobs_par_jour?.length ? "vide" : "donnees"

  return (
    <SectionCardAdmin
      title="Événements par action"
      description="Statistiques des événements par action (total par action)."
      icon={Activity}
    >
      <TransitionEtat etat={etat}>
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger l'état du croisement." />
        ) : isLoading ? (
          <ChartActionsAuditSkeleton />
        ) : (
          <CadreChart vide={!parAction.length} videMessage="Aucune action dans la fenêtre.">
            <PieChart>
              <Tooltip content={<TooltipChart />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Pie
                data={parAction}
                dataKey="total"
                nameKey="action"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
                isAnimationActive={!mouvementReduit}
                animationDuration={600}
                animationEasing="ease-out"
              >
                {parAction.map((entree, i) => (
                  <Cell key={entree.action} fill={COULEURS_ACTION[i % COULEURS_ACTION.length]} />
                ))}
              </Pie>
            </PieChart>
          </CadreChart>
        )}
      </TransitionEtat>
    </SectionCardAdmin>
  )
}

export default ChartEvenementAction
```

## File: src/Pages/Admin/LogsPage/sections/ChartEvenements.jsx
```javascript
import { useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import {
  Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis,
} from "recharts"
import { useLogsStatsQuery } from "@/features/admin-logs.tools"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { CalendarDays } from "lucide-react"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import TooltipChart from "../components/TooltipChart"
import CadreChart from "@/components/admin/CadreChart"

const COULEURS_NIVEAU = { error: "#ef4444", warning: "#f59e0b", info: "#0F2D4D" }

/**
 * Segments par barre, du BAS vers le HAUT (ordre d'empilement Recharts
 * avec stackId="n" : Erreurs → Avertissements → Infos).
 * Profil réaliste d'un journal technique : infos largement dominantes,
 * avertissements moyens, erreurs marginales.
 */
const SEGMENTS_BARRES = [
  [68],
  [54],
  [72],
  [60],
  [58],
  [64],
  [70],
];

/**
 * État de chargement du BarChart empilé « Événements par jour et niveau ».
 * Reprend la géométrie du chart réel :
 *  - 3 segments empilés par jour (Erreurs en bas, Avertissements au
 *    milieu, Infos en haut), séparés par un gap de 1px ;
 *  - arrondi [4, 4, 0, 0] appliqué UNIQUEMENT au segment du haut
 *    (Infos), comme sur le <Bar radius={[4, 4, 0, 0]}> réel ;
 *  - axe Y à gauche, libellés de jours en dessous ;
 *  - légende 3 séries en bas (fontSize 11).
 * `height` doit correspondre à la hauteur du CadreChart / ResponsiveContainer
 * réel pour éviter tout layout shift.
 */
const ChartNiveauxJourSkeleton = ({ height = 220 }) => (
  <div
    role="status"
    aria-label="Chargement du graphique des événements par jour et niveau"
    className="flex w-full flex-col gap-3 p-2"
    style={{ height }}
  >
    <div className="flex flex-1 gap-2">
      {/* Axe Y : 3 graduations fictives */}
      <div className="flex w-6 flex-col justify-between py-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-2 w-full rounded-sm" />
        ))}
      </div>

      {/* Zone du graphique */}
      <div className="flex flex-1 flex-col">
        {/* Barres empilées, alignées en bas comme le BarChart */}
        <div className="flex flex-1 items-end gap-3 border-b border-border pb-px">
          {SEGMENTS_BARRES.map((segments, i) => (
            <div key={i} className="flex h-full flex-1 flex-col justify-end gap-px">
              {/* Rendu haut → bas : on inverse l'ordre des segments.
                  Le PREMIER rendu (Infos, segment du haut) porte l'arrondi
                  [4,4,0,0] comme le <Bar radius={[4, 4, 0, 0]}> réel. */}
              {[...segments].reverse().map((h, k) => (
                <Skeleton
                  key={k}
                  className={k === 0 ? "w-full rounded-t-sm" : "w-full"}
                  style={{
                    height: `${h}%`,
                    animationDelay: `${i * 70 + k * 30}ms`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Libellés de l'axe X (jours) */}
        <div className="mt-2 flex gap-3" aria-hidden="true">
          {SEGMENTS_BARRES.map((_, i) => (
            <Skeleton key={i} className="h-2 flex-1 rounded-sm" />
          ))}
        </div>
      </div>
    </div>

    {/* Légende : équivalent du <Legend wrapperStyle={{ fontSize: 11 }}> — 3 séries */}
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Skeleton className="h-2.5 w-2.5 rounded-xs" />
          <Skeleton className="h-2 w-16 rounded-xs" />
        </div>
      ))}
    </div>
  </div>
);

const ChartEvenements = () => {
  const mouvementReduit = useReducedMotion()
  const { data: stats, isLoading, isError, refetch } = useLogsStatsQuery(30)
  const parJourNiveau = useMemo(
    () =>
      (stats?.events_par_jour ?? []).map((j) => ({
        jour: new Date(`${j.jour}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        Erreurs: (j.par_action.failed ?? 0),
        Avertissements: (j.par_action.skipped ?? 0),
        Infos: (j.par_action.inserted ?? 0) + (j.par_action.updated ?? 0) + (j.par_action.duplicate ?? 0),
      })),
    [stats]
  )

  const etat = isError ? "erreur" : isLoading ? "chargement" : !stats?.jobs_par_jour?.length ? "vide" : "donnees"

  return (
    <SectionCardAdmin
      title="Événements par jour (30 j)"
      description="Statistiques des événements par jour, empilé par niveau."
      contentClassName="p-0 sm:p-0"
      icon={CalendarDays}
    >
      <TransitionEtat etat={etat}>
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger l'état du croisement." />
        ) : isLoading ? (
          <ChartNiveauxJourSkeleton />
        ) : (
          <CadreChart vide={!parJourNiveau.length} videMessage="Aucun événement dans la fenêtre.">
            <BarChart data={parJourNiveau} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="jour" fontSize={10} tickLine={false} />
              <YAxis allowDecimals={false} fontSize={10} tickLine={false} />
              <Tooltip content={<TooltipChart />} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Erreurs" stackId="n" fill={COULEURS_NIVEAU.error} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" />
              <Bar dataKey="Avertissements" stackId="n" fill={COULEURS_NIVEAU.warning} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" />
              <Bar dataKey="Infos" stackId="n" fill={COULEURS_NIVEAU.info} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" radius={[4, 4, 0, 0]} />
            </BarChart>
          </CadreChart>
        )}
      </TransitionEtat>
    </SectionCardAdmin>
  )
}

export default ChartEvenements
```

## File: src/Pages/Admin/LogsPage/sections/CompteursContacts.jsx
```javascript
import { Archive, Inbox, MailOpen, OctagonAlert, Reply } from "lucide-react"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { STATUTS_CONTACT, useLogsStatsQuery, } from "@/features/admin-logs.tools"

const ICON_COMPT = {
  new: Inbox,
  read: MailOpen,
  replied: Reply,
  archived: Archive,
  spam: OctagonAlert,
}

const CompteursContacts = () => {
  const { data: stats, isError, refetch } = useLogsStatsQuery(30)
  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"} >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 xl:grid-cols-5">
          {STATUTS_CONTACT.map((s, i) => (
            <CarteCompteur
              key={`statut-${s.valeur}`}
              label={`${s.libelle} (30 j)`}
              valeur={stats?.contacts_par_statut?.[s.valeur] ?? 0}
              icone={ICON_COMPT[s.valeur]}
              href="/admin/logs"
              query={`?onglet=contacts&statut=${s.valeur}`}
              className={i in [0, 1, 2] ? "sm:col-span-2 xl:col-span-1" : i === 3 ? "sm:col-span-3 xl:col-span-1" : "col-span-2 sm:col-span-3 xl:col-span-1"}
            />
          ))}
        </div>
      )}
    </TransitionEtat>
  )
}

export default CompteursContacts
```

## File: src/Pages/Admin/LogsPage/sections/CompteursEmailsTx.jsx
```javascript
import { AlertCircle, CalendarX, History, ListOrdered } from "lucide-react"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { useEmailsTxStatsQuery } from "@/features/admin-logs.tools"

const CompteursEmailsTx = () => {
  // Stats 30 j (M1-M3, M5, M6) + stats 1 j (M4 badge « aujourd'hui »).
  const { data: stats, isError, refetch } = useEmailsTxStatsQuery(30)
  const { data: statsJour } = useEmailsTxStatsQuery(1)
  const echecsJour = statsJour?.echecs_fenetre ?? 0

  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"}>
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques." />
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <CarteCompteur label="Total (historique)" valeur={stats?.total ?? 0} icone={History} />
          <CarteCompteur
            label="Échecs"
            valeur={stats?.par_statut?.failed ?? 0}
            icone={AlertCircle}
            href="/admin/logs"
            query="?onglet=emails&statut=failed"
          />
          <CarteCompteur
            label="En file"
            valeur={stats?.par_statut?.queued ?? 0}
            icone={ListOrdered}
            href="/admin/logs"
            query="?onglet=emails&statut=queued"
          />
          <CarteCompteur
            label="Échecs aujourd'hui"
            valeur={echecsJour}
            icone={CalendarX}
            suffixe={`échec${echecsJour > 1 ? "s" : ""}`}
          />
        </div>
      )}
    </TransitionEtat>
  )
}

export default CompteursEmailsTx
```

## File: src/Pages/Admin/LogsPage/sections/CompteursEvents.jsx
```javascript
import { Activity, AlertCircle, AlertTriangle, CopyCheck } from "lucide-react"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { useLogsStatsQuery } from "@/features/admin-logs.tools"

const CompteursEvents = () => {
  const { data: stats, isError, refetch } = useLogsStatsQuery(30)
  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"} >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques." />
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <CarteCompteur label="Total événements" valeur={stats?.events_total ?? 0} icone={Activity} />
          <CarteCompteur label="Erreurs" valeur={stats?.events_errors ?? 0} icone={AlertCircle} href="/admin/logs" query="?niveau=error" />
          <CarteCompteur label="Avertissements" valeur={stats?.events_warnings ?? 0} icone={AlertTriangle} href="/admin/logs" query="?niveau=warning" />
          <CarteCompteur label="Doublons détectés" valeur={stats?.events_duplicates ?? 0} icone={CopyCheck} />
        </div>
      )}
    </TransitionEtat>
  )
}

export default CompteursEvents
```

## File: src/Pages/Admin/LogsPage/sections/ListeEmailsTx.jsx
```javascript
import { memo, useMemo, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import { Link } from "react-router-dom"
import { Eye, Inbox, RotateCcw, Search, User } from "lucide-react"
import { cn } from "cn"
import { dateHeure } from "@/lib/dates"
import { useRechercheDebouncee } from "@/hooks/use-recherche-debouncee"
import { useFiltresLogsAdmin } from "@/contexts/FiltresLogsAdmin.context"
import {
  MOTIFS_EMAIL, VARIANTE_STATUT_EMAIL, libelleMotif, libelleStatutEmail,
  useEmailsTxQuery,
} from "@/features/admin-logs.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import PaginationListe from "@/components/admin/PaginationListe"
import EnteteTriable from "@/components/admin/EnteteTriable"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import Bloc from "@/components/admin/Bloc"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SectionErreur, SectionVide, SectionAucunResultat, TransitionEtat } from "@/components/admin/EtatsSection"
import CarteEmailMobile from "../components/CarteEmailMobile"
import { SkeletonLigneEmail, SkeletonCarteEmailMobile } from "../components/SkeletonEmail"
import BlocSkel from "../components/BlocSkel"

/* ─────────────────────────────────────────────────────────────────────
   Liste des emails transactionnels — /admin/logs (onglet Emails).
   Mobile (< md) : cartes + tri par Select — Desktop : table triable.
   Alignement complet sur ListeEvenements / ListeMessages (cycle 17).
───────────────────────────────────────────────────────────────────── */

/* Tri « français » robuste : nombres, textes, dates ISO ; vides en fin. */
const comparerValeurs = (a, b) => {
  const videA = a === null || a === undefined || b === null
  const videB = b === null || b === undefined
  if (videA && videB) return 0
  if (videA) return 1
  if (videB) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" })
}

/* Rang de tri des statuts : échec d'abord (desc) — signal opérationnel. */
const RANG_STATUT_EMAIL = { failed: 3, queued: 2, sent: 1 }

const STATUTS_EMAIL = ["failed", "queued", "sent"]

const COLONNES = [
  { cle: "date", libelle: "Date", directionInitiale: "desc", triValeur: (e) => e.created_at ?? null },
  { cle: "destinataire", libelle: "Destinataire", directionInitiale: "asc", triValeur: (e) => (e.to_email ?? "").toLowerCase() },
  { cle: "motif", libelle: "Motif", directionInitiale: "asc", triValeur: (e) => libelleMotif(e.purpose) },
  { cle: "statut", libelle: "Statut", directionInitiale: "desc", triValeur: (e) => RANG_STATUT_EMAIL[e.status] ?? 0 },
  {
    cle: "tentatives", libelle: "Tentatives", directionInitiale: "desc",
    className: "hidden lg:table-cell",
    triValeur: (e) => e.attempts ?? 0,
  },
]

const classeDeclencheur = (actif, largeur) =>
  cn(
    "h-8 text-xs transition-colors",
    largeur,
    actif
      ? "border-brand-navy/30 bg-secondary font-semibold text-secondary-foreground"
      : "text-muted-foreground"
  )

/* ─── Ligne desktop mémoïsée ─── */
const LigneEmail = memo(function LigneEmail({ email, onDetail }) {
  return (
    <TableRow className="transition-colors hover:bg-muted/50">
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{dateHeure(email.created_at)}</TableCell>
      <TableCell>
        <span className="block max-w-48 truncate text-xs font-medium" title={email.to_email}>{email.to_email}</span>
        {email.subscriber_id && (
          <Link
            to={`/admin/utilisateurs/${email.subscriber_id}`}
            className="inline-flex items-center gap-1 text-[10px] text-primary underline-offset-2 hover:underline"
          >
            <User className="size-3" aria-hidden /> Fiche abonné
          </Link>
        )}
      </TableCell>
      <TableCell className="text-xs">{libelleMotif(email.purpose)}</TableCell>
      <TableCell>
        <Badge variant={VARIANTE_STATUT_EMAIL[email.status] ?? "outline"}>
          {libelleStatutEmail(email.status)}
        </Badge>
        {email.status === "failed" && email.last_error && (
          <span className="mt-0.5 block max-w-48 truncate text-[10px] text-destructive" title={email.last_error}>
            {email.last_error}
          </span>
        )}
      </TableCell>
      <TableCell className="hidden text-xs tabular-nums text-muted-foreground lg:table-cell">{email.attempts}</TableCell>
      <TableCell>
        <div className="flex justify-end">
          <Button variant="ghost" size="icon-sm" onClick={() => onDetail(email)} aria-label={`Détails de l'email à ${email.to_email}`}>
            <Eye className="size-3.5" aria-hidden />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
})

/* ─── SKELETON FIDÈLE ──────────────────────────────────────────────── */
const EmailsSkeleton = ({ nbLignes = 20 }) => {
  const lignes = Array.from({ length: nbLignes }, (_, i) => i)
  const lignesMobile = lignes.slice(0, Math.min(nbLignes, 6))
  return (
    <div role="status" aria-label="Chargement des emails transactionnels">
      {/* Mobile : Select de tri + cartes */}
      <div className="px-4 pt-3 md:hidden" aria-hidden="true">
        <Skeleton className="h-8 w-full" />
      </div>
      <ul className="flex flex-col gap-3 px-4 pb-2 md:hidden" aria-hidden="true">
        {lignesMobile.map((i) => (
          <li key={i}><SkeletonCarteEmailMobile delay={i * 70} /></li>
        ))}
      </ul>
      {/* Desktop : table avec en-tête */}
      <div className="hidden overflow-x-auto scrollbar-thin md:block">
        <Table aria-hidden="true">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><BlocSkel className="h-3 w-10" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-20" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-12" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-12" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-14" /></TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((i) => <SkeletonLigneEmail key={i} delay={i * 70} />)}
          </TableBody>
        </Table>
      </div>
      {/* Pied partagé : équivalent de PaginationListe */}
      <div className="border-t border-border px-4 py-3" aria-hidden="true">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-3 w-24" />
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }, (_, j) => (
              <Skeleton key={j} className="size-8 rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── COMPOSANT PRINCIPAL ────────────────────────────────────────── */
const ListeEmailsTx = () => {
  const mouvementReduit = useReducedMotion()
  const {
    motif, statutEmail, recherche, pageEmails, paramsEmails,
    setMotif, setStatutEmail, setPageEmails, reinitialiserEmails, setScalar,
  } = useFiltresLogsAdmin()

  const { data: emails, isLoading, isError, refetch } = useEmailsTxQuery(paramsEmails)
  const [detail, setDetail] = useState(null)

  /* Tri INITIALISÉ : « Date » descendante (le plus récent d'abord). */
  const [tri, setTri] = useState({ cle: "date", direction: "desc" })

  /* Ancrage du retour en haut du tableau au changement de page. */
  const refTableau = useRef(null)

  // Recherche debouncée → setScalar BRUT.
  const { valeurLocale, setValeurLocale } = useRechercheDebouncee({
    valeurUrl: recherche,
    setScalar,
    cle: "recherche",
  })

  const filtresActifs = !!(motif || statutEmail || recherche)
  const pagePleine = Array.isArray(emails) && emails.length === paramsEmails.limit

  /* Filtrage CLIENT DE GARANTIE sur la page chargée. */
  const emailsFiltres = useMemo(() => {
    const base = emails ?? []
    if (!filtresActifs) return base
    const q = recherche.trim().toLowerCase()
    return base.filter((e) => {
      if (motif && e.purpose !== motif) return false
      if (statutEmail && e.status !== statutEmail) return false
      if (q && !(e.to_email ?? "").toLowerCase().includes(q)) return false
      return true
    })
  }, [emails, filtresActifs, motif, statutEmail, recherche])

  const emailsAffiches = useMemo(() => {
    if (!tri) return emailsFiltres
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return emailsFiltres
    const copie = [...emailsFiltres].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [emailsFiltres, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  /* Tri mobile : un Select (les en-têtes cliquables sont masqués < md). */
  const trierMobile = (valeur) => {
    if (valeur === "serveur") return setTri(null)
    const colonne = COLONNES.find((c) => c.cle === valeur)
    if (colonne) setTri({ cle: colonne.cle, direction: colonne.directionInitiale })
  }

  /* Changement de page → retour en haut du tableau. */
  const changerPage = (nouvellePage) => {
    setPageEmails(nouvellePage)
    refTableau.current?.scrollIntoView({
      behavior: mouvementReduit ? "auto" : "smooth",
      block: "start",
    })
  }

  /* key = fondu léger du corps à chaque changement de tri / filtres. */
  const cleCorps = `${motif}-${statutEmail}-${recherche}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  const etat = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !emails?.length
        ? filtresActifs ? "aucun-resultat" : "vide"
        : "donnees"

  return (
    <div ref={refTableau} className="scroll-mt-20">
      <SectionCardAdmin
        title="Emails transactionnels"
        description="Inscriptions, confirmations, désinscriptions — filtrez par motif, statut ou destinataire."
        icon={Inbox}
        contentClassName="p-0 sm:p-0"
      >
        {/* ─── Filtres : selects shadcn + recherche, responsifs ─── */}
        <div className="flex items-center flex-wrap gap-3 border-b border-border px-4 py-3">
          <div className="relative min-w-52 flex-1">
            {isLoading ? (
              <span
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-primary border-t-transparent"
                aria-label="Recherche en cours"
              />
            ) : (
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            )}
            <Input
              type="search"
              value={valeurLocale}
              onChange={(e) => setValeurLocale(e.target.value)}
              placeholder="Rechercher un destinataire…"
              aria-label="Rechercher un destinataire"
              className="h-8 pl-8 text-xs"
            />
          </div>
          {/* Sentinelle « tous » : Radix refuse la valeur vide. */}
          <Select value={motif || "tous"} onValueChange={(v) => setMotif(v === "tous" ? "" : v)}>
            <SelectTrigger className={classeDeclencheur(!!motif, "w-full sm:w-48")} aria-label="Filtrer par motif">
              <SelectValue placeholder="Filtrer par motif" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous les motifs</SelectItem>
              {MOTIFS_EMAIL.map((m) => (
                <SelectItem key={m.valeur} value={m.valeur}>{m.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statutEmail || "tous"} onValueChange={(v) => setStatutEmail(v === "tous" ? "" : v)}>
            <SelectTrigger className={classeDeclencheur(!!statutEmail, "w-full sm:w-40")} aria-label="Filtrer par statut">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous les statuts</SelectItem>
              {STATUTS_EMAIL.map((v) => (
                <SelectItem key={v} value={v}>{libelleStatutEmail(v)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtresActifs && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={reinitialiserEmails}>
              <RotateCcw aria-hidden /> Réinitialiser
            </Button>
          )}
        </div>

        {/* ─── Corps : états + cartes mobile / table desktop ─── */}
        <Bloc>
          <TransitionEtat etat={etat}>
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les emails transactionnels." />
              </div>
            ) : isLoading ? (
              <EmailsSkeleton nbLignes={paramsEmails.limit} />
            ) : !emails?.length ? (
              <div className="p-4">
                {filtresActifs ? (
                  <SectionAucunResultat onReset={reinitialiserEmails} message="Aucun email ne correspond aux critères." />
                ) : (
                  <SectionVide message="Aucun email transactionnel pour l'instant." />
                )}
              </div>
            ) : (
              <>
                {/* ── Tri — mobile (desktop : en-têtes cliquables) ── */}
                <div className="px-4 pt-3 md:hidden">
                  <Select value={tri?.cle ?? "serveur"} onValueChange={trierMobile}>
                    <SelectTrigger className="h-8 w-full text-xs" aria-label="Trier les emails">
                      <SelectValue placeholder="Trier par…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="serveur">Ordre du serveur (défaut)</SelectItem>
                      <SelectItem value="date">Date (plus récentes d'abord)</SelectItem>
                      <SelectItem value="destinataire">Destinataire (A→Z)</SelectItem>
                      <SelectItem value="motif">Motif (A→Z)</SelectItem>
                      <SelectItem value="statut">Statut (échecs d'abord)</SelectItem>
                      <SelectItem value="tentatives">Tentatives (décroissant)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* ── Mobile : cartes ─────────────────────────── */}
                <ul
                  key={cleCorps}
                  className="flex animate-in flex-col gap-3 px-4 pb-2 duration-200 motion-reduce:animate-none md:hidden"
                >
                  {emailsAffiches.map((email) => (
                    <li key={email.id}>
                      <CarteEmailMobile email={email} onDetail={setDetail} />
                    </li>
                  ))}
                </ul>

                {/* ── Desktop : table ─────────────────────────── */}
                <section aria-label="Emails transactionnels" className="hidden overflow-x-auto scrollbar-thin md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "date")} tri={tri} onTri={basculerTri} />
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "destinataire")} tri={tri} onTri={basculerTri} />
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "motif")} tri={tri} onTri={basculerTri} />
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "statut")} tri={tri} onTri={basculerTri} />
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "tentatives")} tri={tri} onTri={basculerTri} aligneDroite />
                        <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    {/* key = fondu léger à chaque changement de tri / filtres */}
                    <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                      {emailsAffiches.map((email) => (
                        <LigneEmail key={email.id} email={email} onDetail={setDetail} />
                      ))}
                    </TableBody>
                  </Table>
                </section>

                {/* Compteur honnête quand le filtre client s'applique. */}
                {filtresActifs && !isLoading && (
                  <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
                    {emailsAffiches.length} email{emailsAffiches.length > 1 ? "s" : ""} affiché{emailsAffiches.length > 1 ? "s" : ""} sur {emails.length} (page courante)
                  </div>
                )}

                {/* ─── Pagination heuristique ─── */}
                <div className="border-t border-border px-4 py-3">
                  <PaginationListe page={pageEmails} pagePleine={pagePleine} onPageChange={changerPage} />
                </div>
              </>
            )}
          </TransitionEtat>
        </Bloc>
      </SectionCardAdmin>

      {/* ─── Dialog détail (métadonnées seulement — jamais les payloads) ─── */}
      {detail && (
        <Dialog open onOpenChange={(ouvert) => { if (!ouvert) setDetail(null) }}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Email {libelleMotif(detail.purpose)}</DialogTitle>
              <DialogDescription>
                {dateHeure(detail.created_at)} · destinataire {detail.to_email}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <p><span className="font-medium">Statut :</span>{" "}
                <Badge variant={VARIANTE_STATUT_EMAIL[detail.status] ?? "outline"}>{libelleStatutEmail(detail.status)}</Badge>
              </p>
              <p><span className="font-medium">Fournisseur :</span> {detail.provider}</p>
              {detail.provider_email_id && (
                <p className="truncate font-mono text-[10px]" title={detail.provider_email_id}>
                  <span className="font-medium">ID fournisseur :</span> {detail.provider_email_id}
                </p>
              )}
              <p><span className="font-medium">Tentatives :</span> {detail.attempts}</p>
              {detail.last_error && (
                <p className="rounded-lg bg-destructive/10 p-2 font-mono text-[10px] text-destructive">
                  {detail.last_error}
                </p>
              )}
              {detail.subscriber_id && (
                <Link
                  to={`/admin/utilisateurs/${detail.subscriber_id}`}
                  className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                >
                  <User className="size-3" aria-hidden /> Voir la fiche abonné
                </Link>
              )}
              <p className="text-[10px] text-muted-foreground">
                Les payloads de requête/réponse au fournisseur ne sont jamais exposés (principe de sécurité serveur).
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default ListeEmailsTx
```

## File: src/Pages/Admin/LogsPage/sections/ListeEvenements.jsx
```javascript
import { useMemo, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import {
  Activity, AlertTriangle, CalendarDays, RotateCcw,
} from "lucide-react"
import { cn } from "cn"
import { fmtDay } from "@/lib/dates"
import { useFiltresLogsAdmin } from "@/contexts/FiltresLogsAdmin.context"
import {
  LIBELLE_ACTION_EVENT, NIVEAUX_EVENT,
  useEventsQuery, useLogsStatsQuery, useRunsParents, useSourcesReferentiel,
} from "@/features/admin-logs.tools"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import PaginationListe from "@/components/admin/PaginationListe"
import EnteteTriable from "@/components/admin/EnteteTriable"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { Table, TableHeader, TableBody, TableHead, TableRow } from "@/components/ui/table"
import { SectionErreur, SectionVide, SectionAucunResultat, TransitionEtat } from "@/components/admin/EtatsSection"
import Bloc from "@/components/admin/Bloc"
import { FilterPopover, MiniCalendar } from "@/components/shared"
import CarteEventMobile, { SkeletonCarteEventMobile } from "../components/CarteEventMobile"
import BlocSkel from "../components/BlocSkel"
import LigneEvent, { SkeletonLigneEvent } from "../components/LigneEvent"

/* ─────────────────────────────────────────────────────────────────────
   Liste des événements techniques — /admin/logs (onglet Événements).
   Mobile (< md) : cartes + tri par Select — Desktop : table triable.
───────────────────────────────────────────────────────────────────── */

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

/* Date → « AAAA-MM-JJ » local (symétrique du parse en T00:00:00). */
const isoJour = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/* Rang de tri des niveaux : erreur d'abord (desc). */
const RANG_NIVEAU = { error: 3, warning: 2, info: 1 }

/* Colonnes triables — Message (texte long) et Source/run (lien croisé)
   restent des en-têtes simples. */
const COLONNES = [
  { cle: "date", libelle: "Date", directionInitiale: "desc", triValeur: (e) => e.created_at ?? null },
  { cle: "niveau", libelle: "Niveau", directionInitiale: "desc", triValeur: (e) => RANG_NIVEAU[e.niveau] ?? 0 },
  { cle: "action", libelle: "Action", directionInitiale: "asc", triValeur: (e) => LIBELLE_ACTION_EVENT[e.action] ?? e.action ?? "" },
]

/* Déclencheur de filtre : surbrillance quand une valeur non défaut est
   sélectionnée. */
const classeDeclencheur = (actif, largeur) =>
  cn(
    "h-8 text-xs transition-colors",
    largeur,
    actif
      ? "border-brand-navy/30 bg-secondary font-semibold text-secondary-foreground"
      : "text-muted-foreground"
  )



/* ─── SKELETONS FIDÈLES ────────────────────────────────────────────
   ⚠️ `Bloc` est déjà le composant de layout importé de
   @/components/admin/Bloc → le helper skeleton s'appelle BlocSkel. */


const EvenementsSkeleton = ({ nbLignes = 20 }) => {
  const lignes = Array.from({ length: nbLignes }, (_, i) => i)
  /* Le skeleton mobile est borné : inutile de monter des dizaines de
     cartes skeleton quand la taille de page est grande. */
  const lignesMobile = lignes.slice(0, Math.min(nbLignes, 8))
  return (
    <div role="status" aria-label="Chargement des événements">
      {/* Mobile : Select de tri + cartes */}
      <div className="px-4 pt-3 md:hidden" aria-hidden="true">
        <Skeleton className="h-8 w-full" />
      </div>
      <ul className="flex flex-col gap-3 px-4 pb-2 md:hidden" aria-hidden="true">
        {lignesMobile.map((i) => (
          <li key={i}><SkeletonCarteEventMobile delay={i * 70} /></li>
        ))}
      </ul>

      {/* Desktop : table avec en-tête */}
      <div className="hidden overflow-x-auto scrollbar-thin md:block">
        <Table aria-hidden="true">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><BlocSkel className="h-3 w-10" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-12" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-12" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-16" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-20" /></TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((i) => <SkeletonLigneEvent key={i} delay={i * 70} />)}
          </TableBody>
        </Table>
      </div>

      {/* Pied partagé : équivalent de PaginationListe */}
      <div className="border-t border-border px-4 py-3" aria-hidden="true">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-3 w-24" />
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }, (_, j) => (
              <Skeleton key={j} className="size-8 rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── COMPOSANT PRINCIPAL ────────────────────────────────────────── */
const ListeEvenements = () => {
  const mouvementReduit = useReducedMotion()
  const {
    niveau, source, debutEvents, finEvents, pageEvents, paramsEvents,
    setNiveau, setSource, setDebutEvents, setFinEvents, setPageEvents, reinitialiserEvents,
  } = useFiltresLogsAdmin()
  const { data: stats } = useLogsStatsQuery(30)
  const { data: events, isLoading, isError, refetch } = useEventsQuery(paramsEvents)
  const { data: referentiels } = useSourcesReferentiel()
  const { data: runsParents } = useRunsParents()

  /* Tri INITIALISÉ : « Date » descendante (le plus récent d'abord). */
  const [tri, setTri] = useState({ cle: "date", direction: "desc" })
  const [calendrierOuvert, setCalendrierOuvert] = useState(false)

  /* Ancrage du retour en haut du tableau au changement de page. */
  const refTableau = useRef(null)

  /* Résolution sous-run → run parent (pattern cycle 12). */
  const parentParSousRun = useMemo(() => {
    const m = new Map()
    for (const run of runsParents ?? []) {
      for (const sousRun of run.source_runs ?? []) m.set(sousRun.id, run.id)
    }
    return m
  }, [runsParents])

  const filtresActifs = !!(niveau || source || debutEvents || finEvents)
  const pagePleine = Array.isArray(events) && events.length === paramsEvents.limit

  const eventsAffiches = useMemo(() => {
    const base = events ?? []
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [events, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  /* Tri mobile : un Select (les en-têtes cliquables sont masqués < md).
     Chaque option applique la direction initiale naturelle de la colonne ;
     « serveur » revient à l'ordre naturel (tri = null). */
  const trierMobile = (valeur) => {
    if (valeur === "serveur") return setTri(null)
    const colonne = COLONNES.find((c) => c.cle === valeur)
    if (colonne) setTri({ cle: colonne.cle, direction: colonne.directionInitiale })
  }

  /* ─── Période : URL « AAAA-MM-JJ » ↔ MiniCalendar ─── */
  const plageDates = useMemo(() => ({
    start: debutEvents ? new Date(`${debutEvents}T00:00:00`) : null,
    end: finEvents ? new Date(`${finEvents}T00:00:00`) : null,
  }), [debutEvents, finEvents])

  const changerPlage = (r) => {
    setDebutEvents(r?.start ? isoJour(r.start) : "")
    setFinEvents(r?.end ? isoJour(r.end) : "")
  }

  const libellePeriode = debutEvents && finEvents
    ? `Du ${fmtDay(plageDates.start)} au ${fmtDay(plageDates.end)}`
    : debutEvents
      ? `Depuis le ${fmtDay(plageDates.start)}`
      : "Période"

  /* Changement de page → retour en haut du tableau. */
  const changerPage = (nouvellePage) => {
    setPageEvents(nouvellePage)
    refTableau.current?.scrollIntoView({
      behavior: mouvementReduit ? "auto" : "smooth",
      block: "start",
    })
  }

  /* key = fondu léger du corps à chaque changement de tri / filtres. */
  const cleCorps = `${niveau}-${source}-${debutEvents}-${finEvents}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  /* ⚠️ Clé d'état : le tri / filtres n'en font PAS partie — l'ancienne
     clé `${etat}-${cleCorps}` rejouait le fondu global de la section à
     chaque tri en plus du fondu du corps (double animation). Le fondu
     tri/filtres est porté par key={cleCorps} sur le TableBody / la liste. */
  const etat = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !events?.length
        ? filtresActifs ? "aucun-resultat" : "vide"
        : "donnees"

  return (
    <div ref={refTableau} className="scroll-mt-20">
      <SectionCardAdmin
        title="Événements"
        description="Liste des événements d'ingestion — filtrez, triez, croisez avec les runs et les offres."
        icon={Activity}
        contentClassName="p-0 sm:p-0"
      >
        {/* ─── Filtres : selects shadcn + période MiniCalendar ─── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          {/* Sentinelle « tous/toutes » : Radix refuse la valeur vide. */}
          <Select value={niveau || "tous"} onValueChange={(v) => setNiveau(v === "tous" ? "" : v)}>
            <SelectTrigger className={classeDeclencheur(!!niveau, "w-full sm:w-44")} aria-label="Filtrer par niveau">
              <SelectValue placeholder="Filtrer par niveau" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous les niveaux</SelectItem>
              {NIVEAUX_EVENT.map((n) => (
                <SelectItem key={n.valeur} value={n.valeur}>{n.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={source || "toutes"} onValueChange={(v) => setSource(v === "toutes" ? "" : v)}>
            <SelectTrigger className={classeDeclencheur(!!source, "w-full sm:w-56")} aria-label="Filtrer par source">
              <SelectValue placeholder="Filtrer par source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toutes">Toutes les sources</SelectItem>
              {(referentiels?.sources ?? []).map((s) => (
                <SelectItem key={s.id ?? s.code} value={s.id ?? s.code}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Période : déclencheur → panneau MiniCalendar (presets inclus). */}
          <FilterPopover
            open={calendrierOuvert}
            onToggle={() => setCalendrierOuvert((o) => !o)}
            onClose={() => setCalendrierOuvert(false)}
            label={libellePeriode}
            icon={CalendarDays}
            align="right"
            panelClassName="w-[19.5rem] p-3"
          >
            <MiniCalendar range={plageDates} onChange={changerPlage} />
          </FilterPopover>

          {filtresActifs && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={reinitialiserEvents}>
              <RotateCcw aria-hidden /> Réinitialiser
            </Button>
          )}
        </div>

        {/* ─── Corps : états + cartes mobile / table desktop ─── */}
        <Bloc>
          <TransitionEtat etat={etat}>
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les événements." />
              </div>
            ) : isLoading ? (
              <EvenementsSkeleton nbLignes={paramsEvents.limit} />
            ) : !events?.length ? (
              <div className="p-4">
                {filtresActifs ? (
                  <SectionAucunResultat onReset={reinitialiserEvents} message="Aucun événement ne correspond aux critères." />
                ) : (
                  <SectionVide message="Aucun événement d'ingestion pour l'instant." />
                )}
                {/* Erreurs existantes hors filtre courant */}
                {stats?.events_errors > 0 && (
                  <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangle className="size-3.5 text-amber-500" aria-hidden />
                    Des erreurs existent hors filtre courant — {stats.events_errors} au total.
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* ── Tri — mobile (desktop : en-têtes cliquables) ── */}
                <div className="px-4 pt-3 md:hidden">
                  <Select value={tri?.cle ?? "serveur"} onValueChange={trierMobile}>
                    <SelectTrigger className="h-8 w-full text-xs" aria-label="Trier les événements">
                      <SelectValue placeholder="Trier par…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="serveur">Ordre du serveur (défaut)</SelectItem>
                      <SelectItem value="date">Date (plus récentes d'abord)</SelectItem>
                      <SelectItem value="niveau">Niveau (erreurs d'abord)</SelectItem>
                      <SelectItem value="action">Action (A→Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* ── Mobile : cartes ─────────────────────────── */}
                <ul
                  key={cleCorps}
                  className="flex animate-in flex-col gap-3 px-4 pb-2 duration-200 motion-reduce:animate-none md:hidden"
                >
                  {eventsAffiches.map((evt) => (
                    <li key={evt.id}>
                      <CarteEventMobile
                        evt={evt}
                        runParent={evt.source_scrape_run_id ? parentParSousRun.get(evt.source_scrape_run_id) : null}
                      />
                    </li>
                  ))}
                </ul>

                {/* ── Desktop : table ─────────────────────────── */}
                <section aria-label="Événements" className="hidden overflow-x-auto scrollbar-thin md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "date")} tri={tri} onTri={basculerTri} />
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "niveau")} tri={tri} onTri={basculerTri} />
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "action")} tri={tri} onTri={basculerTri} />
                        <TableHead>Message</TableHead>
                        <TableHead>Source / run</TableHead>
                        <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    {/* key = fondu léger à chaque changement de tri / filtres */}
                    <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                      {eventsAffiches.map((evt) => (
                        <LigneEvent
                          key={evt.id}
                          evt={evt}
                          runParent={evt.source_scrape_run_id ? parentParSousRun.get(evt.source_scrape_run_id) : null}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </section>

                {/* ─── Pagination heuristique (liste plate sans total) ─── */}
                <div className="border-t border-border px-4 py-3">
                  <PaginationListe page={pageEvents} pagePleine={pagePleine} onPageChange={changerPage} />
                </div>
              </>
            )}
          </TransitionEtat>
        </Bloc>
      </SectionCardAdmin>
    </div>
  )
}

export default ListeEvenements
```

## File: src/Pages/Admin/LogsPage/sections/ListeMessages.jsx
```javascript
import { memo, useMemo, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import { Eye, Inbox, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { dateHeure } from "@/lib/dates"
import { useFiltresLogsAdmin } from "@/contexts/FiltresLogsAdmin.context"
import {
  CONTACT_INTERNE_VERS_API, STATUTS_CONTACT, VARIANTE_CONTACT,
  messageErreurLogs, useChangerStatutContact, useContactsQuery, useLogsStatsQuery,
} from "@/features/admin-logs.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import PaginationListe from "@/components/admin/PaginationListe"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useNotify } from "@/contexts/Notify.context"
import { SectionErreur, SectionVide, SectionAucunResultat, TransitionEtat } from "@/components/admin/EtatsSection"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import Bloc from "@/components/admin/Bloc"
import DialogMessageDetail from "@/components/dialog/DialogMessageDetail"
import SelectStatutContact from "../components/SelectStatutContact"
import { SkeletonCarteContactMobile, SkeletonLigneContact } from "../components/SkeletonMessage"
import BlocSkel from "../components/BlocSkel"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Messages de contact (cycle 17, doc v3 §17.2).
   Mobile (< md) : cartes avec Select de statut intégré — Desktop : table.
───────────────────────────────────────────────────────────────────── */

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

/** Traduit le statut d'une ligne (stocké OU API) vers la clé API. */
const statutApi = (statut) => CONTACT_INTERNE_VERS_API[statut] ?? statut

/* Rang de tri des statuts : cycle de vie du message (new → spam). */
const RANG_STATUT_CONTACT = { new: 1, read: 2, replied: 3, archived: 4, spam: 5 }

const COLONNES = [
  { cle: "recu", libelle: "Reçu", directionInitiale: "desc", triValeur: (m) => m.created_at ?? null },
  { cle: "expediteur", libelle: "Expéditeur", directionInitiale: "asc", triValeur: (m) => (m.full_name ?? "").toLowerCase() },
  { cle: "sujet", libelle: "Sujet", directionInitiale: "asc", triValeur: (m) => m.subject_label ?? "" },
  { cle: "statut", libelle: "Statut", directionInitiale: "asc", triValeur: (m) => RANG_STATUT_CONTACT[statutApi(m.status)] ?? 0 },
]

const classeDeclencheur = (actif, largeur) =>
  cn(
    "h-8 text-xs transition-colors",
    largeur,
    actif
      ? "border-brand-navy/30 bg-secondary font-semibold text-secondary-foreground"
      : "text-muted-foreground"
  )

/* ── Carte mobile (miroir de la ligne desktop) ─────────────────────
   Toutes les actions restent accessibles : badge de statut, changement
   de statut inline (Select + spinner), bouton détail (Dialog). */
const CarteMessageMobile = memo(function CarteMessageMobile({ message, enCours, onChanger, onDetail }) {
  const cleApi = statutApi(message.status)
  return (
    <article
      aria-label={`Message de ${message.full_name}`}
      className="rounded-xl border border-border bg-card p-4 shadow-soft"
    >
      {/* En-tête : date / identité + badge statut + détail */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] tabular-nums text-muted-foreground">
            Reçu le {dateHeure(message.created_at)}
          </p>
          <p className="mt-0.5 truncate text-sm font-medium" title={message.full_name}>
            {message.full_name}
          </p>
          <p className="truncate text-[10px] text-muted-foreground" title={message.email}>
            {message.email}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={VARIANTE_CONTACT[cleApi] ?? "outline"}>
            {STATUTS_CONTACT.find((s) => s.valeur === cleApi)?.libelle ?? cleApi}
          </Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDetail(message)}
            aria-label={`Détails du message de ${message.full_name}`}
          >
            <Eye className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Sujet (tronqué sur 2 lignes, title complet) */}
      <p className="mt-2 line-clamp-2 text-xs" title={message.subject_label}>
        {message.subject_label}
      </p>
      {message.replied_at && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          répondu le {dateHeure(message.replied_at)}
        </p>
      )}

      {/* Pied : changement de statut */}
      <div className="mt-3 border-t border-border pt-2">
        <SelectStatutContact message={message} enCours={enCours} onChanger={onChanger} />
      </div>
    </article>
  )
})

const ContactsSkeleton = ({ nbLignes }) => {
  const lignes = Array.from({ length: nbLignes }, (_, i) => i)
  return (
    <div role="status" aria-label="Chargement des messages de contact">
      {/* ── Mobile : cartes ─────────────────────────────── */}
      <ul className="flex flex-col gap-3 px-4 pb-2 md:hidden" aria-hidden="true">
        {lignes.slice(0, Math.min(nbLignes, 6)).map((i) => (
          <li key={i}><SkeletonCarteContactMobile delay={i * 70} /></li>
        ))}
      </ul>

      {/* ── Desktop : table avec en-tête ────────────────── */}
      <div className="hidden overflow-x-auto scrollbar-thin md:block">
        <Table aria-hidden="true">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><BlocSkel className="h-3 w-10" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-20" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-10" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-12" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-24" /></TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((i) => <SkeletonLigneContact key={i} delay={i * 70} />)}
          </TableBody>
        </Table>
      </div>

      {/* Pied partagé : équivalent de PaginationListe */}
      <div className="border-t border-border px-4 py-3" aria-hidden="true">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-3 w-24" />
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }, (_, j) => (
              <Skeleton key={j} className="size-8 rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── COMPOSANT PRINCIPAL ────────────────────────────────────────── */
const ListeMessages = () => {
  const notify = useNotify()
  const mouvementReduit = useReducedMotion()
  const { statutContact, pageContacts, paramsContacts, setStatutContact, setPageContacts, reinitialiserContacts } =
    useFiltresLogsAdmin()
  const { data: stats } = useLogsStatsQuery(30)
  const { data: contacts, isLoading, isError, refetch } = useContactsQuery(paramsContacts)
  const changerStatut = useChangerStatutContact()
  const [detail, setDetail] = useState(null)
  /* Tri INITIALISÉ : « Reçu » descendant (le plus récent d'abord). */
  const [tri, setTri] = useState({ cle: "recu", direction: "desc" })
  /* Ancrage du retour en haut du tableau au changement de page. */
  const refTableau = useRef(null)

  const filtresActifs = !!statutContact
  const pagePleine = Array.isArray(contacts) && contacts.length === paramsContacts.limit

  /* Filtrage CLIENT DE GARANTIE sur la page chargée, en plus du
     paramètre serveur — le filtre fonctionne quoi que fasse le backend. */
  const contactsFiltres = useMemo(() => {
    const base = contacts ?? []
    if (!statutContact) return base
    return base.filter((m) => statutApi(m.status) === statutContact)
  }, [contacts, statutContact])

  const contactsAffiches = useMemo(() => {
    if (!tri) return contactsFiltres
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return contactsFiltres
    const copie = [...contactsFiltres].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [contactsFiltres, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  /* Changement de statut inline (Select par ligne). */
  const changer = (message, nouveauStatut) => {
    if (nouveauStatut === statutApi(message.status)) return
    changerStatut.mutate(
      { contactId: message.id, status: nouveauStatut },
      {
        onSuccess: () => notify(`Statut mis à jour : ${STATUTS_CONTACT.find((s) => s.valeur === nouveauStatut)?.libelle ?? nouveauStatut}`, "success"),
        onError: (err) => notify(messageErreurLogs(err) || "Changement de statut impossible", "error"),
      }
    )
  }

  /* Changement de page → retour en haut du tableau. */
  const changerPage = (nouvellePage) => {
    setPageContacts(nouvellePage)
    refTableau.current?.scrollIntoView({
      behavior: mouvementReduit ? "auto" : "smooth",
      block: "start",
    })
  }

  /* key = fondu léger du corps à chaque changement de tri / filtre.
     ⚠️ Le tri / filtres ne font PAS partie de la clé de TransitionEtat :
     l'ancienne clé `${etat}-${cleCorps}` rejouait le fondu global de la
     section à chaque tri en plus du fondu du corps (double animation). */
  const cleCorps = `${statutContact}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  const etat = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !contacts?.length
        ? filtresActifs ? "aucun-resultat" : "vide"
        : "donnees"

  return (
    <>
      {/* ─── Table des messages ─── */}
      <div ref={refTableau} className="scroll-mt-20">
        <SectionCardAdmin
          title="Liste des messages"
          description="Messages reçus via le formulaire de contact"
          icon={Inbox}
          contentClassName="p-0 sm:p-0"
          action={
            <div className="flex flex-wrap items-center gap-2">
              {/* Sentinelle « tous » : Radix refuse la valeur vide (bug de
                  l'ancien SelectItem value=""). */}
              <Select value={statutContact || "tous"} onValueChange={(v) => setStatutContact(v === "tous" ? "" : v)}>
                <SelectTrigger className={classeDeclencheur(!!statutContact, "w-44")} aria-label="Filtrer par statut">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les statuts</SelectItem>
                  {STATUTS_CONTACT.map((s) => (
                    <SelectItem key={s.valeur} value={s.valeur}>
                      <span className="flex items-center justify-between gap-3">
                        {s.libelle}
                        <span className="tabular-nums text-muted-foreground">({stats?.contacts_par_statut?.[s.valeur] ?? 0})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filtresActifs && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={reinitialiserContacts}>
                  <RotateCcw aria-hidden /> Réinitialiser
                </Button>
              )}
            </div>
          }
        >
          <Bloc>
            <TransitionEtat etat={etat}>
              {isError ? (
                <div className="p-4">
                  <SectionErreur onRetry={refetch} message="Impossible de charger les messages." />
                </div>
              ) : isLoading ? (
                <ContactsSkeleton nbLignes={paramsContacts.limit} />
              ) : !contacts?.length ? (
                <div className="p-4">
                  {filtresActifs ? (
                    <SectionAucunResultat onReset={reinitialiserContacts} message="Aucun message ne correspond au statut." />
                  ) : (
                    <SectionVide message="Aucun message de contact pour l'instant." />
                  )}
                </div>
              ) : !contactsAffiches.length ? (
                <div className="p-4">
                  <SectionAucunResultat onReset={reinitialiserContacts} message="Aucun message ne correspond au statut sur cette page." />
                </div>
              ) : (
                <>
                  {/* ── Mobile : cartes ─────────────────────────── */}
                  <ul
                    key={cleCorps}
                    className="flex animate-in flex-col gap-3 px-4 pb-2 duration-200 motion-reduce:animate-none md:hidden"
                  >
                    {contactsAffiches.map((message) => (
                      <li key={message.id}>
                        <CarteMessageMobile
                          message={message}
                          enCours={changerStatut.isPending && changerStatut.variables?.contactId === message.id}
                          onChanger={changer}
                          onDetail={setDetail}
                        />
                      </li>
                    ))}
                  </ul>

                  {/* ── Desktop : table ─────────────────────────── */}
                  <section aria-label="Messages de contact" className="hidden overflow-x-auto scrollbar-thin md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <EnteteTriable colonne={COLONNES.find((c) => c.cle === "recu")} tri={tri} onTri={basculerTri} />
                          <EnteteTriable colonne={COLONNES.find((c) => c.cle === "expediteur")} tri={tri} onTri={basculerTri} />
                          <EnteteTriable colonne={COLONNES.find((c) => c.cle === "sujet")} tri={tri} onTri={basculerTri} />
                          <EnteteTriable colonne={COLONNES.find((c) => c.cle === "statut")} tri={tri} onTri={basculerTri} />
                          <TableHead>Changer le statut</TableHead>
                          <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      {/* key = fondu léger à chaque changement de tri / filtre */}
                      <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                        {contactsAffiches.map((message) => {
                          const cleApi = statutApi(message.status)
                          const enCours = changerStatut.isPending && changerStatut.variables?.contactId === message.id
                          return (
                            <TableRow key={message.id} className="transition-colors hover:bg-muted/50">
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {dateHeure(message.created_at)}
                              </TableCell>
                              <TableCell>
                                <span className="block text-xs font-medium">{message.full_name}</span>
                                <span className="block truncate text-[10px] text-muted-foreground">{message.email}</span>
                              </TableCell>
                              <TableCell className="max-w-44 truncate text-xs" title={message.subject_label}>
                                {message.subject_label}
                              </TableCell>
                              <TableCell>
                                <Badge variant={VARIANTE_CONTACT[cleApi] ?? "outline"}>
                                  {STATUTS_CONTACT.find((s) => s.valeur === cleApi)?.libelle ?? cleApi}
                                </Badge>
                                {message.replied_at && (
                                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                    répondu le {dateHeure(message.replied_at)}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <SelectStatutContact message={message} enCours={enCours} onChanger={changer} />
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-end">
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => setDetail(message)}
                                    aria-label={`Détails du message de ${message.full_name}`}
                                  >
                                    <Eye className="size-3.5" aria-hidden />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </section>

                  {/* Compteur honnête quand le filtre client s'applique. */}
                  {filtresActifs && (
                    <div className="border-t border-border px-4 py-2.5 text-xs tabular-nums text-muted-foreground">
                      {contactsAffiches.length} message{contactsAffiches.length > 1 ? "s" : ""} affiché{contactsAffiches.length > 1 ? "s" : ""} sur {contacts.length} (page courante)
                    </div>
                  )}

                  {/* ─── Pagination heuristique (liste plate sans total) ─── */}
                  <div className="border-t border-border px-4 py-3">
                    <PaginationListe page={pageContacts} pagePleine={pagePleine} onPageChange={changerPage} />
                  </div>
                </>
              )}
            </TransitionEtat>
          </Bloc>
        </SectionCardAdmin>
      </div>

      {/* ─── Dialog détail ─── */}
      {detail && (
        <DialogMessageDetail message={detail} onClose={setDetail} />
      )}
    </>
  )
}

export default ListeMessages
```

## File: src/Pages/Admin/LogsPage/index.jsx
```javascript
import { AnimatePresence, motion } from "framer-motion"
import { FileClock, Mail, MessageSquare, Terminal } from "lucide-react"
import { useFiltresLogsAdmin, FiltresLogsAdminProvider } from "@/contexts/FiltresLogsAdmin.context"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import OngletEvents from "./onglets/OngletEvents"
import OngletContacts from "./onglets/OngletContacts"
import OngletEmailsTx from "./onglets/OngletEmailsTx"
import HeroAdmin from "@/components/admin/HeroAdmin"
import Bloc, { VARIANTS_PAGE, VARIANTS_PANNEAU } from "@/components/admin/Bloc"
import { cn } from "@/lib/utils"

/* ─────────────────────────────────────────────────────────────────────
   Page Logs & emails — /admin/logs (super_admin, doc v3 §17).
   Journal des erreurs & emails transactionnels, diagnostic technique
   transverse : 3 onglets synchronisés à l'URL (param `onglet`).
   Chaque onglet porte ses compteurs + charts, son TRI PAR EN-TÊTE
   initialisé et son retour en haut du tableau au changement de page.
   Refonte : repère visuel de défilement des onglets sur mobile
   (fondu droit), transitions uniformes entre les vues.
   ───────────────────────────────────────────────────────────────────── */
const ONGLETS = [
  { valeur: "events", libelle: "Événements techniques", Icone: Terminal },
  { valeur: "contacts", libelle: "Messages de contact", Icone: MessageSquare },
  { valeur: "emails", libelle: "Emails transactionnels", Icone: Mail },
]

const LogsAdmin = () => {
  const { onglet, setOnglet } = useFiltresLogsAdmin()
  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* ─── En-tête ─── */}
      <HeroAdmin
        title="Journal des erreurs & emails transactionnels"
        description="Diagnostic technique transverse — incidents de scraping, boîte de réception du site public et suivi des emails transactionnels (inscriptions, désinscriptions)."
        icon={FileClock}
        titleBdge="Contenu & sécurité"
      />

      {/* ─── Onglets (synchronisés URL) ─── */}
      <Tabs value={onglet} onValueChange={setOnglet} className="mt-1 w-full">
        <div className="relative">
          <TabsList
            className={cn(
              "flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border border-border bg-muted/20 p-1",
              "scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            )}
          >
            {ONGLETS.map(({ valeur, libelle, Icone }) => (
              <TabsTrigger
                key={valeur}
                value={valeur}
                className={cn(
                  "gap-1.5 whitespace-nowrap rounded-md px-4 py-2 text-xs font-semibold transition-colors",
                  onglet === valeur
                    ? "bg-brand-orange text-brand-navy shadow-soft" /* navy sur orange : 6.3:1 AA */
                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                )}
              >
                <Icone className="size-3.5" aria-hidden="true" />
                {libelle}
              </TabsTrigger>
            ))}
          </TabsList>
          {/* Repère de défilement mobile : fondu sur le bord droit,
              indique que la barre d'onglets peut défiler. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-lg bg-linear-to-l from-surface-container-lowest to-transparent lg:hidden"
          />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={onglet}
            role="tabpanel"
            aria-label={ONGLETS.find((o) => o.valeur === onglet)?.libelle}
            variants={VARIANTS_PANNEAU}
            initial="cache"
            animate="visible"
            exit="cache"
            className="mt-4"
          >
            {onglet === "events" ? (
              <Bloc>
                <OngletEvents />
              </Bloc>
            ) : onglet === "contacts" ? (
              <Bloc>
                <OngletContacts />
              </Bloc>
            ) : (
              <Bloc>
                <OngletEmailsTx />
              </Bloc>
            )}
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </motion.div>
  )
}

const PageLogs = () => (
  <FiltresLogsAdminProvider>
    <LogsAdmin />
  </FiltresLogsAdminProvider>
)

export default PageLogs
```
