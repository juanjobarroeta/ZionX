import React, { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const CustomerImport = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop().toLowerCase();
      if (ext !== 'xlsx' && ext !== 'xls') {
        alert('Por favor selecciona un archivo Excel (.xlsx o .xls)');
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleDownloadTemplate = () => {
    window.open(`${API_BASE_URL}/api/customers/template`, '_blank');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!file) {
      alert('Por favor selecciona un archivo');
      return;
    }

    try {
      setUploading(true);
      const token = localStorage.getItem("token");
      
      const formData = new FormData();
      formData.append('file', file);

      const res = await axios.post(
        `${API_BASE_URL}/api/customers/import`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setResult(res.data);
      setFile(null);
      
      alert(`✅ Importación completada!\n\nImportados: ${res.data.imported}\nOmitidos: ${res.data.skipped}\nTotal: ${res.data.total}`);
      
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Error al importar: " + (error.response?.data?.error || error.message));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-zionx-secondary via-zionx-tertiary to-zionx-secondary">
        {/* Header */}
        <div className="bg-zionx-tertiary border-b border-zionx-secondary">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-black">📤 Importar Clientes Masivamente</h1>
                <p className="text-gray-500 text-sm mt-1">Sube un archivo Excel con tus clientes</p>
              </div>
              <Link
                to="/crm"
                className="bg-white border border-zionx-secondary px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Volver al CRM
              </Link>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Instructions Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-3">📋 Instrucciones</h2>
            <ol className="space-y-2 text-sm text-blue-800">
              <li>1. Descarga la plantilla de Excel (botón abajo)</li>
              <li>2. Llena la información de tus clientes en la hoja "Clientes"</li>
              <li>3. Campos requeridos: <strong>first_name, last_name, email o phone</strong></li>
              <li>4. Guarda el archivo</li>
              <li>5. Súbelo usando el formulario de abajo</li>
            </ol>
          </div>

          {/* Download Template */}
          <div className="bg-white rounded-xl border border-zionx-secondary p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-zionx-primary mb-1">Paso 1: Descargar Plantilla</h3>
                <p className="text-sm text-gray-600">Descarga el archivo Excel con el formato correcto</p>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                📥 Descargar Plantilla Excel
              </button>
            </div>
          </div>

          {/* Upload Form */}
          <div className="bg-white rounded-xl border border-zionx-secondary p-6 mb-6">
            <h3 className="font-semibold text-zionx-primary mb-4">Paso 2: Subir Archivo con Clientes</h3>
            
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <span className="text-6xl mb-4">📊</span>
                  {file ? (
                    <>
                      <p className="text-lg font-semibold text-green-600 mb-2">
                        ✓ {file.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                      <p className="text-sm text-blue-600 mt-2">
                        Click para seleccionar otro archivo
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-semibold text-gray-700 mb-2">
                        Click para seleccionar archivo Excel
                      </p>
                      <p className="text-sm text-gray-500">
                        o arrastra y suelta aquí
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        Formatos: .xlsx, .xls
                      </p>
                    </>
                  )}
                </label>
              </div>

              <button
                type="submit"
                disabled={!file || uploading}
                className="w-full bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-lg font-semibold"
              >
                {uploading ? '⏳ Importando clientes...' : '📤 Importar Clientes'}
              </button>
            </form>
          </div>

          {/* Results */}
          {result && (
            <div className={`rounded-xl border p-6 ${
              result.errors && result.errors.length > 0 
                ? 'bg-yellow-50 border-yellow-200' 
                : 'bg-green-50 border-green-200'
            }`}>
              <h3 className={`font-semibold mb-3 ${
                result.errors && result.errors.length > 0 
                  ? 'text-yellow-900' 
                  : 'text-green-900'
              }`}>
                📊 Resultado de Importación
              </h3>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-white rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">{result.imported}</p>
                  <p className="text-sm text-gray-600">Importados</p>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-orange-600">{result.skipped}</p>
                  <p className="text-sm text-gray-600">Omitidos</p>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-blue-600">{result.total}</p>
                  <p className="text-sm text-gray-600">Total Filas</p>
                </div>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="mt-4">
                  <p className="font-semibold text-yellow-900 mb-2">⚠️ Errores encontrados:</p>
                  <div className="bg-white rounded-lg p-4 max-h-40 overflow-y-auto">
                    <ul className="text-sm text-gray-700 space-y-1">
                      {result.errors.map((error, index) => (
                        <li key={index} className="text-red-600">• {error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <Link
                to="/crm"
                className="mt-4 block text-center text-blue-600 hover:text-blue-800 font-medium"
              >
                Ver clientes importados →
              </Link>
            </div>
          )}

          {/* Field Reference */}
          <div className="bg-white rounded-xl border border-zionx-secondary p-6">
            <h3 className="font-semibold text-zionx-primary mb-4">📝 Campos Disponibles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-700 mb-2">Campos Requeridos:</p>
                <ul className="space-y-1 text-gray-600">
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">first_name</code> - Nombre</li>
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">last_name</code> - Apellidos</li>
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">email</code> o <code className="bg-gray-100 px-2 py-1 rounded">phone</code> - Al menos uno</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-2">Campos Opcionales:</p>
                <ul className="space-y-1 text-gray-600">
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">address</code> - Dirección completa</li>
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">curp</code> - CURP (18 caracteres)</li>
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">rfc</code> - RFC</li>
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">date_of_birth</code> - Fecha (YYYY-MM-DD)</li>
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">occupation</code> - Ocupación</li>
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">monthly_income</code> - Ingreso mensual</li>
                  <li>• <code className="bg-gray-100 px-2 py-1 rounded">notes</code> - Notas adicionales</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CustomerImport;




