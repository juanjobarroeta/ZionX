import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const EmployeeDashboard = () => {
  const { employeeId } = useParams();
  const [employee, setEmployee] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [uploadingFiles, setUploadingFiles] = useState({});

  const taskStatuses = {
    pending: { label: 'Pendientes', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
    in_progress: { label: 'En Progreso', color: 'bg-blue-100 text-blue-800', icon: '🔄' },
    review: { label: 'En Revisión', color: 'bg-purple-100 text-purple-800', icon: '👀' },
    completed: { label: 'Completadas', color: 'bg-green-100 text-green-800', icon: '✅' },
    overdue: { label: 'Vencidas', color: 'bg-red-100 text-red-800', icon: '⚠️' }
  };

  useEffect(() => {
    fetchEmployeeData();
    fetchEmployeeTasks();
  }, [employeeId]);

  const fetchEmployeeData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // First get all team members
      const allMembersResponse = await axios.get(`${API_BASE_URL}/team-members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const allMembers = allMembersResponse.data.team_members || [];
      const targetEmployee = allMembers.find(member => member.id == employeeId);
      
      if (targetEmployee) {
        setEmployee({
          id: targetEmployee.id,
          name: targetEmployee.name,
          email: targetEmployee.email,
          role: targetEmployee.role,
          skills: targetEmployee.skills || [],
          current_tasks: parseInt(targetEmployee.active_assignments) || 0,
          completed_this_month: Math.floor(Math.random() * 30) + 10, // Mock for now
          rating: (4.0 + Math.random()).toFixed(1)
        });
      } else {
        // Fallback if employee not found
        setEmployee({
          id: employeeId,
          name: `Empleado #${employeeId}`,
          email: `empleado${employeeId}@zionx.com`,
          role: 'designer',
          skills: ['Skill 1', 'Skill 2'],
          current_tasks: 0,
          completed_this_month: 0,
          rating: 4.0
        });
      }
    } catch (error) {
      console.error('Error fetching employee:', error);
      // Fallback mock data with dynamic ID
      setEmployee({
        id: employeeId,
        name: `Empleado #${employeeId}`,
        email: `empleado${employeeId}@zionx.com`,
        role: 'designer',
        skills: ['Photoshop', 'Illustrator'],
        current_tasks: Math.floor(Math.random() * 8) + 1,
        completed_this_month: Math.floor(Math.random() * 30) + 10,
        rating: (4.0 + Math.random()).toFixed(1)
      });
    }
  };

  const fetchEmployeeTasks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/team-members/${employeeId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Real tasks from API:', response.data);
      
      // Use real tasks if available, otherwise fall back to mock data
      if (response.data && response.data.length > 0) {
        // Format real tasks to match expected structure
        const formattedTasks = response.data.map(task => ({
          id: task.id,
          title: task.title,
          description: task.description,
          customer_name: task.customer_name,
          post_number: task.post_number,
          due_date: task.due_date?.split('T')[0], // Format date
          status: task.status === 'todo' ? 'pending' : task.status,
          priority: task.priority,
          task_type: task.task_type,
          required_files: task.required_files || [],
          uploaded_files: task.uploaded_files || [],
          estimated_hours: task.estimated_hours || 2,
          content_details: task.content_details || {}
        }));
        setTasks(formattedTasks);
        return;
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      // Generate dynamic mock tasks based on employee ID
      const taskTemplates = [
        {
          title: 'Diseñar post para Campaña Verano',
          description: 'Crear arte para Instagram post sobre promoción de verano',
          customer_name: 'GRUPO STELLA SAPI DE CV',
          task_type: 'design',
          required_files: ['arte'],
          content_details: {
            campaign: 'Promoción Verano',
            format: 'post',
            idea_tema: 'Promoción especial con descuentos de verano',
            copy_in: 'Aprovecha el verano con nuestras ofertas especiales'
          }
        },
        {
          title: 'Crear contenido para redes sociales',
          description: 'Gestionar publicaciones en Instagram y Facebook',
          customer_name: 'Cliente Premium',
          task_type: 'community_management',
          required_files: ['copy_final'],
          content_details: {
            campaign: 'Engagement Campaign',
            format: 'carousel',
            idea_tema: 'Serie de posts para aumentar engagement',
            copy_in: 'Contenido que conecta con la audiencia'
          }
        },
        {
          title: 'Estrategia de contenido mensual',
          description: 'Planificar calendario de contenido',
          customer_name: 'Startup Tech',
          task_type: 'strategy',
          required_files: ['calendario'],
          content_details: {
            campaign: 'Content Strategy',
            format: 'planning',
            idea_tema: 'Estrategia integral de contenido',
            copy_in: 'Plan de contenido para Q4'
          }
        }
      ];

      // Generate tasks based on employee ID to make them unique
      const employeeTasks = [];
      const baseTaskCount = parseInt(employeeId) || 1;
      
      for (let i = 0; i < Math.min(baseTaskCount, 3); i++) {
        const template = taskTemplates[i % taskTemplates.length];
        employeeTasks.push({
          id: parseInt(employeeId) * 10 + i,
          title: `${template.title} #${employeeId}-${i + 1}`,
          description: template.description,
          customer_name: template.customer_name,
          post_number: baseTaskCount + i,
          due_date: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: i === 0 ? 'pending' : i === 1 ? 'in_progress' : 'pending',
          priority: i === 0 ? 'high' : 'medium',
          task_type: template.task_type,
          required_files: template.required_files,
          uploaded_files: i === 1 ? [`draft_employee_${employeeId}.jpg`] : [],
          estimated_hours: 2 + i,
          content_details: {
            ...template.content_details,
            campaign: `${template.content_details.campaign} - Empleado ${employeeId}`
          }
        });
      }
      
      setTasks(employeeTasks);
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/tasks/${taskId}/status`, 
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      ));
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('Error actualizando estado de la tarea');
    }
  };

  const handleFileUpload = async (taskId, files) => {
    try {
      setUploadingFiles(prev => ({ ...prev, [taskId]: true }));
      
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });
      formData.append('task_id', taskId);

      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/tasks/${taskId}/files`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setTasks(prev => prev.map(task => 
          task.id === taskId 
            ? { ...task, uploaded_files: [...task.uploaded_files, ...response.data.files] }
            : task
        ));
        alert('Archivos subidos exitosamente');
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Error subiendo archivos');
    } finally {
      setUploadingFiles(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getDaysUntilDue = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredTasks = tasks.filter(task => {
    if (activeTab === 'overdue') {
      return getDaysUntilDue(task.due_date) < 0 && task.status !== 'completed';
    }
    return task.status === activeTab;
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-zionx-highlight mx-auto mb-4"></div>
            <p className="text-zionx-accent">Cargando dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-zionx-secondary via-zionx-tertiary to-zionx-secondary">
        {/* Header */}
        <div className="bg-zionx-tertiary border-b border-zionx-secondary">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-br from-zionx-accent to-zionx-primary rounded-full flex items-center justify-center text-white font-bold text-xl">
                  {employee?.name?.charAt(0) || 'E'}
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-zionx-primary font-display">
                    {employee?.name || 'Empleado'}
                  </h1>
                  <p className="text-zionx-accent">
                    {employee?.role === 'designer' ? '🎨 Diseñador' : '📱 Community Manager'}
                  </p>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-sm text-zionx-accent">{employee?.email}</span>
                    <span className="text-sm text-zionx-accent">⭐ {employee?.rating || 'N/A'}</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-white rounded-lg p-3 border border-zionx-secondary">
                  <p className="text-2xl font-bold text-zionx-primary">{employee?.current_tasks || 0}</p>
                  <p className="text-xs text-zionx-accent">Tareas Activas</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-zionx-secondary">
                  <p className="text-2xl font-bold text-green-600">{employee?.completed_this_month || 0}</p>
                  <p className="text-xs text-zionx-accent">Completadas</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-zionx-secondary">
                  <p className="text-2xl font-bold text-orange-600">
                    {tasks.filter(t => getDaysUntilDue(t.due_date) < 0 && t.status !== 'completed').length}
                  </p>
                  <p className="text-xs text-zionx-accent">Vencidas</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Task Tabs */}
          <div className="flex space-x-1 bg-zionx-secondary p-1 rounded-lg mb-6">
            {Object.entries(taskStatuses).map(([status, info]) => (
              <button
                key={status}
                onClick={() => setActiveTab(status)}
                className={`flex-1 py-3 px-4 rounded-md font-semibold transition-all duration-200 ${
                  activeTab === status
                    ? "bg-zionx-accent text-white shadow-lg"
                    : "text-zionx-primary hover:text-white hover:bg-zionx-accent/50"
                }`}
              >
                <span className="block">{info.icon}</span>
                <span className="text-sm">{info.label}</span>
                <span className="text-xs block">
                  ({status === 'overdue' 
                    ? tasks.filter(t => getDaysUntilDue(t.due_date) < 0 && t.status !== 'completed').length
                    : tasks.filter(t => t.status === status).length})
                </span>
              </button>
            ))}
          </div>

          {/* Tasks List */}
          <div className="space-y-4">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-zionx-secondary">
                <span className="text-4xl block mb-4">📋</span>
                <p className="text-zionx-accent">No hay tareas en esta categoría</p>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const daysUntilDue = getDaysUntilDue(task.due_date);
                const isOverdue = daysUntilDue < 0 && task.status !== 'completed';
                
                return (
                  <div key={task.id} className={`bg-white rounded-xl p-6 border ${isOverdue ? 'border-red-300 bg-red-50' : 'border-zionx-secondary'}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-bold text-zionx-primary">{task.title}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                            {task.priority.toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${taskStatuses[task.status]?.color}`}>
                            {taskStatuses[task.status]?.icon} {taskStatuses[task.status]?.label}
                          </span>
                        </div>
                        <p className="text-zionx-accent mb-2">{task.description}</p>
                        <div className="flex items-center space-x-4 text-sm text-zionx-accent">
                          <span>👤 {task.customer_name}</span>
                          <span>📝 Post #{task.post_number}</span>
                          <span>⏱️ {task.estimated_hours}h estimadas</span>
                          <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                            📅 {new Date(task.due_date).toLocaleDateString()}
                            {isOverdue ? ` (${Math.abs(daysUntilDue)} días vencida)` : 
                             daysUntilDue === 0 ? ' (Hoy)' : 
                             daysUntilDue === 1 ? ' (Mañana)' : 
                             daysUntilDue > 0 ? ` (${daysUntilDue} días)` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Content Details */}
                    {task.content_details && (
                      <div className="bg-zionx-tertiary rounded-lg p-4 mb-4">
                        <h4 className="font-semibold text-zionx-primary mb-2">📋 Detalles del Contenido</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-zionx-primary">Campaña:</span>
                            <p className="text-zionx-accent">{task.content_details.campaign}</p>
                          </div>
                          <div>
                            <span className="font-medium text-zionx-primary">Formato:</span>
                            <p className="text-zionx-accent">{task.content_details.format}</p>
                          </div>
                          <div className="md:col-span-2">
                            <span className="font-medium text-zionx-primary">Idea/Tema:</span>
                            <p className="text-zionx-accent">{task.content_details.idea_tema}</p>
                          </div>
                          {task.content_details.copy_in && (
                            <div className="md:col-span-2">
                              <span className="font-medium text-zionx-primary">Copy:</span>
                              <p className="text-zionx-accent">{task.content_details.copy_in}</p>
                            </div>
                          )}
                          {task.content_details.elementos_utilizar && (
                            <div className="md:col-span-2">
                              <span className="font-medium text-zionx-primary">Elementos a utilizar:</span>
                              <p className="text-zionx-accent">{Array.isArray(task.content_details.elementos_utilizar) 
                                ? task.content_details.elementos_utilizar.join(', ') 
                                : task.content_details.elementos_utilizar}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* File Upload Section */}
                    <div className="border-t border-zionx-secondary pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-zionx-primary">📎 Archivos Requeridos</h4>
                        <div className="flex space-x-2">
                          {task.status === 'pending' && (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'in_progress')}
                              className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors"
                            >
                              🔄 Iniciar
                            </button>
                          )}
                          {task.status === 'in_progress' && (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'review')}
                              className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600 transition-colors"
                            >
                              👀 Enviar a Revisión
                            </button>
                          )}
                          {task.status === 'review' && (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'completed')}
                              className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 transition-colors"
                            >
                              ✅ Marcar Completada
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-zionx-primary mb-2">Archivos a entregar:</p>
                          <div className="space-y-1">
                            {task.required_files.map((fileType, idx) => (
                              <div key={idx} className="flex items-center space-x-2">
                                <span className="text-sm text-zionx-accent">📄 {fileType}</span>
                                {task.uploaded_files.some(f => f.includes(fileType)) ? (
                                  <span className="text-green-600 text-xs">✅ Subido</span>
                                ) : (
                                  <span className="text-red-600 text-xs">⏳ Pendiente</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-zionx-primary mb-2">Subir archivos:</p>
                          <div className="flex items-center space-x-2">
                            <input
                              type="file"
                              multiple
                              onChange={(e) => handleFileUpload(task.id, e.target.files)}
                              className="text-sm"
                              disabled={uploadingFiles[task.id]}
                            />
                            {uploadingFiles[task.id] && (
                              <span className="text-sm text-zionx-accent">Subiendo...</span>
                            )}
                          </div>
                          
                          {task.uploaded_files.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-zionx-accent mb-1">Archivos subidos:</p>
                              <div className="space-y-1">
                                {task.uploaded_files.map((file, idx) => (
                                  <div key={idx} className="flex items-center space-x-2">
                                    <span className="text-xs text-green-600">📎 {file}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default EmployeeDashboard;
