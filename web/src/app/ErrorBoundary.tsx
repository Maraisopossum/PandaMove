import { Component, type ErrorInfo, type ReactNode } from 'react'
import { EcranErreur } from './EcranErreur'

// Frontière d'erreur racine : remplace la page blanche par un message en français.
export class ErrorBoundary extends Component<{ children: ReactNode }, { erreur: unknown; aErreur: boolean }> {
  state = { erreur: null as unknown, aErreur: false }

  static getDerivedStateFromError(erreur: unknown) {
    return { erreur, aErreur: true }
  }

  componentDidCatch(erreur: unknown, info: ErrorInfo) {
    console.error('Erreur non gérée', erreur, info.componentStack)
  }

  render() {
    if (!this.state.aErreur) return this.props.children
    return <EcranErreur erreur={this.state.erreur} />
  }
}
