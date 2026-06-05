import type { ExperienceTheme } from '@/lib/experience-designer/types'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'

export interface ExperienceThemeCatalogEntry {
  theme: ExperienceTheme
  label: string
  description: string
  /** Public OG image path (under /public). */
  ogImagePath: string
}

/** Published escape-room theme templates for SEO and sitemap discovery. */
export const EXPERIENCE_THEME_CATALOG: ExperienceThemeCatalogEntry[] = [
  {
    theme: 'haunted_manor',
    label: 'Haunted Manor',
    description:
      'Design a Victorian haunted escape experience — séance rooms, hidden passages, and atmospheric puzzle zones for pop-up trailers and retail suites.',
    ogImagePath: '/icons/icon-512x512.png',
  },
  {
    theme: 'cyber_heist',
    label: 'Cyber Heist',
    description:
      'Blueprint a high-tech vault heist escape room — laser grids, server racks, and collaborative hacking puzzles sized for commercial venues.',
    ogImagePath: '/icons/icon-512x512.png',
  },
  {
    theme: 'pirate_vault',
    label: 'Pirate Vault',
    description:
      'Plan a swashbuckling treasure vault adventure — map tables, rigging puzzles, and climax chambers for warehouse and pavilion deployments.',
    ogImagePath: '/icons/icon-512x512.png',
  },
  {
    theme: 'space_station',
    label: 'Space Station',
    description:
      'Architect a sci-fi station escape — airlock corridors, reactor puzzles, and crew quarters optimized for 4–12 players.',
    ogImagePath: '/icons/icon-512x512.png',
  },
]

const catalogByTheme = new Map(EXPERIENCE_THEME_CATALOG.map((entry) => [entry.theme, entry]))

export function isExperienceTheme(value: string | undefined | null): value is ExperienceTheme {
  return Boolean(value && catalogByTheme.has(value as ExperienceTheme))
}

export function experienceDesignerPath(theme?: ExperienceTheme): string {
  if (!theme) return '/coordinator/experience-designer'
  return `/coordinator/experience-designer?theme=${theme}`
}

export function buildExperienceThemeMetadata(theme: ExperienceTheme) {
  const entry = catalogByTheme.get(theme)!
  return buildPublicMetadata({
    title: `${entry.label} Escape Room Blueprint — Experience Designer`,
    description: entry.description,
    path: experienceDesignerPath(theme),
    imageUrl: entry.ogImagePath,
  })
}

export function buildExperienceDesignerMetadata(themeParam?: string | null) {
  if (isExperienceTheme(themeParam)) {
    return buildExperienceThemeMetadata(themeParam)
  }

  return buildPublicMetadata({
    title: 'Experience Designer — Popup Hub',
    description:
      'AI-assisted spatial blueprint workspace for pop-up escape rooms — theme constraints, zone graphs, puzzle BOMs, and council telemetry.',
    path: '/coordinator/experience-designer',
  })
}
