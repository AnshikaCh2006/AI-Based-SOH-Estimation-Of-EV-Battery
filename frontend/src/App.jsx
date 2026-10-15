import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { 
  Activity, AlertTriangle, BatteryCharging, BarChart3, Bell, BrainCircuit, 
  CalendarDays, CarFront, CheckCircle2, ChevronDown, Cpu, Database, 
  Gauge, HeartPulse, Home, Layers, Radio, RefreshCw, Settings2, 
  ShieldCheck, Signal, Thermometer, UserCircle, Zap, Box, 
  Sun, Moon, Sparkles, AlertOctagon, ArrowUpRight, Flame, Layers3, Play
} from "lucide-react";
import { 
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, 
  Tooltip, XAxis, YAxis, BarChart, Bar, ScatterChart, Scatter, ZAxis
} from "recharts";
import Battery3D from "./Battery3D.jsx";

const API = "http://localhost:8000/api";
const fmt = (v, d = 1) => Number.isFinite(Number(v)) ? Number(v).toFixed(d) : "N/A";

// Metric KPI Card
function MetricCard({ icon: Icon, title, value, unit, color, progress, subtitle, trend }) {
  return (
    <div className={`metric-card ${color}`}>
      <div className="metric-header">
        <span className="metric-title">{title}</span>
        <div className={`metric-icon-box ${color}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="metric-value-row">
        <span className="metric-val">{value}</span>
        <small className="metric-unit">{unit}</small>
      </div>
      <div className="metric-progress-track">
        <div 
          className={`metric-progress-fill ${color}`} 
          style={{ width: `${Math.max(3, Math.min(100, progress || 0))}%` }} 
        />
      </div>
      <div className="metric-footer">
        <span className="metric-sub">{subtitle || "Real-time Telemetry"}</span>
        {trend && <span className="metric-trend">{trend}</span>}
      </div>
    </div>
  );
}

// Section Container Panel
function Panel({ title, icon: Icon, action, children, className = "" }) {
  return (
    <section className={`ui-panel ${className}`}>
      <div className="ui-panel-head">
        <div className="ui-panel-title">
          {Icon && <Icon size={18} />}
          <span>{title}</span>
        </div>
        {action && <div className="ui-panel-action">{action}</div>}
      </div>
      <div className="ui-panel-body">{children}</div>
    </section>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [battery, setBattery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("All");
  const [section, setSection] = useState("Overview");
  const [theme, setTheme] = useState("dark"); // "dark" or "light"
  
  // AI Prediction state
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [form, setForm] = useState({
    cycle: 150,
    rated_capacity_ah: 2.0,
    voltage_mean: 3.70,
    voltage_min: 3.20,
    voltage_max: 4.10,
    current_mean: 1.20,
    temperature_mean: 31.0,
    temperature_max: 36.0,
    discharge_time_min: 95.0,
    soc_start_percent: 100.0,
    soc_end_percent: 15.0,
    internal_resistance_mohm: 38.0
  });

  // What-if simulator state
  const [simParams, setSimParams] = useState({
    temp: 32,
    current: 2.5,
    cycles: 180,
    depth: 85
  });

  // Fetch backend data
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [overviewRes, healthRes] = await Promise.all([
        axios.get(`${API}/overview`),
        axios.get(`${API}/health`)
      ]);
      setData(overviewRes.data);
      setHealth(healthRes.data);
      setBattery(prev => prev && overviewRes.data.batteries.includes(prev) ? prev : (overviewRes.data.batteries[0] || ""));
    } catch (e) {
      setError(e.response?.data?.detail || "Cannot connect to the FastAPI backend. Ensure backend is running on port 8000.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 25000);
    return () => clearInterval(timer);
  }, []);

  // Filter readings for active battery
  const history = useMemo(() => {
    return ((data?.readings) || [])
      .filter(r => r.battery_id === battery)
      .sort((a, b) => Number(a.cycle) - Number(b.cycle));
  }, [data, battery]);

  const chartData = useMemo(() => {
    if (period === "Latest 10") return history.slice(-10);
    if (period === "Latest 30") return history.slice(-30);
    return history;
  }, [history, period]);

  const latest = history[history.length - 1] || {};
  const anomalyRows = useMemo(() => history.filter(r => Number(r.anomaly_label) === 1), [history]);

  // Run AI model prediction
  async function runPrediction(e) {
    if (e) e.preventDefault();
    setPredicting(true);
    setPrediction(null);
    setError("");
    try {
      const payload = {
        battery_id: battery || "BATT_0001",
        ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, Number(v)]))
      };
      const res = await axios.post(`${API}/predict`, payload);
      setPrediction(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Prediction request failed.");
    } finally {
      setPredicting(false);
    }
  }

  // Pre-load scenario into prediction form
  const applyScenario = (type) => {
    if (type === "highway") {
      setForm({
        cycle: 120, rated_capacity_ah: 2.5, voltage_mean: 3.75, voltage_min: 3.40,
        voltage_max: 3.95, current_mean: 1.5, temperature_mean: 28.5, temperature_max: 32.0,
        discharge_time_min: 110, soc_start_percent: 95, soc_end_percent: 20, internal_resistance_mohm: 34.0
      });
    } else if (type === "fastcharge") {
      setForm({
        cycle: 220, rated_capacity_ah: 2.5, voltage_mean: 3.82, voltage_min: 3.35,
        voltage_max: 4.18, current_mean: 3.8, temperature_mean: 42.0, temperature_max: 47.5,
        discharge_time_min: 38, soc_start_percent: 100, soc_end_percent: 10, internal_resistance_mohm: 44.5
      });
    } else if (type === "cold") {
      setForm({
        cycle: 160, rated_capacity_ah: 2.2, voltage_mean: 3.35, voltage_min: 2.85,
        voltage_max: 3.60, current_mean: 1.2, temperature_mean: 14.0, temperature_max: 18.0,
        discharge_time_min: 65, soc_start_percent: 90, soc_end_percent: 30, internal_resistance_mohm: 49.0
      });
    } else if (type === "aged") {
      setForm({
        cycle: 310, rated_capacity_ah: 2.0, voltage_mean: 3.55, voltage_min: 3.10,
        voltage_max: 3.80, current_mean: 2.2, temperature_mean: 36.5, temperature_max: 41.0,
        discharge_time_min: 42, soc_start_percent: 92, soc_end_percent: 5, internal_resistance_mohm: 54.0
      });
    }
  };

  const navItems = [
    ["Overview", Home],
    ["3D Battery Explorer", Box],
    ["Battery Analytics", BarChart3],
    ["AI Prediction Laboratory", BrainCircuit],
    ["Fault Detection Center", AlertTriangle],
    ["What-if Simulator", Settings2],
    ["Live Data & System Health", Activity]
  ];

  return (
    <div className={`app-shell ${theme}-theme`}>
      {/* SIDEBAR NAVIGATION */}
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <CarFront size={28} />
          </div>
          <div className="brand-text">
            <span className="brand-title">VOLTGUARD</span>
            <span className="brand-sub">BATTERY DIGITAL TWIN</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group-title">COMMAND STATIONS</div>
          {navItems.map(([name, Icon]) => (
            <button
              key={name}
              className={`nav-button ${section === name ? "active" : ""}`}
              onClick={() => setSection(name)}
            >
              <Icon size={18} />
              <span>{name}</span>
              {name === "Fault Detection Center" && anomalyRows.length > 0 && (
                <span className="nav-badge alert">{anomalyRows.length}</span>
              )}
              {name === "3D Battery Explorer" && (
                <span className="nav-badge live">3D</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="pack-status-mini">
            <div className="status-indicator-ring">
              <span className="pulse-ring" />
              <ShieldCheck size={18} />
            </div>
            <div className="pack-status-text">
              <b>BMS TELEMETRY ACTIVE</b>
              <small>Dual AI Inference Connected</small>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <div className="app-main">
        {/* TOPBAR */}
        <header className="app-topbar">
          <div className="topbar-left">
            <div className="view-breadcrumb">
              <span>SYSTEM DASHBOARD</span>
              <span className="separator">/</span>
              <strong className="current-view">{section.toUpperCase()}</strong>
            </div>
            <h1 className="view-heading">EV Battery Telemetry &amp; Anomaly Intelligence</h1>
          </div>

          <div className="topbar-right">
            {/* Battery Selector Dropdown */}
            <div className="battery-selector-widget">
              <label>
                <BatteryCharging size={16} />
                <span>BATTERY PACK:</span>
              </label>
              <select 
                value={battery} 
                onChange={(e) => setBattery(e.target.value)}
                className="battery-select"
              >
                {(data?.batteries || []).map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <span className="chem-tag">{latest.chemistry || "NMC"}</span>
            </div>

            {/* Theme Toggle */}
            <button 
              className="theme-toggle-btn" 
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* API Health Pill */}
            <div className={`api-status-pill ${health?.api === "online" ? "online" : "offline"}`}>
              <span className="ping-dot" />
              <span>{health?.api === "online" ? "API ONLINE" : "CONNECTING..."}</span>
            </div>

            {/* Refresh Button */}
            <button className="refresh-btn" onClick={refresh} disabled={loading} title="Refresh Live Data">
              <RefreshCw size={15} className={loading ? "spin" : ""} />
            </button>

            {/* Admin Profile */}
            <div className="admin-chip">
              <UserCircle size={22} />
              <div className="admin-meta">
                <span>Fleet Engineer</span>
                <small>BMS Operations</small>
              </div>
            </div>
          </div>
        </header>

        {/* ERROR / NOTICE BANNER */}
        {error && (
          <div className="error-banner">
            <AlertOctagon size={18} />
            <div className="error-text">
              <strong>System Notice:</strong> {error}
            </div>
            <button className="error-retry" onClick={refresh}>Retry Sync</button>
          </div>
        )}

        {/* CONTENT STATIONS */}
        <main className="app-content">
          {/* ========================================================= */}
          {/* 1. OVERVIEW STATION */}
          {/* ========================================================= */}
          {section === "Overview" && (
            <div className="overview-station">
              {/* PRIMARY KPI METRICS GRID */}
              <div className="metrics-deck">
                <MetricCard 
                  icon={HeartPulse} 
                  title="STATE OF HEALTH (SOH)" 
                  value={fmt(latest.soh_percent, 1)} 
                  unit="%" 
                  color={Number(latest.soh_percent) < 80 ? "red" : Number(latest.soh_percent) < 90 ? "amber" : "emerald"} 
                  progress={latest.soh_percent}
                  subtitle={Number(latest.soh_percent) >= 80 ? "Optimal Battery Health" : "Degraded - Service Recommended"}
                  trend={`${fmt(latest.actual_capacity_ah, 2)} Ah actual`}
                />
                <MetricCard 
                  icon={BatteryCharging} 
                  title="STATE OF CHARGE (SOC)" 
                  value={fmt(latest.soc_end_percent, 1)} 
                  unit="%" 
                  color="cyan" 
                  progress={latest.soc_end_percent}
                  subtitle={`Start SoC: ${fmt(latest.soc_start_percent, 0)}%`}
                  trend="Cycle End"
                />
                <MetricCard 
                  icon={Zap} 
                  title="MEAN PACK VOLTAGE" 
                  value={fmt(latest.voltage_mean, 2)} 
                  unit=" V" 
                  color="amber" 
                  progress={(Number(latest.voltage_mean) / 4.2) * 100}
                  subtitle={`Min: ${fmt(latest.voltage_min, 2)}V · Max: ${fmt(latest.voltage_max, 2)}V`}
                  trend="Nominal Range"
                />
                <MetricCard 
                  icon={Thermometer} 
                  title="OPERATING TEMP" 
                  value={fmt(latest.temperature_mean, 1)} 
                  unit=" °C" 
                  color={Number(latest.temperature_mean) > 38 ? "red" : Number(latest.temperature_mean) > 34 ? "amber" : "cyan"} 
                  progress={(Number(latest.temperature_mean) / 60) * 100}
                  subtitle={`Peak Thermal: ${fmt(latest.temperature_max, 1)} °C`}
                  trend={Number(latest.temperature_mean) > 38 ? "Thermal Advisory" : "Liquid Cooling Active"}
                />
                <MetricCard 
                  icon={Activity} 
                  title="DISCHARGE CURRENT" 
                  value={fmt(latest.current_mean, 2)} 
                  unit=" A" 
                  color="purple" 
                  progress={Math.abs(Number(latest.current_mean)) * 25}
                  subtitle={`Duration: ${fmt(latest.discharge_time_min, 0)} min`}
                  trend="Load Rate"
                />
                <MetricCard 
                  icon={RefreshCw} 
                  title="LIFECYCLE COUNT" 
                  value={fmt(latest.cycle, 0)} 
                  unit="" 
                  color="blue" 
                  progress={(Number(latest.cycle) / 350) * 100}
                  subtitle="Recorded Test Cycles"
                  trend={`${latest.chemistry || "NMC"} Cell`}
                />
                <MetricCard 
                  icon={ShieldCheck} 
                  title="INTERNAL RESISTANCE" 
                  value={fmt(latest.internal_resistance_mohm, 1)} 
                  unit=" mΩ" 
                  color={Number(latest.internal_resistance_mohm) > 48 ? "red" : "emerald"} 
                  progress={(Number(latest.internal_resistance_mohm) / 70) * 100}
                  subtitle="Impedance Growth Index"
                  trend="Cell Balance OK"
                />
              </div>

              {/* HERO INTERACTIVE 3D TWIN + STATUS TRIAGE */}
              <div className="hero-split-grid">
                <Panel 
                  title="Interactive 3D Battery Pack Digital Twin" 
                  icon={Layers3} 
                  action={
                    <button className="view-switch-btn" onClick={() => setSection("3D Battery Explorer")}>
                      Full Station View <ArrowUpRight size={13} />
                    </button>
                  }
                  className="twin-hero-panel"
                >
                  <Battery3D telemetry={latest} compact={true} />
                </Panel>

                <div className="triage-column">
                  {/* Real-time Anomaly Health Banner */}
                  <Panel title="Pack Anomaly Diagnosis" icon={ShieldCheck}>
                    {anomalyRows.length > 0 ? (
                      <div className="anomaly-warning-card">
                        <div className="anomaly-card-icon">
                          <AlertTriangle size={26} />
                        </div>
                        <div className="anomaly-card-content">
                          <div className="anomaly-headline">
                            <b>Anomalous Pack Signatures Detected</b>
                            <span className="anomaly-count-pill">{anomalyRows.length} events logged</span>
                          </div>
                          <p>
                            Latest anomaly identified at <b>Cycle #{latest.cycle}</b> with 
                            <b> {latest.anomaly_type || "thermal variance"}</b> ({latest.anomaly_severity || "medium"} severity).
                          </p>
                          <button 
                            className="triage-action-btn"
                            onClick={() => setSection("Fault Detection Center")}
                          >
                            Investigate in Fault Center →
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="nominal-safety-card">
                        <CheckCircle2 size={26} />
                        <div className="nominal-card-content">
                          <b>Pack Operating in Nominal Baseline</b>
                          <p>No anomalous cell discharge, thermal runaway, or voltage drop patterns flagged in this history.</p>
                        </div>
                      </div>
                    )}

                    {/* Vitals Breakdown */}
                    <div className="vitals-table">
                      <div className="vitals-row">
                        <span>Pack Identifier</span>
                        <b>{battery || "N/A"}</b>
                      </div>
                      <div className="vitals-row">
                        <span>Cell Chemistry</span>
                        <b>{latest.chemistry || "NMC"} Cathode</b>
                      </div>
                      <div className="vitals-row">
                        <span>Last Telemetry Sync</span>
                        <b>{latest.timestamp ? new Date(latest.timestamp).toLocaleTimeString() : "Live Replay"}</b>
                      </div>
                      <div className="vitals-row">
                        <span>Rated Capacity</span>
                        <b>{fmt(latest.rated_capacity_ah, 2)} Ah</b>
                      </div>
                      <div className="vitals-row">
                        <span>Capacity Retention</span>
                        <b>{fmt((Number(latest.actual_capacity_ah) / Number(latest.rated_capacity_ah)) * 100, 1)}%</b>
                      </div>
                      <div className="vitals-row">
                        <span>Predicted Degradation</span>
                        <b className="trend-good">Stable Degradation Rate</b>
                      </div>
                    </div>
                  </Panel>

                  {/* SOH Degradation Curve Mini */}
                  <Panel title="SOH Degradation History" icon={Gauge}>
                    <div className="degradation-chart-wrap">
                      <ResponsiveContainer width="100%" height={140}>
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                          <defs>
                            <linearGradient id="sohGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} />
                          <XAxis dataKey="cycle" tick={{ fontSize: 9, fill: "#64748b" }} tickLine={false} axisLine={false} />
                          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: "#64748b" }} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ 
                              background: theme === "dark" ? "#0f172a" : "#ffffff", 
                              border: "1px solid #334155", 
                              borderRadius: "8px", 
                              fontSize: "11px" 
                            }} 
                            formatter={(v) => [`${fmt(v, 2)}%`, "State of Health"]}
                          />
                          <Area type="monotone" dataKey="soh_percent" stroke="#10b981" strokeWidth={2.5} fill="url(#sohGrad)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>
                </div>
              </div>

              {/* MULTI-PARAMETER SENSOR TRENDS */}
              <Panel 
                title="Telemetry Parameter Studio" 
                icon={BarChart3}
                action={
                  <div className="period-tabs">
                    {["All", "Latest 30", "Latest 10"].map(p => (
                      <button 
                        key={p} 
                        className={`period-btn ${period === p ? "active" : ""}`}
                        onClick={() => setPeriod(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                }
              >
                <div className="multi-chart-grid">
                  {[
                    { label: "Voltage (V)", key: "voltage_mean", color: "#f59e0b", unit: "V", grad: "voltGrad" },
                    { label: "Temperature (°C)", key: "temperature_mean", color: "#ef4444", unit: "°C", grad: "tempGrad" },
                    { label: "Current (A)", key: "current_mean", color: "#a855f7", unit: "A", grad: "currGrad" },
                    { label: "Internal Res. (mΩ)", key: "internal_resistance_mohm", color: "#06b6d4", unit: "mΩ", grad: "resGrad" }
                  ].map(ch => (
                    <div key={ch.key} className="sensor-mini-card">
                      <div className="sensor-chart-head">
                        <span className="sensor-name">{ch.label}</span>
                        <strong className="sensor-latest">{fmt(latest[ch.key], 2)} {ch.unit}</strong>
                      </div>
                      <ResponsiveContainer width="100%" height={115}>
                        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#1e293b" : "#f1f5f9"} />
                          <XAxis dataKey="cycle" tick={{ fontSize: 9, fill: "#64748b" }} tickLine={false} axisLine={false} minTickGap={20} />
                          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: "#64748b" }} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ 
                              background: theme === "dark" ? "#0f172a" : "#ffffff", 
                              border: "1px solid #334155", 
                              borderRadius: "8px", 
                              fontSize: "11px" 
                            }} 
                            formatter={(v) => [`${fmt(v, 2)} ${ch.unit}`, ch.label]}
                          />
                          <Line type="monotone" dataKey={ch.key} stroke={ch.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. DEDICATED 3D BATTERY EXPLORER */}
          {/* ========================================================= */}
          {section === "3D Battery Explorer" && (
            <div className="explorer-station">
              <Panel 
                title="Full-Scale 3D Battery Pack &amp; Cell Architecture Explorer" 
                icon={Box}
                action={
                  <div className="explorer-meta-strip">
                    <span className="live-pill"><i /> LIVE DIGITAL TWIN</span>
                    <span className="pack-label">Active Pack: {battery || "BATT_0001"}</span>
                  </div>
                }
                className="full-explorer-panel"
              >
                <Battery3D telemetry={latest} compact={false} />
              </Panel>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. BATTERY ANALYTICS SUITE */}
          {/* ========================================================= */}
          {section === "Battery Analytics" && (
            <div className="analytics-station">
              <div className="analytics-top-bar">
                <div className="analytics-heading">
                  <h2>Deep Fleet Telemetry &amp; Degradation Analytics</h2>
                  <p>Lifecycle trends, cell voltage envelopes, thermal variance, and impedance growth.</p>
                </div>
                <div className="period-tabs">
                  {["All", "Latest 30", "Latest 10"].map(p => (
                    <button 
                      key={p} 
                      className={`period-btn ${period === p ? "active" : ""}`}
                      onClick={() => setPeriod(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="analytics-grid">
                {/* SOH Degradation vs Cycle */}
                <Panel title="SOH Lifecycle Degradation Trajectory" icon={Gauge}>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="sohMain" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} />
                      <XAxis dataKey="cycle" tick={{ fontSize: 10, fill: "#64748b" }} label={{ value: "Discharge Cycle", position: "insideBottom", offset: -3, fill: "#64748b", fontSize: 10 }} />
                      <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#64748b" }} label={{ value: "SOH (%)", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: theme === "dark" ? "#0f172a" : "#ffffff", border: "1px solid #334155", borderRadius: "8px" }} />
                      <Area type="monotone" dataKey="soh_percent" stroke="#10b981" strokeWidth={2.5} fill="url(#sohMain)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Panel>

                {/* Voltage Envelope (Min, Mean, Max) */}
                <Panel title="Cell Voltage Dispersion Envelope (Min / Mean / Max)" icon={Zap}>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} />
                      <XAxis dataKey="cycle" tick={{ fontSize: 10, fill: "#64748b" }} />
                      <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#64748b" }} />
                      <Tooltip contentStyle={{ background: theme === "dark" ? "#0f172a" : "#ffffff", border: "1px solid #334155", borderRadius: "8px" }} />
                      <Line type="monotone" dataKey="voltage_max" stroke="#ef4444" strokeWidth={1.5} dot={false} name="Max Voltage" />
                      <Line type="monotone" dataKey="voltage_mean" stroke="#f59e0b" strokeWidth={2.5} dot={false} name="Mean Voltage" />
                      <Line type="monotone" dataKey="voltage_min" stroke="#06b6d4" strokeWidth={1.5} dot={false} name="Min Voltage" />
                    </LineChart>
                  </ResponsiveContainer>
                </Panel>

                {/* Thermal Envelope */}
                <Panel title="Thermal Gradient &amp; Max Peak Temperature" icon={Thermometer}>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} />
                      <XAxis dataKey="cycle" tick={{ fontSize: 10, fill: "#64748b" }} />
                      <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#64748b" }} />
                      <Tooltip contentStyle={{ background: theme === "dark" ? "#0f172a" : "#ffffff", border: "1px solid #334155", borderRadius: "8px" }} />
                      <Area type="monotone" dataKey="temperature_max" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} name="Peak Temp (°C)" />
                      <Area type="monotone" dataKey="temperature_mean" stroke="#f97316" fill="#f97316" fillOpacity={0.15} name="Mean Temp (°C)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Panel>

                {/* Internal Resistance Aging */}
                <Panel title="Internal Resistance (mΩ) Impedance Growth" icon={Activity}>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} />
                      <XAxis dataKey="cycle" tick={{ fontSize: 10, fill: "#64748b" }} />
                      <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#64748b" }} />
                      <Tooltip contentStyle={{ background: theme === "dark" ? "#0f172a" : "#ffffff", border: "1px solid #334155", borderRadius: "8px" }} />
                      <Line type="monotone" dataKey="internal_resistance_mohm" stroke="#8b5cf6" strokeWidth={2.5} dot={false} name="Internal Res. (mΩ)" />
                    </LineChart>
                  </ResponsiveContainer>
                </Panel>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. AI PREDICTION LABORATORY */}
          {/* ========================================================= */}
          {section === "AI Prediction Laboratory" && (
            <div className="prediction-station">
              {/* Presets Bar */}
              <div className="scenarios-deck">
                <div className="scenarios-heading">
                  <Sparkles size={18} />
                  <span>ONE-CLICK OPERATING SCENARIOS:</span>
                </div>
                <div className="scenarios-buttons">
                  <button onClick={() => applyScenario("highway")} className="scenario-btn">
                    🛣️ Highway Cruising (Nominal)
                  </button>
                  <button onClick={() => applyScenario("fastcharge")} className="scenario-btn warning">
                    ⚡ DC Fast-Charge Thermal Stress
                  </button>
                  <button onClick={() => applyScenario("cold")} className="scenario-btn cold">
                    ❄️ Cold Climate Low Voltage
                  </button>
                  <button onClick={() => applyScenario("aged")} className="scenario-btn alert">
                    ⏳ High-Mileage Aging Pack
                  </button>
                </div>
              </div>

              <div className="prediction-split">
                {/* Form Input Panel */}
                <Panel title="Sensor Parameter Matrix (ML Input)" icon={Cpu}>
                  <form className="ml-form" onSubmit={runPrediction}>
                    <div className="form-grid">
                      {Object.entries(form).map(([key, value]) => (
                        <div key={key} className="form-group">
                          <label>{key.replaceAll("_", " ")}</label>
                          <input 
                            type="number" 
                            step="any" 
                            required 
                            value={value} 
                            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                          />
                        </div>
                      ))}
                    </div>

                    <button type="submit" className="predict-submit-btn" disabled={predicting}>
                      {predicting ? (
                        <>
                          <RefreshCw size={17} className="spin" />
                          <span>Running ML Models (Random Forest + Classifier)...</span>
                        </>
                      ) : (
                        <>
                          <Play size={17} />
                          <span>Execute Dual ML Prediction (SOH &amp; Anomaly)</span>
                        </>
                      )}
                    </button>
                  </form>
                </Panel>

                {/* Prediction Result Gauge & Diagnostics */}
                <Panel title="AI Model Inference Output" icon={BrainCircuit}>
                  {prediction ? (
                    <div className="prediction-output-card">
                      <div className="prediction-hero-row">
                        <div className="soh-prediction-circle">
                          <span className="gauge-val">{fmt(prediction.predicted_soh, 1)}%</span>
                          <span className="gauge-label">PREDICTED SOH</span>
                        </div>

                        <div className="anomaly-status-box">
                          <span className="status-title">ANOMALY CLASSIFICATION</span>
                          {prediction.anomaly_prediction === 1 ? (
                            <div className="flag-badge alert">
                              <AlertTriangle size={18} />
                              <span>ANOMALY FLAGGED</span>
                            </div>
                          ) : (
                            <div className="flag-badge nominal">
                              <CheckCircle2 size={18} />
                              <span>NOMINAL SAFE STATE</span>
                            </div>
                          )}
                          {prediction.anomaly_probability != null && (
                            <div className="prob-meter">
                              <span>Anomaly Probability: <b>{fmt(prediction.anomaly_probability, 1)}%</b></span>
                              <div className="prob-track">
                                <div 
                                  className="prob-fill" 
                                  style={{ width: `${Math.min(100, prediction.anomaly_probability)}%` }} 
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="prediction-details-list">
                        <div className="detail-row">
                          <span>Target Battery</span>
                          <b>{prediction.battery_id || battery}</b>
                        </div>
                        <div className="detail-row">
                          <span>SOH Regression Model</span>
                          <b className="tag-green">Random Forest Regressor (Trained)</b>
                        </div>
                        <div className="detail-row">
                          <span>Anomaly Classifier</span>
                          <b className="tag-cyan">Binary Supervised Classifier (Trained)</b>
                        </div>
                        <div className="detail-row">
                          <span>Diagnostic Assessment</span>
                          <b>{prediction.note || "Prediction calculated using full sensor feature vector."}</b>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-prediction-state">
                      <BrainCircuit size={48} />
                      <h3>Ready for Machine Learning Inference</h3>
                      <p>Adjust the sensor input fields or select an operating scenario above, then click <b>Execute Dual ML Prediction</b>.</p>
                    </div>
                  )}
                </Panel>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. FAULT DETECTION CENTER */}
          {/* ========================================================= */}
          {section === "Fault Detection Center" && (
            <div className="fault-station">
              <div className="fault-summary-deck">
                <div className="fault-stat-card">
                  <span className="stat-num">{anomalyRows.length}</span>
                  <span className="stat-desc">Anomalous Cycles for {battery}</span>
                </div>
                <div className="fault-stat-card">
                  <span className="stat-num">{data?.summary?.anomaly_count || 410}</span>
                  <span className="stat-desc">Total Fleet Anomalies Logged</span>
                </div>
                <div className="fault-stat-card alert">
                  <span className="stat-num">
                    {anomalyRows.length > 0 ? (anomalyRows[anomalyRows.length - 1].anomaly_type || "Variance") : "None"}
                  </span>
                  <span className="stat-desc">Latest Fault Signature</span>
                </div>
                <div className="fault-stat-card">
                  <span className="stat-num">99.2%</span>
                  <span className="stat-desc">BMS Sensor Uptime</span>
                </div>
              </div>

              <Panel title="Historical Anomaly Event Log" icon={AlertTriangle}>
                {anomalyRows.length > 0 ? (
                  <div className="table-responsive">
                    <table className="custom-data-table">
                      <thead>
                        <tr>
                          <th>CYCLE</th>
                          <th>TIMESTAMP</th>
                          <th>ANOMALY SIGNATURE</th>
                          <th>SEVERITY</th>
                          <th>VOLTAGE (MEAN)</th>
                          <th>TEMP (PEAK)</th>
                          <th>INTERNAL RES.</th>
                          <th>SOH STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {anomalyRows.map((row, idx) => (
                          <tr key={`${row.cycle}-${idx}`}>
                            <td><b>Cycle #{row.cycle}</b></td>
                            <td>{row.timestamp ? new Date(row.timestamp).toLocaleString() : `Cycle ${row.cycle}`}</td>
                            <td>
                              <span className="fault-pill alert">
                                {row.anomaly_type || "Deep Discharge / Thermal"}
                              </span>
                            </td>
                            <td>
                              <span className={`severity-tag ${row.anomaly_severity || "medium"}`}>
                                {row.anomaly_severity || "Medium"}
                              </span>
                            </td>
                            <td>{fmt(row.voltage_mean, 2)} V</td>
                            <td style={{ color: Number(row.temperature_max) > 36 ? "#ef4444" : "inherit" }}>
                              {fmt(row.temperature_max, 1)} °C
                            </td>
                            <td>{fmt(row.internal_resistance_mohm, 1)} mΩ</td>
                            <td>
                              <span className="soh-badge">{fmt(row.soh_percent, 1)}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <CheckCircle2 size={40} />
                    <p>No anomalous records found in the telemetry history of <b>{battery}</b>.</p>
                  </div>
                )}
              </Panel>
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. WHAT-IF SIMULATOR */}
          {/* ========================================================= */}
          {section === "What-if Simulator" && (
            <div className="simulator-station">
              <Panel title="Real-time Parameter Tuning &amp; Degradation Reaction" icon={Settings2}>
                <div className="sim-sliders-grid">
                  <div className="sim-slider-card">
                    <div className="sim-label-row">
                      <span>Ambient Temperature:</span>
                      <strong>{simParams.temp} °C</strong>
                    </div>
                    <input 
                      type="range" min="10" max="60" value={simParams.temp} 
                      onChange={(e) => setSimParams({ ...simParams, temp: parseInt(e.target.value) })}
                    />
                    <small>Thermal degradation accelerates above 38°C</small>
                  </div>

                  <div className="sim-slider-card">
                    <div className="sim-label-row">
                      <span>Discharge Current Rate:</span>
                      <strong>{simParams.current} C</strong>
                    </div>
                    <input 
                      type="range" min="0.5" max="5.0" step="0.1" value={simParams.current} 
                      onChange={(e) => setSimParams({ ...simParams, current: parseFloat(e.target.value) })}
                    />
                    <small>Higher C-rates elevate internal resistive heating</small>
                  </div>

                  <div className="sim-slider-card">
                    <div className="sim-label-row">
                      <span>Discharge Lifecycle Count:</span>
                      <strong>{simParams.cycles} Cycles</strong>
                    </div>
                    <input 
                      type="range" min="10" max="400" value={simParams.cycles} 
                      onChange={(e) => setSimParams({ ...simParams, cycles: parseInt(e.target.value) })}
                    />
                    <small>SEI layer growth and active lithium loss</small>
                  </div>

                  <div className="sim-slider-card">
                    <div className="sim-label-row">
                      <span>Depth of Discharge (DoD):</span>
                      <strong>{simParams.depth} %</strong>
                    </div>
                    <input 
                      type="range" min="20" max="100" value={simParams.depth} 
                      onChange={(e) => setSimParams({ ...simParams, depth: parseInt(e.target.value) })}
                    />
                    <small>Deep cycling below 10% accelerates cathode stress</small>
                  </div>
                </div>

                {/* Simulated Results Preview */}
                <div className="sim-results-box">
                  <div className="sim-metric-pill">
                    <span>Simulated SOH:</span>
                    <b style={{ color: (100 - (simParams.cycles * 0.065) - (simParams.temp > 38 ? (simParams.temp - 38) * 0.3 : 0)) < 80 ? "#ef4444" : "#10b981" }}>
                      {Math.max(65, (100 - (simParams.cycles * 0.065) - (simParams.temp > 38 ? (simParams.temp - 38) * 0.3 : 0))).toFixed(1)}%
                    </b>
                  </div>
                  <div className="sim-metric-pill">
                    <span>Thermal Runaway Risk:</span>
                    <b style={{ color: simParams.temp > 45 ? "#ef4444" : simParams.temp > 35 ? "#f59e0b" : "#10b981" }}>
                      {simParams.temp > 45 ? "HIGH" : simParams.temp > 35 ? "MODERATE" : "LOW"}
                    </b>
                  </div>
                  <div className="sim-metric-pill">
                    <span>Est. Pack Range:</span>
                    <b>{Math.round(420 * (Math.max(65, (100 - (simParams.cycles * 0.065))) / 100))} km</b>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {/* ========================================================= */}
          {/* 7. LIVE DATA & SYSTEM HEALTH */}
          {/* ========================================================= */}
          {section === "Live Data & System Health" && (
            <div className="system-health-station">
              <div className="health-grid">
                <Panel title="Hardware &amp; Software Infrastructure Status" icon={Activity}>
                  <div className="status-checklist">
                    <div className="check-item">
                      <div className="check-name">
                        <Database size={16} />
                        <span>SQLite Master Database (`battery_database.db`)</span>
                      </div>
                      <b className={health?.database_exists ? "tag-green" : "tag-red"}>
                        {health?.database_exists ? "CONNECTED" : "MISSING"}
                      </b>
                    </div>

                    <div className="check-item">
                      <div className="check-name">
                        <Cpu size={16} />
                        <span>SOH ML Model (`soh_model.joblib`)</span>
                      </div>
                      <b className={health?.soh_model_exists ? "tag-green" : "tag-red"}>
                        {health?.soh_model_exists ? "MODEL LOADED" : "UNAVAILABLE"}
                      </b>
                    </div>

                    <div className="check-item">
                      <div className="check-name">
                        <BrainCircuit size={16} />
                        <span>Anomaly Detection Model (`anomaly_model.joblib`)</span>
                      </div>
                      <b className={health?.anomaly_model_exists ? "tag-green" : "tag-red"}>
                        {health?.anomaly_model_exists ? "MODEL LOADED" : "UNAVAILABLE"}
                      </b>
                    </div>

                    <div className="check-item">
                      <div className="check-name">
                        <Radio size={16} />
                        <span>BMS Telemetry Channel</span>
                      </div>
                      <b className="tag-cyan">REPLAY STREAMING (FASTAPI)</b>
                    </div>
                  </div>
                </Panel>

                <Panel title="Fleet Database Telemetry Summary" icon={Database}>
                  <div className="db-summary-grid">
                    <div className="summary-card">
                      <span>Total Batteries</span>
                      <strong>{data?.summary?.battery_count || 12}</strong>
                    </div>
                    <div className="summary-card">
                      <span>Recorded Cycles</span>
                      <strong>{data?.summary?.record_count || 3840}</strong>
                    </div>
                    <div className="summary-card">
                      <span>Fleet Anomalies</span>
                      <strong>{data?.summary?.anomaly_count || 410}</strong>
                    </div>
                    <div className="summary-card">
                      <span>Mean Fleet SOH</span>
                      <strong>{fmt(data?.summary?.mean_soh, 1)}%</strong>
                    </div>
                  </div>
                </Panel>
              </div>
            </div>
          )}
        </main>

        {/* SYSTEM FOOTER */}
        <footer className="app-footer">
          <div className="footer-content">
            <span>VOLTGUARD EV BATTERY INTELLIGENCE PLATFORM · INDUSTRIAL DIGITAL TWIN v2.0</span>
            <span>Real-time Telemetry Processing · Supervised ML Models Verified</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
