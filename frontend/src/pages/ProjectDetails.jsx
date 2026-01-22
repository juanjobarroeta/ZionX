import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [stages, setStages] = useState([]);
  const [activity, setActivity] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('kanban');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [selectedStage, setSelectedStage] = useState(null);

  useEffect(() => {
    fetchProjectDetails();
    fetchTeamMembers();
  }, [id]);

  const fetchProjectDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Try to fetch real data from API, fallback to mock data if needed
      try {
        const response = await axios.get(`${API_BASE_URL}/projects/${id}`, { headers });
        
        setProject(response.data.project);
        setTasks(response.data.tasks || []);
        setStages(response.data.stages || []);
        setActivity(response.data.recent_activity || []);
        return; // Exit early if API call succeeds
      } catch (apiError) {
        console.log('API not available, using mock data:', apiError.message);
      }

      // Fallback to mock data if API is not available
      const mockProject = {
        id: parseInt(id),
        name: 'Campaña Digital ZIONX Q1 2025',
        description: 'Lanzamiento completo de campaña digital para el primer trimestre, incluyendo redes sociales, contenido y análisis',
        customer_name: 'Empresa Demo S.A.',
        project_manager_name: 'Juan José Barroeta',
        status: 'active',
        priority: 'high',
        start_date: '2025-01-15',
        due_date: '2025-03-31',
        budget: 15000,
        progress_percentage: 35
      };

      const mockTasks = [
        {
          id: 1,
          title: 'Investigación de Mercado',
          description: 'Análisis completo del mercado objetivo y competencia',
          status: 'completed',
          priority: 'high',
          due_date: '2025-01-25',
          assignee_name: 'Juan José Barroeta'
        },
        {
          id: 2,
          title: 'Estrategia de Contenido',
          description: 'Desarrollo de estrategia de contenido para redes sociales',
          status: 'in_progress',
          priority: 'high',
          due_date: '2025-02-05',
          assignee_name: 'Carol Davis'
        },
        {
          id: 3,
          title: 'Diseño de Assets',
          description: 'Creación de assets visuales para la campaña',
          status: 'todo',
          priority: 'medium',
          due_date: '2025-02-15',
          assignee_name: 'Bob Smith'
        },
        {
          id: 4,
          title: 'Configuración de Campañas',
          description: 'Setup de campañas en plataformas digitales',
          status: 'todo',
          priority: 'high',
          due_date: '2025-02-20',
          assignee_name: 'Alice Johnson'
        },
        {
          id: 5,
          title: 'Análisis y Optimización',
          description: 'Monitoreo y optimización de performance',
          status: 'todo',
          priority: 'medium',
          due_date: '2025-03-30',
          assignee_name: 'Juan José Barroeta'
        }
      ];

      const mockActivity = [
        {
          id: 1,
          user_name: 'Juan José Barroeta',
          description: 'Proyecto creado: Campaña Digital ZIONX Q1 2025',
          created_at: '2025-01-10T10:00:00Z'
        },
        {
          id: 2,
          user_name: 'Juan José Barroeta',
          description: 'Tarea completada: Investigación de Mercado',
          created_at: '2025-01-25T16:30:00Z'
        },
        {
          id: 3,
          user_name: 'Carol Davis',
          description: 'Comenzó trabajo en: Estrategia de Contenido',
          created_at: '2025-01-26T09:15:00Z'
        }
      ];

      setProject(mockProject);
      setTasks(mockTasks);
      setStages([]);
      setActivity(mockActivity);

    } catch (error) {
      console.error('Error fetching project details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/team-members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeamMembers(response.data.team_members || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/tasks/${taskId}/status`, 
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      fetchProjectDetails(); // Refresh data
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-zionx-highlight text-white';
      case 'active': 
      case 'in_progress': return 'bg-zionx-accent text-white';
      case 'review': return 'bg-zionx-secondary text-zionx-primary';
      case 'blocked': return 'bg-zionx-primary text-white';
      case 'planning': return 'bg-zionx-tertiary text-zionx-primary';
      case 'on_hold': return 'bg-zionx-secondary text-zionx-primary';
      case 'cancelled': return 'bg-zionx-accent text-white';
      default: return 'bg-zionx-tertiary text-zionx-primary';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Completado';
      case 'active': return 'Activo';
      case 'in_progress': return 'En Progreso';
      case 'review': return 'En Revisión';
      case 'blocked': return 'Bloqueado';
      case 'todo': return 'Por Hacer';
      case 'planning': return 'Planificación';
      case 'on_hold': return 'En Pausa';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const taskData = {
      project_id: parseInt(id),
      title: formData.get('title'),
      description: formData.get('description'),
      status: formData.get('status'),
      priority: formData.get('priority'),
      assignee_id: formData.get('assignee_id') || null,
      due_date: formData.get('due_date') || null,
      task_type: 'general',
      estimated_hours: 8
    };

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/tasks`, taskData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        // Add the new task to the current tasks list
        const newTask = response.data.task;
        setTasks(prevTasks => [...prevTasks, newTask]);
        
        // Close modal and reset form
        setShowNewTaskModal(false);
        e.target.reset();
        
        console.log('Task created successfully:', newTask);
      }
    } catch (error) {
      console.error('Error creating task:', error);
      // For now, add task locally even if API fails (for demo purposes)
      const newTask = {
        id: Date.now(), // Temporary ID
        ...taskData,
        assignee_name: teamMembers.find(m => m.id == taskData.assignee_id)?.name || null,
        created_at: new Date().toISOString()
      };
      
      setTasks(prevTasks => [...prevTasks, newTask]);
      setShowNewTaskModal(false);
      e.target.reset();
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-zionx-accent mx-auto mb-4"></div>
            <p className="text-zionx-accent">Cargando proyecto...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-zionx-primary mb-2">Proyecto No Encontrado</h2>
          <p className="text-zionx-accent mb-6">El proyecto que buscas no existe.</p>
          <Link
            to="/projects"
            className="bg-gradient-to-r from-zionx-accent to-zionx-primary hover:from-zionx-primary hover:to-zionx-accent text-white font-bold px-6 py-3 rounded-lg transition-all duration-200"
          >
            ← Volver a Proyectos
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Project Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/projects')}
              className="p-2 bg-zionx-tertiary hover:bg-zionx-secondary text-zionx-primary rounded-lg transition-colors border border-zionx-accent"
            >
              ← Volver
            </button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-zionx-primary font-display">{project.name}</h1>
              <p className="text-zionx-accent">{project.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r ${getStatusColor(project.status)} text-white`}>
                {project.status}
              </span>
              <span className="text-2xl">{getPriorityIcon(project.priority)}</span>
            </div>
          </div>

          {/* Project Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-r from-zionx-tertiary to-zionx-secondary p-4 rounded-lg border border-zionx-accent">
              <div className="text-sm text-zionx-accent">Cliente</div>
              <div className="font-bold text-zionx-primary">{project.customer_name}</div>
            </div>
            <div className="bg-gradient-to-r from-zionx-tertiary to-zionx-secondary p-4 rounded-lg border border-zionx-accent">
              <div className="text-sm text-zionx-accent">Gerente</div>
              <div className="font-bold text-zionx-primary">{project.project_manager_name}</div>
            </div>
            <div className="bg-gradient-to-r from-zionx-tertiary to-zionx-secondary p-4 rounded-lg border border-zionx-accent">
              <div className="text-sm text-zionx-accent">Progreso</div>
              <div className="font-bold text-zionx-primary">{project.progress_percentage || 0}%</div>
            </div>
            <div className="bg-gradient-to-r from-zionx-tertiary to-zionx-secondary p-4 rounded-lg border border-zionx-accent">
              <div className="text-sm text-zionx-accent">Fecha Límite</div>
              <div className="font-bold text-zionx-primary">
                {project.due_date ? new Date(project.due_date).toLocaleDateString() : 'No establecida'}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-8 bg-zionx-tertiary p-1 rounded-lg border border-zionx-secondary">
          {[
            { id: 'kanban', label: '📋 Tablero Kanban', icon: '📋' },
            { id: 'timeline', label: '📅 Cronograma', icon: '📅' },
            { id: 'team', label: '👥 Equipo', icon: '👥' },
            { id: 'activity', label: '📝 Actividad', icon: '📝' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-4 rounded-md font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-zionx-accent text-white shadow-lg'
                  : 'text-zionx-accent hover:text-zionx-primary hover:bg-zionx-secondary'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Kanban Board */}
        {activeTab === 'kanban' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-zionx-primary">Tablero de Tareas</h2>
              <button
                onClick={() => setShowNewTaskModal(true)}
                className="bg-gradient-to-r from-zionx-accent to-zionx-primary hover:from-zionx-primary hover:to-zionx-accent text-white font-medium px-4 py-2 rounded-lg transition-all duration-200"
              >
                ➕ Agregar Tarea
              </button>
            </div>

            {/* Kanban Columns */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {['todo', 'in_progress', 'review', 'completed'].map((status) => (
                <div key={status} className="bg-gradient-to-b from-zionx-tertiary to-zionx-secondary rounded-lg p-4 border border-zionx-accent">
                  <h3 className="font-bold text-zionx-primary mb-4 capitalize">
                    {status.replace('_', ' ')} ({tasks.filter(t => t.status === status).length})
                  </h3>
                  
                  <div className="space-y-3">
                    {tasks
                      .filter(task => task.status === status)
                      .map((task) => (
                        <div
                          key={task.id}
                          className="bg-white rounded-lg p-4 border border-zionx-secondary shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
                          onClick={() => {/* Open task details modal */}}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-zionx-primary text-sm">{task.title}</h4>
                            <span className="text-lg">{getPriorityIcon(task.priority)}</span>
                          </div>
                          
                          {task.description && (
                            <p className="text-xs text-zionx-accent mb-3 line-clamp-2">{task.description}</p>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {task.assignee_name && (
                                <div className="w-6 h-6 bg-gradient-to-br from-zionx-accent to-zionx-primary rounded-full flex items-center justify-center">
                                  <span className="text-white text-xs font-bold">
                                    {task.assignee_name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <span className="text-xs text-zionx-accent">{task.assignee_name}</span>
                            </div>
                            
                            <select
                              value={task.status}
                              onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                              className="text-xs bg-zionx-tertiary text-zionx-primary border border-zionx-secondary rounded px-2 py-1 focus:outline-none focus:border-zionx-highlight"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="todo">Por Hacer</option>
                              <option value="in_progress">En Progreso</option>
                              <option value="review">En Revisión</option>
                              <option value="completed">Completado</option>
                            </select>
                          </div>

                          {task.due_date && (
                            <div className="mt-2 text-xs text-zionx-accent">
                              Vence: {new Date(task.due_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Timeline */}
        {activeTab === 'activity' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-zionx-primary">📝 Actividad del Proyecto</h2>
            
            <div className="bg-gradient-to-br from-zionx-tertiary to-zionx-secondary rounded-xl p-6 border border-zionx-accent">
              <div className="space-y-4">
                {activity.map((item, index) => (
                  <div key={item.id} className="flex items-start gap-4 p-4 bg-white rounded-lg border border-zionx-secondary">
                    <div className="w-8 h-8 bg-gradient-to-br from-zionx-accent to-zionx-primary rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">
                        {item.user_name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-zionx-primary">{item.user_name}</span>
                        <span className="text-xs text-zionx-accent">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-zionx-accent">{item.description}</p>
                    </div>
                  </div>
                ))}

                {activity.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">📝</div>
                    <p className="text-zionx-accent">No hay actividad aún</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Task Modal */}
      {showNewTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zionx-primary">Nueva Tarea</h3>
              <button
                onClick={() => setShowNewTaskModal(false)}
                className="text-zionx-accent hover:text-zionx-primary"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zionx-primary mb-1">
                    Título *
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    className="w-full px-3 py-2 border border-zionx-secondary rounded-lg focus:border-zionx-highlight focus:outline-none"
                    placeholder="Título de la tarea"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zionx-primary mb-1">
                    Descripción
                  </label>
                  <textarea
                    name="description"
                    rows="3"
                    className="w-full px-3 py-2 border border-zionx-secondary rounded-lg focus:border-zionx-highlight focus:outline-none"
                    placeholder="Descripción de la tarea"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zionx-primary mb-1">
                      Estado
                    </label>
                    <select
                      name="status"
                      className="w-full px-3 py-2 border border-zionx-secondary rounded-lg focus:border-zionx-highlight focus:outline-none"
                    >
                      <option value="todo">Por Hacer</option>
                      <option value="in_progress">En Progreso</option>
                      <option value="review">En Revisión</option>
                      <option value="completed">Completado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zionx-primary mb-1">
                      Prioridad
                    </label>
                    <select
                      name="priority"
                      className="w-full px-3 py-2 border border-zionx-secondary rounded-lg focus:border-zionx-highlight focus:outline-none"
                    >
                      <option value="low">Baja</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                      <option value="critical">Crítica</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zionx-primary mb-1">
                    Asignar a
                  </label>
                  <select
                    name="assignee_id"
                    className="w-full px-3 py-2 border border-zionx-secondary rounded-lg focus:border-zionx-highlight focus:outline-none"
                  >
                    <option value="">Sin asignar</option>
                    {teamMembers.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zionx-primary mb-1">
                    Fecha de Vencimiento
                  </label>
                  <input
                    type="date"
                    name="due_date"
                    className="w-full px-3 py-2 border border-zionx-secondary rounded-lg focus:border-zionx-highlight focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewTaskModal(false)}
                  className="flex-1 px-4 py-2 bg-zionx-tertiary text-zionx-primary rounded-lg hover:bg-zionx-secondary transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-zionx-accent to-zionx-primary text-white rounded-lg hover:from-zionx-primary hover:to-zionx-accent transition-all"
                >
                  Crear Tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ProjectDetails;
