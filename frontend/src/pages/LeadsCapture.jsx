import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const LeadsCapture = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    service_interest: '',
    source: 'website',
    budget_range: '',
    notes: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/team-members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeamMembers(response.data.team_members || []);
    } catch (error) {
      console.error('Error fetching team:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess(false);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/leads/create`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess(true);
      setFormData({
        name: '',
        phone: '',
        email: '',
        service_interest: '',
        source: 'website',
        budget_range: '',
        notes: ''
      });

      // Show success message
      alert('✅ Lead capturado exitosamente!' + (response.data.whatsapp_sent ? '\n📱 Mensaje de WhatsApp enviado.' : ''));
      
      // Redirect to inbox after 2 seconds
      setTimeout(() => {
        window.location.href = '/leads-inbox';
      }, 2000);

    } catch (err) {
      console.error('Error creating lead:', err);
      setError(err.response?.data?.error || 'Error al capturar el lead');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-black mb-2">➕ Capturar Nuevo Lead</h1>
            <p className="text-gray-600">
              Añade un nuevo lead y envía un mensaje de bienvenida automático por WhatsApp
            </p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-semibold text-green-800">¡Lead capturado exitosamente!</p>
                  <p className="text-sm text-green-600">Mensaje de WhatsApp enviado. Redirigiendo al inbox...</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">❌</span>
                <div>
                  <p className="font-semibold text-red-800">Error</p>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Nombre Completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Juan Pérez García"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Número de WhatsApp <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="+52 55 1234 5678"
              />
              <p className="text-xs text-gray-500 mt-1">
                📱 Incluye código de país (ej: +52 para México). Se enviará un mensaje de WhatsApp automáticamente.
              </p>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Email (Opcional)
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="juan@ejemplo.com"
              />
            </div>

            {/* Service Interest */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Servicio de Interés
              </label>
              <select
                value={formData.service_interest}
                onChange={(e) => setFormData({...formData, service_interest: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Seleccionar...</option>
                <option value="Marketing Digital">Marketing Digital</option>
                <option value="Diseño Gráfico">Diseño Gráfico</option>
                <option value="Gestión de Redes Sociales">Gestión de Redes Sociales</option>
                <option value="Publicidad Pagada">Publicidad Pagada</option>
                <option value="Branding">Branding</option>
                <option value="Fotografía y Video">Fotografía y Video</option>
                <option value="Sitio Web">Sitio Web</option>
                <option value="SEO">SEO</option>
                <option value="Email Marketing">Email Marketing</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            {/* Source */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                ¿Cómo nos conoció?
              </label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({...formData, source: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="website">Sitio Web</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="tiktok">TikTok</option>
                <option value="referral">Referido</option>
                <option value="event">Evento</option>
                <option value="whatsapp_direct">WhatsApp Directo</option>
                <option value="google">Google</option>
                <option value="other">Otro</option>
              </select>
            </div>

            {/* Budget Range */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Presupuesto Aproximado (Opcional)
              </label>
              <select
                value={formData.budget_range}
                onChange={(e) => setFormData({...formData, budget_range: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Seleccionar...</option>
                <option value="< $5,000">Menos de $5,000 MXN</option>
                <option value="$5,000 - $10,000">$5,000 - $10,000 MXN</option>
                <option value="$10,000 - $25,000">$10,000 - $25,000 MXN</option>
                <option value="$25,000 - $50,000">$25,000 - $50,000 MXN</option>
                <option value="> $50,000">Más de $50,000 MXN</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Notas Adicionales
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                rows={4}
                placeholder="Información adicional sobre el lead, necesidades específicas, fecha de seguimiento, etc."
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <span>📱</span>
                    <span>Capturar y Enviar WhatsApp</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Info Box */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">ℹ️ ¿Qué sucede después?</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>✅ El lead se guardará en la base de datos</li>
              <li>📱 Se enviará un mensaje de bienvenida automático por WhatsApp</li>
              <li>💬 Aparecerá en el Inbox para seguimiento</li>
              <li>📊 Podrás ver estadísticas y actividad del lead</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LeadsCapture;



