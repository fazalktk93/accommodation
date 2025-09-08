import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import { loadMe } from './authz'

loadMe()

function showFatal(msg) {
  try {
    const pane = document.getElementById('__err') || (function(){
      const el = document.createElement('pre')
      el.id = '__err'
      el.style.cssText = 'position:fixed;left:8px;bottom:8px;max-width:96vw;max-height:45vh;overflow:auto;background:#111;color:#f66;padding:10px 12px;border-radius:8px;z-index:2147483647;font:12px/1.4 monospace;white-space:pre-wrap'
      document.body.appendChild(el)
      return el
    })()
    pane.textContent += '[fatal] ' + msg + '\n'
  } catch(e) {
    alert('FATAL: ' + msg)
  }
}

try {
  console.log('[main] starting bootstrap')
  const rootEl = document.getElementById('root')
  if (!rootEl) {
    showFatal('No #root element found in index.html')
    throw new Error('No #root element')
  }
  console.log('[main] root element ok, creating React root')

  const root = ReactDOM.createRoot(rootEl)
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  )

  console.log('[main] render() called')
} catch (e) {
  console.error('[main] failed to mount:', e)
  showFatal((e && (e.message || e.stack)) || String(e))
  throw e
}
