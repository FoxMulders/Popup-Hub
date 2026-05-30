export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { Lora, Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google'
import './globals.css'
import { DocumentTitleSync } from '@/components/auth/document-title-sync'
import { AuthSessionGuard } from '@/components/auth/auth-session-guard'
import { PopupLoaderProvider } from '@/components/brand/popup-loader-provider'
import { BuildVersionFooter } from '@/components/brand/build-version-footer'
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
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Popup Hub',
    statusBarStyle: 'black-translucent' as const,
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'Popup Hub',
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
  themeColor: '#7b9b52',
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
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans max-w-full overflow-x-hidden safe-bottom">
        <PopupLoaderProvider>
          <DocumentTitleSync initialRole={sessionRole} />
          <AuthSessionGuard />
          <ServiceWorkerRegister />
          <div className="flex min-h-full flex-1 flex-col">
            <TooltipProvider>
              {children}
            </TooltipProvider>
            <BuildVersionFooter />
          </div>
          <InstallPrompt />
          <Toaster richColors position="top-right" />
        </PopupLoaderProvider>
      </body>
    </html>
  )
}
