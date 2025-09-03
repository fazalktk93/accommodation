// frontend/src/pages/Login.jsx
import { useState } from 'react'
import { login, isLoggedIn } from '../auth'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  if (isLoggedIn()) {
    // Already logged in → send home
    window.location.href = '/'
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      await login(username.trim(), password)
      window.location.href = '/'
    } catch (ex) {
      setError(ex.message || 'Login failed')
    }
  }

  const inputStyle = { width:'100%',padding:'10px 12px',border:'1px solid #d9dbe1',borderRadius:8,fontSize:14 }
  const btnStyle = { width:'100%',marginTop:16,padding:'10px 12px',fontSize:15,border:0,borderRadius:8,cursor:'pointer',background:'black',color:'#fff' }

  return (
    <div style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#f6f7f9'}}>
      <div style={{width:'100%',maxWidth:380,background:'#fff',padding:24,borderRadius:12,boxShadow:'0 10px 30px rgba(0,0,0,.08)'}}>
        <h1 style={{marginTop:0,fontSize:18}}>Sign in</h1>
        <form onSubmit={onSubmit}>
          <label style={{display:'block',fontSize:13,margin:'12px 0 6px'}}>Username</label>
          <input value={username} onChange={e=>setUsername(e.target.value)} required autoComplete="username" style={inputStyle} />
          <label style={{display:'block',fontSize:13,margin:'12px 0 6px'}}>Password</label>
          <input value={password} onChange={e=>setPassword(e.target.value)} required type="password" autoComplete="current-password" style={inputStyle} />
          <button type="submit" style={btnStyle}>Login</button>
          <div style={{color:'#b00020',fontSize:13,minHeight:16,marginTop:10}}>{error}</div>
        </form>
      </div>
    </div>
  )
}
