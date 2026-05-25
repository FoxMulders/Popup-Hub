'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FeedErrorBoundaryProps {
  children: ReactNode
  title?: string
}

interface FeedErrorBoundaryState {
  hasError: boolean
  message: string | null
}

export class FeedErrorBoundary extends Component<
  FeedErrorBoundaryProps,
  FeedErrorBoundaryState
> {
  state: FeedErrorBoundaryState = { hasError: false, message: null }

  static getDerivedStateFromError(error: Error): FeedErrorBoundaryState {
    return { hasError: true, message: error.message || 'Something went wrong' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[MeetTheMakerFeed]', error, info.componentStack)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center"
        >
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" aria-hidden />
          <p className="font-medium text-foreground">
            {this.props.title ?? 'Meet the Maker feed unavailable'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {this.state.message ?? 'An unexpected error occurred while loading the feed.'}
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={this.handleRetry}>
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
