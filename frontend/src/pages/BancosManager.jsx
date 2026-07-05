import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./Bancos.css";

const fmtMoney = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n) || 0);
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const maskAccount = (n) => (n ? `••${String(n).slice(-4)}` : "");

// Categorize-without-invoice options (ignore with a tag).
const IGNORE_TAGS = [
  { tag: "TAX_PAYMENT", label: "Impuestos" },
  { tag: "COMISION", label: "Comisión bancaria" },
  { tag: "PAYROLL_NO_CFDI", label: "Nómina sin CFDI" },
  { tag: "INTERNAL_TRANSFER", label: "Transferencia entre cuentas" },
  { tag: "NON_DEDUCTIBLE", label: "No deducible" },
  { tag: "OTHER", label: "Ignorar" },
];
const TAG_LABEL = Object.fromEntries(IGNORE_TAGS.map((t) => [t.tag, t.label]));

const FILTERS = [
  { id: "", label: "Todos", key: null },
  { id: "UNMATCHED", label: "Sin conciliar", key: "UNMATCHED" },
  { id: "MATCHED", label: "Conciliados", key: "MATCHED" },
  { id: "IGNORED", label: "Ignorados", key: "IGNORED" },
];

const CONF_LABEL = { alta: "Alta", media: "Media", baja: "Baja" };

