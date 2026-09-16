import { ResponsiveContainer } from "recharts";
import { SectionVide } from "./EtatsSection";

/* Cadre interne : titre + skeleton / vide / chart (chaque chart garde
   son propre cycle d'états). */
const CadreChart = ({ vide, videMessage, minHeight = 220, children }) => (
  <>
    {vide ? (
      <SectionVide message={videMessage} />
    ) : (
      <div style={{ height: minHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    )}
  </>
)

export default CadreChart