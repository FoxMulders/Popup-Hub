'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The "Tipsy Fox" Konami secret.
 *
 * Listens globally for the canonical Konami sequence
 *   ↑ ↑ ↓ ↓ ← → ← → B A
 * on keyboards, plus an equivalent
 *   swipe-up swipe-up swipe-down swipe-down
 *   swipe-left swipe-right swipe-left swipe-right
 *   tap tap
 * sequence on touch devices. When the full sequence is entered (in
 * order, no gaps) a tiny festival-hatted fox slides up from the
 * bottom-left corner, winks, then scampers off-screen and unmounts.
 *
 * The cursor resets eagerly on any input that breaks the expected
 * next token — including non-sequence printable keys mid-flight —
 * so accidental progress can never accumulate. While the fox is
 * already on screen, additional Konami inputs are ignored (no
 * stacking).
 *
 * The component is mounted unconditionally at the root layout so
 * the listener is always live, but renders nothing until the
 * sequence completes.
 */

const KONAMI_SEQUENCE = [
  'up', 'up', 'down', 'down',
  'left', 'right', 'left', 'right',
  'b', 'a',
] as const

type Token = (typeof KONAMI_SEQUENCE)[number]

const SWIPE_THRESHOLD_PX = 40
const TAP_MAX_TRAVEL_PX = 18
const TAP_MAX_DURATION_MS = 280

function keyToToken(e: KeyboardEvent): Token | null {
  switch (e.key) {
    case 'ArrowUp':
      return 'up'
    case 'ArrowDown':
      return 'down'
    case 'ArrowLeft':
      return 'left'
    case 'ArrowRight':
      return 'right'
    default:
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return null
  const k = e.key.toLowerCase()
  if (k === 'a') return 'a'
  if (k === 'b') return 'b'
  return null
}

type Phase = 'idle' | 'enter' | 'wink-closed' | 'wink-open' | 'scamper'

export function KonamiSecretFox() {
  const [active, setActive] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const cursor = useRef(0)
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null)

  useEffect(() => {
    function advance(token: Token) {
      const expected = KONAMI_SEQUENCE[cursor.current]
      if (token === expected) {
        cursor.current += 1
        if (cursor.current === KONAMI_SEQUENCE.length) {
          cursor.current = 0
          setActive((current) => current || true)
        }
        return
      }
      // Broken sequence — restart, but allow the broken token to
      // itself begin a new sequence if it happens to match index 0.
      cursor.current = token === KONAMI_SEQUENCE[0] ? 1 : 0
    }

    function onKey(e: KeyboardEvent) {
      const token = keyToToken(e)
      if (token) {
        advance(token)
        return
      }
      // Any other printable key mid-sequence resets the cursor so
      // accidental typing can't leave us in a half-matched state.
      if (cursor.current > 0 && (e.key.length === 1 || e.key === 'Backspace')) {
        cursor.current = 0
      }
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) {
        touchStart.current = null
        return
      }
      const t = e.touches[0]
      touchStart.current = { x: t.clientX, y: t.clientY, t: performance.now() }
    }

    function onTouchEnd(e: TouchEvent) {
      const start = touchStart.current
      touchStart.current = null
      if (!start) return
      const t = e.changedTouches[0]
      if (!t) return
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      const dt = performance.now() - start.t
      const adx = Math.abs(dx)
      const ady = Math.abs(dy)

      let token: Token | null = null
      if (adx < TAP_MAX_TRAVEL_PX && ady < TAP_MAX_TRAVEL_PX && dt < TAP_MAX_DURATION_MS) {
        // Quick stationary tap maps to the next non-directional
        // token in the sequence (B then A). If we're not at one of
        // those slots the tap simply breaks the cursor.
        const expected = KONAMI_SEQUENCE[cursor.current]
        if (expected === 'b' || expected === 'a') token = expected
        else {
          cursor.current = 0
          return
        }
      } else if (adx > ady && adx > SWIPE_THRESHOLD_PX) {
        token = dx > 0 ? 'right' : 'left'
      } else if (ady > adx && ady > SWIPE_THRESHOLD_PX) {
        token = dy > 0 ? 'down' : 'up'
      }
      if (token) advance(token)
    }

    function onTouchCancel() {
      touchStart.current = null
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchCancel, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [])

  // Choreography: enter (slide up) → eyes blink shut → eyes reopen → scamper off.
  // Total duration ≈ 3.0 s, after which the component unmounts the fox
  // and resumes listening for another sequence.
  useEffect(() => {
    if (!active) return
    setPhase('enter')
    const t1 = window.setTimeout(() => setPhase('wink-closed'), 800)
    const t2 = window.setTimeout(() => setPhase('wink-open'), 1100)
    const t3 = window.setTimeout(() => setPhase('scamper'), 1500)
    const t4 = window.setTimeout(() => {
      setActive(false)
      setPhase('idle')
    }, 3000)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
      window.clearTimeout(t4)
    }
  }, [active])

  if (!active) return null

  return (
    <div
      className="konami-fox-stage pointer-events-none fixed bottom-2 left-4 z-[9999]"
      role="presentation"
      aria-hidden="true"
      data-phase={phase}
    >
      <FoxSvg phase={phase} />
    </div>
  )
}

