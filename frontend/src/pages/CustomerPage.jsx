import { API_BASE_URL } from "../utils/constants";
import React from "react";
import { Link } from "react-router-dom";

const CustomerList = ({ customers }) => {
  return (
    <div className="bg-white border-t-4 border-lime-500 rounded-md overflow-x-auto p-4">
      {!customers ? (
        <p className="text-neutral-800">Cargando clientes...</p>
      ) : (
        <table className="min-w-full text-sm text-neutral-800">
          <thead className="bg-primary-500 text-neutral-800">
            <tr>
              <th className="text-left px-4 py-2">Nombre</th>
              <th className="text-left px-4 py-2">Teléfono</th>
              <th className="text-left px-4 py-2">Correo</th>
              <th className="text-left px-4 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-t border-neutral-200 hover:bg-white">
                <td className="px-4 py-2">{customer.name}</td>
                <td className="px-4 py-2">{customer.phone}</td>
                <td className="px-4 py-2">{customer.email}</td>
                <td className="px-4 py-2">
                  <Link to={`/customer/${customer.id}`} className="text-primary-500 hover:underline">
                    Ver Perfil
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default CustomerList;