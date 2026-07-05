import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import "./ProjectDetails.css";

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
        <div className="zxpdt">
          <div className="zxpdt-inner">
            <div className="zxpdt-loading">Cargando proyecto…</div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="zxpdt">
          <div className="zxpdt-inner">
            <div className="zxpdt-notfound">
              <div className="big">❌</div>
              <h2>Proyecto No Encontrado</h2>
              <p>El proyecto que buscas no existe.</p>
              <Link to="/projects" className="zxpdt-btn solid">
                ← Volver a Proyectos
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="zxpdt">
        <div className="zxpdt-inner">
          {/* Project Header */}
          <div className="zxpdt-head">
            <div className="zxpdt-head-top">
              <div>
                <div className="zxpdt-eyebrow">Proyecto</div>
                <h1 className="zxpdt-h1">
                  <span className="zxpdt-serif">{project.name}</span>
                </h1>
                {project.description && <p className="zxpdt-desc">{project.description}</p>}
              </div>
              <div className="zxpdt-head-right">
                <span className={`zxpdt-status ${project.status}`}>
                  {getStatusText(project.status)}
                </span>
                <span className="zxpdt-prio">{getPriorityIcon(project.priority)}</span>
                <button
                  onClick={() => navigate('/projects')}
                  className="zxpdt-btn"
                >
                  ← Volver
                </button>
              </div>
            </div>

            {/* Project Info Tiles */}
            <div className="zxpdt-tiles">
              <div className="zxpdt-tile">
                <div className="k">Cliente</div>
                <div className="v">{project.customer_name}</div>
              </div>
              <div className="zxpdt-tile">
                <div className="k">Gerente</div>
                <div className="v">{project.project_manager_name}</div>
              </div>
              <div className="zxpdt-tile">
                <div className="k">Progreso</div>
                <div className="v num">{project.progress_percentage || 0}%</div>
                <div className="zxpdt-track">
                  <div className="zxpdt-fill" style={{ width: `${project.progress_percentage || 0}%` }}></div>
                </div>
              </div>
              <div className="zxpdt-tile">
                <div className="k">Fecha Límite</div>
                <div className="v">
                  {project.due_date ? new Date(project.due_date).toLocaleDateString() : 'No establecida'}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="zxpdt-tabs">
            {[
              { id: 'kanban', label: 'Tablero Kanban', icon: '📋' },
              { id: 'timeline', label: 'Cronograma', icon: '📅' },
              { id: 'team', label: 'Equipo', icon: '👥' },
              { id: 'activity', label: 'Actividad', icon: '📝' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`zxpdt-tab${activeTab === tab.id ? ' active' : ''}`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

        {/* Kanban Board */}
        {activeTab === 'kanban' && (
          <div className="zxpdt-inner" style={{ gap: 18, padding: 0 }}>
            <div className="zxpdt-sec-head">
              <h2>Tablero de Tareas</h2>
              <button
                onClick={() => setShowNewTaskModal(true)}
                className="zxpdt-btn solid"
              >
                ➕ Agregar Tarea
              </button>
            </div>

            {/* Kanban Columns */}
            <div className="zxpdt-kanban">
              {['todo', 'in_progress', 'review', 'completed'].map((status) => (
                <div key={status} className="zxpdt-col">
                  <h3 className="zxpdt-col-head">
                    {getStatusText(status)}
                    <span className="zxpdt-col-count">{tasks.filter(t => t.status === status).length}</span>
                  </h3>

                  <div className="zxpdt-cards">
                    {tasks
                      .filter(task => task.status === status)
                      .map((task) => (
                        <div
                          key={task.id}
                          className="zxpdt-task"
                          onClick={() => {/* Open task details modal */}}
                        >
                          <div className="zxpdt-task-top">
                            <h4>{task.title}</h4>
                            <span>{getPriorityIcon(task.priority)}</span>
                          </div>

                          {task.description && (
                            <p className="zxpdt-task-desc">{task.description}</p>
                          )}

                          <div className="zxpdt-task-foot">
                            <div className="zxpdt-who">
                              {task.assignee_name && (
                                <div className="zxpdt-avatar">
                                  {task.assignee_name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span>{task.assignee_name}</span>
                            </div>

                            <select
                              value={task.status}
                              onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                              className="zxpdt-select"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="todo">Por Hacer</option>
                              <option value="in_progress">En Progreso</option>
                              <option value="review">En Revisión</option>
                              <option value="completed">Completado</option>
                            </select>
                          </div>

                          {task.due_date && (
                            <div className="zxpdt-due">
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
          <div className="zxpdt-inner" style={{ gap: 18, padding: 0 }}>
            <div className="zxpdt-sec-head">
              <h2>📝 Actividad del Proyecto</h2>
            </div>

            <div className="zxpdt-panel">
              <div className="zxpdt-activity">
                {activity.map((item, index) => (
                  <div key={item.id} className="zxpdt-act-row">
                    <div className="zxpdt-avatar">
                      {item.user_name?.charAt(0).toUpperCase() || '?'}
                    </div>

                    <div className="zxpdt-act-body">
                      <div className="zxpdt-act-meta">
                        <span className="name">{item.user_name}</span>
                        <span className="time">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="zxpdt-act-desc">{item.description}</p>
                    </div>
                  </div>
                ))}

                {activity.length === 0 && (
                  <div className="zxpdt-empty">
                    <div className="big">📝</div>
                    <p>No hay actividad aún</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* New Task Modal */}
      {showNewTaskModal && (
        <div className="zxpdt-overlay">
          <div className="zxpdt-modal">
            <div className="zxpdt-modal-head">
              <h3>Nueva Tarea</h3>
              <button
                onClick={() => setShowNewTaskModal(false)}
                className="zxpdt-x"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="zxpdt-form">
              <div className="zxpdt-fld">
                <label>Título *</label>
                <input
                  type="text"
                  name="title"
                  required
                  className="zxpdt-input"
                  placeholder="Título de la tarea"
                />
              </div>

              <div className="zxpdt-fld">
                <label>Descripción</label>
                <textarea
                  name="description"
                  rows="3"
                  className="zxpdt-textarea"
                  placeholder="Descripción de la tarea"
                />
              </div>

              <div className="zxpdt-form-row">
                <div className="zxpdt-fld">
                  <label>Estado</label>
                  <select name="status">
                    <option value="todo">Por Hacer</option>
                    <option value="in_progress">En Progreso</option>
                    <option value="review">En Revisión</option>
                    <option value="completed">Completado</option>
                  </select>
                </div>

                <div className="zxpdt-fld">
                  <label>Prioridad</label>
                  <select name="priority">
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </select>
                </div>
              </div>

              <div className="zxpdt-fld">
                <label>Asignar a</label>
                <select name="assignee_id">
                  <option value="">Sin asignar</option>
                  {teamMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="zxpdt-fld">
                <label>Fecha de Vencimiento</label>
                <input
                  type="date"
                  name="due_date"
                  className="zxpdt-input"
                />
              </div>

              <div className="zxpdt-modal-actions">
                <button
                  type="button"
                  onClick={() => setShowNewTaskModal(false)}
                  className="zxpdt-btn"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="zxpdt-btn solid"
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
