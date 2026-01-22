import React, { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";

const StoreDashboard = () => {
  const [data, setData] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;

      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/dashboard/store-profitability`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params,
        }
      );
      setData(res.data);
    } catch (err) {
      console.error("Error fetching store profitability:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Layout>
      <div>
        <h1>🏬 Store Dashboard</h1>

        <div style={{ marginBottom: "1rem" }}>
          <label>From: </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ backgroundColor: "black", color: "lime", border: "1px solid lime", padding: "0.3rem" }}
          />
          <label style={{ marginLeft: "1rem" }}>To: </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ backgroundColor: "black", color: "lime", border: "1px solid lime", padding: "0.3rem" }}
          />
          <button onClick={fetchData} style={{ marginLeft: "1rem" }}>
            🔄 Refresh
          </button>
        </div>

        {loading ? (
          <p>Loading store data...</p>
        ) : (
          <table
            border="1"
            cellPadding="10"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              backgroundColor: "black",
              color: "#00FF00",
              border: "1px solid #00FF00"
            }}
          >
            <thead>
              <tr>
                <th style={{ border: "1px solid #00FF00", padding: "8px", backgroundColor: "#111" }}>Store</th>
                <th style={{ border: "1px solid #00FF00", padding: "8px", backgroundColor: "#111", textAlign: "right" }}>Revenue</th>
                <th style={{ border: "1px solid #00FF00", padding: "8px", backgroundColor: "#111", textAlign: "right" }}>COGS</th>
                <th style={{ border: "1px solid #00FF00", padding: "8px", backgroundColor: "#111", textAlign: "right" }}>Interest</th>
                <th style={{ border: "1px solid #00FF00", padding: "8px", backgroundColor: "#111", textAlign: "right" }}>Penalties</th>
                <th style={{ border: "1px solid #00FF00", padding: "8px", backgroundColor: "#111", textAlign: "right" }}>Expenses</th>
                <th style={{ border: "1px solid #00FF00", padding: "8px", backgroundColor: "#111", textAlign: "right" }}>Net Profit</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.store}>
                  <td style={{ border: "1px solid #00FF00", padding: "8px" }}>{s.store}</td>
                  <td style={{ border: "1px solid #00FF00", padding: "8px", textAlign: "right" }}>${s.revenue.toFixed(2)}</td>
                  <td style={{ border: "1px solid #00FF00", padding: "8px", textAlign: "right" }}>${s.cogs.toFixed(2)}</td>
                  <td style={{ border: "1px solid #00FF00", padding: "8px", textAlign: "right" }}>${s.interest.toFixed(2)}</td>
                  <td style={{ border: "1px solid #00FF00", padding: "8px", textAlign: "right" }}>${s.penalties.toFixed(2)}</td>
                  <td style={{ border: "1px solid #00FF00", padding: "8px", textAlign: "right" }}>${s.expenses.toFixed(2)}</td>
                  <td style={{ border: "1px solid #00FF00", padding: "8px", textAlign: "right" }}>
                    <strong>${s.net_profit.toFixed(2)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
};

export default StoreDashboard;