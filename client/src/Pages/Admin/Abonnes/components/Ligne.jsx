

const Ligne = ({ label, children }) => (
  <div className="flex items-center justify-between gap-2 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="truncate font-medium">{children}</span>
  </div>
)

export default Ligne