export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { Lora, Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google'
import './globals.css'
import { DocumentTitleSync } from '@/components/auth/document-title-sync'
import { InstallPrompt } from '@/components/navigation/install-prompt'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getSessionRoleForTitle } from '@/lib/auth/session-role-for-title'
import { roleDocumentTitle } from '@/lib/auth/document-title'

const display = Lora({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
})

const body = Plus_Jakarta_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const baseMetadata = {
  description:
    'Discover local markets, manage vendor booths, and run digital quarter auctions with Popup Hub.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Popup Hub',
    statusBarStyle: 'default' as const,
  },
} satisfies Omit<Metadata, 'title'>

export async function generateMetadata(): Promise<Metadata> {
  const role = await getSessionRoleForTitle()

  return {
    ...baseMetadata,
    title: roleDocumentTitle(role),
  }
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
  themeColor: '#2d5016',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const sessionRole = await getSessionRoleForTitle()

  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <DocumentTitleSync initialRole={sessionRole} />
        <ServiceWorkerRegister />
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <InstallPrompt />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
