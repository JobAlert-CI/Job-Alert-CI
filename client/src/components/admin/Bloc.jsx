/* eslint-disable react-refresh/only-export-components */
import { motion } from "framer-motion"
import { ErrorBoundary } from "react-error-boundary"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import { cn } from "cn"


export const VARIANTS_PAGE = {
  cache: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

export const VARIANTS_PANNEAU = {
  cache: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.07, delayChildren: 0.05 },
  },
}

export const VARIANTS_BLOC = {
  cache: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
}

/** Une section = un bloc animé + son ErrorBoundary dédié. */
const Bloc = ({ className, children }) => (
  <motion.div variants={VARIANTS_BLOC} className={cn("min-w-0", className)}>
    <ErrorBoundary FallbackComponent={AdminSectionFallback}>{children}</ErrorBoundary>
  </motion.div>
)

export default Bloc