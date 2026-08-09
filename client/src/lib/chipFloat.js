const chipFloat = (delay, duration = 4.5) => ({
  initial: { opacity: 0, scale: 0.8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: [0, -7, 0],
    transition: {
      opacity: { duration: 0.4, delay },
      scale: { duration: 0.4, delay },
      y: {
        duration,
        repeat: Infinity,
        ease: "easeInOut",
        delay: delay + 0.4,
      },
    },
  },
})

export default chipFloat