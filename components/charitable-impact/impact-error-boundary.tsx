'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ImpactErrorBoundaryProps {
  children: ReactNode
}

interface ImpactErrorBoundaryState {
  hasError: boolean
}

export class ImpactErrorBoundary extends Component<
  ImpactErrorBoundaryProps,
  ImpactErrorBoundaryState
> {
  state: ImpactErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ImpactErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[CharitableImpactTracker]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Charitable impact tracker is temporarily unavailable.</span>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
