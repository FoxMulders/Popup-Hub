'use client'

import { useEffect, useRef, useState } from 'react'
import type { PlacedObject } from '../state/types'

interface InlineLabelEditorProps {
  /** The placed object whose label is being edited. */
  obj: PlacedObject
  /** Current pixels-per-foot — handles zoom. */
  pxPerFt: number
  /** Commit a new label value. Called on Enter or blur. */
  onCommit: (next: string) => void
  /** Discard the edit (Escape). */
  onCancel: () => void
}

/**
 * Initial value the editor seeds the input with for each object kind.
 *
 * Labels and booths edit the user-facing label/text in place; walls /
 * aisles / stages share the same `label` field. Doors edit their
 * generic label too — the door subtype stays under the property
 * inspector's control.
 */
function initialValue(obj: PlacedObject): string {
  if (obj.kind === 'label') return obj.text ?? ''
  return obj.label ?? ''
}

/**
 * Inline label editor rendered over the canvas via SVG `<foreignObject>`.
 *
 * Why foreignObject and not an HTML overlay positioned in screen
 * coords:
 *   - It stays glued to the object during canvas zoom & pan because
 *     it inherits the SVG viewport math automatically.
 *   - It rotates with the object's parent `<g transform="rotate…">`
 *     in `canvas-objects.tsx`, but we render it *outside* that group
 *     intentionally so the input always reads upright even when the
 *     object is tilted (typing into an upside-down input is a non-
 *     starter).
 *
 * The component auto-focuses and highlights all text on mount per the
 * ux brief. Enter / blur commit; Escape cancels.
 */
export function InlineLabelEditor({
  obj,
  pxPerFt,
  onCommit,
  onCancel,
}: InlineLabelEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Capture the seed value once so re-renders during the gesture
  // don't snap the input back to a stale label. We read it during
  // initial state setup rather than via a ref to keep ESLint's
  // `react-hooks/refs` rule happy.
  const [seedValue] = useState(() => initialValue(obj))

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    // requestAnimationFrame defers focus to after layout — without it
    // Safari occasionally focuses before the foreignObject is fully
    // attached and the caret never lands in the input.
    const raf = requestAnimationFrame(() => {
      input.focus()
      input.select()
    })
    return () => cancelAnimationFrame(raf)
  }, [obj.id])

  // Use the *unrotated* bounding box for input placement so the editor
  // is always upright; this makes typing usable regardless of how the
  // booth has been tilted via the rotate handle.
  const x = obj.x * pxPerFt
  const y = obj.y * pxPerFt
  const w = obj.width * pxPerFt
  const h = obj.height * pxPerFt
  // Clamp the editor's height so a tall stage's input doesn't end up
  // 200px tall — it's just a single-line text edit.
  const editorHeightPx = Math.min(40, Math.max(24, h * 0.65))
  const editorY = y + (h - editorHeightPx) / 2

  return (
    <foreignObject
      x={x}
      y={editorY}
      width={Math.max(60, w)}
      height={editorHeightPx}
      // Pointer events live on the input itself; the foreignObject
      // wrapper passes them through so other canvas chrome (selection
      // overlay) still receives clicks outside the box.
      style={{ overflow: 'visible' }}
      data-inline-editor="true"
    >
      <div
        // The XHTML xmlns is required by SVG spec for foreignObject
        // children to render in some browsers (notably Safari 16-).
        // React's HTMLDivElement props don't include `xmlns`, so we
        // pass it through a typed escape hatch rather than widening
        // the props globally.
        {...({ xmlns: 'http://www.w3.org/1999/xhtml' } as Record<
          string,
          string
        >)}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 4px',
          boxSizing: 'border-box',
        }}
      >
        <input
          ref={inputRef}
          defaultValue={seedValue}
          aria-label="Edit label"
          autoComplete="off"
          spellCheck={false}
          onPointerDown={(e) => {
            // Stop pointer events from bubbling into the canvas's drag
            // / marquee handlers on the underlying SVG.
            e.stopPropagation()
          }}
          onBlur={(e) => {
            onCommit(e.currentTarget.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onCommit(e.currentTarget.value)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            }
            // Stop other editor shortcuts (Ctrl+A, Ctrl+C, Ctrl+V, R,
            // Delete, etc.) from leaking into the canvas keyboard
            // pipeline — we let the input handle them natively.
            e.stopPropagation()
          }}
          style={{
            width: '100%',
            height: '100%',
            border: '2px solid #0f766e',
            borderRadius: 6,
            padding: '0 6px',
            fontSize: 12,
            fontWeight: 600,
            color: '#1c1917',
            background: '#ffffff',
            outline: 'none',
            boxShadow: '0 2px 6px rgba(15,23,42,0.12)',
          }}
        />
      </div>
    </foreignObject>
  )
}
