import type { ReactNode } from 'react'

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const

export const OG_IMAGE_GRADIENT =
  'linear-gradient(135deg, #1e3d1a 0%, #2d5a27 45%, #3d7a35 100%)'

type OgImageCardProps = {
  eyebrow?: string
  title: string
  subtitle?: string
  footer?: ReactNode
}

/** Shared JSX layout for `next/og` ImageResponse cards. */
export function OgImageCard({ eyebrow = 'Popup Hub', title, subtitle, footer }: OgImageCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: '64px 72px',
        background: OG_IMAGE_GRADIENT,
        color: '#faf8f5',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontSize: 28,
          fontWeight: 600,
          opacity: 0.9,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 64,
          fontWeight: 800,
          lineHeight: 1.08,
          letterSpacing: '-0.03em',
          maxWidth: 900,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            marginTop: 28,
            fontSize: 28,
            lineHeight: 1.45,
            opacity: 0.88,
            maxWidth: 820,
          }}
        >
          {subtitle}
        </div>
      ) : null}
      {footer ? <div style={{ marginTop: 24, fontSize: 22, opacity: 0.8 }}>{footer}</div> : null}
    </div>
  )
}
