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
}

export function useLayoutKeyboardShortcuts(handlers: LayoutKeyboardShortcutHandlers) {
  const { onUndo, onRedo, onClearLayout, onToggleLockAll, onToolChange } = handlers

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
        onToolChange('eraser')
        return
      }

      if (mod || e.altKey) return

      const tool = SHORTCUT_TO_TOOL[e.key.toUpperCase()]
      if (tool) {
        e.preventDefault()
        onToolChange(tool)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onUndo, onRedo, onClearLayout, onToggleLockAll, onToolChange])
}
