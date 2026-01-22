import React, { useState, useEffect } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";

const PublicRegister = () => {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    birthdate: "",
    curp: "",
    address: "",
    employment: "",
    income: "",
    promotion_id: "",
  });

  const [promotions, setPromotions] = useState([]);
  const [files, setFiles] = useState({});

  useEffect(() => {
    const fetchPromotions = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/promotions/active`);
        setPromotions(res.data);
      } catch (err) {
        console.error("Error loading promotions:", err);
      }
    };
    fetchPromotions();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setFiles({ ...files, [e.target.name]: e.target.files[0] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();

    Object.entries(form).forEach(([key, value]) => {
      const parsedValue = key === "promotion_id" ? parseInt(value, 10) : value;
      data.append(key, parsedValue);
    });

    Object.entries(files).forEach(([key, file]) => {
      data.append(key, file);
    });

    try {
      await axios.post(`${API_BASE_URL}/public/apply`, data);
      alert("✅ Tu solicitud fue enviada con éxito");
    } catch (err) {
      console.error("❌ Error in public register:", err);
      alert("❌ Error al enviar la solicitud");
    }
  };

  return (
    <Layout>
    <div className="container mt-5">
      <h2>Solicitud de registro</h2>
      <form onSubmit={handleSubmit} encType="multipart/form-data">
        <label>Selecciona una promoción</label>
        <select
          name="promotion_id"
          value={form.promotion_id}
          onChange={handleChange}
          className="form-control mb-3"
        >
          <option value="">Promo JJ -</option>
          {promotions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        {["first_name", "last_name", "phone", "email", "birthdate", "curp", "address", "employment", "income"].map((field) => (
          <input
            key={field}
            type={field === "birthdate" ? "date" : "text"}
            name={field}
            placeholder={field.replace("_", " ")}
            value={form[field]}
            onChange={handleChange}
            className="form-control mb-2"
          />
        ))}
        <label>INE</label>
        <input type="file" name="ife" onChange={handleFileChange} className="form-control mb-2" />
        <label>Buró de crédito</label>
        <input type="file" name="credit_bureau" onChange={handleFileChange} className="form-control mb-2" />
        <label>Selfie</label>
        <input type="file" name="selfie" onChange={handleFileChange} className="form-control mb-2" />
        <label>Video de confirmación</label>
        <input type="file" name="video" onChange={handleFileChange} className="form-control mb-2" />
        <button type="submit" className="btn btn-primary mt-3">Enviar solicitud</button>
      </form>
    </div>
    </Layout>
  );
};

export default PublicRegister;