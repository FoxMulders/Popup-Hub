/**
 * Wizard description-length contract.
 *
 * This module previously housed the multi-persona "QA desk" copy
 * audit. The QA desk has been retired; the only piece other surfaces
 * still depend on is the minimum-description threshold used by the
 * Step 1 inline validator and the autosave guard. Keep this file
 * minimal so the threshold has an obvious home.
 */
export const DESCRIPTION_MIN_LENGTH = 15
export const DESCRIPTION_MAX_LENGTH = 2000
