import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const ApprovalModal = ({ isOpen, onClose, content, onActionComplete }) => {
  const [action, setAction] = useState(null); // 'approve', 'reject', 'reassign'
  const [feedback, setFeedback] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [sendBackTo, setSendBackTo] = useState('');
  const [newApprover, setNewApprover] = useState('');
  const [approvers, setApprovers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (isOpen && content) {
      fetchApprovers();
      fetchTeamMembers();
      fetchHistory();
    }
  }, [isOpen, content]);

  const fetchApprovers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/approvals/approvers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApprovers(res.data || []);
    } catch (error) {
      console.error('Error fetching approvers:', error);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeamMembers(res.data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const fetchHistory = async () => {
    if (!content?.id) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/approvals/history/${content.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/approvals/approve/${content.id}`, {
        feedback,
        internal_notes: internalNotes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onActionComplete?.('approved');
      onClose();
    } catch (error) {
      console.error('Error approving:', error);
      alert('Error al aprobar el contenido');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Por favor indica el motivo del rechazo');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/approvals/reject/${content.id}`, {
        reason: rejectionReason,
        feedback,
        send_back_to: sendBackTo || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onActionComplete?.('rejected');
      onClose();
    } catch (error) {
      console.error('Error rejecting:', error);
      alert('Error al rechazar el contenido');
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async () => {
    if (!newApprover) {
      alert('Por favor selecciona un nuevo aprobador');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/approvals/reassign/${content.id}`, {
        new_approver_id: newApprover,
        notes: internalNotes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onActionComplete?.('reassigned');
      onClose();
    } catch (error) {
      console.error('Error reassigning:', error);
      alert('Error al reasignar');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (actionType) => {
    const icons = {
      'submitted': '📤',
      'approved': '✅',
      'rejected': '❌',
      'revision_requested': '↩️',
      'reassigned': '🔄'
    };
    return icons[actionType] || '📋';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen || !content) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Revisión de Contenido</h2>
              <p className="text-gray-300 text-sm">
                {content.customer_name} • {content.campaign || 'Sin campaña'}
              </p>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl">×</button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Content Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Left: Content Details */}
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-700 mb-3">📋 Detalles del Post</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Plataforma:</span>
                    <span className="font-medium capitalize">{content.platform}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Formato:</span>
                    <span className="font-medium">{content.content_type || content.formato}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fecha Programada:</span>
                    <span className="font-medium">
                      {content.scheduled_date ? new Date(content.scheduled_date).toLocaleDateString('es-ES') : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Revisión #:</span>
                    <span className="font-medium">{content.current_revision || 1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Diseñador:</span>
                    <span className="font-medium">{content.designer_name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Community Manager:</span>
                    <span className="font-medium">{content.cm_name || '—'}</span>
                  </div>
                </div>
              </div>

              {content.idea_tema && (
                <div className="bg-blue-50 rounded-xl p-4">
                  <h4 className="font-semibold text-blue-700 mb-2">💡 Idea / Tema</h4>
                  <p className="text-sm text-gray-700">{content.idea_tema}</p>
                </div>
              )}

              {content.copy_out && (
                <div className="bg-purple-50 rounded-xl p-4">
                  <h4 className="font-semibold text-purple-700 mb-2">✍️ Copy (Caption)</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{content.copy_out}</p>
                </div>
              )}

              {content.rejection_reason && (
                <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                  <h4 className="font-semibold text-red-700 mb-2">⚠️ Última Corrección Solicitada</h4>
                  <p className="text-sm text-gray-700">{content.rejection_reason}</p>
                </div>
              )}
            </div>

            {/* Right: Preview & Actions */}
            <div className="space-y-4">
              {/* Arte Preview */}
              {content.arte && (
                <div className="bg-gray-100 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-700 mb-2">🎨 Arte</h4>
                  <div className="bg-white rounded-lg p-2 flex items-center justify-center min-h-[200px]">
                    {content.arte.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                      <img 
                        src={content.arte} 
                        alt="Arte" 
                        className="max-w-full max-h-[300px] object-contain rounded"
                      />
                    ) : (
                      <a 
                        href={content.arte} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        📎 Ver archivo adjunto
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* History Toggle */}
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {showHistory ? '🔼 Ocultar Historial' : '🔽 Ver Historial de Aprobaciones'}
              </button>

              {showHistory && (
                <div className="bg-gray-50 rounded-xl p-4 max-h-[200px] overflow-y-auto">
                  <h4 className="font-semibold text-gray-700 mb-3">📜 Historial</h4>
                  {history.length === 0 ? (
                    <p className="text-sm text-gray-500">Sin historial previo</p>
                  ) : (
                    <div className="space-y-2">
                      {history.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm border-l-2 border-gray-300 pl-3">
                          <span>{getActionIcon(item.action)}</span>
                          <div>
                            <p className="font-medium capitalize">{item.action.replace('_', ' ')}</p>
                            <p className="text-gray-500 text-xs">
                              {item.decision_by_name || item.submitted_by_name} • {formatDate(item.decision_at || item.created_at)}
                            </p>
                            {item.feedback && <p className="text-gray-600 mt-1">{item.feedback}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Selection */}
          {!action && (
            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-700 mb-4">¿Qué acción deseas tomar?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setAction('approve')}
                  className="bg-green-500 hover:bg-green-600 text-white py-4 px-6 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  ✅ Aprobar
                </button>
                <button
                  onClick={() => setAction('reject')}
                  className="bg-red-500 hover:bg-red-600 text-white py-4 px-6 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  ↩️ Solicitar Cambios
                </button>
                <button
                  onClick={() => setAction('reassign')}
                  className="bg-blue-500 hover:bg-blue-600 text-white py-4 px-6 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  🔄 Reasignar Aprobador
                </button>
              </div>
            </div>
          )}

          {/* Approve Form */}
          {action === 'approve' && (
            <div className="border-t pt-6 space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <span className="text-2xl">✅</span>
                <h3 className="font-semibold text-lg">Aprobar Contenido</h3>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comentarios (opcional)
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Ej: Excelente trabajo, listo para publicar..."
                  className="w-full border rounded-lg p-3 text-sm"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setAction(null)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-medium transition-colors"
                >
                  ← Volver
                </button>
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'Aprobando...' : '✅ Confirmar Aprobación'}
                </button>
              </div>
            </div>
          )}

          {/* Reject Form */}
          {action === 'reject' && (
            <div className="border-t pt-6 space-y-4">
              <div className="flex items-center gap-2 text-red-600">
                <span className="text-2xl">↩️</span>
                <h3 className="font-semibold text-lg">Solicitar Cambios</h3>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo del rechazo <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ej: El copy necesita ser más corto, los colores no coinciden con la marca..."
                  className="w-full border rounded-lg p-3 text-sm border-red-300 focus:ring-red-500"
                  rows={4}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enviar de vuelta a:
                </label>
                <select
                  value={sendBackTo}
                  onChange={(e) => setSendBackTo(e.target.value)}
                  className="w-full border rounded-lg p-3 text-sm"
                >
                  <option value="">Mantener asignación actual</option>
                  {teamMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.role || member.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas adicionales (opcional)
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Sugerencias específicas o recursos de referencia..."
                  className="w-full border rounded-lg p-3 text-sm"
                  rows={2}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setAction(null)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-medium transition-colors"
                >
                  ← Volver
                </button>
                <button
                  onClick={handleReject}
                  disabled={loading || !rejectionReason.trim()}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : '↩️ Enviar para Revisión'}
                </button>
              </div>
            </div>
          )}

          {/* Reassign Form */}
          {action === 'reassign' && (
            <div className="border-t pt-6 space-y-4">
              <div className="flex items-center gap-2 text-blue-600">
                <span className="text-2xl">🔄</span>
                <h3 className="font-semibold text-lg">Reasignar Aprobador</h3>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nuevo Aprobador <span className="text-red-500">*</span>
                </label>
                <select
                  value={newApprover}
                  onChange={(e) => setNewApprover(e.target.value)}
                  className="w-full border rounded-lg p-3 text-sm"
                  required
                >
                  <option value="">Seleccionar aprobador...</option>
                  {approvers.map(approver => (
                    <option key={approver.id} value={approver.id}>
                      {approver.name} ({approver.role || approver.approval_role || 'Aprobador'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Motivo de la reasignación..."
                  className="w-full border rounded-lg p-3 text-sm"
                  rows={2}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setAction(null)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-medium transition-colors"
                >
                  ← Volver
                </button>
                <button
                  onClick={handleReassign}
                  disabled={loading || !newApprover}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'Reasignando...' : '🔄 Confirmar Reasignación'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApprovalModal;

