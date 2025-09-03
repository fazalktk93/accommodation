import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

class TopErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state = { error: null } }
  static getDerivedStateFromError(e){ return { error: e } }
  componentDidCatch(e, info){ console.error('App crashed:', e, info) }
  render(){
    if (this.state.error) {
      return (
        <div style={{ padding: 16 }}>
          <h3 style={{ color: '#b00020', marginTop: 0 }}>Something went wrong</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {String(this.state.error && this.state.error.message || this.state.error)}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TopErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </TopErrorBoundary>
  </React.StrictMode>
)
