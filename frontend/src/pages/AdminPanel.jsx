import React, { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [statusUpdate, setStatusUpdate] = useState({});
  const token = localStorage.getItem("token");

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/users`, { headers });
      setUsers(res.data);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const fetchLoans = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/loans`, { headers });
      setLoans(res.data);
    } catch (err) {
      console.error("Error fetching loans:", err);
    }
  };

  const deleteUser = async (id) => {
    try {
      await axios.delete(`${API_BASE_URL}/admin/users/${id}`, { headers });
      fetchUsers();
    } catch (err) {
      console.error("Error deleting user:", err);
    }
  };

  const deleteLoan = async (id) => {
    try {
      await axios.delete(`${API_BASE_URL}/admin/loans/${id}`, { headers });
      fetchLoans();
    } catch (err) {
      console.error("Error deleting loan:", err);
    }
  };

  const updateLoanStatus = async (id) => {
    try {
      await axios.put(
        `${API_BASE_URL}/admin/loans/${id}`,
        { status: statusUpdate[id] || "approved" },
        { headers }
      );
      fetchLoans();
    } catch (err) {
      console.error("Error updating loan status:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchLoans();
  }, []);

  return (
    <Layout>
    <div className="container mt-5">
      <h2 className="mb-4">Panel de Administración</h2>

      <h4>Usuarios Registrados</h4>
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Rol</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.role}</td>
              <td>
                <button className="btn btn-danger btn-sm" onClick={() => deleteUser(user.id)}>
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 className="mt-5">Préstamos Activos</h4>
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>ID</th>
            <th>ID Usuario</th>
            <th>Monto</th>
            <th>Término</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => (
            <tr key={loan.id}>
              <td>{loan.id}</td>
              <td>{loan.user_id}</td>
              <td>${loan.amount}</td>
              <td>{loan.term} semanas</td>
              <td>{loan.status}</td>
              <td>
                <input
                  type="text"
                  className="form-control form-control-sm mb-1"
                  placeholder="Nuevo estado"
                  onChange={(e) =>
                    setStatusUpdate({ ...statusUpdate, [loan.id]: e.target.value })
                  }
                />
                <button
                  className="btn btn-primary btn-sm me-2"
                  onClick={() => updateLoanStatus(loan.id)}
                >
                  Actualizar
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => deleteLoan(loan.id)}
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </Layout>
  );
};

export default AdminPanel;