// src/hooks/use-glissement.js
import { useState } from "react"

const SEUIL_SWIPE_PX = 56
const SEUIL_SWIPE_VITESSE = 420

/** Swipe horizontal des carrousels (direction + drag framer-motion). */
export const useGlissement = ({ count, idx, setIdx, pause, reprendre }) => {
  const [direction, setDirection] = useState(1)

  const suivant = () => {
    setDirection(1)
    setIdx((i) => (i + 1) % count)
  }
  const precedent = () => {
    setDirection(-1)
    setIdx((i) => (i - 1 + count) % count)
  }
  const onSelect = (i) => {
    if (i !== idx) {
      setDirection(i > idx ? 1 : -1)
      setIdx(i)
    }
  }

  const propsGlissement = {
    drag: "x",
    dragConstraints: { left: 0, right: 0 },
    dragElastic: 0.15,
    dragMomentum: false,
    dragTransition: { bounceStiffness: 600, bounceDamping: 28 },
    onDragStart: pause,
    onDragEnd: (e, info) => {
      reprendre()
      const { offset, velocity } = info
      if (offset.x < -SEUIL_SWIPE_PX || velocity.x < -SEUIL_SWIPE_VITESSE) suivant()
      else if (offset.x > SEUIL_SWIPE_PX || velocity.x > SEUIL_SWIPE_VITESSE) precedent()
    },
  }

  return { direction, onSelect, propsGlissement }
}