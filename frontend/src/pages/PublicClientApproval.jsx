import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { PlatformPreview } from '../components/SocialPreviews';

const PublicClientApproval = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedbacks, setFeedbacks] = useState({});
  const [actionStates, setActionStates] = useState({});

  useEffect(() => {
    fetchPosts();
  }, [token]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/approvals/client/${token}`);
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar el contenido');
    } finally {
      setLoading(false);
    }
  };

  const approvePost = async (postId) => {
    try {
      setActionStates(prev => ({ ...prev, [postId]: 'approving' }));
      await axios.post(`${API_BASE_URL}/api/approvals/client/${token}/approve/${postId}`, {
        feedback: feedbacks[postId] || ''
      });
      setActionStates(prev => ({ ...prev, [postId]: 'approved' }));
      // Refresh to show updated status
      fetchPosts();
    } catch (err) {
      setActionStates(prev => ({ ...prev, [postId]: 'error' }));
      alert(err.response?.data?.error || 'Error al aprobar');
    }
  };

  const requestChanges = async (postId) => {
    const feedback = feedbacks[postId];
    if (!feedback?.trim()) {
      alert('Por favor describe los cambios que necesitas');
      return;
    }
    try {
      setActionStates(prev => ({ ...prev, [postId]: 'requesting' }));
      await axios.post(`${API_BASE_URL}/api/approvals/client/${token}/request-changes/${postId}`, {
        feedback
      });
      setActionStates(prev => ({ ...prev, [postId]: 'changes_requested' }));
      fetchPosts();
    } catch (err) {
      setActionStates(prev => ({ ...prev, [postId]: 'error' }));
      alert(err.response?.data?.error || 'Error al solicitar cambios');
    }
  };

  const buildPreviewPost = (post) => ({
    customer: data.customer,
    platform: post.platform,
    copy_out: post.copy_out,
    copy_in: post.copy_in,
    image_url: post.arte ? `${API_BASE_URL}${post.arte}` : null,
    arte_files: post.arte_files ? (typeof post.arte_files === 'string' ? JSON.parse(post.arte_files) : post.arte_files) : [],
    scheduled_date: post.scheduled_date,
    content_type: post.content_type
  });

  const getStatusBadge = (post) => {
    if (post.client_status === 'approved') {
      return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">Aprobado</span>;
    }
    if (post.client_status === 'changes_requested') {
      return <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">Cambios solicitados</span>;
    }
    if (post.status === 'publicado') {
      return <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">Publicado</span>;
    }
    if (post.status === 'programado') {
      return <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">Programado</span>;
    }
    return <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium">Pendiente</span>;
  };

  const needsAction = (post) => {
    return !post.client_status && post.status !== 'publicado' && post.status !== 'programado';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando contenido...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border p-8 max-w-md text-center">
          <span className="text-5xl block mb-4">🔗</span>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Enlace no disponible</h2>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  const monthNames = {
    '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
    '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
    '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
  };
  const [year, month] = (data.month_year || '').split('-');
  const monthLabel = `${monthNames[month] || month} ${year}`;

  const pendingCount = data.posts.filter(needsAction).length;
  const approvedCount = data.posts.filter(p => p.client_status === 'approved').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wide mb-1">Revision de contenido</p>
              <h1 className="text-2xl font-bold text-gray-900">{data.customer}</h1>
              <p className="text-gray-500 mt-1">{monthLabel} · {data.posts.length} publicaciones</p>
            </div>
            <div className="text-right">
              <div className="flex gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                  <p className="text-lg font-bold text-green-700">{approvedCount}</p>
                  <p className="text-xs text-green-600">Aprobados</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
                  <p className="text-lg font-bold text-yellow-700">{pendingCount}</p>
                  <p className="text-xs text-yellow-600">Pendientes</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Posts */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {data.posts.map((post) => (
          <div key={post.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {/* Post Header */}
            <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-gray-400">#{post.post_number}</span>
                <div>
                  <h3 className="font-semibold text-gray-900">{post.campaign || 'Sin titulo'}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-gray-200 rounded px-2 py-0.5 capitalize">{post.platform}</span>
                    <span className="text-xs bg-gray-200 rounded px-2 py-0.5">{post.content_type || 'post'}</span>
                    {post.scheduled_date && (
                      <span className="text-xs text-gray-500">
                        {new Date(post.scheduled_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {getStatusBadge(post)}
            </div>

            {/* Preview + Actions */}
            <div className="p-6">
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Platform Preview */}
                <div className="flex-1 flex justify-center bg-gray-900 rounded-lg p-6">
                  <PlatformPreview post={buildPreviewPost(post)} />
                </div>

                {/* Actions Panel */}
                <div className="w-full lg:w-80 flex flex-col">
                  {post.idea_tema && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">Concepto</p>
                      <p className="text-sm text-gray-700">{post.idea_tema}</p>
                    </div>
                  )}

                  {post.client_feedback_text && (
                    <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs font-medium text-blue-600 uppercase mb-1">Tu feedback anterior</p>
                      <p className="text-sm text-blue-800 whitespace-pre-wrap">{post.client_feedback_text}</p>
                    </div>
                  )}

                  {needsAction(post) && (
                    <>
                      <textarea
                        value={feedbacks[post.id] || ''}
                        onChange={(e) => setFeedbacks(prev => ({ ...prev, [post.id]: e.target.value }))}
                        placeholder="Comentarios (opcional para aprobar, requerido para cambios)"
                        rows={3}
                        className="w-full border rounded-lg px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-black focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => approvePost(post.id)}
                          disabled={actionStates[post.id] === 'approving'}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                        >
                          {actionStates[post.id] === 'approving' ? 'Aprobando...' : 'Aprobar'}
                        </button>
                        <button
                          onClick={() => requestChanges(post.id)}
                          disabled={actionStates[post.id] === 'requesting'}
                          className="flex-1 bg-white border-2 border-orange-400 text-orange-600 hover:bg-orange-50 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                        >
                          {actionStates[post.id] === 'requesting' ? 'Enviando...' : 'Solicitar cambios'}
                        </button>
                      </div>
                    </>
                  )}

                  {post.client_status === 'approved' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                      <span className="text-3xl block mb-2">✅</span>
                      <p className="font-medium text-green-800">Aprobado</p>
                      {post.client_reviewed_at && (
                        <p className="text-xs text-green-600 mt-1">
                          {new Date(post.client_reviewed_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  )}

                  {post.client_status === 'changes_requested' && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                      <span className="text-3xl block mb-2">↩️</span>
                      <p className="font-medium text-orange-800">Cambios solicitados</p>
                      <p className="text-xs text-orange-600 mt-1">El equipo esta trabajando en tus cambios</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {data.posts.length === 0 && (
          <div className="bg-white rounded-xl border p-12 text-center">
            <span className="text-5xl block mb-4">📋</span>
            <p className="text-gray-500">No hay contenido listo para revision en este momento</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t bg-white mt-8">
        <div className="max-w-5xl mx-auto px-6 py-4 text-center text-xs text-gray-400">
          Powered by ZIONX Marketing
        </div>
      </div>
    </div>
  );
};

export default PublicClientApproval;
