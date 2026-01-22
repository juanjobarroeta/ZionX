import React, { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";

const AdminPromotions = () => {
  const token = localStorage.getItem("token");
  const [promotions, setPromotions] = useState([]);
  const [financialProducts, setFinancialProducts] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    product_id: "",
    financial_product_id: "",
    is_active: true,
  });

  const fetchPromotions = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/promotions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPromotions(res.data);
    } catch (err) {
      console.error("Error fetching promotions:", err);
    }
  };

  const fetchFinancialProducts = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/financial-products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFinancialProducts(res.data);
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
      await axios.post(`${API_BASE_URL}/promotions`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setForm({
        title: "",
        description: "",
        price: "",
        product_id: "",
        financial_product_id: "",
        is_active: true,
      });
      fetchPromotions();
    } catch (err) {
      console.error("Error creating promotion:", err);
    }
  };

  useEffect(() => {
    fetchPromotions();
    fetchFinancialProducts();
  }, []);

  return (
    <Layout>
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <h2 className="text-xl font-semibold mb-6 text-neutral-800">Gestión de Promociones</h2>

      <form onSubmit={handleSubmit} className="row g-3 mb-5">
        <div className="col-md-6">
          <input
            type="text"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
            placeholder="TÍTULO"
            name="title"
            value={form.title}
            onChange={handleChange}
            required
          />
        </div>
        <div className="col-md-6">
          <input
            type="text"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
            placeholder="DESCRIPCIÓN"
            name="description"
            value={form.description}
            onChange={handleChange}
          />
        </div>
        <div className="col-md-6">
          <input
            type="number"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
            placeholder="PRECIO"
            name="price"
            value={form.price}
            onChange={handleChange}
            required
          />
        </div>
        <div className="col-md-6">
          <input
            type="text"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
            placeholder="PRODUCTO"
            name="product_id"
            value={form.product_id}
            onChange={handleChange}
            required
          />
        </div>
        <div className="col-md-6">
          <select
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
            name="financial_product_id"
            value={form.financial_product_id}
            onChange={handleChange}
            required
          >
            <option value="">Seleccionar Financiamiento</option>
            {financialProducts.map((fp) => (
              <option key={fp.id} value={fp.id}>
                {fp.title} - {fp.interest_rate}% / {fp.term_weeks} semanas
              </option>
            ))}
          </select>
        </div>
        <div className="col-12">
          <button className="mt-2 bg-primary-500 hover:bg-primary-600 text-neutral-800 font-medium py-2 px-4 rounded">Crear Promoción</button>
        </div>
      </form>

      <h3 className="text-lg font-semibold mt-10 mb-4 text-neutral-800">Promociones existentes</h3>
      <div className="bg-white border-t-4 border-lime-500 rounded-md overflow-x-auto">
        <table className="min-w-full text-sm text-neutral-800">
          <thead className="bg-primary-500 text-neutral-800">
            <tr>
              <th>Título</th>
              <th>Producto</th>
              <th>Financiamiento</th>
              <th>Activo</th>
            </tr>
          </thead>
          <tbody>
            {promotions.map((promo) => (
              <tr key={promo.id} className="border-t border-neutral-200 hover:bg-white">
                <td>{promo.title}</td>
                <td>{promo.product_id}</td>
                <td>{promo.financial_product_id}</td>
                <td>{promo.is_active ? "Sí" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </Layout>
  );
};

export default AdminPromotions;
