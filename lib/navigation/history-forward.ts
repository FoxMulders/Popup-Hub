/** Session history stack for canGoForward when Navigation API is unavailable. */
export interface HistoryStackState {
  stack: string[]
  index: number
}

export function createHistoryStack(initialPath: string): HistoryStackState {
  return { stack: [initialPath], index: 0 }
}

/** Push or replace current entry after client navigation (not popstate). */
export function pushHistoryPath(state: HistoryStackState, path: string): HistoryStackState {
  if (state.stack[state.index] === path) return state

  const stack = state.stack.slice(0, state.index + 1)
  stack.push(path)
  return { stack, index: stack.length - 1 }
}

/** Move index after popstate by matching the new location. */
export function applyPopstatePath(state: HistoryStackState, path: string): HistoryStackState {
  if (state.index > 0 && state.stack[state.index - 1] === path) {
    return { ...state, index: state.index - 1 }
  }
  if (state.index < state.stack.length - 1 && state.stack[state.index + 1] === path) {
    return { ...state, index: state.index + 1 }
  }
  return state
}

export function canGoForwardFromStack(state: HistoryStackState): boolean {
  return state.index < state.stack.length - 1
}

export function canGoBackFromStack(state: HistoryStackState): boolean {
  return state.index > 0
}

export type NavigationWithHistory = {
  canGoBack?: boolean
  canGoForward?: boolean
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

export function readNavigationApiCanGoBack(): boolean | null {
  if (typeof window === 'undefined') return null
  const nav = (window as Window & { navigation?: NavigationWithHistory }).navigation
  if (!nav || typeof nav.canGoBack !== 'boolean') return null
  return nav.canGoBack
}

export function readNavigationApiCanGoForward(): boolean | null {
  if (typeof window === 'undefined') return null
  const nav = (window as Window & { navigation?: NavigationWithHistory }).navigation
  if (!nav || typeof nav.canGoForward !== 'boolean') return null
  return nav.canGoForward
}

export function hasNavigationApi(): boolean {
  if (typeof window === 'undefined') return false
  const nav = (window as Window & { navigation?: NavigationWithHistory }).navigation
  return Boolean(
    nav &&
      typeof nav.canGoBack === 'boolean' &&
      typeof nav.canGoForward === 'boolean'
  )
}
