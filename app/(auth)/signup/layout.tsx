import { buildPublicMetadata } from '@/lib/seo/public-metadata'

export const metadata = buildPublicMetadata({
  title: 'Create Account',
  description: 'Create a free Popup Hub account to discover markets, apply as a vendor, or host events.',
  path: '/signup',
  noIndex: true,
})

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children
}
