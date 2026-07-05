import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import "./CreateProject.css";

const CreateProject = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    customer_id: '',
    project_manager_id: '',
    start_date: '',
    due_date: '',
    budget: '',
    project_type: 'marketing_campaign',
    priority: 'medium',
    template_id: ''
  });
  const [customers, setCustomers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch customers from API
      const customersRes = await axios.get(`${API_BASE_URL}/customers`, { headers });
      setCustomers(customersRes.data || []);

      // Mock team members for demo
      const mockTeamMembers = [
        { id: 1, name: 'Juan José Barroeta', role: 'Project Manager' },
        { id: 2, name: 'Alice Johnson', role: 'Senior Developer' },
        { id: 3, name: 'Bob Smith', role: 'UI/UX Designer' },
        { id: 4, name: 'Carol Davis', role: 'Content Strategist' }
      ];
      setTeamMembers(mockTeamMembers);
      
      // Mock templates for now
      setTemplates([
        { id: 1, name: 'Lanzamiento de Campaña de Marketing', project_type: 'marketing_campaign' },
        { id: 2, name: 'Rediseño de Sitio Web', project_type: 'website_design' },
        { id: 3, name: 'Auditoría y Optimización SEO', project_type: 'seo_audit' },
        { id: 4, name: 'Estrategia de Redes Sociales', project_type: 'social_media' }
      ]);

    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/projects`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.project) {
        navigate(`/projects/${response.data.project.id}`);
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Error creating project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 1, title: 'Información Básica', icon: '📝', description: 'Detalles del proyecto' },
    { id: 2, title: 'Asignación', icon: '👥', description: 'Equipo y cronograma' },
    { id: 3, title: 'Configuración', icon: '⚙️', description: 'Ajustes y plantilla' }
  ];

  return (
    <Layout>
      <div className="zxcpr">
        <div className="zxcpr-inner">
          {/* Header */}
          <div className="zxcpr-head">
            <button
              onClick={() => navigate('/projects')}
              className="zxcpr-back"
            >
              ← Volver
            </button>
            <div>
              <p className="zxcpr-eyebrow">Nuevo proyecto</p>
              <h1>Crear <span className="zxcpr-serif">nuevo</span> proyecto</h1>
              <p className="sub">Configura un nuevo proyecto de marketing para tu cliente</p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="zxcpr-steps">
            {steps.map((step, index) => (
              <div key={step.id} className="zxcpr-step">
                <div className={`zxcpr-dot ${
                  currentStep > step.id
                    ? 'done'
                    : currentStep === step.id
                      ? 'active'
                      : ''
                }`}>
                  <span>{step.icon}</span>
                </div>
                <div className={`zxcpr-steplabel ${currentStep >= step.id ? 'on' : ''}`}>
                  <div className="t">{step.title}</div>
                  <div className="d">{step.description}</div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`zxcpr-connector ${currentStep > step.id ? 'done' : ''}`} />
                )}
              </div>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="zxcpr-form">
            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <div className="zxcpr-fields">
                <h2>📝 Información del Proyecto</h2>

                <div className="zxcpr-row">
                  <div className="zxcpr-field">
                    <label className="zxcpr-label">Nombre del Proyecto *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="zxcpr-input"
                      placeholder="Ingresa el nombre del proyecto"
                    />
                  </div>

                  <div className="zxcpr-field">
                    <label className="zxcpr-label">Tipo de Proyecto</label>
                    <select
                      name="project_type"
                      value={formData.project_type}
                      onChange={handleInputChange}
                      className="zxcpr-select"
                    >
                      <option value="marketing_campaign">Campaña de Marketing</option>
                      <option value="website_design">Diseño Web</option>
                      <option value="seo_audit">Auditoría SEO</option>
                      <option value="social_media">Redes Sociales</option>
                      <option value="content_creation">Creación de Contenido</option>
                      <option value="brand_identity">Identidad de Marca</option>
                    </select>
                  </div>
                </div>

                <div className="zxcpr-field">
                  <label className="zxcpr-label">Descripción</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                    className="zxcpr-textarea"
                    placeholder="Describe los objetivos y metas del proyecto"
                  />
                </div>

                <div className="zxcpr-row">
                  <div className="zxcpr-field">
                    <label className="zxcpr-label">Prioridad</label>
                    <select
                      name="priority"
                      value={formData.priority}
                      onChange={handleInputChange}
                      className="zxcpr-select"
                    >
                      <option value="low">🟢 Baja</option>
                      <option value="medium">🟡 Media</option>
                      <option value="high">🟠 Alta</option>
                      <option value="critical">🔴 Crítica</option>
                    </select>
                  </div>

                  <div className="zxcpr-field">
                    <label className="zxcpr-label">Presupuesto</label>
                    <input
                      type="number"
                      name="budget"
                      value={formData.budget}
                      onChange={handleInputChange}
                      className="zxcpr-input"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Assignment */}
            {currentStep === 2 && (
              <div className="zxcpr-fields">
                <h2>👥 Equipo y Cronograma</h2>

                <div className="zxcpr-row">
                  <div className="zxcpr-field">
                    <label className="zxcpr-label">Cliente *</label>
                    <select
                      name="customer_id"
                      value={formData.customer_id}
                      onChange={handleInputChange}
                      required
                      className="zxcpr-select"
                    >
                      <option value="">Seleccionar Cliente</option>
                      {customers.map((customer) => {
                        const displayName = customer.business_name
                          ? customer.business_name
                          : `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
                        return (
                          <option key={customer.id} value={customer.id}>
                            {displayName}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="zxcpr-field">
                    <label className="zxcpr-label">Gerente de Proyecto</label>
                    <select
                      name="project_manager_id"
                      value={formData.project_manager_id}
                      onChange={handleInputChange}
                      className="zxcpr-select"
                    >
                      <option value="">Seleccionar Gerente</option>
                      {teamMembers.filter(m => m.role?.toLowerCase().includes('manager')).map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} - {member.role}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="zxcpr-row">
                  <div className="zxcpr-field">
                    <label className="zxcpr-label">Fecha de Inicio</label>
                    <input
                      type="date"
                      name="start_date"
                      value={formData.start_date}
                      onChange={handleInputChange}
                      className="zxcpr-input"
                    />
                  </div>

                  <div className="zxcpr-field">
                    <label className="zxcpr-label">Fecha Límite</label>
                    <input
                      type="date"
                      name="due_date"
                      value={formData.due_date}
                      onChange={handleInputChange}
                      className="zxcpr-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Configuration */}
            {currentStep === 3 && (
              <div className="zxcpr-fields">
                <h2>⚙️ Configuración del Proyecto</h2>

                <div className="zxcpr-field">
                  <label className="zxcpr-label">Plantilla de Proyecto</label>
                  <select
                    name="template_id"
                    value={formData.template_id}
                    onChange={handleInputChange}
                    className="zxcpr-select"
                  >
                    <option value="">Empezar desde cero</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  <p className="zxcpr-hint">
                    Las plantillas proporcionan etapas y tareas preconfiguradas para comenzar rápidamente
                  </p>
                </div>

                {/* Project Summary */}
                <div className="zxcpr-summary">
                  <h3>📋 Resumen del Proyecto</h3>
                  <div className="zxcpr-sumgrid">
                    <div className="zxcpr-sumitem">
                      <span className="k">Nombre</span>
                      <span className="v">{formData.name || 'No establecido'}</span>
                    </div>
                    <div className="zxcpr-sumitem">
                      <span className="k">Tipo</span>
                      <span className="v">{formData.project_type}</span>
                    </div>
                    <div className="zxcpr-sumitem">
                      <span className="k">Cliente</span>
                      <span className="v">
                        {customers.find(c => c.id == formData.customer_id)?.first_name} {customers.find(c => c.id == formData.customer_id)?.last_name || 'No seleccionado'}
                      </span>
                    </div>
                    <div className="zxcpr-sumitem">
                      <span className="k">Gerente</span>
                      <span className="v">
                        {teamMembers.find(m => m.id == formData.project_manager_id)?.name || 'No asignado'}
                      </span>
                    </div>
                    <div className="zxcpr-sumitem">
                      <span className="k">Presupuesto</span>
                      <span className="v">
                        {formData.budget ? `$${parseFloat(formData.budget).toLocaleString()}` : 'No establecido'}
                      </span>
                    </div>
                    <div className="zxcpr-sumitem">
                      <span className="k">Prioridad</span>
                      <span className="v">{formData.priority}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="zxcpr-nav">
              <button
                type="button"
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep === 1}
                className="zxcpr-btn"
              >
                ← Anterior
              </button>

              <div className="zxcpr-pips">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className={`zxcpr-pip ${currentStep >= step.id ? 'on' : ''}`}
                  />
                ))}
              </div>

              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="zxcpr-btn solid"
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading || !formData.name || !formData.customer_id}
                  className="zxcpr-btn solid"
                >
                  {loading ? (
                    <span className="zxcpr-spinner">
                      <i></i>
                      Creando...
                    </span>
                  ) : (
                    '🚀 Crear Proyecto'
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default CreateProject;
