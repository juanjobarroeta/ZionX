import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../utils/constants";
import "./Landing.css";
import "./Auth.css";

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
          const role = localStorage.getItem("userRole");
          const creatorHome = ["designer", "community_manager", "copywriter"].includes(role);
          window.location.href = role === "client" ? "/portal" : creatorHome ? "/my-work" : "/dashboard";
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
      // Content creators land on their personal "Mi trabajo" home; everyone
      // else on the dashboard.
      const role = res.data.user?.role;
      const creatorHome = ["designer", "community_manager", "copywriter"].includes(role);
      window.location.href = role === "client" ? "/portal" : creatorHome ? "/my-work" : "/dashboard";
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

  const isError = message && /error|no response|unexpected/i.test(message);

  return (
    <div className="zx-auth">
      {/* Brand / art panel */}
      <div className="zx-auth-art">
        <img className="wordmark" src="/landing/logo-wordmark-white.webp" alt="ZIONX" />
        <div>
          <h1 className="tagline">
            Mission <span className="zx-auth-serif">control.</span>
          </h1>
          <p className="subtag">
            Sign in to run briefs, content calendars, budgets and reporting — all from one place.
          </p>
        </div>
        <span className="zx-auth-copyright">© 2026 ZIONX. All systems nominal.</span>
        <img className="zx-auth-planet" src="/landing/planet.webp" alt="" />
        <img className="zx-auth-astro" src="/landing/astronaut.webp" alt="Floating astronaut" />
      </div>

      {/* Form panel */}
      <div className="zx-auth-form-wrap">
        <div className="zx-auth-card">
          <div className="zx-auth-eyebrow">
            <span>ZIONX Platform</span>
          </div>
          <h2 className="zx-auth-title">{isLogin ? "Welcome back" : "Create account"}</h2>
          <p className="zx-auth-sub">
            {isLogin ? "Sign in to your mission control." : "Join the crew and get to work."}
          </p>

          {message && (
            <div className={`zx-auth-msg${isError ? " error" : ""}`}>{message}</div>
          )}

          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="zx-field">
                <label htmlFor="name">Nombre</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="Tu nombre"
                />
              </div>
            )}
            <div className="zx-field">
              <label htmlFor="email">Correo electrónico</label>
              <input
                type="email"
                id="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="tu@correo.com"
              />
            </div>
            <div className="zx-field">
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="zx-auth-submit">
              {isLogin ? "Ingresar" : "Registrarse"}
            </button>
          </form>

          <p className="zx-auth-switch">
            {isLogin ? "¿No tienes una cuenta?" : "¿Ya tienes una cuenta?"}{" "}
            <button type="button" onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? "Registrarse" : "Iniciar sesión"}
            </button>
          </p>
          <div className="zx-auth-back">
            <Link to="/">← Volver al inicio</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;