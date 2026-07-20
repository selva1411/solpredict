'use client'
import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  label?: string
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(e: Error) {
    return { hasError: true, message: e.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-32 border border-[#353534] font-mono text-xs text-[#9e8e78]">
          <div className="text-center space-y-1">
            <div className="text-[#ffb4ab]">
              ⚠ {this.props.label ?? 'Component'} failed to render
            </div>
            <div className="text-[#353534] text-[10px]">
              {this.state.message}
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
