import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Layout from "../components/Layout";
import { format } from "date-fns";

const ProductProfile = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await axios.get(
          `http://localhost:5001/inventory-items/${id}/details`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );
        setProduct(response.data.product ?? response.data);
        console.log("Response data for product details:", response.data);
        setHistory(response.data.history || []);
      } catch (error) {
        console.error("Error loading product:", error);
      }
    };

    fetchProduct();
  }, [id]);

  if (!product) return <Layout><div>Cargando producto...</div></Layout>;

  return (
    <Layout>
      <nav className="text-sm text-neutral-600 mb-4">
        <a href="/admin/inventory" className="hover:underline text-primary-600">Inventario</a> &raquo; <span className="text-neutral-800">Producto #{id}</span>
      </nav>
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-xl border border-neutral-200">
        <h1 className="text-xl font-semibold text-neutral-800 mb-4">Perfil del Producto</h1>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-neutral-800 text-sm">
          <div><strong>Modelo:</strong> {product.model}</div>
          <div><strong>Marca:</strong> {product.brand}</div>
          <div><strong>Color:</strong> {product.color}</div>
          <div><strong>RAM:</strong> {product.ram}</div>
          <div><strong>Almacenamiento:</strong> {product.storage || product.almacenamiento}</div>
          <div><strong>IMEI:</strong> {product.imei || "No asignado"}</div>
          <div><strong>Sucursal:</strong> {product.store}</div>
          <div><strong>Estatus:</strong> {product.status}</div>
        </div>
      </div>

      <h2 className="mt-6 text-lg font-semibold">Historial de Movimientos</h2>
      {history.length === 0 ? (
        <p>No hay historial registrado.</p>
      ) : (
        <table className="mt-2 w-full text-sm border border-neutral-200">
          <thead className="bg-white text-neutral-800">
            <tr>
              <th className="p-2 border">Fecha</th>
              <th className="p-2 border">Acción</th>
              <th className="p-2 border">Responsable</th>
              <th className="p-2 border">Sucursal</th>
              <th className="p-2 border">Notas</th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry, idx) => (
              <tr key={idx} className="border-t border-neutral-200">
                <td className="p-2 border">{format(new Date(entry.date), "dd MMM yyyy - HH:mm")}</td>
                <td className="p-2 border">{entry.action}</td>
                <td className="p-2 border">{entry.actor}</td>
                <td className="p-2 border">{entry.store}</td>
                <td className="p-2 border">{entry.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
};

export default ProductProfile;