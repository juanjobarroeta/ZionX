import React, { useState, useEffect } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [message, setMessage] = useState("");

  // Check if user is already logged in with valid token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        // Check if token is valid and not expired
        if (payload && payload.id && payload.exp && payload.exp > Date.now() / 1000) {
          console.log("User already logged in with valid token, redirecting to dashboard");
          window.location.href = "/dashboard";
        } else {
          console.log("Token expired or invalid, clearing and staying on auth page");
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }
      } catch (error) {
        console.log("Invalid token format, clearing and staying on auth page");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = isLogin ? "/login" : "/register";
      const res = await axios.post(`${API_BASE_URL}${endpoint}`, form);
      localStorage.setItem("token", res.data.token);
      if (res.data.user) {
        localStorage.setItem("user", JSON.stringify(res.data.user));
        // Store role separately for easy access by Sidebar and route protection
        localStorage.setItem("userRole", res.data.user.role || 'user');
        localStorage.setItem("userId", res.data.user.id);
        localStorage.setItem("userName", res.data.user.name);
      }
      console.log("Token received:", res.data.token);
      console.log("User role:", res.data.user?.role);
      setMessage(res.data.message);
      window.location.href = "/dashboard";
    } catch (error) {
      if (error.response) {
        setMessage("Error: " + error.response.data.message);
      } else if (error.request) {
        setMessage("No response from server. Is it running?");
      } else {
        setMessage("Unexpected error: " + error.message);
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-surface-50 to-surface-100 text-neutral-800 px-4">
      <div className="flex flex-col items-center">
        <div className="mb-6 w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
          <span className="text-neutral-800 font-bold text-2xl">F</span>
        </div>
        <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-xl border border-neutral-200">
          <h2 className="mb-6 text-2xl font-semibold text-center text-primary-600">
            {isLogin ? "Sign In" : "Sign Up"}
          </h2>
          {message && (
            <div className="mb-4 p-3 text-center text-sm text-blue-700 bg-blue-100 rounded">
              {message}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="mb-4">
                <label className="block mb-1 text-gray-700 font-medium" htmlFor="name">
                  Nombre
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-primary-500 bg-white text-neutral-800 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}
            <div className="mb-4">
              <label className="block mb-1 text-gray-700 font-medium" htmlFor="email">
                Correo Electrónico
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-primary-500 bg-white text-neutral-800 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="mb-6">
              <label className="block mb-1 text-gray-700 font-medium" htmlFor="password">
                Contraseña
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-primary-500 bg-white text-neutral-800 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-primary-500 text-neutral-800 font-semibold rounded hover:bg-white hover:text-primary-500 transition"
            >
              {isLogin ? "Ingresar" : "Registrarse"}
            </button>
          </form>
          <p className="mt-6 text-center text-gray-600">
            {isLogin ? "¿No tienes una cuenta?" : "¿Ya tienes una cuenta?"}{" "}
            <button
              className="text-primary-500 hover:underline font-medium"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? "Registrarse" : "Iniciar Sesión"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;