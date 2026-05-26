'use client'

import { useEffect } from 'react'
import { SHORTCUT_TO_TOOL } from '@/lib/booth-planner/layout-tool-shortcuts'
import type { LayoutTool } from '@/lib/booth-planner/layout-tool-shortcuts'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true
  }
  return target.isContentEditable
}

export interface LayoutKeyboardShortcutHandlers {
  onUndo: () => void
  onRedo: () => void
  onClearLayout: () => void
  onToggleLockAll: () => void
  onToolChange: (tool: LayoutTool) => void
  /** Delete / Backspace — remove selection or activate eraser. */
  onErase?: () => void
  /**
   * R key — when a vendor cell is currently selected on the canvas, rotate
   * it 90° instead of switching to the eraser tool. Returning `true` from
   * the handler tells the shortcut layer the rotation was consumed and the
   * R-as-eraser fallback should be skipped.
   */
  onRotateSelected?: () => boolean
}

export function useLayoutKeyboardShortcuts(handlers: LayoutKeyboardShortcutHandlers) {
  const { onUndo, onRedo, onClearLayout, onToggleLockAll, onToolChange, onErase, onRotateSelected } =
    handlers

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return

      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()

      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) onRedo()
        else onUndo()
        return
      }

      if (mod && key === 'y') {
        e.preventDefault()
        onRedo()
        return
      }

      if (mod && e.altKey && key === 'c') {
        e.preventDefault()
        onClearLayout()
        return
      }

      if (mod && key === 'l') {
        e.preventDefault()
        onToggleLockAll()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (onErase) {
          onErase()
          return
        }
        onToolChange('eraser')
        return
      }

      if (mod || e.altKey) return

      // R rotates the focused canvas cell when one is selected. Only when no
      // selection exists do we fall through to R = eraser tool shortcut.
      if (e.key.toLowerCase() === 'r' && onRotateSelected) {
        if (onRotateSelected()) {
          e.preventDefault()
          return
        }
      }

      const tool = SHORTCUT_TO_TOOL[e.key.toUpperCase()]
      if (tool) {
        e.preventDefault()
        onToolChange(tool)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onUndo, onRedo, onClearLayout, onToggleLockAll, onToolChange, onErase, onRotateSelected])
}