const BancosManager = () => {
  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);
  const [accounts, setAccounts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loadingAccts, setLoadingAccts] = useState(true);
  const [txState, setTxState] = useState({ loading: false, transactions: [], counts: { UNMATCHED: 0, MATCHED: 0, IGNORED: 0 } });
  const [filter, setFilter] = useState("");
  const [importReport, setImportReport] = useState(null);
  const [showDescartadas, setShowDescartadas] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(null); // txId whose candidates are open
  const [candidates, setCandidates] = useState({ loading: false, items: [] });
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);

  const active = accounts.find((a) => a.id === activeId) || null;

  const flash = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(null), 3200); }, []);

  const loadAccounts = useCallback(async () => {
    setLoadingAccts(true);
    try {
      const r = await axios.get(`${API_BASE_URL}/api/bancos/accounts`, { headers });
      const list = r.data?.accounts || [];
      setAccounts(list);
      setActiveId((prev) => prev && list.some((a) => a.id === prev) ? prev : (list[0]?.id ?? null));
    } catch {
      setAccounts([]);
    } finally {
      setLoadingAccts(false);
    }
  }, [headers]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const loadTransactions = useCallback(async () => {
    if (!activeId) return;
    setTxState((s) => ({ ...s, loading: true }));
    try {
      const q = filter ? `?status=${filter}` : "";
      const r = await axios.get(`${API_BASE_URL}/api/bancos/accounts/${activeId}/transactions${q}`, { headers });
      setTxState({ loading: false, transactions: r.data?.transactions || [], counts: r.data?.counts || { UNMATCHED: 0, MATCHED: 0, IGNORED: 0 } });
    } catch {
      setTxState({ loading: false, transactions: [], counts: { UNMATCHED: 0, MATCHED: 0, IGNORED: 0 } });
    }
  }, [activeId, filter, headers]);

  useEffect(() => { loadTransactions(); setExpanded(null); }, [loadTransactions]);

  // ---- upload ----
  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeId) return;
    setBusy(true);
    setImportReport(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await axios.post(`${API_BASE_URL}/api/bancos/accounts/${activeId}/upload`, form, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });
      setImportReport(r.data);
      flash(`${r.data.imported} movimientos importados${r.data.autoMatched ? ` · ${r.data.autoMatched} conciliados` : ""}`);
      await Promise.all([loadTransactions(), loadAccounts()]);
    } catch (err) {
      const d = err.response?.data;
      setImportReport({ error: d?.message || "No se pudo importar", descartadas: d?.descartadas, warnings: d?.warnings });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const autoConciliar = async () => {
    if (!activeId) return;
    setBusy(true);
    try {
      const r = await axios.post(`${API_BASE_URL}/api/bancos/accounts/${activeId}/auto-conciliar`, {}, { headers });
      flash(r.data.matched ? `${r.data.matched} movimientos conciliados automáticamente` : "Sin coincidencias automáticas");
      await Promise.all([loadTransactions(), loadAccounts()]);
    } catch {
      flash("No se pudo conciliar automáticamente");
    } finally {
      setBusy(false);
    }
  };

  // ---- per-tx actions ----
  const toggleExpand = async (tx) => {
    if (expanded === tx.id) { setExpanded(null); return; }
    setExpanded(tx.id);
    setCandidates({ loading: true, items: [] });
    try {
      const r = await axios.get(`${API_BASE_URL}/api/bancos/transactions/${tx.id}/candidates`, { headers });
      setCandidates({ loading: false, items: r.data?.candidates || [] });
    } catch {
      setCandidates({ loading: false, items: [] });
    }
  };

  const patchTx = async (txId, body, okMsg) => {
    setBusy(true);
    try {
      await axios.patch(`${API_BASE_URL}/api/bancos/transactions/${txId}`, body, { headers });
      if (okMsg) flash(okMsg);
      setExpanded(null);
      await Promise.all([loadTransactions(), loadAccounts()]);
    } catch (err) {
      flash(err.response?.data?.message || "No se pudo actualizar");
    } finally {
      setBusy(false);
    }
  };

  const confirmMatch = (txId, cand) =>
    patchTx(txId, { action: "match", matched_type: cand.type, matched_id: cand.id }, "Movimiento conciliado");
  const ignoreTx = (txId, tag) => patchTx(txId, { action: "ignore", category_tag: tag }, "Movimiento categorizado");
  const unmatch = (txId) => patchTx(txId, { action: "unmatch" });
  const unignore = (txId) => patchTx(txId, { action: "unignore" });

  // ---- render ----
  return (
    <Layout>
      <div className="zxbnk">
        <div className="zxbnk-inner">
          <div className="zxbnk-head">
            <div>
              <div className="eyebrow">Finanzas</div>
              <h1>Conciliación <span className="zxbnk-serif">bancaria</span></h1>
            </div>
            <button className="zxbnk-btn primary" onClick={() => setShowAccountModal(true)}>Agregar cuenta</button>
          </div>

          {loadingAccts ? (
            <div className="zxbnk-loading">Cargando cuentas…</div>
          ) : accounts.length === 0 ? (
            <div className="zxbnk-empty">
              <div className="lead">Sin cuentas bancarias</div>
              <div>Agrega una cuenta para empezar a cargar estados de cuenta y conciliar movimientos.</div>
              <button className="zxbnk-btn primary" onClick={() => setShowAccountModal(true)}>Agregar cuenta</button>
            </div>
          ) : (
            <>
              {/* account selector */}
              <div className="zxbnk-accounts">
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    className={`zxbnk-acct${a.id === activeId ? " active" : ""}`}
                    onClick={() => setActiveId(a.id)}
                  >
                    <span className="b">{a.banco}</span>
                    <span className="n">{a.nombre || maskAccount(a.numero_cuenta)}</span>
                    {a.counts.UNMATCHED > 0 && <span className="zxbnk-dot">{a.counts.UNMATCHED}</span>}
                  </button>
                ))}
              </div>

              {active && (
                <div className="zxbnk-card">
                  <div className="zxbnk-card-top">
                    <div>
                      <div className="zxbnk-card-title">{active.nombre || active.banco}</div>
                      <div className="zxbnk-card-meta">
                        {active.banco} · {maskAccount(active.numero_cuenta) || "sin número"}
                        {active.titular ? ` · ${active.titular}` : ""}
                      </div>
                    </div>
                    <div className="zxbnk-card-saldo">
                      <span className="k">Saldo en banco</span>
                      <span className="v">{active.saldo != null ? fmtMoney(active.saldo) : "—"}</span>
                    </div>
                  </div>
                  <div className="zxbnk-card-actions">
                    <label className={`zxbnk-btn${busy ? " disabled" : ""}`}>
                      Cargar estado de cuenta
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".csv,.txt,.ofx,.qfx,.xlsx,.xls,.xlsm"
                        onChange={onUpload}
                        disabled={busy}
                        hidden
                      />
                    </label>
                    <button className="zxbnk-btn" onClick={autoConciliar} disabled={busy}>
                      Conciliar automáticamente
                    </button>
                    <span className="zxbnk-card-status">
                      {active.counts.UNMATCHED > 0
                        ? `${active.counts.UNMATCHED} por conciliar`
                        : "Todo cuadrado"}
                    </span>
                  </div>
                </div>
              )}

              {/* import report */}
              {importReport && (
                <div className={`zxbnk-report${importReport.error ? " error" : ""}`}>
                  {importReport.error ? (
                    <div className="zxbnk-report-lead">{importReport.error}</div>
                  ) : (
                    <div className="zxbnk-report-lead">
                      {importReport.imported} importados
                      {importReport.duplicates ? ` · ${importReport.duplicates} duplicados omitidos` : ""}
                      {importReport.categorized ? ` · ${importReport.categorized} categorizados` : ""}
                      {importReport.autoMatched ? ` · ${importReport.autoMatched} conciliados` : ""}
                      {importReport.descartadas?.length ? ` · ${importReport.descartadas.length} filas descartadas` : ""}
                    </div>
                  )}
                  {importReport.descartadas?.length > 0 && (
                    <>
                      <button className="zxbnk-link" onClick={() => setShowDescartadas((v) => !v)}>
                        {showDescartadas ? "Ocultar" : "Ver"} filas descartadas
                      </button>
                      {showDescartadas && (
                        <ul className="zxbnk-descartadas">
                          {importReport.descartadas.map((d, i) => (
                            <li key={i}>Fila {d.fila}: {d.motivo}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                  <button className="zxbnk-report-close" onClick={() => setImportReport(null)}>Cerrar</button>
                </div>
              )}

              {/* filters */}
              <div className="zxbnk-filters">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    className={`zxbnk-filter${filter === f.id ? " active" : ""}`}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label}
                    {f.key && <span className="c">{txState.counts[f.key] ?? 0}</span>}
                  </button>
                ))}
              </div>

              {/* transactions */}
              {txState.loading ? (
                <div className="zxbnk-loading">Cargando movimientos…</div>
              ) : txState.transactions.length === 0 ? (
                <div className="zxbnk-empty small">
                  <div className="lead">Sin movimientos</div>
                  <div>Carga un estado de cuenta para ver los movimientos aquí.</div>
                </div>
              ) : (
                <div className="zxbnk-tx-list">
                  {txState.transactions.map((tx) => (
                    <div key={tx.id} className={`zxbnk-tx s-${tx.status.toLowerCase()}`}>
                      <div className="zxbnk-tx-row">
                        <div className="zxbnk-tx-main">
                          <div className="zxbnk-tx-desc">{tx.descripcion}</div>
                          <div className="zxbnk-tx-sub">
                            {fmtDate(tx.fecha)}
                            {tx.referencia ? ` · Ref. ${tx.referencia}` : ""}
                            {tx.saldo != null ? ` · Saldo ${fmtMoney(tx.saldo)}` : ""}
                          </div>
                          {tx.status === "MATCHED" && tx.match && (
                            <div className="zxbnk-tx-link">
                              Conciliado con {tx.match.label}{tx.match.party ? ` · ${tx.match.party}` : ""}
                            </div>
                          )}
                          {tx.status === "IGNORED" && (
                            <div className="zxbnk-tx-tag">{TAG_LABEL[tx.category_tag] || "Ignorado"}</div>
                          )}
                        </div>
                        <div className="zxbnk-tx-amt-col">
                          <div className={`zxbnk-tx-amt ${Number(tx.monto) >= 0 ? "pos" : "neg"}`}>
                            {Number(tx.monto) >= 0 ? "+" : "−"}{fmtMoney(Math.abs(Number(tx.monto)))}
                          </div>
                          {tx.status === "UNMATCHED" && (
                            <button className="zxbnk-link" onClick={() => toggleExpand(tx)} disabled={busy}>
                              {expanded === tx.id ? "Cerrar" : "Buscar coincidencia"}
                            </button>
                          )}
                          {tx.status === "MATCHED" && (
                            <button className="zxbnk-link danger" onClick={() => unmatch(tx.id)} disabled={busy}>Desconciliar</button>
                          )}
                          {tx.status === "IGNORED" && (
                            <button className="zxbnk-link" onClick={() => unignore(tx.id)} disabled={busy}>Reabrir</button>
                          )}
                        </div>
                      </div>

                      {expanded === tx.id && tx.status === "UNMATCHED" && (
                        <div className="zxbnk-match">
                          <div className="zxbnk-match-head">Coincidencias sugeridas</div>
                          {candidates.loading ? (
                            <div className="zxbnk-match-loading">Buscando…</div>
                          ) : candidates.items.length === 0 ? (
                            <div className="zxbnk-match-empty">Sin coincidencias. Categoriza el movimiento abajo.</div>
                          ) : (
                            <div className="zxbnk-cands">
                              {candidates.items.map((c) => (
                                <div key={`${c.type}-${c.id}`} className="zxbnk-cand">
                                  <div className="zxbnk-cand-main">
                                    <span className="l">{c.label}</span>
                                    {c.party && <span className="p">{c.party}</span>}
                                  </div>
                                  <div className="zxbnk-cand-meta">
                                    <span>{fmtMoney(c.amount)}</span>
                                    <span>{fmtDate(c.date)}</span>
                                    <span className={`zxbnk-conf ${c.confidence}`}>{CONF_LABEL[c.confidence] || c.confidence}</span>
                                  </div>
                                  <button className="zxbnk-btn sm" onClick={() => confirmMatch(tx.id, c)} disabled={busy}>Conciliar</button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="zxbnk-cat">
                            <span className="zxbnk-cat-label">o categoriza sin factura:</span>
                            {IGNORE_TAGS.map((t) => (
                              <button key={t.tag} className="zxbnk-chip" onClick={() => ignoreTx(tx.id, t.tag)} disabled={busy}>
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {showAccountModal && (
          <AccountModal
            headers={headers}
            onClose={() => setShowAccountModal(false)}
            onSaved={async (acct) => { setShowAccountModal(false); await loadAccounts(); if (acct?.id) setActiveId(acct.id); }}
            flash={flash}
          />
        )}

        {toast && <div className="zxbnk-toast">{toast}</div>}
      </div>
    </Layout>
  );
};

// ---- add-account modal ----
const BANCOS = ["BBVA", "Banorte", "Santander", "Banamex", "HSBC", "Scotiabank", "Banregio", "Inbursa", "Afirme", "Otro"];
const TIPOS = [
  { id: "cheques", label: "Cheques" },
  { id: "tarjeta", label: "Tarjeta" },
  { id: "caja", label: "Caja" },
];

const AccountModal = ({ headers, onClose, onSaved, flash }) => {
  const [form, setForm] = useState({ banco: "BBVA", nombre: "", numero_cuenta: "", clabe: "", moneda: "MXN", tipo: "cheques", titular: "" });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.banco) { flash("El banco es obligatorio"); return; }
    setSaving(true);
    try {
      const r = await axios.post(`${API_BASE_URL}/api/bancos/accounts`, form, { headers });
      onSaved(r.data);
    } catch (err) {
      flash(err.response?.data?.message || "No se pudo crear la cuenta");
      setSaving(false);
    }
  };

  return (
    <div className="zxbnk-scrim" onClick={onClose}>
      <div className="zxbnk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="zxbnk-modal-head">Agregar cuenta bancaria</div>
        <div className="zxbnk-modal-body">
          <label>Banco
            <select value={form.banco} onChange={set("banco")}>
              {BANCOS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <label>Nombre / alias
            <input type="text" value={form.nombre} onChange={set("nombre")} placeholder="p. ej. Cuenta operativa" />
          </label>
          <label>Número de cuenta
            <input type="text" value={form.numero_cuenta} onChange={set("numero_cuenta")} />
          </label>
          <label>CLABE
            <input type="text" value={form.clabe} onChange={set("clabe")} />
          </label>
          <div className="zxbnk-modal-row">
            <label>Tipo
              <select value={form.tipo} onChange={set("tipo")}>
                {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label>Moneda
              <select value={form.moneda} onChange={set("moneda")}>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </label>
          </div>
          <label>Titular
            <input type="text" value={form.titular} onChange={set("titular")} />
          </label>
        </div>
        <div className="zxbnk-modal-foot">
          <button className="zxbnk-btn" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="zxbnk-btn primary" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
};

export default BancosManager;
