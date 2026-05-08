'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error.message, info.componentStack)
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="bg-white rounded-2xl border border-red-100 p-6 text-center space-y-3">
          <p className="text-3xl">😕</p>
          <p className="text-sm font-semibold text-gray-700">Este bloco encontrou um erro</p>
          {this.state.error?.message && (
            <p className="text-xs text-gray-400 font-mono leading-relaxed">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.reset}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl px-4 py-2 text-sm transition-all active:scale-95"
          >
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
