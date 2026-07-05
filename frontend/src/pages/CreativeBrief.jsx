import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./CreativeBrief.css";

const CreativeBrief = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    // Basic Info
    prospect_name: '',
    company_name: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    social_profiles: '',
    
    // Personal/Brand Questions
    why_this_business: '',
    what_you_love: '',
    what_you_dont_do: '',
    how_perceived: '',
    brand_personality: '',
    differentiators: '',
    concerns_about_exposure: '',
    
    // Business Description
    company_description: '',
    history_origin: '',
    project_reason: '',
    core_concept: '',
    value_proposition: '',
    value_offer: '',
    services_list: '',
    main_service: '',
    
    // Objectives
    primary_objective: '',
    secondary_objective: '',
    problem_to_solve: '',
    target_consumer: '',
    ideal_client_primary: '',
    ideal_client_secondary: '',
    
    // Expertise
    specializations: '',
    confident_procedures: '',
    unique_differentiators: '',
    not_ready_for: '',
    clients_served: '',
    proud_results: '',
    key_selling_points: '',
    promise_delivery: '',
    central_idea: '',
    desired_emotions: '',
    brand_keywords: '',
    anti_keywords: '',
    success_definition: '',
    success_metrics: '',
    strategic_allies: '',
    
    // Competition
    direct_competition: '',
    indirect_competition: '',
    
    // References
    brand_references: '',
    inspiration_notes: '',
    
    // Additional
    budget_range: '',
    timeline: '',
    notes: ''
  });

  useEffect(() => {
    if (id) {
      loadBrief();
    }
  }, [id]);

  const loadBrief = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/api/briefs/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFormData(res.data);
    } catch (error) {
      console.error("Error loading brief:", error);
      alert("Error al cargar brief");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      
      if (id) {
        await axios.put(`${API_BASE_URL}/api/briefs/${id}`, formData, { headers });
      } else {
        const res = await axios.post(`${API_BASE_URL}/api/briefs`, formData, { headers });
        navigate(`/briefs/${res.data.id}`);
      }
      
      alert("✅ Brief guardado exitosamente");
    } catch (error) {
      console.error("Error saving brief:", error);
      alert("❌ Error al guardar brief");
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { number: 1, title: "Información General", icon: "📋" },
    { number: 2, title: "Negocio y Objetivos", icon: "🎯" },
    { number: 3, title: "Diferenciación", icon: "⭐" },
    { number: 4, title: "Competencia", icon: "🏆" },
    { number: 5, title: "Referencias", icon: "🎨" }
  ];

  const renderStep1 = () => (
    <div className="zxcbr-stack">
      <h2 className="zxcbr-h2">📋 Información General</h2>
      
      <div className="zxcbr-grid2">
        <div>
          <label className="zxcbr-label">Nombre del Cliente *</label>
          <input
            type="text"
            value={formData.prospect_name}
            onChange={(e) => handleChange('prospect_name', e.target.value)}
            className="zxcbr-input"
            placeholder="Ej: Lucía García"
            required
          />
        </div>
        
        <div>
          <label className="zxcbr-label">Nombre de la Empresa</label>
          <input
            type="text"
            value={formData.company_name}
            onChange={(e) => handleChange('company_name', e.target.value)}
            className="zxcbr-input"
            placeholder="Ej: Lucía Estética"
          />
        </div>
        
        <div>
          <label className="zxcbr-label">Correo Electrónico</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className="zxcbr-input"
            placeholder="cliente@ejemplo.com"
          />
        </div>
        
        <div>
          <label className="zxcbr-label">Teléfono</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className="zxcbr-input"
            placeholder="222 123 4567"
          />
        </div>
      </div>

      <div>
        <label className="zxcbr-label">Dirección</label>
        <input
          type="text"
          value={formData.address}
          onChange={(e) => handleChange('address', e.target.value)}
          className="zxcbr-input"
          placeholder="Dirección completa"
        />
      </div>

      <div className="zxcbr-grid2">
        <div>
          <label className="zxcbr-label">Página Web</label>
          <input
            type="url"
            value={formData.website}
            onChange={(e) => handleChange('website', e.target.value)}
            className="zxcbr-input"
            placeholder="https://ejemplo.com"
          />
        </div>
        
        <div>
          <label className="zxcbr-label">Perfiles de RRSS</label>
          <input
            type="text"
            value={formData.social_profiles}
            onChange={(e) => handleChange('social_profiles', e.target.value)}
            className="zxcbr-input"
            placeholder="@instagram, @facebook"
          />
        </div>
      </div>

      <div className="zxcbr-note">
        <h3 className="zxcbr-note-title">Preguntas Personales</h3>
        
        <div className="zxcbr-stack-sm">
          <div>
            <label className="zxcbr-label">
              ¿Por qué decidiste dedicarte a este negocio?
            </label>
            <textarea
              value={formData.why_this_business}
              onChange={(e) => handleChange('why_this_business', e.target.value)}
              rows="3"
              className="zxcbr-input"
              placeholder="Tu respuesta..."
            />
          </div>

          <div>
            <label className="zxcbr-label">
              ¿Qué te gusta más de esta área?
            </label>
            <textarea
              value={formData.what_you_love}
              onChange={(e) => handleChange('what_you_love', e.target.value)}
              rows="3"
              className="zxcbr-input"
              placeholder="Tu respuesta..."
            />
          </div>

          <div>
            <label className="zxcbr-label">
              ¿Qué tipo de resultados NO te gusta hacer?
            </label>
            <textarea
              value={formData.what_you_dont_do}
              onChange={(e) => handleChange('what_you_dont_do', e.target.value)}
              rows="2"
              className="zxcbr-input"
              placeholder="Tu respuesta..."
            />
          </div>

          <div>
            <label className="zxcbr-label">
              ¿Cómo quieres que te perciban tus clientes?
            </label>
            <textarea
              value={formData.how_perceived}
              onChange={(e) => handleChange('how_perceived', e.target.value)}
              rows="2"
              className="zxcbr-input"
              placeholder="Tu respuesta..."
            />
          </div>

          <div>
            <label className="zxcbr-label">
              Si tu marca fuera una persona, ¿cómo sería?
            </label>
            <textarea
              value={formData.brand_personality}
              onChange={(e) => handleChange('brand_personality', e.target.value)}
              rows="2"
              className="zxcbr-input"
              placeholder="Tu respuesta..."
            />
          </div>

          <div>
            <label className="zxcbr-label">
              ¿Qué te diferencia de otros competidores?
            </label>
            <textarea
              value={formData.differentiators}
              onChange={(e) => handleChange('differentiators', e.target.value)}
              rows="3"
              className="zxcbr-input"
              placeholder="Tu respuesta..."
            />
          </div>

          <div>
            <label className="zxcbr-label">
              ¿Te incomoda algo sobre exponerte en redes sociales?
            </label>
            <textarea
              value={formData.concerns_about_exposure}
              onChange={(e) => handleChange('concerns_about_exposure', e.target.value)}
              rows="2"
              className="zxcbr-input"
              placeholder="Tu respuesta..."
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="zxcbr-stack">
      <h2 className="zxcbr-h2">🎯 Negocio y Objetivos</h2>
      
      <div>
        <label className="zxcbr-label">Descripción de la Empresa</label>
        <textarea
          value={formData.company_description}
          onChange={(e) => handleChange('company_description', e.target.value)}
          rows="4"
          className="zxcbr-input"
          placeholder="Describe tu empresa..."
        />
      </div>

      <div>
        <label className="zxcbr-label">Historia / Origen</label>
        <textarea
          value={formData.history_origin}
          onChange={(e) => handleChange('history_origin', e.target.value)}
          rows="3"
          className="zxcbr-input"
          placeholder="¿Cómo empezó todo?"
        />
      </div>

      <div>
        <label className="zxcbr-label">
          ¿Por qué estás llevando a cabo este proyecto?
        </label>
        <textarea
          value={formData.project_reason}
          onChange={(e) => handleChange('project_reason', e.target.value)}
          rows="3"
          className="zxcbr-input"
          placeholder="Tu respuesta..."
        />
      </div>

      <div>
        <label className="zxcbr-label">
          Concepto Central (Core Concept)
        </label>
        <input
          type="text"
          value={formData.core_concept}
          onChange={(e) => handleChange('core_concept', e.target.value)}
          className="zxcbr-input"
          placeholder="La idea principal del proyecto"
        />
      </div>

      <div className="zxcbr-grid2">
        <div>
          <label className="zxcbr-label">
            ¿Qué promete lograr o solucionar? (Propuesta de Valor)
          </label>
          <textarea
            value={formData.value_proposition}
            onChange={(e) => handleChange('value_proposition', e.target.value)}
            rows="3"
            className="zxcbr-input"
            placeholder="Tu respuesta..."
          />
        </div>

        <div>
          <label className="zxcbr-label">
            ¿Cómo cumple lo que promete? (Oferta de Valor)
          </label>
          <textarea
            value={formData.value_offer}
            onChange={(e) => handleChange('value_offer', e.target.value)}
            rows="3"
            className="zxcbr-input"
            placeholder="Tu respuesta..."
          />
        </div>
      </div>

      <div>
        <label className="zxcbr-label">
          Enlista y Describe Servicios
        </label>
        <textarea
          value={formData.services_list}
          onChange={(e) => handleChange('services_list', e.target.value)}
          rows="4"
          className="zxcbr-input"
          placeholder="1. Servicio A - Descripción&#10;2. Servicio B - Descripción"
        />
      </div>

      <div>
        <label className="zxcbr-label">
          Servicio/Producto Principal y Por Qué
        </label>
        <textarea
          value={formData.main_service}
          onChange={(e) => handleChange('main_service', e.target.value)}
          rows="2"
          className="zxcbr-input"
          placeholder="Tu respuesta..."
        />
      </div>

      <div className="zxcbr-note blue">
        <h3 className="zxcbr-note-title">Objetivos del Proyecto</h3>
        
        <div className="zxcbr-grid2">
          <div>
            <label className="zxcbr-label">Objetivo Principal</label>
            <textarea
              value={formData.primary_objective}
              onChange={(e) => handleChange('primary_objective', e.target.value)}
              rows="3"
              className="zxcbr-input"
            />
          </div>

          <div>
            <label className="zxcbr-label">Objetivo Secundario</label>
            <textarea
              value={formData.secondary_objective}
              onChange={(e) => handleChange('secondary_objective', e.target.value)}
              rows="3"
              className="zxcbr-input"
            />
          </div>
        </div>

        <div className="zxcbr-field">
          <label className="zxcbr-label">
            ¿Qué problema vamos a resolver?
          </label>
          <textarea
            value={formData.problem_to_solve}
            onChange={(e) => handleChange('problem_to_solve', e.target.value)}
            rows="3"
            className="zxcbr-input"
          />
        </div>

        <div className="zxcbr-field">
          <label className="zxcbr-label">
            ¿Para qué consumidor resolveremos el problema?
          </label>
          <textarea
            value={formData.target_consumer}
            onChange={(e) => handleChange('target_consumer', e.target.value)}
            rows="2"
            className="zxcbr-input"
          />
        </div>

        <div className="zxcbr-grid2">
          <div>
            <label className="zxcbr-label">Cliente Ideal (Primario)</label>
            <textarea
              value={formData.ideal_client_primary}
              onChange={(e) => handleChange('ideal_client_primary', e.target.value)}
              rows="3"
              className="zxcbr-input"
            />
          </div>

          <div>
            <label className="zxcbr-label">Cliente Ideal (Secundario)</label>
            <textarea
              value={formData.ideal_client_secondary}
              onChange={(e) => handleChange('ideal_client_secondary', e.target.value)}
              rows="3"
              className="zxcbr-input"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="zxcbr-stack">
      <h2 className="zxcbr-h2">⭐ Diferenciación y Expertise</h2>
      
      <div className="zxcbr-stack-sm">
        <div>
          <label className="zxcbr-label">
            ¿Qué especializaciones, cursos o certificaciones tienes?
          </label>
          <textarea
            value={formData.specializations}
            onChange={(e) => handleChange('specializations', e.target.value)}
            rows="3"
            className="zxcbr-input"
          />
        </div>

        <div>
          <label className="zxcbr-label">
            ¿En qué procedimientos/servicios te sientes más segura?
          </label>
          <textarea
            value={formData.confident_procedures}
            onChange={(e) => handleChange('confident_procedures', e.target.value)}
            rows="3"
            className="zxcbr-input"
          />
        </div>

        <div>
          <label className="zxcbr-label">
            ¿En cuáles NO te sientes lista aún?
          </label>
          <textarea
            value={formData.not_ready_for}
            onChange={(e) => handleChange('not_ready_for', e.target.value)}
            rows="2"
            className="zxcbr-input"
          />
        </div>

        <div>
          <label className="zxcbr-label">
            ¿Ya has atendido clientes? ¿Cuántos aproximadamente?
          </label>
          <input
            type="text"
            value={formData.clients_served}
            onChange={(e) => handleChange('clients_served', e.target.value)}
            className="zxcbr-input"
            placeholder="Ej: Sí, aproximadamente 50 clientes"
          />
        </div>

        <div>
          <label className="zxcbr-label">
            ¿Qué resultados has logrado que te hayan hecho sentir orgullosa?
          </label>
          <textarea
            value={formData.proud_results}
            onChange={(e) => handleChange('proud_results', e.target.value)}
            rows="3"
            className="zxcbr-input"
          />
        </div>

        <div>
          <label className="zxcbr-label">
            ¿Qué puntos clave debemos informar al cliente potencial sobre tu negocio?
          </label>
          <textarea
            value={formData.key_selling_points}
            onChange={(e) => handleChange('key_selling_points', e.target.value)}
            rows="3"
            className="zxcbr-input"
          />
        </div>

        <div>
          <label className="zxcbr-label">
            ¿Cómo podemos asegurarnos de que lo que se promete realmente se cumple?
          </label>
          <textarea
            value={formData.promise_delivery}
            onChange={(e) => handleChange('promise_delivery', e.target.value)}
            rows="3"
            className="zxcbr-input"
          />
        </div>

        <div>
          <label className="zxcbr-label">
            ¿Cuál es la idea central que debería liderar el proyecto?
          </label>
          <textarea
            value={formData.central_idea}
            onChange={(e) => handleChange('central_idea', e.target.value)}
            rows="2"
            className="zxcbr-input"
          />
        </div>

        <div>
          <label className="zxcbr-label">
            ¿Qué emociones quieren despertar en la audiencia cuando piensen en tu negocio?
          </label>
          <textarea
            value={formData.desired_emotions}
            onChange={(e) => handleChange('desired_emotions', e.target.value)}
            rows="2"
            className="zxcbr-input"
            placeholder="Ej: Confianza, seguridad, bienestar..."
          />
        </div>

        <div className="zxcbr-grid2">
          <div>
            <label className="zxcbr-label">
              5 Palabras que SÍ Describen tu Negocio
            </label>
            <input
              type="text"
              value={formData.brand_keywords}
              onChange={(e) => handleChange('brand_keywords', e.target.value)}
              className="zxcbr-input"
              placeholder="profesional, innovador, confiable..."
            />
          </div>

          <div>
            <label className="zxcbr-label">
              5 Palabras que NO Describen tu Negocio
            </label>
            <input
              type="text"
              value={formData.anti_keywords}
              onChange={(e) => handleChange('anti_keywords', e.target.value)}
              className="zxcbr-input"
              placeholder="barato, improvisado, genérico..."
            />
          </div>
        </div>

        <div>
          <label className="zxcbr-label">
            ¿Qué significa "éxito" para ti con este proyecto? ¿Cómo lo medirías?
          </label>
          <textarea
            value={formData.success_definition}
            onChange={(e) => handleChange('success_definition', e.target.value)}
            rows="3"
            className="zxcbr-input"
          />
        </div>

        <div>
          <label className="zxcbr-label">
            Métricas de Éxito (KPIs)
          </label>
          <input
            type="text"
            value={formData.success_metrics}
            onChange={(e) => handleChange('success_metrics', e.target.value)}
            className="zxcbr-input"
            placeholder="Ej: 100 clientes nuevos, 10k seguidores..."
          />
        </div>

        <div>
          <label className="zxcbr-label">
            Aliados Estratégicos / Influencers (usernames)
          </label>
          <input
            type="text"
            value={formData.strategic_allies}
            onChange={(e) => handleChange('strategic_allies', e.target.value)}
            className="zxcbr-input"
            placeholder="@username1, @username2"
          />
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="zxcbr-stack">
      <h2 className="zxcbr-h2">🏆 Análisis de Competencia</h2>
      
      <div>
        <label className="zxcbr-label">
          ¿Cuál es tu competencia directa?
        </label>
        <textarea
          value={formData.direct_competition}
          onChange={(e) => handleChange('direct_competition', e.target.value)}
          rows="4"
          className="zxcbr-input"
          placeholder="Negocios que ofrecen lo mismo que tú..."
        />
        <p className="zxcbr-hint">
          Competidores que ofrecen exactamente los mismos servicios
        </p>
      </div>

      <div>
        <label className="zxcbr-label">
          ¿Cuál es tu competencia indirecta?
        </label>
        <textarea
          value={formData.indirect_competition}
          onChange={(e) => handleChange('indirect_competition', e.target.value)}
          rows="4"
          className="zxcbr-input"
          placeholder="Negocios que resuelven el mismo problema de forma diferente..."
        />
        <p className="zxcbr-hint">
          Alternativas que los clientes podrían considerar
        </p>
      </div>

      <div className="zxcbr-note yellow">
        <h3 className="zxcbr-note-title">Información Adicional del Proyecto</h3>
        
        <div className="zxcbr-grid2">
          <div>
            <label className="zxcbr-label">Rango de Presupuesto</label>
            <select
              value={formData.budget_range}
              onChange={(e) => handleChange('budget_range', e.target.value)}
              className="zxcbr-input"
            >
              <option value="">Selecciona...</option>
              <option value="$3,000-$5,000">$3,000 - $5,000</option>
              <option value="$5,000-$10,000">$5,000 - $10,000</option>
              <option value="$10,000-$20,000">$10,000 - $20,000</option>
              <option value="$20,000+">$20,000+</option>
            </select>
          </div>

          <div>
            <label className="zxcbr-label">Timeline del Proyecto</label>
            <select
              value={formData.timeline}
              onChange={(e) => handleChange('timeline', e.target.value)}
              className="zxcbr-input"
            >
              <option value="">Selecciona...</option>
              <option value="Urgente (1-2 semanas)">Urgente (1-2 semanas)</option>
              <option value="Normal (1 mes)">Normal (1 mes)</option>
              <option value="Flexible (2-3 meses)">Flexible (2-3 meses)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="zxcbr-stack">
      <h2 className="zxcbr-h2">🎨 Referencias e Inspiración</h2>
      
      <div>
        <label className="zxcbr-label">
          Adjunta Referencias de Marcas que te Gusten
        </label>
        <textarea
          value={formData.brand_references}
          onChange={(e) => handleChange('brand_references', e.target.value)}
          rows="5"
          className="zxcbr-input"
          placeholder="URLs de Instagram, sitios web, o descripciones de marcas que admiras..."
        />
        <p className="zxcbr-hint">
          Puedes pegar links de Instagram, websites, o describir las marcas
        </p>
      </div>

      <div>
        <label className="zxcbr-label">
          Notas Adicionales sobre Referencias
        </label>
        <textarea
          value={formData.inspiration_notes}
          onChange={(e) => handleChange('inspiration_notes', e.target.value)}
          rows="3"
          className="zxcbr-input"
          placeholder="¿Qué te gusta de estas referencias? ¿Qué NO te gusta?"
        />
      </div>

      <div>
        <label className="zxcbr-label">
          Notas / Comentarios Finales
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows="4"
          className="zxcbr-input"
          placeholder="Cualquier información adicional que quieras compartir..."
        />
      </div>

      <div className="zxcbr-note green">
        <h3 className="zxcbr-note-title">🎉 ¡Casi Listo!</h3>
        <p className="zxcbr-note-p">
          Has completado el Creative Brief. Ahora puedes:
        </p>
        <ul className="zxcbr-note-list">
          <li>✅ Guardarlo como borrador</li>
          <li>✅ Enviarlo al prospecto para que lo complete</li>
          <li>✅ Convertirlo en cliente cuando esté listo</li>
          <li>✅ Usarlo para crear la estrategia de marketing</li>
        </ul>
      </div>
    </div>
  );

  if (loading) {
    return (
      <Layout>
        <div className="zxcbr">
          <div className="zxcbr-inner zxcbr-loading">
            <div className="zxcbr-spinner"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="zxcbr">
        <div className="zxcbr-inner">
          {/* Header */}
          <div className="zxcbr-head">
            <div>
              <div className="zxcbr-eyebrow">Creative Brief</div>
              <h1 className="zxcbr-h1">Cuestionario <span className="zxcbr-serif">detallado</span></h1>
              <p className="zxcbr-sub">Para proyectos de marketing</p>
            </div>
            <button
              onClick={() => navigate('/briefs')}
              className="zxcbr-btn"
            >
              ← Volver
            </button>
          </div>

          {/* Progress Steps */}
          <div className="zxcbr-steps">
            {steps.map((step, index) => (
              <div key={step.number} className="zxcbr-stepwrap">
                <div
                  onClick={() => setCurrentStep(step.number)}
                  className={`zxcbr-step ${
                    currentStep === step.number
                      ? 'active'
                      : currentStep > step.number
                      ? 'done'
                      : ''
                  }`}
                >
                  {currentStep > step.number ? '✓' : step.icon}
                </div>
                {index < steps.length - 1 && (
                  <div className={`zxcbr-stepline ${currentStep > step.number ? 'done' : ''}`} />
                )}
              </div>
            ))}
          </div>

          <div className="zxcbr-stephead">
            <h3 className="zxcbr-stepname">{steps[currentStep - 1].title}</h3>
            <p className="zxcbr-stepcount">Paso {currentStep} de {steps.length}</p>
          </div>

          {/* Form Content */}
          <div className="zxcbr-panel">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
            {currentStep === 5 && renderStep5()}

            {/* Navigation */}
            <div className="zxcbr-nav">
              <button
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep === 1}
                className="zxcbr-btn"
              >
                ← Anterior
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="zxcbr-btn"
              >
                {saving ? '💾 Guardando...' : '💾 Guardar Progreso'}
              </button>

              {currentStep < 5 ? (
                <button
                  onClick={() => setCurrentStep(Math.min(5, currentStep + 1))}
                  className="zxcbr-btn solid"
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  onClick={async () => {
                    await handleSave();
                    navigate('/briefs');
                  }}
                  className="zxcbr-btn ok"
                >
                  ✓ Completar Brief
                </button>
              )}
            </div>

            {/* Quick Actions */}
            {id && (
              <div className="zxcbr-actions">
                <button
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem("token");
                      const res = await axios.post(`${API_BASE_URL}/api/briefs/${id}/generate-link`, {}, {
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      const link = res.data.public_link || `${window.location.origin}/public-brief/${res.data.token}`;
                      
                      // Copy to clipboard
                      navigator.clipboard.writeText(link);
                      
                      alert(`✅ Link copiado al portapapeles:\n\n${link}\n\nEnvía este link al prospecto para que llene el brief sin necesidad de login.`);
                    } catch (error) {
                      alert("❌ Error al generar link");
                    }
                  }}
                  className="zxcbr-btn solid full"
                >
                  🔗 Generar Link Público (para enviar al prospecto)
                </button>

                <div className="zxcbr-actions-row">
                  <button
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem("token");
                        await axios.post(`${API_BASE_URL}/api/briefs/${id}/send`, {}, {
                          headers: { Authorization: `Bearer ${token}` }
                        });
                        alert("✅ Brief marcado como enviado");
                      } catch (error) {
                        alert("❌ Error al marcar como enviado");
                      }
                    }}
                    className="zxcbr-btn flex"
                  >
                    📤 Marcar como Enviado
                  </button>

                  <button
                    onClick={async () => {
                      if (!confirm("¿Convertir este prospecto en cliente?")) return;
                      try {
                        const token = localStorage.getItem("token");
                        const res = await axios.post(`${API_BASE_URL}/api/briefs/${id}/convert`, {}, {
                          headers: { Authorization: `Bearer ${token}` }
                        });
                        alert(`✅ Convertido a cliente #${res.data.customer.id}`);
                        navigate('/crm');
                      } catch (error) {
                        alert("❌ Error al convertir");
                      }
                    }}
                    className="zxcbr-btn ok flex"
                  >
                    ✓ Convertir a Cliente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CreativeBrief;
