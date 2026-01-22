import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

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
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate('/projects')}
              className="p-2 bg-zionx-tertiary hover:bg-zionx-secondary text-zionx-primary rounded-lg transition-colors border border-zionx-accent"
            >
              ← Volver
            </button>
            <div>
              <h1 className="text-3xl font-bold text-zionx-primary font-display">Crear Nuevo Proyecto</h1>
              <p className="text-zionx-accent">Configura un nuevo proyecto de marketing para tu cliente</p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-8">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-200 ${
                  currentStep > step.id
                    ? 'bg-zionx-highlight border-zionx-highlight text-white'
                    : currentStep === step.id
                      ? 'bg-zionx-accent border-zionx-accent text-white'
                      : 'bg-zionx-tertiary border-zionx-secondary text-zionx-accent'
                }`}>
                  <span className="text-lg">{step.icon}</span>
                </div>
                <div className="ml-3 min-w-0">
                  <div className={`font-medium text-sm ${
                    currentStep >= step.id ? 'text-zionx-primary' : 'text-zionx-accent'
                  }`}>
                    {step.title}
                  </div>
                  <div className="text-zionx-accent text-xs">{step.description}</div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-8 h-px mx-4 ${
                    currentStep > step.id ? 'bg-zionx-highlight' : 'bg-zionx-secondary'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-gradient-to-br from-white to-zionx-tertiary rounded-xl p-8 border border-zionx-secondary shadow-lg">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-zionx-primary mb-6">📝 Información del Proyecto</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-zionx-primary font-medium mb-2">Nombre del Proyecto *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-zionx-tertiary border border-zionx-secondary rounded-lg text-zionx-primary px-4 py-3 focus:border-zionx-highlight focus:outline-none transition-colors"
                    placeholder="Ingresa el nombre del proyecto"
                  />
                </div>

                <div>
                  <label className="block text-zionx-primary font-medium mb-2">Tipo de Proyecto</label>
                  <select
                    name="project_type"
                    value={formData.project_type}
                    onChange={handleInputChange}
                    className="w-full bg-zionx-tertiary border border-zionx-secondary rounded-lg text-zionx-primary px-4 py-3 focus:border-zionx-highlight focus:outline-none transition-colors"
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

              <div>
                <label className="block text-zionx-primary font-medium mb-2">Descripción</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full bg-zionx-tertiary border border-zionx-secondary rounded-lg text-zionx-primary px-4 py-3 focus:border-zionx-highlight focus:outline-none transition-colors"
                  placeholder="Describe los objetivos y metas del proyecto"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-zionx-primary font-medium mb-2">Prioridad</label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                    className="w-full bg-zionx-tertiary border border-zionx-secondary rounded-lg text-zionx-primary px-4 py-3 focus:border-zionx-highlight focus:outline-none transition-colors"
                  >
                    <option value="low">🟢 Baja</option>
                    <option value="medium">🟡 Media</option>
                    <option value="high">🟠 Alta</option>
                    <option value="critical">🔴 Crítica</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zionx-primary font-medium mb-2">Presupuesto</label>
                  <input
                    type="number"
                    name="budget"
                    value={formData.budget}
                    onChange={handleInputChange}
                    className="w-full bg-zionx-tertiary border border-zionx-secondary rounded-lg text-zionx-primary px-4 py-3 focus:border-zionx-highlight focus:outline-none transition-colors"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Assignment */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-zionx-primary mb-6">👥 Equipo y Cronograma</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-zionx-primary font-medium mb-2">Cliente *</label>
                  <select
                    name="customer_id"
                    value={formData.customer_id}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-zionx-tertiary border border-zionx-secondary rounded-lg text-zionx-primary px-4 py-3 focus:border-zionx-highlight focus:outline-none transition-colors"
                  >
                    <option value="">Seleccionar Cliente</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.first_name} {customer.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-zionx-primary font-medium mb-2">Gerente de Proyecto</label>
                  <select
                    name="project_manager_id"
                    value={formData.project_manager_id}
                    onChange={handleInputChange}
                    className="w-full bg-zionx-tertiary border border-zionx-secondary rounded-lg text-zionx-primary px-4 py-3 focus:border-zionx-highlight focus:outline-none transition-colors"
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-zionx-primary font-medium mb-2">Fecha de Inicio</label>
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                    className="w-full bg-zionx-tertiary border border-zionx-secondary rounded-lg text-zionx-primary px-4 py-3 focus:border-zionx-highlight focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-zionx-primary font-medium mb-2">Fecha Límite</label>
                  <input
                    type="date"
                    name="due_date"
                    value={formData.due_date}
                    onChange={handleInputChange}
                    className="w-full bg-zionx-tertiary border border-zionx-secondary rounded-lg text-zionx-primary px-4 py-3 focus:border-zionx-highlight focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Configuration */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-zionx-primary mb-6">⚙️ Configuración del Proyecto</h2>
              
              <div>
                <label className="block text-zionx-primary font-medium mb-2">Plantilla de Proyecto</label>
                <select
                  name="template_id"
                  value={formData.template_id}
                  onChange={handleInputChange}
                  className="w-full bg-zionx-tertiary border border-zionx-secondary rounded-lg text-zionx-primary px-4 py-3 focus:border-zionx-highlight focus:outline-none transition-colors"
                >
                  <option value="">Empezar desde cero</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-zionx-accent mt-2">
                  Las plantillas proporcionan etapas y tareas preconfiguradas para comenzar rápidamente
                </p>
              </div>

              {/* Project Summary */}
              <div className="bg-zionx-secondary/30 rounded-lg p-6 border border-zionx-accent">
                <h3 className="text-lg font-bold text-zionx-primary mb-4">📋 Resumen del Proyecto</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-zionx-accent">Nombre:</span>
                    <span className="ml-2 font-medium text-zionx-primary">{formData.name || 'No establecido'}</span>
                  </div>
                  <div>
                    <span className="text-zionx-accent">Tipo:</span>
                    <span className="ml-2 font-medium text-zionx-primary">{formData.project_type}</span>
                  </div>
                  <div>
                    <span className="text-zionx-accent">Cliente:</span>
                    <span className="ml-2 font-medium text-zionx-primary">
                      {customers.find(c => c.id == formData.customer_id)?.first_name} {customers.find(c => c.id == formData.customer_id)?.last_name || 'No seleccionado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zionx-accent">Gerente:</span>
                    <span className="ml-2 font-medium text-zionx-primary">
                      {teamMembers.find(m => m.id == formData.project_manager_id)?.name || 'No asignado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zionx-accent">Presupuesto:</span>
                    <span className="ml-2 font-medium text-zionx-primary">
                      {formData.budget ? `$${parseFloat(formData.budget).toLocaleString()}` : 'No establecido'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zionx-accent">Prioridad:</span>
                    <span className="ml-2 font-medium text-zionx-primary">{formData.priority}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-zionx-secondary">
            <button
              type="button"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
              className="bg-zionx-tertiary hover:bg-zionx-secondary disabled:bg-zionx-secondary disabled:cursor-not-allowed text-zionx-primary font-medium px-6 py-3 rounded-lg transition-colors border border-zionx-accent"
            >
              ← Anterior
            </button>

            <div className="flex items-center gap-2">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    currentStep >= step.id ? 'bg-zionx-accent' : 'bg-zionx-secondary'
                  }`}
                />
              ))}
            </div>

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="bg-gradient-to-r from-zionx-accent to-zionx-primary hover:from-zionx-primary hover:to-zionx-accent text-white font-medium px-6 py-3 rounded-lg transition-all duration-200"
              >
                Siguiente →
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || !formData.name || !formData.customer_id}
                className="bg-gradient-to-r from-zionx-highlight to-zionx-accent hover:from-zionx-accent hover:to-zionx-highlight disabled:from-zionx-secondary disabled:to-zionx-tertiary disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
    </Layout>
  );
};

export default CreateProject;
