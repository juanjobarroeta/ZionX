import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import "./ProjectManagement.css";

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
        <div className="zxprj">
          <div className="zxprj-inner">
            <div className="zxprj-loading">Cargando proyectos...</div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="zxprj">
        <div className="zxprj-inner">
        {/* Header */}
        <div className="zxprj-head">
          <div>
            <div className="zxprj-eyebrow">ZIONX / Operaciones</div>
            <h1 className="zxprj-h1">
              Gestión de <span className="zxprj-serif">proyectos</span>
            </h1>
            <p className="zxprj-sub">Gestiona proyectos, tareas y colaboración en equipo</p>
          </div>
          <div className="zxprj-actions">
            <Link to="/projects/new" className="zxprj-btn solid">
              Nuevo proyecto
            </Link>
            <button onClick={fetchProjectData} className="zxprj-btn">
              Actualizar
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="zxprj-stats">
          {[
            { label: 'Total de Proyectos', value: projectStats.total, cls: 'lead' },
            { label: 'Proyectos Activos', value: projectStats.active, cls: 'ok' },
            { label: 'Completados', value: projectStats.completed, cls: '' },
            { label: 'Vencidos', value: projectStats.overdue, cls: 'warn' }
          ].map((stat, idx) => (
            <div key={idx} className={`zxprj-stat ${stat.cls}`}>
              <span className="k">{stat.label}</span>
              <span className="v">{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Navigation Tabs */}
        <div className="zxprj-tabs">
          {[
            { id: 'overview', label: 'Resumen' },
            { id: 'projects', label: 'Proyectos' },
            { id: 'tasks', label: 'Tareas' },
            { id: 'team', label: 'Equipo' },
            { id: 'analytics', label: 'Analíticas' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`zxprj-tab ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="zxprj-stack">
            {/* Recent Projects */}
            <div className="zxprj-panel">
              <h2>Proyectos recientes</h2>
              <div className="zxprj-rows">
                {projects.slice(0, 5).map((project) => (
                  <div key={project.id} className="zxprj-prow">
                    <div className="zxprj-prow-main">
                      <div className={`zxprj-dot ${project.status}`}></div>
                      <div>
                        <h4>{project.name}</h4>
                        <div className="who">{project.customer_name}</div>
                      </div>
                    </div>
                    <div className="zxprj-prow-side">
                      <div className="zxprj-track">
                        <div
                          className="zxprj-fill"
                          style={{ width: `${project.completion_percentage || 0}%` }}
                        ></div>
                      </div>
                      <span className="zxprj-pct">{project.completion_percentage || 0}%</span>
                      <Link to={`/projects/${project.id}`} className="zxprj-arrow">
                        →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Urgent Follow-ups */}
            <div className="zxprj-panel">
              <h2>Seguimientos urgentes</h2>
              <div className="zxprj-rows">
                {followUps.slice(0, 5).map((followUp) => (
                  <div key={followUp.id} className="zxprj-fu">
                    <div>
                      <h4>{followUp.title}</h4>
                      <div className="meta">{followUp.project_name} - {followUp.task_title}</div>
                    </div>
                    <div className="zxprj-fu-side">
                      <span className="zxprj-fu-date">
                        {new Date(followUp.scheduled_for).toLocaleDateString()}
                      </span>
                      <button className="zxprj-check">
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
          <div className="zxprj-stack">
            {/* Filters */}
            <div className="zxprj-filters">
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="zxprj-select"
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
                className="zxprj-select"
              >
                <option value="all">Todas las Prioridades</option>
                <option value="critical">Crítica</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>

            {/* Projects Grid */}
            <div className="zxprj-grid">
              {filteredProjects.map((project) => (
                <div key={project.id} className="zxprj-card">
                  <div className="zxprj-card-top">
                    <div className="pri">
                      <span>{getPriorityIcon(project.priority)}</span>
                      <span className={`zxprj-pill ${project.status}`}>
                        {getStatusText(project.status)}
                      </span>
                    </div>
                    <Link to={`/projects/${project.id}`} className="zxprj-arrow">
                      →
                    </Link>
                  </div>

                  <h3>{project.name}</h3>
                  <p className="desc">{project.description}</p>

                  <div className="zxprj-meta">
                    <div className="zxprj-meta-row">
                      <span className="l">Cliente</span>
                      <span className="r">{project.customer_name}</span>
                    </div>

                    <div className="zxprj-meta-row">
                      <span className="l">Gerente</span>
                      <span className="r">{project.project_manager_name}</span>
                    </div>

                    <div className="zxprj-meta-row">
                      <span className="l">Fecha Límite</span>
                      <span className="r num">
                        {project.due_date ? new Date(project.due_date).toLocaleDateString() : 'No establecida'}
                      </span>
                    </div>

                    <div className="zxprj-prog">
                      <div className="zxprj-meta-row">
                        <span className="l">Progreso</span>
                        <span className="r num">{project.completion_percentage || 0}%</span>
                      </div>
                      <div className="zxprj-track">
                        <div
                          className="zxprj-fill"
                          style={{ width: `${project.completion_percentage || 0}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="zxprj-meta-row tasks">
                      <span className="l">Tareas</span>
                      <span className="r num">
                        {project.completed_tasks || 0}/{project.total_tasks || 0}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredProjects.length === 0 && (
              <div className="zxprj-empty">
                <span className="big">📋</span>
                <div className="lead">No se Encontraron Proyectos</div>
                <p>Crea tu primer proyecto para comenzar</p>
                <Link to="/projects/new" className="zxprj-btn solid">
                  Crear proyecto
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Team Tab */}
        {activeTab === 'team' && (
          <div className="zxprj-stack">
            <div className="zxprj-grid">
              {teamMembers.map((member) => (
                <div key={member.id} className="zxprj-tcard">
                  <div className="zxprj-tcard-head">
                    <div className="zxprj-avatar">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3>{member.name}</h3>
                      <p>{member.role}</p>
                    </div>
                  </div>

                  <div className="zxprj-meta">
                    <div className="zxprj-meta-row">
                      <span className="l">Departamento</span>
                      <span className="r">{member.department}</span>
                    </div>
                    <div className="zxprj-meta-row">
                      <span className="l">Tareas Activas</span>
                      <span className="r num">{member.active_assignments || 0}</span>
                    </div>
                    <div className="zxprj-meta-row">
                      <span className="l">Carga de Trabajo</span>
                      <span className="r num">{member.estimated_workload || 0}h</span>
                    </div>
                  </div>

                  {member.skills && (
                    <div className="zxprj-skills">
                      <div className="k">Habilidades</div>
                      <div className="tags">
                        {member.skills.slice(0, 3).map((skill, idx) => (
                          <span key={idx} className="zxprj-tag">
                            {skill}
                          </span>
                        ))}
                        {member.skills.length > 3 && (
                          <span className="zxprj-tag more">
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
          <div className="zxprj-stack">
            <div className="zxprj-panel">
              <h2>Analíticas de rendimiento de proyectos</h2>

              <div className="zxprj-metrics">
                <div className="zxprj-metric">
                  <span className="k">Tasa de Finalización</span>
                  <span className="v">
                    {projects.length > 0 ? Math.round((projectStats.completed / projects.length) * 100) : 0}%
                  </span>
                </div>

                <div className="zxprj-metric">
                  <span className="k">Progreso Promedio</span>
                  <span className="v">
                    {projects.length > 0
                      ? Math.round(projects.reduce((sum, p) => sum + (p.completion_percentage || 0), 0) / projects.length)
                      : 0}%
                  </span>
                </div>

                <div className="zxprj-metric">
                  <span className="k">Utilización del Equipo</span>
                  <span className="v">
                    {teamMembers.length > 0
                      ? Math.round(teamMembers.reduce((sum, m) => sum + (m.active_assignments || 0), 0) / teamMembers.length)
                      : 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </Layout>
  );
};

export default ProjectManagement;
