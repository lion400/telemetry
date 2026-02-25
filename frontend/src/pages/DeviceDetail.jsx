import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { AreaChart, Area, LineChart, Line, BarChart, Bar,
         XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useStore } from '../store'
import { subscribeDevice, unsubscribeDevice } from '../socket'

const API = '/api'

// LFP LFP1.28KWH12.8V-P65L2EV50 specs
const BAT = { chargeV: 14.4, dischargeV: 10.4, nominalV: 12.8, capacityAh: 100, energyWh: 1280 }
// Tracer-AN G3 / Panel M10-36-350W
const PANEL = { maxW: 350, mpptEff: 98, mpptTrackEff: 99.5 }
// GV310LAU
const GV310 = { bufferMax: 30000, accuracyM: 1.8, autonomyH: 36 }

const MPPT_STAGE_COLOR = { 'Bulk': '#ffd740', 'Absorción': '#1a6fff', 'Float': '#00e676', 'Equalización': '#ff9800' }

const DOOR_LABELS = ['Principal', 'Gabinete Solar', 'Compartimento A', 'Compartimento B']

function MetricChip({ label, value, unit, color = '#e8f0fe', mono = true, small = false }) {
  return (
    <div style={{ background: '#111f35', borderRadius: 8, padding: small ? '8px 12px' : '10px 14px', border: '1px solid #1a3050' }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#3d5a80', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: mono ? "'DM Mono',monospace" : "'Syne',sans-serif", fontSize: small ? 14 : 18, fontWeight: 700, color }}>
        {value ?? '—'}<span style={{ fontSize: 11, color: '#6b8ab0', marginLeft: 3 }}>{unit}</span>
      </div>
    </div>
  )
}

function SectionTitle({ children, color = '#5a9fff' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 4 }}>
      <div style={{ width: 3, height: 16, background: color, borderRadius: 2 }} />
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 1.5, color, textTransform: 'uppercase' }}>
        {children}
      </span>
    </div>
  )
}

const CUSTOM_TOOLTIP = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#111f35', border: '1px solid #1a3050', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
      <div style={{ color: '#6b8ab0', marginBottom: 4, fontFamily: "'DM Mono',monospace" }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</div>
      ))}
    </div>
  )
}

