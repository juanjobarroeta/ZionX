import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import ApprovalModal from '../components/ApprovalModal';

const TeamDashboard = () => {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, in_progress: 0, review: 0, completed: 0, overdue: 0 });
  const [workload, setWorkload] = useState([]);
  const [approvalQueue, setApprovalQueue] = useState([]);
  const [approvalStats, setApprovalStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('board'); // board, list
  const [activeTab, setActiveTab] = useState('tasks'); // tasks, approvals
  const [selectedContent, setSelectedContent] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filter, activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Always fetch all data including approvals
      const requests = [
        axios.get(`${API_BASE_URL}/api/team/content-tasks`, { 
          headers,
          params: { status: filter, days: 30 }
        }),
        axios.get(`${API_BASE_URL}/api/team/workload`, { headers }),
        axios.get(`${API_BASE_URL}/api/approvals/queue`, { headers }),
        axios.get(`${API_BASE_URL}/api/approvals/stats`, { headers })
      ];

      const results = await Promise.all(requests.map(r => r.catch(e => ({ data: null, error: e }))));

      const [tasksRes, workloadRes, approvalsRes, approvalStatsRes] = results;

      if (tasksRes.data) {
        setTasks(tasksRes.data.tasks || []);
        setStats(tasksRes.data.stats || {});
      }
      if (workloadRes.data) {
        setWorkload(workloadRes.data || []);
      }
      if (approvalsRes?.data) {
        setApprovalQueue(approvalsRes.data.items || []);
      }
      if (approvalStatsRes?.data) {
        setApprovalStats(approvalStatsRes.data || {});
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
      // Mock data for development
      setTasks([
        { id: 1, customer_name: 'Cliente Demo', campaign: 'Campaña Navidad', platform: 'instagram', 
          status: 'en_diseño', scheduled_date: new Date().toISOString(), designer_name: 'Ana García',
          priority: 'high', idea_tema: 'Post promocional' },
        { id: 2, customer_name: 'Otro Cliente', campaign: 'Lanzamiento', platform: 'facebook', 
          status: 'planificado', scheduled_date: new Date(Date.now() + 86400000).toISOString(), 
          cm_name: 'Carlos López', priority: 'medium', idea_tema: 'Anuncio de producto' }
      ]);
      setStats({ total: 2, pending: 1, in_progress: 1, review: 0, completed: 0, overdue: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenApproval = (content) => {
    setSelectedContent(content);
    setShowApprovalModal(true);
  };

  const handleApprovalComplete = (action) => {
    fetchData();
    setShowApprovalModal(false);
    setSelectedContent(null);
  };

  const getStatusInfo = (status) => {
    const statuses = {
      'planificado': { label: 'Planificado', color: 'bg-gray-100 text-gray-700', icon: '📋' },
      'pending': { label: 'Pendiente', color: 'bg-gray-100 text-gray-700', icon: '📋' },
      'en_diseño': { label: 'En Diseño', color: 'bg-blue-100 text-blue-700', icon: '🎨' },
      'in_progress': { label: 'En Progreso', color: 'bg-blue-100 text-blue-700', icon: '🔄' },
      'revision': { label: 'En Revisión', color: 'bg-yellow-100 text-yellow-700', icon: '👁️' },
      'aprobado': { label: 'Aprobado', color: 'bg-purple-100 text-purple-700', icon: '✅' },
      'publicado': { label: 'Publicado', color: 'bg-green-100 text-green-700', icon: '🚀' },
      'completed': { label: 'Completado', color: 'bg-green-100 text-green-700', icon: '✅' }
    };
    return statuses[status] || { label: status, color: 'bg-gray-100 text-gray-700', icon: '📄' };
  };

  const getPlatformIcon = (platform) => {
    const platforms = {
      'instagram': '📷',
      'facebook': '📘',
      'tiktok': '🎵',
      'linkedin': '💼',
      'twitter': '🐦',
      'youtube': '▶️'
    };
    return platforms[platform?.toLowerCase()] || '📱';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'urgent': 'border-l-4 border-l-red-500',
      'high': 'border-l-4 border-l-orange-500',
      'medium': 'border-l-4 border-l-yellow-500',
      'low': 'border-l-4 border-l-green-500'
    };
    return colors[priority] || 'border-l-4 border-l-gray-300';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'Hoy';
    if (date.toDateString() === tomorrow.toDateString()) return 'Mañana';
    
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const isOverdue = (dateStr, status) => {
    if (status === 'publicado' || status === 'completed') return false;
    return new Date(dateStr) < new Date();
  };

  // Group tasks by status for board view
  const columns = [
    { key: 'pending', label: 'Pendientes', statuses: ['planificado', 'pending'] },
    { key: 'in_progress', label: 'En Progreso', statuses: ['en_diseño', 'in_progress'] },
    { key: 'review', label: 'En Revisión', statuses: ['revision', 'aprobado'] },
    { key: 'completed', label: 'Completados', statuses: ['publicado', 'completed'] }
  ];

  const getColumnTasks = (statuses) => tasks.filter(t => statuses.includes(t.status));

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">✅ Tareas del Equipo</h1>
            <p className="text-gray-500">Contenido, tareas y aprobaciones</p>
          </div>
          <div className="flex gap-3">
            <Link 
              to="/content-calendar" 
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
            >
              📅 Calendario
            </Link>
            <Link 
              to="/people" 
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
            >
              👥 Equipo
            </Link>
          </div>
        </div>

        {/* Main Tabs: Tasks vs Approvals */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'tasks' 
                ? 'bg-black text-white shadow-lg' 
                : 'bg-white text-gray-600 hover:bg-gray-100 border'
            }`}
          >
            📋 Tareas de Contenido
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'approvals' 
                ? 'bg-black text-white shadow-lg' 
                : 'bg-white text-gray-600 hover:bg-gray-100 border'
            }`}
          >
            ✅ Aprobaciones
            {(approvalStats.pending_review || approvalQueue.length > 0) && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {approvalStats.pending_review || approvalQueue.length}
              </span>
            )}
          </button>
        </div>

        {/* APPROVALS TAB */}
        {activeTab === 'approvals' && (
          <>
            {/* Approval Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <p className="text-sm text-gray-500">Pendientes</p>
                <p className="text-2xl font-bold text-orange-600">{approvalStats.pending_review || 0}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <p className="text-sm text-gray-500">Mis Pendientes</p>
                <p className="text-2xl font-bold text-blue-600">{approvalStats.my_pending || 0}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <p className="text-sm text-gray-500">Aprobados (7 días)</p>
                <p className="text-2xl font-bold text-green-600">{approvalStats.approved_this_week || 0}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <p className="text-sm text-gray-500">Revisiones (7 días)</p>
                <p className="text-2xl font-bold text-red-600">{approvalStats.revisions_this_week || 0}</p>
              </div>
            </div>

            {/* Approval Queue */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-gray-50">
                <h3 className="font-semibold text-gray-700">📋 Cola de Aprobaciones</h3>
                <p className="text-sm text-gray-500">Contenido pendiente de revisión y aprobación</p>
              </div>
              
              {approvalQueue.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-4xl block mb-3">✅</span>
                  <p>No hay contenido pendiente de aprobación</p>
                  <p className="text-sm text-gray-400">¡Todo está al día!</p>
                </div>
              ) : (
                <div className="divide-y">
                  {approvalQueue.map(item => (
                    <div 
                      key={item.id} 
                      className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleOpenApproval(item)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{getPlatformIcon(item.platform)}</span>
                            <h4 className="font-medium text-gray-900">
                              {item.campaign || item.idea_tema || 'Sin título'}
                            </h4>
                            {item.current_revision > 1 && (
                              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                                Revisión #{item.current_revision}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {item.customer_name} • {item.content_type || 'Post'}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                            <span>📅 {item.scheduled_date ? new Date(item.scheduled_date).toLocaleDateString('es-ES') : '—'}</span>
                            <span>🎨 {item.designer_name || '—'}</span>
                            <span>📱 {item.cm_name || '—'}</span>
                            {item.approver_name && <span>👤 Aprobador: {item.approver_name}</span>}
                          </div>
                          {item.rejection_reason && (
                            <div className="mt-2 text-xs bg-red-50 text-red-700 px-3 py-1 rounded-lg inline-block">
                              ⚠️ {item.rejection_reason.substring(0, 100)}...
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`text-xs px-3 py-1 rounded-full ${
                            item.approval_status === 'pending_review' ? 'bg-yellow-100 text-yellow-700' :
                            item.approval_status === 'in_review' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {item.approval_status === 'pending_review' ? '⏳ Pendiente' : 
                             item.approval_status === 'in_review' ? '👁️ En Revisión' : 
                             item.status}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenApproval(item); }}
                            className="text-sm bg-black text-white px-4 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                          >
                            Revisar →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <>
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border shadow-sm">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border shadow-sm">
            <p className="text-sm text-gray-500">Pendientes</p>
            <p className="text-2xl font-bold text-gray-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border shadow-sm">
            <p className="text-sm text-gray-500">En Progreso</p>
            <p className="text-2xl font-bold text-blue-600">{stats.in_progress}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border shadow-sm">
            <p className="text-sm text-gray-500">En Revisión</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.review}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border shadow-sm">
            <p className="text-sm text-gray-500">Completados</p>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>
          <div className={`bg-white rounded-xl p-4 border shadow-sm ${stats.overdue > 0 ? 'ring-2 ring-red-500' : ''}`}>
            <p className="text-sm text-gray-500">Vencidos</p>
            <p className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-red-600' : 'text-gray-400'}`}>{stats.overdue}</p>
          </div>
        </div>

        {/* Filters & View Toggle */}
        <div className="bg-white rounded-xl p-4 border shadow-sm mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-2">
              {['all', 'pending', 'in_progress', 'completed'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === f ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : f === 'in_progress' ? 'En Progreso' : 'Completados'}
                </button>
              ))}
            </div>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('board')}
                className={`px-3 py-1.5 rounded-md text-sm ${viewMode === 'board' ? 'bg-white shadow' : ''}`}
              >
                📋 Board
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-sm ${viewMode === 'list' ? 'bg-white shadow' : ''}`}
              >
                📝 Lista
              </button>
            </div>
          </div>
        </div>

        {/* Board View */}
        {viewMode === 'board' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {columns.map(column => (
              <div key={column.key} className="bg-gray-100 rounded-xl p-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-700">{column.label}</h3>
                  <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-sm">
                    {getColumnTasks(column.statuses).length}
                  </span>
                </div>
                <div className="space-y-3">
                  {getColumnTasks(column.statuses).map(task => (
                    <div 
                      key={task.id} 
                      className={`bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow ${getPriorityColor(task.priority)}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-lg">{getPlatformIcon(task.platform)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusInfo(task.status).color}`}>
                          {getStatusInfo(task.status).label}
                        </span>
                      </div>
                      <h4 className="font-medium text-gray-900 text-sm mb-1 line-clamp-2">
                        {task.campaign || task.idea_tema || 'Sin título'}
                      </h4>
                      <p className="text-xs text-gray-500 mb-2">{task.customer_name}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className={`${isOverdue(task.scheduled_date, task.status) ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                          📅 {formatDate(task.scheduled_date)}
                        </span>
                        <span className="text-gray-400">
                          {task.designer_name || task.cm_name || 'Sin asignar'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {getColumnTasks(column.statuses).length === 0 && (
                    <div className="text-center text-gray-400 py-8 text-sm">
                      No hay tareas
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Tarea</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Cliente</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Plataforma</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Fecha</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Asignado</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tasks.map(task => (
                  <tr key={task.id} className={`hover:bg-gray-50 ${getPriorityColor(task.priority)}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{task.campaign || task.idea_tema || 'Sin título'}</p>
                      <p className="text-xs text-gray-500">{task.content_type || task.pilar}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{task.customer_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-lg">{getPlatformIcon(task.platform)}</span>
                      <span className="ml-2 text-sm text-gray-600 capitalize">{task.platform}</span>
                    </td>
                    <td className={`px-4 py-3 text-sm ${isOverdue(task.scheduled_date, task.status) ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {formatDate(task.scheduled_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {task.designer_name || task.cm_name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusInfo(task.status).color}`}>
                        {getStatusInfo(task.status).icon} {getStatusInfo(task.status).label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tasks.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <span className="text-4xl block mb-3">📋</span>
                <p>No hay tareas de contenido</p>
                <Link to="/content-calendar" className="text-blue-600 hover:underline text-sm">
                  Ir al calendario de contenido →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Team Workload Section */}
        {workload.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">👥 Carga de Trabajo del Equipo</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {workload.map(member => (
                <div key={member.id} className="bg-white rounded-xl border p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600">
                      {member.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.role}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-blue-50 rounded-lg p-2">
                      <p className="text-lg font-bold text-blue-600">{member.active_tasks || 0}</p>
                      <p className="text-xs text-gray-500">Activas</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2">
                      <p className="text-lg font-bold text-green-600">{member.completed_tasks || 0}</p>
                      <p className="text-xs text-gray-500">Completadas</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
          </>
        )}

        {/* Approval Modal */}
        <ApprovalModal
          isOpen={showApprovalModal}
          onClose={() => setShowApprovalModal(false)}
          content={selectedContent}
          onActionComplete={handleApprovalComplete}
        />
      </div>
    </Layout>
  );
};

export default TeamDashboard;
