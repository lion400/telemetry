import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import LoginPage from './pages/Login'
import AppShell from './pages/AppShell'
import { useStore } from './store'
import { connectSocket } from './socket'
import { loadSavedTheme } from './themes'

export default function App() {
  const { token, fetchMe } = useStore()

  // Cargar tema guardado al inicio
  useEffect(() => { loadSavedTheme() }, [])

  useEffect(() => {
    if (token) {
      fetchMe()
      connectSocket(token)
    }
  }, [token])

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: var(--bg-app, #060d1a);
          color: var(--text-primary, #e8f0fe);
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border, #1a3050); border-radius: 4px; }
        body::before {
          content: '';
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background:
            radial-gradient(ellipse 60% 40% at 20% 10%, rgba(26,111,255,0.07) 0%, transparent 60%),
            radial-gradient(ellipse 50% 50% at 80% 80%, rgba(0,212,255,0.04) 0%, transparent 60%);
        }
        input, select, textarea, button { font-family: inherit; }
      `}</style>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!token ? <LoginPage /> : <Navigate to="/" />} />
          <Route path="/*" element={token ? <AppShell /> : <Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-input, var(--bg-input, #111f35))',
            color: 'var(--text-primary, var(--text-primary, #e8f0fe))',
            border: '1px solid #1a3050',
            fontFamily: "'DM Sans', sans-serif",
          }
        }}
      />
    </>
  )
}
