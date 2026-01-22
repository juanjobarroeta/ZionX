

import React, { useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";

const CreateInventory = () => {
  const [form, setForm] = useState({
    category: "",
    brand: "",
    model: "",
    color: "",
    ram: "",
    storage: "",
    purchase_price: "",
    sale_price: "",
    store: "",
  });

  const token = localStorage.getItem("token");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/inventory-items/manual`, form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("Producto agregado exitosamente");
      setForm({
        category: "",
        brand: "",
        model: "",
        color: "",
        ram: "",
        storage: "",
        purchase_price: "",
        sale_price: "",
        store: "",
      });
    } catch (err) {
      console.error("Error al agregar producto:", err);
      alert("Error al agregar producto");
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h2 className="text-neutral-800 text-xl font-bold mb-6">Agregar producto manualmente</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            ["category", "Categoría (ej. teléfono, tv, etc.)"],
            ["brand", "Marca"],
            ["model", "Modelo"],
            ["color", "Color"],
            ["ram", "RAM"],
            ["storage", "Almacenamiento"],
            ["purchase_price", "Precio de compra"],
            ["sale_price", "Precio de venta"],
            ["store", "Sucursal"],
          ].map(([key, label]) => (
            <input
              key={key}
              type="text"
              name={key}
              placeholder={label}
              value={form[key]}
              onChange={handleChange}
              className="p-2 bg-white border border-primary-500 text-neutral-800 rounded w-full"
            />
          ))}
        </div>
        <button
          onClick={handleSubmit}
          className="mt-6 bg-primary-500 hover:bg-primary-600 text-neutral-800 font-bold px-6 py-2 rounded transition"
        >
          Guardar producto
        </button>
      </div>
    </Layout>
  );
};

export default CreateInventory;