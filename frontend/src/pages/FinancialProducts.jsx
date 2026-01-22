import { API_BASE_URL } from "../utils/constants";
import React, { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";

const FinancialProducts = () => {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    title: "",
    interest_rate: "",
    term_weeks: "",
    payment_frequency: "",
    penalty_fee: "",
    down_payment: "",
    notes: "",
  });

  const token = localStorage.getItem("token");

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/financial-products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts(res.data);
    } catch (err) {
      console.error("Error fetching financial products:", err);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        interest_rate: parseFloat(form.interest_rate),
        penalty_fee: parseFloat(form.penalty_fee),
        down_payment: parseFloat(form.down_payment),
        term_weeks: parseInt(form.term_weeks),
      };

      const response = await axios.post(`${API_BASE_URL}/financial-products`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("Financial product created:", response.data);
      alert("Producto financiero creado correctamente");

      fetchProducts();
      setForm({
        title: "",
        interest_rate: "",
        term_weeks: "",
        payment_frequency: "",
        penalty_fee: "",
        down_payment: "",
        notes: "",
      });
    } catch (err) {
      console.error("Error creating financial product:", err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return (
    <Layout>
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <h2 className="mb-4">Productos Financieros</h2>

      <form className="mb-5" onSubmit={handleSubmit}>
        <div className="row g-3">
          <div className="col-md-4">
            <input
              type="text"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
              name="title"
              value={form.title}
              placeholder="Nombre del producto"
              onChange={handleChange}
            />
          </div>
          <div className="col-md-4">
            <input
              type="text"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
              name="interest_rate"
              value={form.interest_rate}
              placeholder="Tasa de interés (%)"
              onChange={handleChange}
            />
          </div>
          <div className="col-md-4">
            <input
              type="text"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
              name="term_weeks"
              value={form.term_weeks}
              placeholder="Plazo (semanas)"
              onChange={handleChange}
            />
          </div>
          <div className="col-md-4">
            <select
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
              name="payment_frequency"
              value={form.payment_frequency}
              onChange={handleChange}
            >
              <option value="">Frecuencia de pago</option>
              <option value="diario">Diario</option>
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
          <div className="col-md-4">
            <input
              type="text"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
              name="penalty_fee"
              value={form.penalty_fee}
              placeholder="Penalización ($)"
              onChange={handleChange}
            />
          </div>
          <div className="col-md-4">
            <input
              type="text"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
              name="down_payment"
              value={form.down_payment}
              placeholder="Enganche ($)"
              onChange={handleChange}
            />
          </div>
          <div className="col-md-4">
            <input
              type="text"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
              name="notes"
              value={form.notes}
              placeholder="Notas"
              onChange={handleChange}
            />
          </div>
        </div>
        <button type="submit" className="mt-4 bg-primary-500 hover:bg-primary-600 text-neutral-800 font-medium py-2 px-4 rounded">
          Agregar producto financiero
        </button>
      </form>

      <h3 className="text-lg font-semibold mt-10 mb-4 text-neutral-800">Plantillas existentes</h3>
      <div className="bg-white border-t-4 border-lime-500 rounded-md overflow-x-auto">
        <table className="min-w-full text-sm text-neutral-800">
          <thead className="bg-primary-500 text-neutral-800">
            <tr>
              <th>Nombre</th>
              <th>Interés</th>
              <th>Plazo</th>
              <th>Frecuencia</th>
              <th>Enganche</th>
              <th>Penalización</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-neutral-200 hover:bg-white">
                <td>{p.title}</td>
                <td>{p.interest_rate}%</td>
                <td>{p.term_weeks} semanas</td>
                <td>{p.payment_frequency}</td>
                <td>${p.down_payment}</td>
                <td>${p.penalty_fee}</td>
                <td>{p.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </Layout>
  );
};

export default FinancialProducts;
