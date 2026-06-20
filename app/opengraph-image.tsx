import { ImageResponse } from 'next/og'

export const alt = 'Popup Hub — Discover Local Makers Markets'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: '64px 72px',
          background: 'linear-gradient(135deg, #1e3d1a 0%, #2d5a27 45%, #3d7a35 100%)',
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
          Popup Hub
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
          Discover local makers markets
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 28,
            lineHeight: 1.45,
            opacity: 0.88,
            maxWidth: 820,
          }}
        >
          Browse confirmed vendors, apply with one passport, and run market day from one hub — built
          in Canada.
        </div>
      </div>
    ),
    { ...size },
  )
}
