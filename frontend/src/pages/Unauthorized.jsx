import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { getRoleInfo } from '../config/roles';

const Unauthorized = () => {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole') || 'user';
  const roleInfo = getRoleInfo(userRole);

  // Determine best redirect based on role
  const getHomeForRole = () => {
    switch (userRole) {
      case 'community_manager':
      case 'designer':
      case 'copywriter':
        return '/employee-dashboard';
      case 'accountant':
        return '/income';
      case 'hr_manager':
        return '/people';
      case 'account_manager':
        return '/clientes';
      default:
        return '/dashboard';
    }
  };

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full text-center">
          {/* Icon */}
          <div className="w-24 h-24 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-5xl">🚫</span>
          </div>
          
          {/* Message */}
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Acceso No Autorizado
          </h1>
          <p className="text-gray-600 mb-6">
            No tienes permisos para acceder a esta página.
          </p>
          
          {/* Role Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl">{roleInfo?.icon || '👤'}</span>
              <div className="text-left">
                <p className="font-medium text-gray-900">{roleInfo?.name || 'Usuario'}</p>
                <p className="text-sm text-gray-500">{roleInfo?.description || ''}</p>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
            >
              ← Volver
            </button>
            <Link
              to={getHomeForRole()}
              className="px-6 py-3 bg-black hover:bg-gray-800 text-white rounded-xl font-medium transition-colors"
            >
              Ir a mi área →
            </Link>
          </div>
          
          {/* Help */}
          <p className="text-sm text-gray-400 mt-8">
            Si crees que deberías tener acceso, contacta a tu administrador.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Unauthorized;

