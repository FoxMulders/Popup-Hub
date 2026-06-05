/**
 * QA destructive merge entry — delegates to Merge_qa (2D stage bounds).
 *
 * Promotion: replace production destructive-merge.ts merge path with Merge_qa logic.
 */

export {
  clearDestructiveMergeInDoc,
  framesBoundToMerge,
} from '@/components/coordinator/floor-plan-v2/state/destructive-merge'

export {
  destructiveMergeInDocQa as destructiveMergeInDoc,
  type DestructiveMergeSelectionQa as DestructiveMergeSelection,
} from './Merge_qa'
