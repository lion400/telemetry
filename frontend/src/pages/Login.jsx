import React, { useState } from 'react'
import { useStore } from '../store'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { login } = useStore()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [captchaChecked, setCaptchaChecked] = useState(false)

  const S = {
    page: {
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-app, var(--bg-app, #060d1a))', position: 'relative', overflow: 'hidden',
    },
    bg: {
      position: 'absolute', inset: 0, pointerEvents: 'none',
      background: 'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(26,111,255,0.1) 0%, transparent 70%)',
    },
    card: {
      width: 420, background: 'var(--bg-card, var(--bg-card, #0c1829))', border: '1px solid #1a3050',
      borderRadius: 16, padding: '40px 36px', position: 'relative', zIndex: 1,
    },
    logo: {
      display: 'flex', alignItems: 'center', gap: 12,
      fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 6,
    },
    logoIcon: {
      width: 40, height: 40, background: 'var(--accent, var(--accent, #1a6fff))', borderRadius: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
    },
    subtitle: {
      fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2,
      color: 'var(--text-muted, var(--text-muted, #3d5a80))', textTransform: 'uppercase', marginBottom: 36,
    },
    label: {
      display: 'block', fontFamily: "'DM Mono',monospace", fontSize: 10,
      letterSpacing: 1, color: 'var(--text-secondary, var(--text-secondary, #6b8ab0))', textTransform: 'uppercase', marginBottom: 6,
    },
    input: {
      width: '100%', background: 'var(--bg-input, var(--bg-input, #111f35))', border: '1px solid #1a3050',
      borderRadius: 8, padding: '10px 14px', color: 'var(--text-primary, var(--text-primary, #e8f0fe))', fontSize: 14,
      outline: 'none', transition: 'border-color 0.2s', marginBottom: 18,
    },
    captcha: {
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--bg-input, var(--bg-input, #111f35))', border: '1px solid #1a3050',
      borderRadius: 8, padding: '10px 14px', marginBottom: 18, cursor: 'pointer',
    },
    btn: {
      width: '100%', background: 'var(--accent, var(--accent, #1a6fff))', border: 'none', borderRadius: 8,
      padding: '12px', color: '#fff', fontFamily: "'Syne',sans-serif",
      fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4,
      transition: 'opacity 0.2s',
    },
    demo: {
      marginTop: 24, padding: '12px 16px',
      background: 'var(--nav-active-bg, rgba(26,111,255,0.08))', border: '1px solid rgba(26,111,255,0.2)',
      borderRadius: 8, fontFamily: "'DM Mono',monospace", fontSize: 11,
      color: 'var(--text-secondary, var(--text-secondary, #6b8ab0))', lineHeight: 1.9,
    },
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!captchaChecked) {
      toast.error('Por favor completa la verificación CAPTCHA')
      return
    }
    setLoading(true)
    try {
      await login(form.username, form.password)
      toast.success('¡Bienvenido!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error de autenticación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.bg} />
      <div style={S.card}>
        <div style={S.logo}>
          <div style={S.logoIcon}>☀</div>
          Solar<span style={{ color: 'var(--accent, var(--accent, #5a9fff))' }}>Track</span>
        </div>
        <div style={S.subtitle}>Paradas Seguras — EMOV · Sistema de Telemetría</div>

        <form onSubmit={handleSubmit}>
          <label style={S.label}>Usuario o Email</label>
          <input
            style={S.input} type="text" placeholder="admin"
            value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            onFocus={e => e.target.style.borderColor = 'var(--accent, var(--accent, #1a6fff))'}
            onBlur={e => e.target.style.borderColor = 'var(--border, var(--border, #1a3050))'}
            autoFocus required
          />

          <label style={S.label}>Contraseña</label>
          <input
            style={S.input} type="password" placeholder="••••••••"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            onFocus={e => e.target.style.borderColor = 'var(--accent, var(--accent, #1a6fff))'}
            onBlur={e => e.target.style.borderColor = 'var(--border, var(--border, #1a3050))'}
            required
          />

          {/* CAPTCHA */}
          <div
            style={{ ...S.captcha, borderColor: captchaChecked ? 'rgba(0,230,118,0.4)' : 'var(--border, var(--border, #1a3050))' }}
            onClick={() => setCaptchaChecked(c => !c)}
          >
            <div style={{
              width: 20, height: 20, borderRadius: 4,
              border: `2px solid ${captchaChecked ? 'var(--online, var(--online, #00e676))' : 'var(--text-muted, var(--text-muted, #3d5a80))'}`,
              background: captchaChecked ? 'var(--online, var(--online, #00e676))' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all 0.2s',
            }}>
              {captchaChecked && <span style={{ color: 'var(--bg-app, var(--bg-app, #060d1a))', fontSize: 13, fontWeight: 900 }}>✓</span>}
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-primary, var(--text-primary, #e8f0fe))', userSelect: 'none' }}>No soy un robot</span>
            <span style={{ marginLeft: 'auto', fontSize: 22 }}>🛡</span>
          </div>

          <button style={{ ...S.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? 'Accediendo...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div style={S.demo}>
          <strong style={{ color: 'var(--accent, var(--accent, #5a9fff))' }}>Cuenta demo</strong><br />
          Usuario: <strong style={{ color: 'var(--text-primary, var(--text-primary, #e8f0fe))' }}>admin</strong>
          &nbsp;·&nbsp;
          Contraseña: <strong style={{ color: 'var(--text-primary, var(--text-primary, #e8f0fe))' }}>Admin2024!</strong>
        </div>
      </div>
    </div>
  )
}
