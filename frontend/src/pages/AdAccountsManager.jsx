import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";
import { customerName } from "../utils/customerName";
import "./SocialAccounts.css";

const fmtMoney = (n, cur) =>
  `${cur === "USD" ? "US$" : "$"}${(Number(n) || 0).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtNum = (n) => (Number(n) || 0).toLocaleString("es-MX");
const fmtDate = (s) => (s ? new Date(s).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Nunca");

const AdAccountsManager = () => {
  const [accounts, setAccounts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");
  const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };

  const fetchData = async () => {
    try {
      const [accRes, custRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/ads/accounts`, { headers }),
        axios.get(`${API_BASE_URL}/customers`, { headers }).catch(() => ({ data: [] })),
      ]);
      setAccounts(Array.isArray(accRes.data?.accounts) ? accRes.data.accounts : []);
      setCustomers(Array.isArray(custRes.data) ? custRes.data : []);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  const assign = async (id, customerId) => {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, customer_id: customerId || null } : a)));
    try {
      await axios.patch(`${API_BASE_URL}/api/ads/accounts/${id}/customer`, { customer_id: customerId || null }, { headers });
    } catch {
      fetchData();
    }
  };

  const sync = async () => {
    setSyncing(true); setMsg("");
    try {
      const r = await axios.post(`${API_BASE_URL}/api/ads/sync`, {}, { headers });
      setMsg(`Sincronizadas ${r.data.synced}/${r.data.total} cuentas.`);
      await fetchData();
    } catch (e) {
      setMsg(e.response?.data?.error || "No se pudo sincronizar la inversión.");
    } finally {
      setSyncing(false);
    }
  };

  const assigned = accounts.filter((a) => a.customer_id).length;
  const totalSpend = accounts.reduce((s, a) => s + (Number(a.month_spend) || 0), 0);

  return (
    <Layout>
      <div className="zxsa">
        <div className="zxsa-inner">
          <div className="zxsa-head">
            <div>
              <div className="eyebrow">Publicidad</div>
              <h1>Cuentas <span className="zxsa-serif">publicitarias</span></h1>
              <div className="sub">Inversión y rendimiento traídos directamente de Meta. Asigna cada cuenta a un cliente para que aparezca en su portal.</div>
            </div>
            <div className="zxsa-actions">
              <button className="zxsa-btn" onClick={sync} disabled={syncing}>{syncing ? "Sincronizando…" : "Sincronizar inversión"}</button>
              <Link to="/social/accounts" className="zxsa-btn solid">Conectar en Meta</Link>
            </div>
          </div>

          {msg && <div className="zxsa-note">{msg}</div>}

          {loading ? (
            <div className="zxsa-loading"><div className="zxsa-spinner" /></div>
          ) : accounts.length === 0 ? (
            <div className="zxsa-empty">
              <div className="lead">Aún no hay cuentas publicitarias</div>
              <div>Conéctate con Meta desde <Link to="/social/accounts">Cuentas de Redes Sociales</Link> otorgando el permiso de anuncios (ads_read). Tus cuentas publicitarias aparecerán aquí.</div>
            </div>
          ) : (
            <>
              <div className="zxsa-tiles">
                <div className="zxsa-tile"><span className="k">Cuentas</span><span className="v">{accounts.length}</span></div>
                <div className="zxsa-tile"><span className="k">Asignadas</span><span className="v">{assigned}</span></div>
                <div className="zxsa-tile"><span className="k">Inversión del mes</span><span className="v">{fmtMoney(totalSpend)}</span></div>
                <div className="zxsa-tile"><span className="k">Sin asignar</span><span className="v">{accounts.length - assigned}</span></div>
              </div>

              <div className="zxsa-grid">
                {accounts.map((a) => (
                  <div className="zxsa-card" key={a.id}>
                    <div className="zxsa-card-top">
                      <div className="zxsa-avatar mono">{(a.account_name || "A").charAt(0).toUpperCase()}</div>
                      <div className="zxsa-idwrap">
                        <div className="zxsa-name">{a.account_name || `Cuenta ${a.platform_account_id}`}</div>
                        <div className="zxsa-meta">
                          <span className={`zxsa-plat ${a.platform === "google" ? "" : "facebook"}`}>{a.platform === "google" ? "Google Ads" : "Meta Ads"}</span>
                          {a.currency && <span>{a.currency}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="zxsa-followers">
                      Inversión: <b>{fmtMoney(a.month_spend, a.currency)}</b> · Impresiones: <b>{fmtNum(a.month_impressions)}</b> · Clics: <b>{fmtNum(a.month_clicks)}</b>
                    </div>
                    <div className="zxsa-date">Última sincronización: {fmtDate(a.last_synced_at)}</div>

                    <label className="zxsa-assign">
                      Cliente
                      <select value={a.customer_id || ""} onChange={(e) => assign(a.id, e.target.value)}>
                        <option value="">Sin asignar</option>
                        {customers.map((c) => <option key={c.id} value={c.id}>{customerName(c)}</option>)}
                      </select>
                    </label>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AdAccountsManager;
