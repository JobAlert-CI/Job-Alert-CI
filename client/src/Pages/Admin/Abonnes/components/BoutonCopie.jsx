import { Check, Copy } from "lucide-react"
import { useState } from "react"


const BoutonCopie = ({ texte, libelle }) => {
  const [copie, setCopie] = useState(false)
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte)
      setCopie(true)
      window.setTimeout(() => setCopie(false), 1600)
    } catch {
      /* Presse-papiers indisponible : on ignore. */
    }
  }
  return (
    <button
      type="button"
      onClick={copier}
      aria-label={libelle ?? `Copier ${texte}`}
      title={copie ? "Copié !" : "Copier"}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copie ? <Check className="size-3 text-emerald-600" aria-hidden /> : <Copy className="size-3" aria-hidden />}
    </button>
  )
}


export default BoutonCopie