// src/pages/comment-ca-marche/components/SerpentineTrace.jsx
import { useRef } from "react"
import { motion } from "framer-motion"
import { TRACE_PATH, TRACE_VIEWBOX } from "@/tools/ccm.tools"

const SerpentineTrace = ({ progress }) => {
  const pathRef = useRef(null)

  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${TRACE_VIEWBOX.width} ${TRACE_VIEWBOX.height}`}
        preserveAspectRatio="none"
      >
        <path
          ref={pathRef}
          d={TRACE_PATH}
          fill="none"
          stroke="var(--color-brand-navy)"
          strokeOpacity="0.06"
          strokeWidth="80"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <motion.path
          d={TRACE_PATH}
          fill="none"
          stroke="var(--color-brand-orange)"
          strokeOpacity="0.05"
          strokeWidth="104"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ pathLength: progress }}
        />
        <motion.path
          d={TRACE_PATH}
          fill="none"
          stroke="var(--color-brand-orange)"
          strokeOpacity="0.10"
          strokeWidth="89"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ pathLength: progress }}
        />
        <motion.path
          d={TRACE_PATH}
          fill="none"
          stroke="var(--color-brand-orange)"
          strokeOpacity="0.5"
          strokeWidth="78"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ pathLength: progress }}
        />
      </svg>
    </div>
  )
}

export default SerpentineTrace