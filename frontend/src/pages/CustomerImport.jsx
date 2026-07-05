import React, { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./CustomerImport.css";

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
      <div className="zximp">
        <div className="zximp-inner">
          {/* Header */}
          <div className="zximp-head">
            <div>
              <div className="zximp-eyebrow">Clientes</div>
              <h1 className="zximp-h1">
                Importar clientes <span className="zximp-serif">masivamente</span>
              </h1>
              <p className="zximp-sub">Sube un archivo Excel con tus clientes</p>
            </div>
            <Link to="/crm" className="zximp-back">← Volver al CRM</Link>
          </div>

          {/* Instructions */}
          <div className="zximp-note">
            <h2>Instrucciones</h2>
            <ol className="zximp-steps">
              <li>Descarga la plantilla de Excel (botón abajo)</li>
              <li>Llena la información de tus clientes en la hoja "Clientes"</li>
              <li>Campos requeridos: <strong>first_name, last_name, email o phone</strong></li>
              <li>Guarda el archivo</li>
              <li>Súbelo usando el formulario de abajo</li>
            </ol>
          </div>

          {/* Download Template */}
          <div className="zximp-panel">
            <div className="zximp-steprow">
              <div>
                <h3>Paso 1: Descargar plantilla</h3>
                <p>Descarga el archivo Excel con el formato correcto</p>
              </div>
              <button onClick={handleDownloadTemplate} className="zximp-btn">
                📥 Descargar plantilla Excel
              </button>
            </div>
          </div>

          {/* Upload Form */}
          <div className="zximp-panel">
            <h3>Paso 2: Subir archivo con clientes</h3>

            <form onSubmit={handleUpload} className="zximp-form">
              <div className={`zximp-drop${file ? ' has-file' : ''}`}>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="zximp-hidden-input"
                  id="file-upload"
                  style={{ display: 'none' }}
                />
                <label htmlFor="file-upload" className="zximp-drop-label">
                  <span className="zximp-drop-icon">📊</span>
                  {file ? (
                    <>
                      <p className="zximp-drop-lead ok">✓ {file.name}</p>
                      <p className="zximp-drop-meta">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                      <p className="zximp-drop-swap">
                        Click para seleccionar otro archivo
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="zximp-drop-lead">
                        Click para seleccionar archivo Excel
                      </p>
                      <p className="zximp-drop-hint">
                        o arrastra y suelta aquí
                      </p>
                      <p className="zximp-drop-hint">
                        Formatos: .xlsx, .xls
                      </p>
                    </>
                  )}
                </label>
              </div>

              <button
                type="submit"
                disabled={!file || uploading}
                className="zximp-submit"
              >
                {uploading ? '⏳ Importando clientes...' : '📤 Importar clientes'}
              </button>
            </form>
          </div>

          {/* Results */}
          {result && (
            <div className={`zximp-result${
              result.errors && result.errors.length > 0 ? ' warn' : ''
            }`}>
              <h3>Resultado de importación</h3>

              <div className="zximp-summary">
                <div>
                  <span className="v ok">{result.imported}</span>
                  <span className="k">Importados</span>
                </div>
                <div>
                  <span className="v warn">{result.skipped}</span>
                  <span className="k">Omitidos</span>
                </div>
                <div>
                  <span className="v">{result.total}</span>
                  <span className="k">Total filas</span>
                </div>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="zximp-errors">
                  <p className="lead">⚠️ Errores encontrados:</p>
                  <div className="zximp-errlist">
                    <ul>
                      {result.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <Link to="/crm" className="zximp-golink">
                Ver clientes importados →
              </Link>
            </div>
          )}

          {/* Field Reference */}
          <div className="zximp-panel">
            <h3 style={{ marginBottom: '16px' }}>Campos disponibles</h3>
            <div className="zximp-tablewrap">
              <table className="zximp-table">
                <thead>
                  <tr>
                    <th>Campo</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code className="zximp-code">first_name</code></td>
                    <td><span className="zximp-req">Requerido</span></td>
                    <td>Nombre</td>
                  </tr>
                  <tr>
                    <td><code className="zximp-code">last_name</code></td>
                    <td><span className="zximp-req">Requerido</span></td>
                    <td>Apellidos</td>
                  </tr>
                  <tr>
                    <td>
                      <code className="zximp-code">email</code>{' '}
                      <code className="zximp-code">phone</code>
                    </td>
                    <td><span className="zximp-req">Requerido</span></td>
                    <td>Al menos uno</td>
                  </tr>
                  <tr>
                    <td><code className="zximp-code">address</code></td>
                    <td><span className="zximp-opt">Opcional</span></td>
                    <td>Dirección completa</td>
                  </tr>
                  <tr>
                    <td><code className="zximp-code">curp</code></td>
                    <td><span className="zximp-opt">Opcional</span></td>
                    <td>CURP (18 caracteres)</td>
                  </tr>
                  <tr>
                    <td><code className="zximp-code">rfc</code></td>
                    <td><span className="zximp-opt">Opcional</span></td>
                    <td>RFC</td>
                  </tr>
                  <tr>
                    <td><code className="zximp-code">date_of_birth</code></td>
                    <td><span className="zximp-opt">Opcional</span></td>
                    <td>Fecha (YYYY-MM-DD)</td>
                  </tr>
                  <tr>
                    <td><code className="zximp-code">occupation</code></td>
                    <td><span className="zximp-opt">Opcional</span></td>
                    <td>Ocupación</td>
                  </tr>
                  <tr>
                    <td><code className="zximp-code">monthly_income</code></td>
                    <td><span className="zximp-opt">Opcional</span></td>
                    <td>Ingreso mensual</td>
                  </tr>
                  <tr>
                    <td><code className="zximp-code">notes</code></td>
                    <td><span className="zximp-opt">Opcional</span></td>
                    <td>Notas adicionales</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CustomerImport;




