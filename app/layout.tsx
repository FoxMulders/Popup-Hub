export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { Lora, Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

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

export const metadata: Metadata = {
  title: 'Popup Hub — Local Market Marketplace',
  description:
    'Discover local markets, manage vendor booths, and run digital quarter auctions with Popup Hub.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Popup Hub',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
  themeColor: '#2d5016',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
