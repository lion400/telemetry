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

  logout: () => {
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

  fetchEvents: async (params = {}) => {
    try {
      const { data } = await axios.get(`${API}/events`, { params })
      set({
        events: data.events,
        unreadEvents: data.events.filter(e => !e.resolved).length,
      })
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
