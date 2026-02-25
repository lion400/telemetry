import { io } from 'socket.io-client'
import { useStore } from './store'

let socket = null

export function connectSocket(token) {
  if (socket?.connected) return socket

  socket = io(import.meta.env.VITE_SOCKET_URL || '/', {
    auth: { token },
    transports: ['websocket'],
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  })

  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket.id)
  })

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason)
  })

  socket.on('connect_error', (err) => {
    console.warn('Socket error:', err.message)
  })

  // Broadcast telemetry from all devices
  socket.on('telemetry_broadcast', (data) => {
    useStore.getState().updateTelemetry(data)
  })

  // Telemetry for a subscribed device
  socket.on('telemetry', (data) => {
    useStore.getState().updateTelemetry(data)
  })

  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}

export function subscribeDevice(deviceId) {
  socket?.emit('subscribe_device', deviceId)
}

export function unsubscribeDevice(deviceId) {
  socket?.emit('unsubscribe_device', deviceId)
}

export { socket }
