/** Mobile-friendly haptics for auction wins and purchases. */
export function playWinHaptics(): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  navigator.vibrate([180, 80, 180, 80, 280, 120, 400])
}

export function playChipTapHaptic(): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  navigator.vibrate(12)
}

/** Short celebration audio with speech fallback when woo-hoo.mp3 is missing. */
export function playWinAudio(): () => void {
  const audio = new Audio('/sounds/woo-hoo.mp3')
  let stopped = false

  const stop = () => {
    if (stopped) return
    stopped = true
    audio.pause()
  }

  audio.play().catch(() => {
    try {
      const ctx = new AudioContext()
      const notes = [523.25, 659.25, 783.99, 1046.5]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.value = freq
        gain.gain.value = 0.12
        osc.connect(gain)
        gain.connect(ctx.destination)
        const t = ctx.currentTime + i * 0.12
        osc.start(t)
        osc.stop(t + 0.22)
      })
    } catch {
      /* silent */
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance('Woo Hoo! I won!')
      utter.rate = 1.05
      utter.pitch = 1.15
      window.speechSynthesis.speak(utter)
    }
  })

  return stop
}

/** Fireworks-style confetti burst using canvas-confetti when available. */
export async function fireWinConfetti(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const confetti = (await import('canvas-confetti')).default
    const duration = 2800
    const end = Date.now() + duration

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 62,
        origin: { x: 0, y: 0.65 },
        colors: ['#2d6a4f', '#52b788', '#f4a261', '#e9c46a'],
      })
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 62,
        origin: { x: 1, y: 0.65 },
        colors: ['#40916c', '#e76f51', '#ffffff', '#264653'],
      })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
    confetti({ particleCount: 120, spread: 100, origin: { y: 0.55 } })
  } catch {
    /* CSS confetti fallback handled in component */
  }
}