function FoxSvg({ phase }: { phase: Phase }) {
  const eyeClosed = phase === 'wink-closed'
  return (
    <svg
      viewBox="0 0 80 100"
      width="72"
      height="90"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible' }}
    >
      {/* Tail tucked behind body */}
      <ellipse cx="65" cy="74" rx="14" ry="9" fill="#F08C3D" transform="rotate(20 65 74)" />
      <circle cx="73" cy="69" r="4.5" fill="#FFFFFF" />
      {/* Body */}
      <ellipse cx="40" cy="82" rx="28" ry="12" fill="#F08C3D" />
      {/* Face */}
      <circle cx="40" cy="58" r="22" fill="#F08C3D" />
      {/* Cheek tufts */}
      <ellipse cx="22" cy="62" rx="4" ry="6" fill="#F08C3D" />
      <ellipse cx="58" cy="62" rx="4" ry="6" fill="#F08C3D" />
      {/* Ears */}
      <polygon points="22,42 18,18 33,32" fill="#F08C3D" />
      <polygon points="58,42 62,18 47,32" fill="#F08C3D" />
      <polygon points="22,40 21,30 28,36" fill="#1F1F1E" />
      <polygon points="58,40 59,30 52,36" fill="#1F1F1E" />
      {/* Snout */}
      <ellipse cx="40" cy="65" rx="11" ry="8" fill="#FFFFFF" />
      <ellipse cx="40" cy="58" rx="3" ry="2.5" fill="#1F1F1E" />
      <line x1="40" y1="60" x2="40" y2="70" stroke="#1F1F1E" strokeWidth="1.4" />
      <path d="M40,70 Q36,73 33,71" stroke="#1F1F1E" strokeWidth="1.2" fill="none" />
      <path d="M40,70 Q44,73 47,71" stroke="#1F1F1E" strokeWidth="1.2" fill="none" />
      {/* Left eye */}
      <circle cx="33" cy="52" r="2.6" fill="#1F1F1E" />
      <circle cx="33.7" cy="51.3" r="0.7" fill="#FFFFFF" />
      {/* Right eye — winks during the wink-closed phase */}
      {eyeClosed ? (
        <path
          d="M44,52 Q47,54 50,52"
          stroke="#1F1F1E"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      ) : (
        <>
          <circle cx="47" cy="52" r="2.6" fill="#1F1F1E" />
          <circle cx="47.7" cy="51.3" r="0.7" fill="#FFFFFF" />
        </>
      )}
      {/* Festival party hat */}
      <polygon points="40,3 30,30 50,30" fill="#5B8C5A" />
      <polygon points="40,3 30,30 38,18" fill="#3A5F39" />
      {/* Pom-pom */}
      <circle cx="40" cy="3" r="3" fill="#FFC107" />
      {/* Polka dots */}
      <circle cx="34.5" cy="22" r="1.6" fill="#E53935" />
      <circle cx="45.5" cy="20" r="1.6" fill="#FBC02D" />
      <circle cx="38" cy="27" r="1.4" fill="#1976D2" />
      <circle cx="44" cy="27" r="1.4" fill="#FFFFFF" />
    </svg>
  )
}
