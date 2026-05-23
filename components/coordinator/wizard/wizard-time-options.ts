export const WIZARD_TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const opts = []
  for (let h = 6; h <= 23; h++) {
    for (const m of [0, 30]) {
      if (h === 23 && m === 30) break
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      const period = h < 12 ? 'AM' : 'PM'
      const displayH = h % 12 === 0 ? 12 : h % 12
      opts.push({ value: `${hh}:${mm}`, label: `${displayH}:${mm} ${period}` })
    }
  }
  return opts
})()

export function formatTimeLabel(value: string): string {
  const match = WIZARD_TIME_OPTIONS.find((o) => o.value === value)
  return match?.label ?? value
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
