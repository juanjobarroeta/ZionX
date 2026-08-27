import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import { customerName } from "../utils/customerName";
import "./GlobalSearch.css";

// Command-K palette. Fetches customers + team once per open, filters locally as
// the user types, and supports full keyboard use (arrows + Enter + Esc).
const GlobalSearch = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState("");
  const [data, setData] = useState({ customers: [], team: [], loaded: false });
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setActive(0);
    // Focus after the modal paints.
    const t = setTimeout(() => inputRef.current?.focus(), 30);

    const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
    Promise.all([
      axios.get(`${API_BASE_URL}/customers`, { headers }).catch(() => ({ data: [] })),
      axios.get(`${API_BASE_URL}/team-members`, { headers }).catch(() => ({ data: {} })),
    ]).then(([c, t2]) => {
      setData({
        customers: Array.isArray(c.data) ? c.data : [],
        team: t2.data?.team_members || [],
        loaded: true,
      });
    });
    return () => clearTimeout(t);
  }, [isOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return { customers: [], team: [] };
    const customers = data.customers
      .map((c) => ({ ...c, display: customerName(c) }))
      .filter(
        (c) =>
          c.display?.toLowerCase().includes(q) ||
          c.business_name?.toLowerCase().includes(q) ||
          c.commercial_name?.toLowerCase().includes(q) ||
          c.contact_email?.toLowerCase().includes(q) ||
          c.contact_phone?.includes(q) ||
          c.phone?.includes(q)
      )
      .slice(0, 6);
    const team = data.team
      .filter((m) => m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q))
      .slice(0, 4);
    return { customers, team };
  }, [query, data]);

  // Flat list drives keyboard navigation across both sections.
  const flat = useMemo(
    () => [
      ...results.customers.map((c) => ({ type: "customer", item: c })),
      ...results.team.map((m) => ({ type: "team", item: m })),
    ],
    [results]
  );

  useEffect(() => setActive(0), [query]);

  if (!isOpen) return null;

  const select = (entry) => {
    if (!entry) return;
    navigate(entry.type === "customer" ? `/customer/${entry.item.id}` : `/employee/${entry.item.id}`);
    setQuery("");
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") return onClose();
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, flat.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter") { e.preventDefault(); select(flat[active] || flat[0]); }
  };

  const Row = ({ entry, index }) => {
    const isCustomer = entry.type === "customer";
    const label = isCustomer ? entry.item.display : entry.item.name;
    const sub = isCustomer ? entry.item.contact_email || entry.item.phone || "" : entry.item.role || "";
    return (
      <button
        className={`zxgs-row${index === active ? " active" : ""}`}
        onMouseEnter={() => setActive(index)}
        onClick={() => select(entry)}
      >
        <span className="zxgs-avatar">{(label || "?").charAt(0).toUpperCase()}</span>
        <span className="zxgs-rowmain">
          <span className="zxgs-rowtitle">{label}</span>
          {sub && <span className="zxgs-rowsub">{sub}</span>}
        </span>
        <span className="zxgs-go">→</span>
      </button>
    );
  };

  const empty = query.trim().length >= 2 && flat.length === 0;

  return (
    <div className="zxgs-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="zxgs-modal" onKeyDown={onKeyDown}>
        <div className="zxgs-inputrow">
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar clientes, equipo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="zxgs-input"
          />
        </div>

        <div className="zxgs-body">
          {query.trim().length < 2 ? (
            <div className="zxgs-hint">Escribe al menos 2 caracteres para buscar</div>
          ) : !data.loaded ? (
            <div className="zxgs-hint">Buscando…</div>
          ) : empty ? (
            <div className="zxgs-hint">Sin resultados para “{query.trim()}”</div>
          ) : (
            <>
              {results.customers.length > 0 && (
                <div className="zxgs-section">
                  <div className="zxgs-label">Clientes</div>
                  {results.customers.map((c, i) => (
                    <Row key={`c${c.id}`} entry={{ type: "customer", item: c }} index={i} />
                  ))}
                </div>
              )}
              {results.team.length > 0 && (
                <div className="zxgs-section">
                  <div className="zxgs-label">Equipo</div>
                  {results.team.map((m, i) => (
                    <Row key={`t${m.id}`} entry={{ type: "team", item: m }} index={results.customers.length + i} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="zxgs-foot">
          <span><kbd>↑↓</kbd> navegar</span>
          <span><kbd>Enter</kbd> abrir</span>
          <span><kbd>Esc</kbd> cerrar</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