export default function DeviceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { telemetry: storeTelemetry } = useStore()
  const [device, setDevice] = useState(null)
  const [activeTab, setActiveTab] = useState('battery')
  const [socHistory, setSocHistory] = useState([])
  const [solarHistory, setSolarHistory] = useState([])
  const [signalHistory, setSignalHistory] = useState([])
  const [recentEvents, setRecentEvents] = useState([])

  const t = storeTelemetry[id] || {}

  // Fetch device info
  useEffect(() => {
    axios.get(`${API}/devices/${id}`).then(r => setDevice(r.data)).catch(() => {})
    subscribeDevice(id)
    return () => unsubscribeDevice(id)
  }, [id])

  // Fetch historical data
  const fetchHistory = useCallback(async () => {
    try {
      const [soc, solar, sig, ev] = await Promise.all([
        axios.get(`${API}/telemetry/${id}/soc`),
        axios.get(`${API}/telemetry/${id}/solar`),
        axios.get(`${API}/telemetry/${id}/signal`),
        axios.get(`${API}/events`, { params: { device_id: id, limit: 20 } }),
      ])
      setSocHistory(soc.data.map(r => ({
        h: r.hour?.slice(11, 16),
        soc: r.soc ? +r.soc.toFixed(1) : 0,
        v: r.voltage ? +r.voltage.toFixed(2) : 0,
      })))
      setSolarHistory(solar.data.map(r => ({
        h: r.hour?.slice(11, 16),
        w: r.panel_power ? +r.panel_power.toFixed(1) : 0,
      })))
      setSignalHistory(sig.data.map(r => ({
        h: r.hour?.slice(11, 16),
        rssi: r.rssi ? +r.rssi.toFixed(0) : 0,
        rsrp: r.rsrp ? +r.rsrp.toFixed(0) : 0,
      })))
      setRecentEvents(ev.data.events || [])
    } catch (e) {}
  }, [id])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  if (!device) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#3d5a80' }}>
      Cargando parada...
    </div>
  )

  // Derived values
  const soc = t.soc ?? '--'
  const voltage = t.voltage ?? '--'
  const chargeA = t.current_charge ?? '--'
  const dischargeA = t.current_discharge ?? '--'
  const chargeW = t.power_charge ?? '--'
  const dischargeW = t.power_discharge ?? '--'
  const temp = t.temperature ?? '--'
  const humidity = t.humidity ?? '--'
  const panelW = t.panel_power ?? '--'
  const panelV = t.panel_voltage ?? '--'
  const panelA = t.panel_current ?? '--'
  const mpptStage = t.mppt_stage ?? '--'
  const mpptStageColor = MPPT_STAGE_COLOR[mpptStage] || '#6b8ab0'
  const rssi = t.rssi ?? '--'
  const rsrp = t.rsrp ?? '--'
  const rsrq = t.rsrq ?? '--'
  const snr = t.snr ?? '--'
  const lteBand = t.lte_band ?? '--'
  const cells = [t.cell_v1, t.cell_v2, t.cell_v3, t.cell_v4]
  const uptime = t.uptime
  const status = device.status === 'online' || t.ts ? 'online' : 'offline'

  const socColor = typeof soc === 'number'
    ? (soc > 50 ? '#00e676' : soc > 20 ? '#ffd740' : '#ff5252')
    : '#6b8ab0'

  const rssiColor = typeof rssi === 'number'
    ? (rssi > -80 ? '#00e676' : rssi > -95 ? '#ffd740' : '#ff5252')
    : '#6b8ab0'

  // Uptime formatting
  const fmtUptime = (s) => {
    if (!s) return '--'
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    return `${d}d ${h}h ${m}m`
  }

  const TABS = [
    { id: 'battery', label: '🔋 Batería' },
    { id: 'solar',   label: '☀ Solar' },
    { id: 'sensors', label: '🌡 Sensores' },
    { id: 'signal',  label: '📶 Señal' },
    { id: 'events',  label: '⚠ Eventos' },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid #1a3050', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: '1px solid #1a3050', borderRadius: 8, padding: '5px 12px', color: '#6b8ab0', cursor: 'pointer', fontSize: 12 }}>
          ← Volver
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800 }}>{device.name}</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#3d5a80', marginTop: 2 }}>
            {device.address} · IMEI: {device.imei || id}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {t.buffered_positions > 0 && (
            <span style={{ fontSize: 10, color: '#ffd740', background: 'rgba(255,215,64,0.1)', border: '1px solid rgba(255,215,64,0.3)', borderRadius: 20, padding: '2px 8px' }}>
              📦 {t.buffered_positions} buffer
            </span>
          )}
          <span style={{
            fontSize: 11, padding: '4px 12px', borderRadius: 20,
            background: status === 'online' ? 'rgba(0,230,118,0.1)' : 'rgba(255,82,82,0.1)',
            color: status === 'online' ? '#00e676' : '#ff5252',
            border: `1px solid ${status === 'online' ? 'rgba(0,230,118,0.3)' : 'rgba(255,82,82,0.3)'}`,
          }}>
            {status === 'online' ? '● EN LÍNEA' : '● SIN REPORTE'}
          </span>
        </div>
      </div>

      {/* Quick metrics bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 0, borderBottom: '1px solid #1a3050' }}>
        {[
          { l: 'SOC', v: soc, u: '%', c: socColor },
          { l: 'Voltaje', v: typeof voltage === 'number' ? voltage.toFixed(2) : voltage, u: 'V', c: '#5a9fff' },
          { l: 'P. Carga', v: typeof chargeW === 'number' ? chargeW.toFixed(0) : chargeW, u: 'W', c: '#00e676' },
          { l: 'P. Descarga', v: typeof dischargeW === 'number' ? dischargeW.toFixed(0) : dischargeW, u: 'W', c: '#ff5252' },
          { l: 'Panel', v: typeof panelW === 'number' ? panelW.toFixed(0) : panelW, u: 'W', c: '#ffd740' },
          { l: 'Temp.', v: typeof temp === 'number' ? temp.toFixed(1) : temp, u: '°C', c: '#ff9800' },
          { l: 'RSSI', v: rssi, u: 'dBm', c: rssiColor },
        ].map((m, i) => (
          <div key={i} style={{
            padding: '8px 14px',
            borderRight: i < 6 ? '1px solid #1a3050' : 'none',
            background: '#0c1829',
          }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#3d5a80', letterSpacing: 1, textTransform: 'uppercase' }}>{m.l}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 700, color: m.c, marginTop: 2 }}>
              {m.v}<span style={{ fontSize: 10, color: '#6b8ab0', marginLeft: 2 }}>{m.u}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1a3050', background: '#0c1829' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '10px 20px', background: 'none', border: 'none',
            borderBottom: activeTab === tab.id ? '2px solid #1a6fff' : '2px solid transparent',
            color: activeTab === tab.id ? '#5a9fff' : '#6b8ab0',
            cursor: 'pointer', fontSize: 12, fontFamily: "'DM Sans',sans-serif",
            transition: 'color 0.15s',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

        {/* ── BATERÍA ─────────────────────────────────────────────────────── */}
        {activeTab === 'battery' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* SOC bar */}
            <div style={{ background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12, padding: '20px 24px' }}>
              <SectionTitle color={socColor}>Estado de carga — LFP 100Ah / 1.28kWh</SectionTitle>
              <div style={{ position: 'relative', height: 32, background: '#111f35', borderRadius: 8, overflow: 'hidden', border: '1px solid #1a3050', marginBottom: 8 }}>
                <div style={{
                  width: `${typeof soc === 'number' ? soc : 0}%`, height: '100%',
                  background: `linear-gradient(90deg, ${socColor}aa, ${socColor})`,
                  borderRadius: 8, transition: 'width 1.5s ease',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', inset: 0, opacity: 0.3,
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                    animation: 'shimmer 2s infinite',
                  }} />
                </div>
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontFamily: "'Syne',sans-serif",
                  fontSize: 14, fontWeight: 800, color: '#fff',
                }}>
                  {soc}%
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#3d5a80' }}>
                <span>DESCARGA {BAT.dischargeV}V</span>
                <span>NOMINAL {BAT.nominalV}V</span>
                <span>CARGA COMPLETA {BAT.chargeV}V</span>
              </div>
            </div>

            {/* Métricas batería */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              <MetricChip label="Voltaje pack" value={typeof voltage === 'number' ? voltage.toFixed(3) : voltage} unit="V" color="#5a9fff" />
              <MetricChip label="Corriente carga" value={typeof chargeA === 'number' ? chargeA.toFixed(2) : chargeA} unit="A" color="#00e676" />
              <MetricChip label="Corriente descarga" value={typeof dischargeA === 'number' ? dischargeA.toFixed(2) : dischargeA} unit="A" color="#ff5252" />
              <MetricChip label="Temperatura" value={typeof temp === 'number' ? temp.toFixed(1) : temp} unit="°C" color="#ff9800" />
              <MetricChip label="Potencia carga" value={typeof chargeW === 'number' ? chargeW.toFixed(1) : chargeW} unit="W" color="#00e676" />
              <MetricChip label="Potencia descarga" value={typeof dischargeW === 'number' ? dischargeW.toFixed(1) : dischargeW} unit="W" color="#ff5252" />
              <MetricChip label="Cap. nominal" value="100" unit="Ah" color="#6b8ab0" />
              <MetricChip label="Energía total" value="1280" unit="Wh" color="#6b8ab0" />
            </div>

            {/* Voltaje por celda 4S1P */}
            <div style={{ background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12, padding: '16px 20px' }}>
              <SectionTitle color="#00d4ff">Voltaje por celda — 4S1P (3.2V nominal)</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                {cells.map((cv, i) => {
                  const pct = cv ? Math.max(0, Math.min(100, ((cv - 2.5) / (3.65 - 2.5)) * 100)) : 0
                  const cc = cv > 3.3 ? '#00e676' : cv > 3.0 ? '#ffd740' : '#ff5252'
                  return (
                    <div key={i} style={{ background: '#111f35', borderRadius: 8, padding: '12px', border: '1px solid #1a3050', textAlign: 'center' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#3d5a80', marginBottom: 8 }}>CELDA {i+1}</div>
                      <div style={{ height: 60, background: '#1a3050', borderRadius: 4, overflow: 'hidden', position: 'relative', marginBottom: 8 }}>
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${pct}%`, background: cc, transition: 'height 1s ease' }} />
                      </div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: cc }}>
                        {cv ? cv.toFixed(3) : '—'}<span style={{ fontSize: 9, color: '#6b8ab0', marginLeft: 2 }}>V</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#3d5a80' }}>
                <span>CORTE: 2.5V</span>
                <span>NOMINAL: 3.2V</span>
                <span>MÁX: 3.65V</span>
              </div>
            </div>

            {/* Gráfica SOC 24h */}
            {socHistory.length > 0 && (
              <div style={{ background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12, padding: '16px 20px' }}>
                <SectionTitle>SOC histórico — últimas 24h</SectionTitle>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={socHistory}>
                    <defs>
                      <linearGradient id="gSoc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1a6fff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#1a6fff" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="h" tick={{ fill: '#3d5a80', fontSize: 9 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#3d5a80', fontSize: 9 }} />
                    <ReferenceLine y={20} stroke="#ff5252" strokeDasharray="4 4" label={{ value: '20% mín', fill: '#ff5252', fontSize: 8 }} />
                    <Tooltip content={<CUSTOM_TOOLTIP />} />
                    <Area type="monotone" dataKey="soc" name="SOC" stroke="#1a6fff" fill="url(#gSoc)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ── SOLAR ───────────────────────────────────────────────────────── */}
        {activeTab === 'solar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Estado MPPT */}
            <div style={{ background: '#0c1829', border: `1px solid ${mpptStageColor}40`, borderRadius: 12, padding: '16px 20px' }}>
              <SectionTitle color={mpptStageColor}>MPPT Tracer-AN G3 — {PANEL.mpptEff}% eficiencia</SectionTitle>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{
                  background: `${mpptStageColor}20`, border: `1px solid ${mpptStageColor}60`,
                  borderRadius: 8, padding: '8px 16px',
                  fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, color: mpptStageColor,
                }}>
                  {mpptStage}
                </div>
                <div style={{ fontSize: 11, color: '#6b8ab0', lineHeight: 1.8 }}>
                  Modo de carga actual (3 etapas: Bulk → Absorción → Float)<br />
                  Eficiencia tracking MPPT: {PANEL.mpptTrackEff}% · DC/DC: {PANEL.mpptEff}%
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                <MetricChip label="Potencia panel" value={typeof panelW === 'number' ? panelW.toFixed(1) : panelW} unit="W" color="#ffd740" />
                <MetricChip label="Voltaje panel" value={typeof panelV === 'number' ? panelV.toFixed(2) : panelV} unit="V" color="#ffd740" />
                <MetricChip label="Corriente panel" value={typeof panelA === 'number' ? panelA.toFixed(2) : panelA} unit="A" color="#ffd740" />
                <MetricChip label="Panel máx." value={PANEL.maxW} unit="W" color="#6b8ab0" />
              </div>
            </div>

            {/* Gráfica solar 7 días */}
            {solarHistory.length > 0 && (
              <div style={{ background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12, padding: '16px 20px' }}>
                <SectionTitle color="#ffd740">Generación solar — últimos 7 días</SectionTitle>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={solarHistory}>
                    <XAxis dataKey="h" tick={{ fill: '#3d5a80', fontSize: 9 }} />
                    <YAxis domain={[0, PANEL.maxW]} tick={{ fill: '#3d5a80', fontSize: 9 }} />
                    <Tooltip content={<CUSTOM_TOOLTIP />} />
                    <Bar dataKey="w" name="Potencia (W)" fill="#ffd740" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Info panel */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12, padding: '14px 18px' }}>
                <SectionTitle color="#ffd740">Panel Solar</SectionTitle>
                {[
                  ['Modelo', 'EPEVER M10-36-350'],
                  ['Potencia pico', '350 Wp'],
                  ['Voltaje Vmp', '38.1 V'],
                  ['Voltaje Voc', '45.2 V'],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(26,48,80,0.5)' }}>
                    <span style={{ fontSize: 11, color: '#6b8ab0' }}>{l}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#e8f0fe' }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12, padding: '14px 18px' }}>
                <SectionTitle color="#ffd740">Controlador MPPT</SectionTitle>
                {[
                  ['Modelo', 'Tracer 4210AN G3'],
                  ['Corriente máx.', '40 A'],
                  ['Eficiencia DC/DC', '98%'],
                  ['Tracking MPPT', '>99.5%'],
                  ['Comunicación', 'RS485'],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(26,48,80,0.5)' }}>
                    <span style={{ fontSize: 11, color: '#6b8ab0' }}>{l}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#e8f0fe' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SENSORES ─────────────────────────────────────────────────────── */}
        {activeTab === 'sensors' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

              {/* Temperatura */}
              <div style={{ background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12, padding: '20px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🌡</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#3d5a80', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
                  TEMPERATURA — WMS301
                </div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 48, fontWeight: 800, color: '#ff9800' }}>
                  {typeof temp === 'number' ? temp.toFixed(1) : temp}
                  <span style={{ fontSize: 20, color: '#6b8ab0' }}>°C</span>
                </div>
                <div style={{ fontSize: 11, color: '#6b8ab0', marginTop: 8 }}>
                  Rango operación: -20°C a +60°C (descarga)
                </div>
              </div>

              {/* Humedad */}
              <div style={{ background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12, padding: '20px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>💧</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#3d5a80', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
                  HUMEDAD RELATIVA — WMS301
                </div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 48, fontWeight: 800, color: '#00d4ff' }}>
                  {typeof humidity === 'number' ? humidity.toFixed(1) : humidity}
                  <span style={{ fontSize: 20, color: '#6b8ab0' }}>%</span>
                </div>
                <div style={{ fontSize: 11, color: '#6b8ab0', marginTop: 8 }}>
                  Humedad operación batería LFP: 40%–80%
                </div>
              </div>
            </div>

            {/* Monitor puertas */}
            <div style={{ background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12, padding: '16px 20px' }}>
              <SectionTitle>Sensores de puerta — Queclink WMS301 / BLE 5.2</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                {DOOR_LABELS.map((label, i) => {
                  const open = t[`door${i+1}`]
                  return (
                    <div key={i} style={{
                      background: '#111f35', borderRadius: 10, padding: '16px',
                      border: `1px solid ${open ? 'rgba(255,82,82,0.4)' : 'rgba(0,230,118,0.2)'}`,
                      textAlign: 'center', transition: 'border-color 0.3s',
                    }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>{open ? '🔓' : '🔒'}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#6b8ab0', marginBottom: 6 }}>
                        Puerta {i+1}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{label}</div>
                      <div style={{
                        marginTop: 8, fontSize: 10, padding: '3px 10px', borderRadius: 20,
                        background: open ? 'rgba(255,82,82,0.15)' : 'rgba(0,230,118,0.1)',
                        color: open ? '#ff5252' : '#00e676',
                        border: `1px solid ${open ? 'rgba(255,82,82,0.4)' : 'rgba(0,230,118,0.3)'}`,
                      }}>
                        {open ? '🚨 ABIERTO' : '✓ CERRADO'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── SEÑAL ────────────────────────────────────────────────────────── */}
        {activeTab === 'signal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Métricas LTE GV310LAU */}
            <div style={{ background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12, padding: '16px 20px' }}>
              <SectionTitle color="#00d4ff">Señal LTE — Queclink GV310LAU</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 12 }}>
                <MetricChip label="RSSI" value={rssi} unit="dBm" color={rssiColor} />
                <MetricChip label="RSRP" value={rsrp} unit="dBm" color={typeof rsrp === 'number' ? (rsrp > -90 ? '#00e676' : rsrp > -105 ? '#ffd740' : '#ff5252') : '#6b8ab0'} />
                <MetricChip label="RSRQ" value={rsrq} unit="dB" color="#00d4ff" />
                <MetricChip label="SNR" value={snr} unit="dB" color="#5a9fff" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                <div style={{ background: '#111f35', borderRadius: 8, padding: '10px 14px', border: '1px solid #1a3050' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#3d5a80', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>BANDA LTE</div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800, color: '#00d4ff' }}>{lteBand}</div>
                  <div style={{ fontSize: 10, color: '#6b8ab0', marginTop: 2 }}>LTE Cat4 FDD</div>
                </div>
                <div style={{ background: '#111f35', borderRadius: 8, padding: '10px 14px', border: '1px solid #1a3050' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#3d5a80', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>PRECISIÓN GPS</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 700, color: '#00e676' }}>&lt;2.0</div>
                  <div style={{ fontSize: 10, color: '#6b8ab0', marginTop: 2 }}>metros CEP (u-blox)</div>
                </div>
                <div style={{ background: '#111f35', borderRadius: 8, padding: '10px 14px', border: '1px solid #1a3050' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#3d5a80', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>BUFFER LOCAL</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 700, color: '#ffd740' }}>
                    {t.buffered_positions ?? 0}
                  </div>
                  <div style={{ fontSize: 10, color: '#6b8ab0', marginTop: 2 }}>/ 30.000 posiciones</div>
                </div>
                <div style={{ background: '#111f35', borderRadius: 8, padding: '10px 14px', border: '1px solid #1a3050' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#3d5a80', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>UPTIME</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: '#e8f0fe' }}>{fmtUptime(uptime)}</div>
                  <div style={{ fontSize: 10, color: '#6b8ab0', marginTop: 2 }}>Autonomía batt.: {GV310.autonomyH}h</div>
                </div>
              </div>
            </div>

            {/* Bandas soportadas */}
            <div style={{ background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12, padding: '14px 18px' }}>
              <SectionTitle color="#00d4ff">Bandas operativas — LATAM</SectionTitle>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['B1','B2','B3','B4','B5','B7','B8','B28'].map(b => (
                  <span key={b} style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 10,
                    fontFamily: "'DM Mono',monospace",
                    background: lteBand === b ? 'rgba(0,212,255,0.2)' : 'rgba(26,48,80,0.5)',
                    color: lteBand === b ? '#00d4ff' : '#6b8ab0',
                    border: `1px solid ${lteBand === b ? 'rgba(0,212,255,0.4)' : '#1a3050'}`,
                    fontWeight: lteBand === b ? 700 : 400,
                  }}>
                    LTE FDD {b}
                  </span>
                ))}
                {['B1','B2','B5','B8'].map(b => (
                  <span key={'w'+b} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontFamily: "'DM Mono',monospace", background: 'rgba(26,48,80,0.3)', color: '#6b8ab0', border: '1px solid #1a3050' }}>
                    WCDMA {b}
                  </span>
                ))}
              </div>
            </div>

            {/* Gráfica señal 24h */}
            {signalHistory.length > 0 && (
              <div style={{ background: '#0c1829', border: '1px solid #1a3050', borderRadius: 12, padding: '16px 20px' }}>
                <SectionTitle color="#00d4ff">RSSI / RSRP histórico — últimas 24h</SectionTitle>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={signalHistory}>
                    <XAxis dataKey="h" tick={{ fill: '#3d5a80', fontSize: 9 }} />
                    <YAxis domain={[-120, -50]} tick={{ fill: '#3d5a80', fontSize: 9 }} />
                    <ReferenceLine y={-100} stroke="#ff5252" strokeDasharray="4 4" label={{ value: 'Señal débil', fill: '#ff5252', fontSize: 8 }} />
                    <Tooltip content={<CUSTOM_TOOLTIP />} />
                    <Line type="monotone" dataKey="rssi" name="RSSI" stroke="#00d4ff" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="rsrp" name="RSRP" stroke="#5a9fff" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ── EVENTOS ──────────────────────────────────────────────────────── */}
        {activeTab === 'events' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#3d5a80', letterSpacing: 1, textTransform: 'uppercase' }}>
              Últimos 20 eventos — {device.name}
            </div>
            {recentEvents.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: '#3d5a80' }}>Sin eventos registrados</div>
            )}
            {recentEvents.map(ev => {
              const sev = { info: '#5a9fff', warning: '#ffd740', critical: '#ff5252' }
              const icon = { info: 'ℹ', warning: '⚠', critical: '🚨' }
              return (
                <div key={ev.id} style={{
                  background: '#0c1829', borderRadius: 10, padding: '12px 16px',
                  border: `1px solid ${sev[ev.severity]}30`,
                  opacity: ev.resolved ? 0.5 : 1, transition: 'opacity 0.2s',
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{icon[ev.severity]}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: sev[ev.severity] }}>{ev.type?.replace('_', ' ')}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#3d5a80' }}>
                        {ev.ts ? new Date(ev.ts).toLocaleString('es-EC') : '--'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#e8f0fe' }}>{ev.message}</div>
                    {ev.resolved && <div style={{ marginTop: 4, fontSize: 10, color: '#00e676' }}>✓ Resuelto</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
      `}</style>
    </div>
  )
}
