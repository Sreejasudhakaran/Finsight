import { useState, useEffect, useRef, useCallback } from "react";
import RiskChart from "./RiskChart";
import AnomalyTable from "./AnomalyTable";

export default function Dashboard({ token, user, onLogout, api }) {
  const [prices,     setPrices]     = useState([]);
  const [risk,       setRisk]       = useState([]);
  const [anomalies,  setAnomalies]  = useState([]);
  const [history,    setHistory]    = useState([]);
  const [selectedTicker, setSelected] = useState("AAPL");
  const [loading,    setLoading]    = useState({ prices: true, risk: true, anomaly: true, history: true });
  const [wsStatus,   setWsStatus]   = useState("connecting");
  const wsRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchPrices = useCallback(async () => {
    try {
      const r = await fetch(`${api}/prices/live`, { headers });
      const d = await r.json();
      setPrices(d.prices?.filter(p => !p.error) || []);
    } catch (e) {} finally {
      setLoading(l => ({ ...l, prices: false }));
    }
  }, [api, token]);

  const fetchRisk = useCallback(async () => {
    try {
      const r = await fetch(`${api}/risk/portfolio`, { headers });
      const d = await r.json();
      setRisk(d.risk_metrics?.filter(m => !m.error) || []);
    } catch (e) {} finally {
      setLoading(l => ({ ...l, risk: false }));
    }
  }, [api, token]);

  const fetchAnomalies = useCallback(async () => {
    try {
      const r = await fetch(`${api}/anomaly/scan`, { headers });
      const d = await r.json();
      setAnomalies(d.anomalies || []);
    } catch (e) {} finally {
      setLoading(l => ({ ...l, anomaly: false }));
    }
  }, [api, token]);

  const fetchHistory = useCallback(async (ticker) => {
    setLoading(l => ({ ...l, history: true }));
    try {
      const r = await fetch(`${api}/prices/history/${ticker}`, { headers });
      const d = await r.json();
      setHistory(d.data || []);
    } catch (e) {} finally {
      setLoading(l => ({ ...l, history: false }));
    }
  }, [api, token]);

  // WebSocket live price updates
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.hostname}:8000/ws/prices`);
    wsRef.current = ws;
    ws.onopen  = () => setWsStatus("live");
    ws.onclose = () => setWsStatus("disconnected");
    ws.onerror = () => setWsStatus("error");
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "price_update") {
        setPrices(prev => {
          const updated = [...prev];
          msg.data.forEach(live => {
            const idx = updated.findIndex(p => p.ticker === live.ticker);
            if (idx >= 0) updated[idx] = { ...updated[idx], ...live };
          });
          return updated;
        });
      }
    };
    return () => ws.close();
  }, []);

  // Initial data load
  useEffect(() => {
    fetchPrices();
    fetchRisk();
    fetchAnomalies();
    fetchHistory(selectedTicker);
  }, []);

  const selectTicker = (t) => {
    setSelected(t);
    fetchHistory(t);
  };

  // Derived metrics
  const totalVar = risk.reduce((s, r) => s + (r.var_95_pct || 0), 0);
  const highRisk = risk.filter(r => r.risk_level === "HIGH").length;
  const avgVol   = risk.length ? risk.reduce((s, r) => s + (r.volatility_annualised || 0), 0) / risk.length : 0;
  const selectedRisk = risk.find(r => r.ticker === selectedTicker);

  return (
    <div className="dash-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">📈 FinSight</div>
        <div className="sidebar-item active">📊 Dashboard</div>
        <div className="sidebar-item">📈 Portfolio</div>
        <div className="sidebar-item">⚠ Anomalies</div>
        <div className="sidebar-item">🔒 Risk Models</div>
        <div className="sidebar-item">⚙ Settings</div>
        <div className="sidebar-bottom">
          <button className="logout-btn" onClick={onLogout}>← Sign Out</button>
        </div>
      </aside>

      {/* Main */}
      <div className="dash-main">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-title">Portfolio Risk Monitor</div>
          <div className="topbar-right">
            <div className="live-badge">
              <div className="live-dot" />
              {wsStatus === "live" ? "Live" : wsStatus}
            </div>
            <div className="user-badge">👤 {user}</div>
          </div>
        </div>

        <div className="dash-content">
          {/* Metric Cards */}
          <div className="metrics-row">
            <div className="metric-card">
              <div className="metric-label">Portfolio VaR (95%)</div>
              <div className={`metric-val ${totalVar < 0 ? "c-red" : "c-green"}`}>
                {totalVar.toFixed(2)}%
              </div>
              <div className="metric-sub">Max 1-day loss estimate</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Avg Volatility</div>
              <div className="metric-val c-amber">{(avgVol * 100).toFixed(1)}%</div>
              <div className="metric-sub">Annualised across portfolio</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">High Risk Stocks</div>
              <div className="metric-val c-red">{highRisk}</div>
              <div className="metric-sub">Volatility &gt; 40%</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Anomalies Flagged</div>
              <div className="metric-val c-blue">{anomalies.length}</div>
              <div className="metric-sub">Isolation Forest detections</div>
            </div>
          </div>

          {/* Price Table + Chart */}
          <div className="dash-grid-3">
            {/* Prices */}
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Live Prices</span>
                <button className="refresh-btn" onClick={fetchPrices}>↻ Refresh</button>
              </div>
              {loading.prices ? (
                <div className="loading"><div className="spin" /> Fetching prices...</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>Price</th>
                      <th>Change</th>
                      <th>Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prices.slice(0, 12).map(p => {
                      const riskInfo = risk.find(r => r.ticker === p.ticker);
                      return (
                        <tr key={p.ticker} onClick={() => selectTicker(p.ticker)}
                          style={{ cursor: "pointer", background: selectedTicker === p.ticker ? "rgba(59,130,246,0.06)" : "" }}>
                          <td style={{ fontFamily: "Syne, sans-serif", fontWeight: 700 }}>{p.ticker}</td>
                          <td>${p.price?.toFixed(2)}</td>
                          <td style={{ color: p.change_pct < 0 ? "var(--red)" : "var(--green)" }}>
                            {p.change_pct > 0 ? "+" : ""}{p.change_pct?.toFixed(2)}%
                          </td>
                          <td>
                            {riskInfo && (
                              <span className={`badge ${
                                riskInfo.risk_level === "HIGH" ? "badge-red" :
                                riskInfo.risk_level === "MEDIUM" ? "badge-amber" : "badge-green"
                              }`}>{riskInfo.risk_level}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Risk detail */}
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">{selectedTicker} Risk</span>
              </div>
              <div className="panel-body">
                {selectedRisk ? (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <div className="metric-label">VaR (95%)</div>
                      <div className="metric-val c-red" style={{ fontSize: 24 }}>{selectedRisk.var_95_pct?.toFixed(3)}%</div>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <div className="metric-label">Volatility (Ann.)</div>
                      <div className="metric-val c-amber" style={{ fontSize: 24 }}>{(selectedRisk.volatility_annualised * 100)?.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="metric-label">Risk Level</div>
                      <span className={`badge ${
                        selectedRisk.risk_level === "HIGH" ? "badge-red" :
                        selectedRisk.risk_level === "MEDIUM" ? "badge-amber" : "badge-green"
                      }`} style={{ fontSize: 13, padding: "4px 12px" }}>
                        {selectedRisk.risk_level}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="loading"><div className="spin" /></div>
                )}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-header">
              <span className="panel-title">{selectedTicker} — 30-Day Price History</span>
              <button className="refresh-btn" onClick={() => fetchHistory(selectedTicker)}>↻ Refresh</button>
            </div>
            <div className="panel-body">
              {loading.history ? (
                <div className="loading"><div className="spin" /> Loading chart...</div>
              ) : (
                <RiskChart data={history} ticker={selectedTicker} />
              )}
            </div>
          </div>

          {/* Anomaly Table */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Anomaly Detection — Isolation Forest</span>
              <button className="refresh-btn" onClick={fetchAnomalies}>↻ Scan</button>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <AnomalyTable anomalies={anomalies} loading={loading.anomaly} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
