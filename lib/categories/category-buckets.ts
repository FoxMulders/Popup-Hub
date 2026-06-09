import type { Category } from '@/types/database'

export type CategoryBucketKey = 'makers' | 'art' | 'food' | 'apparel' | 'commercial'

export const CATEGORY_BUCKET_ORDER: CategoryBucketKey[] = [
  'makers',
  'art',
  'food',
  'apparel',
  'commercial',
]

export const CATEGORY_BUCKET_DISPLAY_LABELS: Record<CategoryBucketKey, string> = {
  makers: 'Makers & Crafts',
  art: 'Art & Prints',
  food: 'Food & Beverage',
  apparel: 'Apparel',
  commercial: 'Commercial / MLMs',
}

const FOOD_MATCHERS = [
  'food & beverage',
  'baking',
  'fresh produce',
  'honey',
  'preserves',
]

const APPAREL_MATCHERS = ['clothing', 'apparel']

const ART_MATCHERS = [
  'books & art',
  'photography',
  'printmaking',
  'stationery',
  'chimes',
  'wind art',
  'glass',
  'stained glass',
]

function normalize(name: string): string {
  return name.trim().toLowerCase()
}

function matchesAny(name: string, patterns: string[]): boolean {
  const n = normalize(name)
  return patterns.some((p) => n.includes(p))
}

export function classifyCategoryBucket(
  category: Pick<Category, 'name' | 'is_mlm'>,
  allowMlm: boolean
): CategoryBucketKey {
  if (allowMlm && category.is_mlm) return 'commercial'
  if (matchesAny(category.name, FOOD_MATCHERS)) return 'food'
  if (matchesAny(category.name, APPAREL_MATCHERS)) return 'apparel'
  if (matchesAny(category.name, ART_MATCHERS)) return 'art'
  return 'makers'
}
