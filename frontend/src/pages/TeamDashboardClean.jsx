import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import ApprovalModal from '../components/ApprovalModal';

const TeamDashboardClean = () => {
  const [teamMembers, setTeamMembers] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); // all, pending, in_progress, review
  const [viewMode, setViewMode] = useState('kanban'); // kanban or list
  const [activeTab, setActiveTab] = useState('tasks'); // tasks or approvals
  const [approvalQueue, setApprovalQueue] = useState([]);
  const [approvalStats, setApprovalStats] = useState({});
  const [selectedContent, setSelectedContent] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  useEffect(() => {
    fetchTeamData();
  }, []);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch team members
      const teamRes = await axios.get(`${API_BASE_URL}/team-members`, { headers });
      const members = teamRes.data.team_members || [];
      setTeamMembers(members);

      // Fetch tasks for all team members
      const tasksPromises = members.map(member =>
        axios.get(`${API_BASE_URL}/team-members/${member.id}/tasks`, { headers })
          .then(res => res.data.map(task => ({ ...task, assignee_name: member.name, assignee_role: member.role })))
          .catch(() => [])
      );

      const tasksArrays = await Promise.all(tasksPromises);
      const allTasksFlat = tasksArrays.flat();
      
      console.log('All team tasks:', allTasksFlat);
      setAllTasks(allTasksFlat);

      // Fetch approval queue
      try {
        const [approvalsRes, approvalStatsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/approvals/queue`, { headers }),
          axios.get(`${API_BASE_URL}/api/approvals/stats`, { headers })
        ]);
        setApprovalQueue(approvalsRes.data.items || []);
        setApprovalStats(approvalStatsRes.data || {});
      } catch (approvalError) {
        console.error('Error fetching approvals:', approvalError);
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenApproval = (content) => {
    setSelectedContent(content);
    setShowApprovalModal(true);
  };

  const handleApprovalComplete = () => {
    fetchTeamData();
    setShowApprovalModal(false);
    setSelectedContent(null);
  };

  const getPlatformIcon = (platform) => {
    const icons = {
      'instagram': '📷',
      'facebook': '📘',
      'tiktok': '🎵',
      'linkedin': '💼',
      'twitter': '🐦',
      'youtube': '▶️'
    };
    return icons[platform?.toLowerCase()] || '📱';
  };

  const getTasksByStatus = (status) => {
    return allTasks.filter(t => {
      if (status === 'all') return true;
      if (status === 'pending') return t.status === 'todo' || t.status === 'pending';
      if (status === 'in_progress') return t.status === 'in_progress';
      if (status === 'review') return t.status === 'review';
      return false;
    });
  };

  const getDaysUntilDue = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredTasks = getTasksByStatus(activeFilter);

  const stats = {
    totalMembers: teamMembers.length,
    pendingTasks: getTasksByStatus('pending').length,
    inProgressTasks: getTasksByStatus('in_progress').length,
    reviewTasks: getTasksByStatus('review').length,
    overdueTasks: allTasks.filter(t => getDaysUntilDue(t.due_date) < 0 && t.status !== 'completed').length
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-black"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-black">Dashboard de Equipo</h1>
              <p className="text-gray-500 text-sm mt-1">Gestión y supervisión de productividad</p>
            </div>
            <Link
              to="/team-management"
              className="bg-black hover:bg-gray-800 text-white px-6 py-2 rounded-lg transition-colors font-medium"
            >
              👥 Gestionar Equipo
            </Link>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="px-8 py-6">
          <div className="grid grid-cols-5 gap-6 mb-8">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Miembros del Equipo</p>
                  <p className="text-3xl font-bold text-black">{stats.totalMembers}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Pendientes</p>
                  <p className="text-3xl font-bold text-black">{stats.pendingTasks}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">⏳</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">En Progreso</p>
                  <p className="text-3xl font-bold text-black">{stats.inProgressTasks}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🔄</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">En Revisión</p>
                  <p className="text-3xl font-bold text-black">{stats.reviewTasks}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">👀</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Vencidas</p>
                  <p className="text-3xl font-bold text-black">{stats.overdueTasks}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Tab Toggle: Tasks vs Approvals */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'tasks' 
                  ? 'bg-black text-white shadow-lg' 
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              📋 Tareas del Equipo
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'approvals' 
                  ? 'bg-black text-white shadow-lg' 
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              ✅ Aprobaciones
              {(approvalStats.pending_review > 0 || approvalQueue.length > 0) && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {approvalStats.pending_review || approvalQueue.length}
                </span>
              )}
            </button>
          </div>

          {/* APPROVALS TAB CONTENT */}
          {activeTab === 'approvals' && (
            <>
              {/* Approval Stats */}
              <div className="grid grid-cols-4 gap-6 mb-8">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <p className="text-gray-600 text-sm">Pendientes de Revisión</p>
                  <p className="text-3xl font-bold text-orange-600">{approvalStats.pending_review || 0}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <p className="text-gray-600 text-sm">Mis Pendientes</p>
                  <p className="text-3xl font-bold text-blue-600">{approvalStats.my_pending || 0}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <p className="text-gray-600 text-sm">Aprobados (7 días)</p>
                  <p className="text-3xl font-bold text-green-600">{approvalStats.approved_this_week || 0}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <p className="text-gray-600 text-sm">Revisiones Solicitadas</p>
                  <p className="text-3xl font-bold text-red-600">{approvalStats.revisions_this_week || 0}</p>
                </div>
              </div>

              {/* Approval Queue */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="font-semibold text-black">📋 Cola de Aprobaciones</h3>
                  <p className="text-sm text-gray-500">Contenido pendiente de revisión y aprobación</p>
                </div>
                
                {approvalQueue.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <span className="text-5xl block mb-4">✅</span>
                    <p className="text-lg font-medium">No hay contenido pendiente de aprobación</p>
                    <p className="text-sm text-gray-400 mt-1">¡Todo está al día!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {approvalQueue.map(item => (
                      <div 
                        key={item.id} 
                        className="p-5 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleOpenApproval(item)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xl">{getPlatformIcon(item.platform)}</span>
                              <h4 className="font-semibold text-black">
                                {item.campaign || item.idea_tema || 'Sin título'}
                              </h4>
                              {item.current_revision > 1 && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                                  Revisión #{item.current_revision}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {item.customer_name} • {item.content_type || 'Post'}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-400">
                              <span>📅 {item.scheduled_date ? new Date(item.scheduled_date).toLocaleDateString('es-ES') : '—'}</span>
                              {item.designer_name && <span>🎨 {item.designer_name}</span>}
                              {item.cm_name && <span>📱 {item.cm_name}</span>}
                              {item.approver_name && <span>👤 Aprobador: {item.approver_name}</span>}
                            </div>
                            {item.rejection_reason && (
                              <div className="mt-2 text-xs bg-red-50 text-red-700 px-3 py-2 rounded-lg">
                                ⚠️ Última corrección: {item.rejection_reason.substring(0, 100)}...
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 ml-4">
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
                              className="text-sm bg-black text-white px-5 py-2 rounded-lg hover:bg-gray-800 transition-colors font-medium"
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

          {/* TASKS TAB CONTENT */}
          {activeTab === 'tasks' && (
            <>
          {/* View Mode Toggle */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-4 py-2 rounded-md text-sm transition-colors ${
                  viewMode === 'kanban' ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:text-black'
                }`}
              >
                📋 Kanban
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-md text-sm transition-colors ${
                  viewMode === 'list' ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:text-black'
                }`}
              >
                📄 Lista
              </button>
            </div>
          </div>

          {/* Kanban View */}
          {viewMode === 'kanban' && (
            <div className="grid grid-cols-4 gap-4">
              {/* Pendientes Column */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-black text-sm">Pendientes</h3>
                  <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold">
                    {getTasksByStatus('pending').length}
                  </span>
                </div>
                <div className="space-y-3">
                  {getTasksByStatus('pending').map(task => (
                    <div
                      key={task.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                    >
                      <h4 className="font-medium text-black text-sm mb-2 line-clamp-2">{task.title}</h4>
                      <p className="text-xs text-gray-500 mb-3">{task.customer_name}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {task.assignee_name?.charAt(0)}
                          </div>
                          <span className="text-xs text-gray-600">{task.assignee_name?.split(' ')[0]}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(task.due_date).getDate()}/{new Date(task.due_date).getMonth() + 1}
                        </span>
                      </div>
                    </div>
                  ))}
                  {getTasksByStatus('pending').length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">Sin tareas</p>
                  )}
                </div>
              </div>

              {/* En Progreso Column */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-black text-sm">En Progreso</h3>
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                    {getTasksByStatus('in_progress').length}
                  </span>
                </div>
                <div className="space-y-3">
                  {getTasksByStatus('in_progress').map(task => (
                    <div
                      key={task.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                    >
                      <h4 className="font-medium text-black text-sm mb-2 line-clamp-2">{task.title}</h4>
                      <p className="text-xs text-gray-500 mb-3">{task.customer_name}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {task.assignee_name?.charAt(0)}
                          </div>
                          <span className="text-xs text-gray-600">{task.assignee_name?.split(' ')[0]}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(task.due_date).getDate()}/{new Date(task.due_date).getMonth() + 1}
                        </span>
                      </div>
                    </div>
                  ))}
                  {getTasksByStatus('in_progress').length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">Sin tareas</p>
                  )}
                </div>
              </div>

              {/* En Revisión Column */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-black text-sm">En Revisión</h3>
                  <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold">
                    {getTasksByStatus('review').length}
                  </span>
                </div>
                <div className="space-y-3">
                  {getTasksByStatus('review').map(task => (
                    <div
                      key={task.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                    >
                      <h4 className="font-medium text-black text-sm mb-2 line-clamp-2">{task.title}</h4>
                      <p className="text-xs text-gray-500 mb-3">{task.customer_name}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {task.assignee_name?.charAt(0)}
                          </div>
                          <span className="text-xs text-gray-600">{task.assignee_name?.split(' ')[0]}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(task.due_date).getDate()}/{new Date(task.due_date).getMonth() + 1}
                        </span>
                      </div>
                    </div>
                  ))}
                  {getTasksByStatus('review').length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">Sin tareas</p>
                  )}
                </div>
              </div>

              {/* Completadas Column */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-black text-sm">Completadas</h3>
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">
                    {getTasksByStatus('completed').length}
                  </span>
                </div>
                <div className="space-y-3">
                  {getTasksByStatus('completed').map(task => (
                    <div
                      key={task.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer opacity-75"
                    >
                      <h4 className="font-medium text-black text-sm mb-2 line-clamp-2">{task.title}</h4>
                      <p className="text-xs text-gray-500 mb-3">{task.customer_name}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {task.assignee_name?.charAt(0)}
                          </div>
                          <span className="text-xs text-gray-600">{task.assignee_name?.split(' ')[0]}</span>
                        </div>
                        <span className="text-xs text-green-600">✓</span>
                      </div>
                    </div>
                  ))}
                  {getTasksByStatus('completed').length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">Sin tareas</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div>
              <div className="flex space-x-2 mb-6">
              {[
                { id: 'all', label: 'Todas' },
                { id: 'pending', label: 'Pendientes' },
                { id: 'in_progress', label: 'En Progreso' },
                { id: 'review', label: 'En Revisión' }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeFilter === filter.id
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
              </div>

              {/* Tasks List */}
              <div className="space-y-4">
            {filteredTasks.map(task => {
              const daysUntil = getDaysUntilDue(task.due_date);
              const isOverdue = daysUntil < 0 && task.status !== 'completed';
              
              return (
                <div
                  key={task.id}
                  className={`bg-white border rounded-lg p-6 hover:shadow-lg transition-all ${
                    isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-base font-semibold text-black">{task.title}</h3>
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          {task.task_type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>👤 {task.customer_name || 'Cliente'}</span>
                        <span>📝 Post #{task.post_number}</span>
                        <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                          📅 {new Date(task.due_date).toLocaleDateString('es-ES')}
                          {isOverdue ? ` (Vencida)` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Assignee */}
                    <div className="flex items-center space-x-2 ml-4">
                      <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white font-bold">
                        {task.assignee_name?.charAt(0) || 'T'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-black">{task.assignee_name}</p>
                        <p className="text-xs text-gray-500">{task.assignee_role}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

                {filteredTasks.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No hay tareas en esta categoría</p>
                  </div>
                )}
              </div>
            </div>
          )}
            </>
          )}
        </div>

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

export default TeamDashboardClean;
