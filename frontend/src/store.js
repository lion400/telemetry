import { create } from 'zustand'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || '/api'

// Attach JWT to every request automatically
axios.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

export const useStore = create((set, get) => ({
  // ── Auth ──────────────────────────────────────────
  user: null,
  token: localStorage.getItem('token'),

  login: async (username, password) => {
    const { data } = await axios.post(`${API}/auth/login`, { username, password })
    localStorage.setItem('token', data.token)
    set({ token: data.token, user: data.user })
    return data
  },

  logout: async () => {
    try {
      const token = localStorage.getItem('token')
      if (token) {
        await axios.post(`${API}/auth/logout`, {}, { headers: { Authorization: `Bearer ${token}` } })
      }
    } catch (e) {}
    localStorage.removeItem('token')
    set({ token: null, user: null, devices: [], selectedDevice: null, telemetry: {}, events: [] })
  },

  fetchMe: async () => {
    try {
      const { data } = await axios.get(`${API}/auth/me`)
      set({ user: data })
    } catch {
      get().logout()
    }
  },

  // ── Devices ───────────────────────────────────────
  devices: [],
  selectedDevice: null,
  selectedDeviceId: null,

  fetchDevices: async () => {
    try {
      const { data } = await axios.get(`${API}/devices`)
      set({ devices: data })
    } catch (e) {
      console.error('fetchDevices:', e)
    }
  },

  setSelectedDevice: (deviceId) => {
    const device = get().devices.find(d => d.device_id === deviceId)
    set({ selectedDevice: device, selectedDeviceId: deviceId })
  },

  // ── Telemetry (live, keyed by device_id) ─────────
  telemetry: {},

  updateTelemetry: (data) => {
    set(state => ({
      telemetry: { ...state.telemetry, [data.device_id]: data },
      // Also refresh device list row with latest values
      devices: state.devices.map(d =>
        d.device_id === data.device_id
          ? {
              ...d,
              soc: data.soc,
              voltage: data.voltage,
              temperature: data.temperature,
              rssi: data.rssi,
              current_lat: data.lat,
              current_lng: data.lng,
              status: 'online',
              last_telemetry: data.ts,
              door1: data.door1,
              door2: data.door2,
              door3: data.door3,
              door4: data.door4,
            }
          : d
      ),
    }))
  },

  // ── Events ────────────────────────────────────────
  events: [],
  unreadEvents: 0,

  // Devuelve la clave localStorage para el timestamp de "visto" por usuario
  _seenKey: () => {
    const uid = get().user?.id ?? 'anon'
    return `alerts_seen_${uid}`
  },

  // Marca las alertas como vistas ahora mismo (para este usuario)
  markAlertsSeen: () => {
    const key = get()._seenKey()
    const now = new Date().toISOString()
    localStorage.setItem(key, now)
    set({ unreadEvents: 0 })
  },

  fetchEvents: async (params = {}) => {
    try {
      const { data } = await axios.get(`${API}/events`, { params })
      // Calcular no-leídos: eventos pendientes/atendiendo creados DESPUÉS
      // del último "visto" de este usuario
      const key = get()._seenKey()
      const seenAt = localStorage.getItem(key)
      const unread = data.events.filter(e => {
        if (e.status === 'resolved') return false
        if (!seenAt) return true
        const evTs = e.ts ? new Date(e.ts.endsWith('Z') ? e.ts : e.ts + 'Z') : new Date(0)
        return evTs > new Date(seenAt)
      }).length
      set({ events: data.events, unreadEvents: unread })
      return data
    } catch (e) {
      console.error('fetchEvents:', e)
      return { events: [], total: 0 }
    }
  },

  // ── Geocercas ─────────────────────────────────────
  geocercas: [],
  fetchGeocercas: async () => {
    try {
      const { data } = await axios.get(`${API}/geocercas`)
      set({ geocercas: data })
    } catch (e) {
      console.error('fetchGeocercas:', e)
    }
  },

  // ── UI state ──────────────────────────────────────
  activeView: 'dashboard',
  setActiveView: (v) => set({ activeView: v }),
}))
