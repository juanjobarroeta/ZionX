import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const ProjectManagement = () => {
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    assignee: 'all'
  });

  useEffect(() => {
    fetchProjectData();
  }, []);

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Try to fetch real data from API, fallback to mock data if needed
      try {
        const [projectsRes, teamRes, followUpsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/projects`, { headers }),
          axios.get(`${API_BASE_URL}/team-members`, { headers }),
          axios.get(`${API_BASE_URL}/follow-ups`, { headers })
        ]);

        setProjects(projectsRes.data.projects || []);
        setTeamMembers(teamRes.data.team_members || []);
        setFollowUps(followUpsRes.data.follow_ups || []);
        return; // Exit early if API calls succeed
      } catch (apiError) {
        console.log('API not available, using mock data:', apiError.message);
      }
      
      // Fallback to mock data if API is not available
      const mockProjects = [
        {
          id: 1,
          name: 'Campaña Digital ZIONX Q1 2025',
          description: 'Lanzamiento completo de campaña digital para el primer trimestre, incluyendo redes sociales, contenido y análisis',
          customer_name: 'Empresa Demo S.A.',
          project_manager_name: 'Juan José Barroeta',
          status: 'active',
          priority: 'high',
          start_date: '2025-01-15',
          due_date: '2025-03-31',
          budget: 15000,
          progress_percentage: 35,
          total_tasks: 8,
          completed_tasks: 3,
          created_at: '2025-01-10T10:00:00Z'
        },
        {
          id: 2,
          name: 'Rediseño Web Corporativo',
          description: 'Renovación completa del sitio web con nueva identidad ZIONX',
          customer_name: 'TechStart Inc.',
          project_manager_name: 'Alice Johnson',
          status: 'planning',
          priority: 'medium',
          start_date: '2025-02-01',
          due_date: '2025-04-15',
          budget: 25000,
          progress_percentage: 10,
          total_tasks: 12,
          completed_tasks: 1,
          created_at: '2025-01-08T14:30:00Z'
        },
        {
          id: 3,
          name: 'Estrategia SEO Avanzada',
          description: 'Implementación de estrategia SEO completa con análisis técnico y optimización',
          customer_name: 'Local Business Co.',
          project_manager_name: 'Bob Smith',
          status: 'completed',
          priority: 'low',
          start_date: '2024-12-01',
          due_date: '2025-01-31',
          budget: 8000,
          progress_percentage: 100,
          total_tasks: 6,
          completed_tasks: 6,
          created_at: '2024-11-25T09:15:00Z'
        }
      ];

      const mockTeamMembers = [
        {
          id: 1,
          name: 'Juan José Barroeta',
          email: 'juan@zionx.com',
          role: 'Project Manager',
          department: 'Management',
          skills: ['leadership', 'planning', 'communication'],
          active_assignments: 3,
          estimated_workload: 45
        },
        {
          id: 2,
          name: 'Alice Johnson',
          email: 'alice@zionx.com',
          role: 'Senior Developer',
          department: 'Development',
          skills: ['react', 'node.js', 'postgresql'],
          active_assignments: 2,
          estimated_workload: 35
        },
        {
          id: 3,
          name: 'Bob Smith',
          email: 'bob@zionx.com',
          role: 'UI/UX Designer',
          department: 'Design',
          skills: ['figma', 'adobe-creative', 'user-research'],
          active_assignments: 4,
          estimated_workload: 50
        },
        {
          id: 4,
          name: 'Carol Davis',
          email: 'carol@zionx.com',
          role: 'Content Strategist',
          department: 'Marketing',
          skills: ['copywriting', 'seo', 'social-media'],
          active_assignments: 3,
          estimated_workload: 40
        }
      ];

      const mockFollowUps = [
        {
          id: 1,
          title: 'Recordatorio: Estrategia de Contenido',
          message: 'La tarea "Estrategia de Contenido" vence pronto',
          project_name: 'Campaña Digital ZIONX Q1 2025',
          task_title: 'Estrategia de Contenido',
          scheduled_for: '2025-02-03T10:00:00Z',
          status: 'pending'
        },
        {
          id: 2,
          title: 'Nueva Asignación: Diseño de Assets',
          message: 'Se te ha asignado una nueva tarea',
          project_name: 'Campaña Digital ZIONX Q1 2025',
          task_title: 'Diseño de Assets',
          scheduled_for: '2025-01-20T09:00:00Z',
          status: 'pending'
        }
      ];

      setProjects(mockProjects);
      setTeamMembers(mockTeamMembers);
      setFollowUps(mockFollowUps);

    } catch (error) {
      console.error('Error fetching project data:', error);
      setProjects([]);
      setTeamMembers([]);
      setFollowUps([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'from-zionx-highlight to-zionx-accent';
      case 'active': return 'from-zionx-accent to-zionx-primary';
      case 'on_hold': return 'from-zionx-secondary to-zionx-tertiary';
      case 'cancelled': return 'from-zionx-accent to-zionx-secondary';
      case 'planning': return 'from-zionx-tertiary to-zionx-secondary';
      default: return 'from-zionx-tertiary to-zionx-secondary';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Completado';
      case 'active': return 'Activo';
      case 'on_hold': return 'En Pausa';
      case 'cancelled': return 'Cancelado';
      case 'planning': return 'Planificación';
      default: return status;
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

  const filteredProjects = projects.filter(project => {
    if (filters.status !== 'all' && project.status !== filters.status) return false;
    if (filters.priority !== 'all' && project.priority !== filters.priority) return false;
    return true;
  });

  const projectStats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    overdue: projects.filter(p => new Date(p.due_date) < new Date() && p.status !== 'completed').length
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-zionx-accent mx-auto mb-4"></div>
            <p className="text-zionx-accent">Cargando proyectos...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-zionx-primary mb-2 font-display">
                🎯 Gestión de Proyectos
              </h1>
              <p className="text-zionx-accent">Gestiona proyectos, tareas y colaboración en equipo</p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/projects/new"
                className="bg-gradient-to-r from-zionx-accent to-zionx-primary hover:from-zionx-primary hover:to-zionx-accent text-white font-bold px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                ➕ Nuevo Proyecto
              </Link>
              <button
                onClick={fetchProjectData}
                className="bg-zionx-tertiary hover:bg-zionx-secondary text-zionx-primary font-medium px-4 py-3 rounded-lg transition-colors border border-zionx-accent"
              >
                🔄 Actualizar
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Total de Proyectos', value: projectStats.total, icon: '📊', color: 'from-zionx-accent to-zionx-primary', textColor: 'text-white' },
              { label: 'Proyectos Activos', value: projectStats.active, icon: '🚀', color: 'from-zionx-tertiary to-zionx-secondary', textColor: 'text-zionx-primary' },
              { label: 'Completados', value: projectStats.completed, icon: '✅', color: 'from-zionx-highlight to-zionx-accent', textColor: 'text-white' },
              { label: 'Vencidos', value: projectStats.overdue, icon: '⚠️', color: 'from-zionx-secondary to-zionx-tertiary', textColor: 'text-zionx-primary' }
            ].map((stat, idx) => (
              <div key={idx} className={`bg-gradient-to-r ${stat.color} p-6 rounded-xl ${stat.textColor} shadow-lg border border-zionx-accent/20`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div className="text-3xl">{stat.icon}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-8 bg-zionx-tertiary p-1 rounded-lg border border-zionx-secondary">
          {[
            { id: 'overview', label: '📊 Resumen', icon: '📋' },
            { id: 'projects', label: '🎯 Proyectos', icon: '📁' },
            { id: 'tasks', label: '✅ Tareas', icon: '📝' },
            { id: 'team', label: '👥 Equipo', icon: '👨‍💼' },
            { id: 'analytics', label: '📈 Analíticas', icon: '📊' }
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

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Recent Projects */}
            <div className="bg-gradient-to-br from-zionx-tertiary to-zionx-secondary rounded-xl p-6 border border-zionx-accent">
              <h3 className="text-xl font-bold text-zionx-primary mb-6">🔥 Proyectos Recientes</h3>
              <div className="space-y-4">
                {projects.slice(0, 5).map((project) => (
                  <div key={project.id} className="flex items-center justify-between p-4 bg-white rounded-lg border border-zionx-secondary hover:shadow-lg transition-all duration-200">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${getStatusColor(project.status)}`}></div>
                      <div>
                        <h4 className="font-semibold text-zionx-primary">{project.name}</h4>
                        <p className="text-sm text-zionx-accent">{project.customer_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm">{getPriorityIcon(project.priority)}</span>
                      <div className="w-32 bg-zionx-secondary rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-zionx-highlight to-zionx-accent h-2 rounded-full transition-all duration-300"
                          style={{ width: `${project.completion_percentage || 0}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-zionx-primary">{project.completion_percentage || 0}%</span>
                      <Link
                        to={`/projects/${project.id}`}
                        className="text-zionx-highlight hover:text-zionx-accent transition-colors"
                      >
                        →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Urgent Follow-ups */}
            <div className="bg-gradient-to-br from-zionx-tertiary to-zionx-secondary rounded-xl p-6 border border-zionx-accent">
              <h3 className="text-xl font-bold text-zionx-primary mb-6">⚡ Seguimientos Urgentes</h3>
              <div className="space-y-3">
                {followUps.slice(0, 5).map((followUp) => (
                  <div key={followUp.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-zionx-secondary">
                    <div>
                      <h4 className="font-medium text-zionx-primary">{followUp.title}</h4>
                      <p className="text-sm text-zionx-accent">{followUp.project_name} - {followUp.task_title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zionx-accent">
                        {new Date(followUp.scheduled_for).toLocaleDateString()}
                      </span>
                      <button className="text-zionx-highlight hover:text-zionx-accent transition-colors">
                        ✓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Projects Tab */}
        {activeTab === 'projects' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-zionx-tertiary p-4 rounded-lg border border-zionx-secondary">
              <div className="flex items-center gap-4">
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  className="bg-white text-zionx-primary border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                >
                  <option value="all">Todos los Estados</option>
                  <option value="planning">Planificación</option>
                  <option value="active">Activo</option>
                  <option value="completed">Completado</option>
                  <option value="on_hold">En Pausa</option>
                </select>

                <select
                  value={filters.priority}
                  onChange={(e) => setFilters({...filters, priority: e.target.value})}
                  className="bg-white text-zionx-primary border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                >
                  <option value="all">Todas las Prioridades</option>
                  <option value="critical">Crítica</option>
                  <option value="high">Alta</option>
                  <option value="medium">Media</option>
                  <option value="low">Baja</option>
                </select>
              </div>
            </div>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <div key={project.id} className="bg-gradient-to-br from-white to-zionx-tertiary rounded-xl p-6 border border-zionx-secondary shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getPriorityIcon(project.priority)}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${getStatusColor(project.status)} text-white`}>
                        {getStatusText(project.status)}
                      </span>
                    </div>
                    <Link
                      to={`/projects/${project.id}`}
                      className="text-zionx-highlight hover:text-zionx-accent transition-colors"
                    >
                      🔗
                    </Link>
                  </div>

                  <h3 className="text-lg font-bold text-zionx-primary mb-2 font-display">{project.name}</h3>
                  <p className="text-sm text-zionx-accent mb-4 line-clamp-2">{project.description}</p>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zionx-accent">Cliente:</span>
                      <span className="font-medium text-zionx-primary">{project.customer_name}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zionx-accent">Gerente:</span>
                      <span className="font-medium text-zionx-primary">{project.project_manager_name}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zionx-accent">Fecha Límite:</span>
                      <span className="font-medium text-zionx-primary">
                        {project.due_date ? new Date(project.due_date).toLocaleDateString() : 'No establecida'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zionx-accent">Progreso:</span>
                        <span className="font-medium text-zionx-primary">{project.completion_percentage || 0}%</span>
                      </div>
                      <div className="w-full bg-zionx-secondary rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-zionx-highlight to-zionx-accent h-2 rounded-full transition-all duration-500"
                          style={{ width: `${project.completion_percentage || 0}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm pt-2 border-t border-zionx-secondary">
                      <span className="text-zionx-accent">Tareas:</span>
                      <span className="font-medium text-zionx-primary">
                        {project.completed_tasks || 0}/{project.total_tasks || 0}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredProjects.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-xl font-bold text-zionx-primary mb-2">No se Encontraron Proyectos</h3>
                <p className="text-zionx-accent mb-6">Crea tu primer proyecto para comenzar</p>
                <Link
                  to="/projects/new"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-zionx-accent to-zionx-primary hover:from-zionx-primary hover:to-zionx-accent text-white font-bold px-6 py-3 rounded-lg transition-all duration-200"
                >
                  ➕ Crear Proyecto
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Team Tab */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teamMembers.map((member) => (
                <div key={member.id} className="bg-gradient-to-br from-white to-zionx-tertiary rounded-xl p-6 border border-zionx-secondary shadow-lg">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-zionx-accent to-zionx-primary rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-lg">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-zionx-primary">{member.name}</h3>
                      <p className="text-sm text-zionx-accent">{member.role}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zionx-accent">Departamento:</span>
                      <span className="font-medium text-zionx-primary">{member.department}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zionx-accent">Tareas Activas:</span>
                      <span className="font-medium text-zionx-primary">{member.active_assignments || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zionx-accent">Carga de Trabajo:</span>
                      <span className="font-medium text-zionx-primary">{member.estimated_workload || 0}h</span>
                    </div>
                  </div>

                  {member.skills && (
                    <div className="mt-4">
                      <p className="text-xs text-zionx-accent mb-2">Habilidades:</p>
                      <div className="flex flex-wrap gap-1">
                        {member.skills.slice(0, 3).map((skill, idx) => (
                          <span key={idx} className="px-2 py-1 bg-zionx-secondary text-zionx-primary text-xs rounded-full">
                            {skill}
                          </span>
                        ))}
                        {member.skills.length > 3 && (
                          <span className="px-2 py-1 bg-zionx-accent text-white text-xs rounded-full">
                            +{member.skills.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-zionx-tertiary to-zionx-secondary rounded-xl p-6 border border-zionx-accent">
              <h3 className="text-xl font-bold text-zionx-primary mb-6">📊 Analíticas de Rendimiento de Proyectos</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg p-4 border border-zionx-secondary">
                  <h4 className="font-semibold text-zionx-primary mb-2">Tasa de Finalización</h4>
                  <div className="text-3xl font-bold text-zionx-accent">
                    {projects.length > 0 ? Math.round((projectStats.completed / projects.length) * 100) : 0}%
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border border-zionx-secondary">
                  <h4 className="font-semibold text-zionx-primary mb-2">Progreso Promedio</h4>
                  <div className="text-3xl font-bold text-zionx-accent">
                    {projects.length > 0 
                      ? Math.round(projects.reduce((sum, p) => sum + (p.completion_percentage || 0), 0) / projects.length)
                      : 0}%
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border border-zionx-secondary">
                  <h4 className="font-semibold text-zionx-primary mb-2">Utilización del Equipo</h4>
                  <div className="text-3xl font-bold text-zionx-accent">
                    {teamMembers.length > 0 
                      ? Math.round(teamMembers.reduce((sum, m) => sum + (m.active_assignments || 0), 0) / teamMembers.length)
                      : 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProjectManagement;
