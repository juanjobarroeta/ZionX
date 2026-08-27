import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import PageShell from "../components/PageShell";
import { API_BASE_URL } from "../utils/constants";
import { customerName, customerContact } from "../utils/customerName";
import "./Directory.css";

const CustomerDirectoryClean = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API_BASE_URL}/customers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCustomers(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error("Error fetching customers:", error);
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  // Archive = reversible soft-delete: removes the client from the directory but
  // keeps its ledger, files and content intact (restorable from the backend).
  const archive = async (c) => {
    const label = customerName(c);
    if (!window.confirm(`¿Archivar a "${label}"?\n\nSe quitará del directorio pero se conserva toda su información (contenido, archivos, facturación). Es reversible.`)) return;
    try {
      setBusyId(c.id);
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/customers/${c.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCustomers((prev) => prev.filter((x) => x.id !== c.id));
    } catch (error) {
      console.error("Error archiving customer:", error);
      alert(error.response?.data?.message || "No se pudo archivar el cliente");
    } finally {
      setBusyId(null);
    }
  };

  const nameOf = customerName;
  const emailOf = (c) => c.contact_email || c.email || "";

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) =>
      [c.business_name, c.commercial_name, c.contact_email, c.email, c.industry]
        .some((v) => (v || "").toString().toLowerCase().includes(term))
    );
  }, [customers, search]);

  // Honest derived stats (no fabricated numbers).
  const stats = useMemo(() => {
    const withEmail = customers.filter((c) => emailOf(c)).length;
    const industries = new Set(customers.map((c) => (c.industry || "").trim()).filter(Boolean)).size;
    return { total: customers.length, withEmail, industries };
  }, [customers]);

  return (
    <PageShell
      className="zxcr"
      eyebrow="Clientes"
      title="Directorio de"
      titleAccent="clientes"
      actions={<Link to="/create-customer" className="zx-btn on-ink">Nuevo cliente</Link>}
      telemetry={[
        { k: "Clientes", v: stats.total },
        { k: "Con correo", v: stats.withEmail },
        { k: "Industrias", v: stats.industries },
      ]}
    >

          <input
            className="zxcr-search"
            placeholder="Buscar por nombre, correo o industria…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {loading ? (
            <div className="zxcr-loading">Cargando clientes…</div>
          ) : filtered.length === 0 ? (
            <div className="zxcr-empty">
              <div className="lead">{customers.length === 0 ? "Aún no hay clientes" : "Sin resultados"}</div>
              {customers.length === 0 && <Link to="/create-customer">+ Crear el primer cliente</Link>}
            </div>
          ) : (
            <div className="zxcr-list">
              {filtered.map((c) => (
                <div key={c.id} className="zxcr-rowwrap">
                  <Link to={`/customer/${c.id}`} className="zxcr-row">
                    <span className="zxcr-avatar">{nameOf(c).charAt(0).toUpperCase()}</span>
                    <div className="zxcr-who">
                      <div className="name">{nameOf(c)}</div>
                      <div className="sub">
                        {customerContact(c) && customerContact(c) !== nameOf(c) && <span>{customerContact(c)}</span>}
                        {emailOf(c) && <span>{emailOf(c)}</span>}
                        {c.industry && <span className="zxcr-tag">{c.industry}</span>}
                      </div>
                    </div>
                    <span className="zxcr-arrow">→</span>
                  </Link>
                  <button
                    className="zxcr-archive"
                    title="Archivar cliente (reversible)"
                    disabled={busyId === c.id}
                    onClick={() => archive(c)}
                  >
                    {busyId === c.id ? "…" : "Archivar"}
                  </button>
                </div>
              ))}
            </div>
          )}
    </PageShell>
  );
};

export default CustomerDirectoryClean;
