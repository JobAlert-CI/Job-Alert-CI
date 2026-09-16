import { cn } from "cn"


const CompteurCaracteres = ({ valeur, max, id }) => {
  const restant = max - valeur
  const classe =
    restant <= 0
      ? "font-semibold text-destructive"
      : restant <= 100
        ? "font-medium text-[#B45309]"
        : "text-muted-foreground"

  return (
    <p
      id={id}
      aria-live="polite"
      className={cn("text-right text-[10px] tabular-nums transition-colors duration-200", classe)}
    >
      {valeur}/{max}
    </p>
  )
}

export default CompteurCaracteres