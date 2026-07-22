import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";
import { FUNNEL_STAGES, stageLabel } from "../config/salesFunnel";
import "./ClientDashboard.css";

const fmtMoney = (n) =>
  `$${(Number(n) || 0).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const monthName = () => new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" });

const ClientDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };

  useEffect(() => {
    axios.get(`${API_BASE_URL}/portal/summary`, { headers })
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Layout><div className="zxpt"><div className="zxpt-loading">Cargando tu panel…</div></div></Layout>;
  if (!data) return <Layout><div className="zxpt"><div className="zxpt-loading">No se pudo cargar el panel.</div></div></Layout>;

  const { funnel, content, billing } = data;
  const maxStage = Math.max(1, ...funnel.stages.map((s) => s.n));
  const stageMap = Object.fromEntries(funnel.stages.map((s) => [s.status, s.n]));

  const chargeLabel = billing.charge_status === "cobrado" ? "Pagado"
    : billing.charge_status === "pendiente" ? "Pendiente" : "—";

  return (
    <Layout>
      <div className="zxpt">
        <div className="zxpt-inner">
          <div className="zxpt-head">
            <div className="eyebrow">Tu panel · {monthName()}</div>
            <h1>Hola, <span className="zxpt-serif">{data.customer_name}</span></h1>
            <div className="sub">Así va tu embudo de prospectos este mes.</div>
          </div>

          <div className="zxpt-tiles">
            <div className="zxpt-tile"><span className="k">Leads totales</span><span className="v">{funnel.total}</span></div>
            <div className="zxpt-tile"><span className="k">Nuevos este mes</span><span className="v">{funnel.new_this_month}</span></div>
            <div className="zxpt-tile ok"><span className="k">Conversión</span><span className="v">{funnel.conversion}%</span></div>
            <div className="zxpt-tile sched"><span className="k">Valor en pipeline</span><span className="v">{fmtMoney(funnel.pipeline_value)}</span></div>
          </div>

          <div className="zxpt-grid">
            <div className="zxpt-card wide">
              <div className="zxpt-card-head">Tu embudo <Link to="/funnel" className="zxpt-link">Ver todo →</Link></div>
              <div className="zxpt-stages">
                {FUNNEL_STAGES.map((s) => {
                  const n = stageMap[s.key] || 0;
                  return (
                    <div className="zxpt-stage" key={s.key}>
                      <div className="lbl">{stageLabel(s.key)}</div>
                      <div className="track"><div className={`fill t-${s.tone}`} style={{ width: `${(n / maxStage) * 100}%` }} /></div>
                      <div className="n">{n}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="zxpt-card">
              <div className="zxpt-card-head">Este mes</div>
              <div className="zxpt-stat"><span className="k">Ganados</span><span className="v">{funnel.won}</span></div>
              <div className="zxpt-stat"><span className="k">Valor ganado</span><span className="v">{fmtMoney(funnel.won_value)}</span></div>
              <div className="zxpt-stat"><span className="k">Contenido planeado</span><span className="v">{content.planned}</span></div>
              <div className="zxpt-divider" />
              <div className="zxpt-stat"><span className="k">Plan mensual</span><span className="v">{fmtMoney(billing.monthly)}</span></div>
              <div className="zxpt-stat"><span className="k">Cobro del mes</span><span className={`v ${billing.charge_status === "cobrado" ? "paid" : ""}`}>{chargeLabel}</span></div>
            </div>
          </div>

          <div className="zxpt-soon">Próximamente: inversión en anuncios, costo por lead y alcance en redes.</div>
        </div>
      </div>
    </Layout>
  );
};

export default ClientDashboard;
