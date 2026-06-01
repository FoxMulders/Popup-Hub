/** Oldest-first log text for copy/paste troubleshooting. */
export function formatDebugLogText(logs: string[]): string {
  if (logs.length === 0) return ''
  return [...logs].reverse().join('\n')
}
