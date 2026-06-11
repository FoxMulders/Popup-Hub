import type { Variants } from 'framer-motion'

/** Stagger container for SHAPES & BOOTHS — patron left, designer tools center, vendor right. */
export const toolbarElementPanelsContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.05,
    },
  },
}

/**
 * Single toolbar cluster entry — strict vertical center axis (x stays 0).
 * Patron, designer tools, and vendor panels share this path so they land centered.
 */
export const toolbarElementPanel: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
    x: 0,
  },
  visible: {
    opacity: 1,
    y: 0,
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 420,
      damping: 34,
    },
  },
}
