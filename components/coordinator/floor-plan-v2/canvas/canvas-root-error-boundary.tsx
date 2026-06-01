'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

export interface CanvasRootErrorBoundaryProps {
  children: ReactNode
  onReset: () => void
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  hasError: boolean
  message: string
}

/**
 * Catches canvas mount/render failures and offers a geometry reset.
 */
export class CanvasRootErrorBoundary extends Component<
  CanvasRootErrorBoundaryProps,
  State
> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info)
  }

  private handleReset = (): void => {
    this.props.onReset()
    this.setState({ hasError: false, message: '' })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-6 text-center">
          <p className="font-semibold text-amber-950">Canvas failed to load</p>
          <p className="max-w-md text-sm text-amber-900/80">
            {this.state.message ||
              'The layout surface hit an unexpected error. Reset geometry to recover.'}
          </p>
          <button
            type="button"
            className="rounded-md bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900"
            onClick={this.handleReset}
          >
            Reset canvas (Main Hall 50×50′)
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
