export default function AnomalyTable({ anomalies = [], loading = false }) {
  if (loading) return (
    <div className="loading"><div className="spin" /> Scanning for anomalies...</div>
  );
  if (!anomalies.length) return (
    <div className="loading" style={{ color: "#10b981" }}>✓ No anomalies detected</div>
  );

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Ticker</th>
          <th>Price</th>
          <th>Return</th>
          <th>Score</th>
          <th>Severity</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {anomalies.map((a, i) => (
          <tr key={i}>
            <td style={{ fontFamily: "Syne, sans-serif", fontWeight: 700 }}>{a.ticker}</td>
            <td>${a.price?.toFixed(2)}</td>
            <td style={{ color: a.return_pct < 0 ? "var(--red)" : "var(--green)" }}>
              {a.return_pct > 0 ? "+" : ""}{a.return_pct?.toFixed(2)}%
            </td>
            <td style={{ color: "var(--text3)", fontFamily: "monospace" }}>{a.score?.toFixed(4)}</td>
            <td>
              <span className={`badge ${a.severity === "HIGH" ? "badge-red" : "badge-amber"}`}>
                {a.severity}
              </span>
            </td>
            <td style={{ color: "var(--text3)" }}>{a.date}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
