import { useState } from 'react'
import { supabase } from './supabase'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = isSignUp 
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
    setLoading(false)
  }

  const handleGuestLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: 'guest@demouser.com', 
      password: '123456' 
    })
    
    if (error) {
      console.error(error.message)
      alert("Guest mode unavailable.")
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} className="bg-[#0f172a] font-sans">
      {/* BULLETPROOF CONTAINER: Forces max-width to 400px so it never stretches */}
      <div style={{ width: '100%', maxWidth: '400px', backgroundColor: '#1e293b', padding: '40px', borderRadius: '16px', border: '1px solid #334155', textAlign: 'center' }}>
        
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '30px', color: '#fff' }}>FlashForge<span style={{ color: '#6366f1' }}>.</span></h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>AI-POWERED FLASHCARDS WITH SM-2</p>
        </div>

        <button 
          onClick={handleGuestLogin}
          disabled={loading}
          style={{ width: '100%', padding: '15px', backgroundColor: '#45436c', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', marginBottom: '20px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Authenticating...' : 'Explore as Guest (Skip Login)'}
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', opacity: 0.5 }}>
          <div style={{ flexGrow: 1, height: '1px', backgroundColor: '#334155' }}></div>
          <span style={{ padding: '0 10px', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Or Email Access</span>
          <div style={{ flexGrow: 1, height: '1px', backgroundColor: '#334155' }}></div>
        </div>

        <form style={{ display: 'flex', flexDirection: 'column', gap: '15px' }} onSubmit={handleAuth}>
          <input type="email" required style={{ width: '100%', padding: '15px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" required style={{ width: '100%', padding: '15px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '15px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Authenticating...' : (isSignUp ? 'Create Vault' : 'Sign In')}
          </button>
        </form>
        
        <button onClick={() => setIsSignUp(!isSignUp)} style={{ width: '100%', marginTop: '20px', padding: '10px', backgroundColor: 'transparent', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>
          {isSignUp ? 'Back to Login' : "New here? Sign Up"}
        </button>
      </div>
    </div>
  )
}