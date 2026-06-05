import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import { buildExperienceDesignerMetadata } from '@/lib/seo/experience-theme-metadata'

const ExperienceDesignerWorkspace = dynamic(
  () =>
    import('@/components/experience-designer/experience-designer-workspace').then((mod) => ({
      default: mod.ExperienceDesignerWorkspace,
    })),
  {
    loading: () => (
      <div className="flex h-[100dvh] flex-col bg-[#0b0f14] p-4">
        <Skeleton className="h-14 w-full rounded-lg bg-white/10" />
        <Skeleton className="mt-4 min-h-0 flex-1 rounded-xl bg-white/10" />
      </div>
    ),
  }
)

interface Props {
  searchParams: Promise<{ theme?: string }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { theme } = await searchParams
  return buildExperienceDesignerMetadata(theme)
}

export default function ExperienceDesignerPage() {
  return <ExperienceDesignerWorkspace />
}
