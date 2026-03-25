import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zionx-primary mb-6">📋 Información General</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del Cliente *</label>
          <input
            type="text"
            value={formData.prospect_name}
            onChange={(e) => handleChange('prospect_name', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
            placeholder="Ej: Lucía García"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Nombre de la Empresa</label>
          <input
            type="text"
            value={formData.company_name}
            onChange={(e) => handleChange('company_name', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
            placeholder="Ej: Lucía Estética"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Correo Electrónico</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
            placeholder="cliente@ejemplo.com"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
            placeholder="222 123 4567"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Dirección</label>
        <input
          type="text"
          value={formData.address}
          onChange={(e) => handleChange('address', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          placeholder="Dirección completa"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Página Web</label>
          <input
            type="url"
            value={formData.website}
            onChange={(e) => handleChange('website', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
            placeholder="https://ejemplo.com"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Perfiles de RRSS</label>
          <input
            type="text"
            value={formData.social_profiles}
            onChange={(e) => handleChange('social_profiles', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
            placeholder="@instagram, @facebook"
          />
        </div>
      </div>

      <div className="bg-lime-50 border border-lime-200 rounded-lg p-4">
        <h3 className="font-medium text-gray-800 mb-3">Preguntas Personales</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ¿Por qué decidiste dedicarte a este negocio?
            </label>
            <textarea
              value={formData.why_this_business}
              onChange={(e) => handleChange('why_this_business', e.target.value)}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
              placeholder="Tu respuesta..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ¿Qué te gusta más de esta área?
            </label>
            <textarea
              value={formData.what_you_love}
              onChange={(e) => handleChange('what_you_love', e.target.value)}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
              placeholder="Tu respuesta..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ¿Qué tipo de resultados NO te gusta hacer?
            </label>
            <textarea
              value={formData.what_you_dont_do}
              onChange={(e) => handleChange('what_you_dont_do', e.target.value)}
              rows="2"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
              placeholder="Tu respuesta..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ¿Cómo quieres que te perciban tus clientes?
            </label>
            <textarea
              value={formData.how_perceived}
              onChange={(e) => handleChange('how_perceived', e.target.value)}
              rows="2"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
              placeholder="Tu respuesta..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Si tu marca fuera una persona, ¿cómo sería?
            </label>
            <textarea
              value={formData.brand_personality}
              onChange={(e) => handleChange('brand_personality', e.target.value)}
              rows="2"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
              placeholder="Tu respuesta..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ¿Qué te diferencia de otros competidores?
            </label>
            <textarea
              value={formData.differentiators}
              onChange={(e) => handleChange('differentiators', e.target.value)}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
              placeholder="Tu respuesta..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ¿Te incomoda algo sobre exponerte en redes sociales?
            </label>
            <textarea
              value={formData.concerns_about_exposure}
              onChange={(e) => handleChange('concerns_about_exposure', e.target.value)}
              rows="2"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
              placeholder="Tu respuesta..."
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zionx-primary mb-6">🎯 Negocio y Objetivos</h2>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Descripción de la Empresa</label>
        <textarea
          value={formData.company_description}
          onChange={(e) => handleChange('company_description', e.target.value)}
          rows="4"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          placeholder="Describe tu empresa..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Historia / Origen</label>
        <textarea
          value={formData.history_origin}
          onChange={(e) => handleChange('history_origin', e.target.value)}
          rows="3"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          placeholder="¿Cómo empezó todo?"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ¿Por qué estás llevando a cabo este proyecto?
        </label>
        <textarea
          value={formData.project_reason}
          onChange={(e) => handleChange('project_reason', e.target.value)}
          rows="3"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          placeholder="Tu respuesta..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Concepto Central (Core Concept)
        </label>
        <input
          type="text"
          value={formData.core_concept}
          onChange={(e) => handleChange('core_concept', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          placeholder="La idea principal del proyecto"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ¿Qué promete lograr o solucionar? (Propuesta de Valor)
          </label>
          <textarea
            value={formData.value_proposition}
            onChange={(e) => handleChange('value_proposition', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
            placeholder="Tu respuesta..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ¿Cómo cumple lo que promete? (Oferta de Valor)
          </label>
          <textarea
            value={formData.value_offer}
            onChange={(e) => handleChange('value_offer', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
            placeholder="Tu respuesta..."
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Enlista y Describe Servicios
        </label>
        <textarea
          value={formData.services_list}
          onChange={(e) => handleChange('services_list', e.target.value)}
          rows="4"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          placeholder="1. Servicio A - Descripción&#10;2. Servicio B - Descripción"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Servicio/Producto Principal y Por Qué
        </label>
        <textarea
          value={formData.main_service}
          onChange={(e) => handleChange('main_service', e.target.value)}
          rows="2"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          placeholder="Tu respuesta..."
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-gray-800 mb-3">Objetivos del Proyecto</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Objetivo Principal</label>
            <textarea
              value={formData.primary_objective}
              onChange={(e) => handleChange('primary_objective', e.target.value)}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Objetivo Secundario</label>
            <textarea
              value={formData.secondary_objective}
              onChange={(e) => handleChange('secondary_objective', e.target.value)}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ¿Qué problema vamos a resolver?
          </label>
          <textarea
            value={formData.problem_to_solve}
            onChange={(e) => handleChange('problem_to_solve', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ¿Para qué consumidor resolveremos el problema?
          </label>
          <textarea
            value={formData.target_consumer}
            onChange={(e) => handleChange('target_consumer', e.target.value)}
            rows="2"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cliente Ideal (Primario)</label>
            <textarea
              value={formData.ideal_client_primary}
              onChange={(e) => handleChange('ideal_client_primary', e.target.value)}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cliente Ideal (Secundario)</label>
            <textarea
              value={formData.ideal_client_secondary}
              onChange={(e) => handleChange('ideal_client_secondary', e.target.value)}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zionx-primary mb-6">⭐ Diferenciación y Expertise</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ¿Qué especializaciones, cursos o certificaciones tienes?
          </label>
          <textarea
            value={formData.specializations}
            onChange={(e) => handleChange('specializations', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ¿En qué procedimientos/servicios te sientes más segura?
          </label>
          <textarea
            value={formData.confident_procedures}
            onChange={(e) => handleChange('confident_procedures', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ¿En cuáles NO te sientes lista aún?
          </label>
          <textarea
            value={formData.not_ready_for}
            onChange={(e) => handleChange('not_ready_for', e.target.value)}
            rows="2"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ¿Ya has atendido clientes? ¿Cuántos aproximadamente?
          </label>
          <input
            type="text"
            value={formData.clients_served}
            onChange={(e) => handleChange('clients_served', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
            placeholder="Ej: Sí, aproximadamente 50 clientes"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ¿Qué resultados has logrado que te hayan hecho sentir orgullosa?
          </label>
          <textarea
            value={formData.proud_results}
            onChange={(e) => handleChange('proud_results', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ¿Qué puntos clave debemos informar al cliente potencial sobre tu negocio?
          </label>
          <textarea
            value={formData.key_selling_points}
            onChange={(e) => handleChange('key_selling_points', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ¿Cómo podemos asegurarnos de que lo que se promete realmente se cumple?
          </label>
          <textarea
            value={formData.promise_delivery}
            onChange={(e) => handleChange('promise_delivery', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ¿Cuál es la idea central que debería liderar el proyecto?
          </label>
          <textarea
            value={formData.central_idea}
            onChange={(e) => handleChange('central_idea', e.target.value)}
            rows="2"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ¿Qué emociones quieren despertar en la audiencia cuando piensen en tu negocio?
          </label>
          <textarea
            value={formData.desired_emotions}
            onChange={(e) => handleChange('desired_emotions', e.target.value)}
            rows="2"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
            placeholder="Ej: Confianza, seguridad, bienestar..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              5 Palabras que SÍ Describen tu Negocio
            </label>
            <input
              type="text"
              value={formData.brand_keywords}
              onChange={(e) => handleChange('brand_keywords', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
              placeholder="profesional, innovador, confiable..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              5 Palabras que NO Describen tu Negocio
            </label>
            <input
              type="text"
              value={formData.anti_keywords}
              onChange={(e) => handleChange('anti_keywords', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
              placeholder="barato, improvisado, genérico..."
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ¿Qué significa "éxito" para ti con este proyecto? ¿Cómo lo medirías?
          </label>
          <textarea
            value={formData.success_definition}
            onChange={(e) => handleChange('success_definition', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Métricas de Éxito (KPIs)
          </label>
          <input
            type="text"
            value={formData.success_metrics}
            onChange={(e) => handleChange('success_metrics', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
            placeholder="Ej: 100 clientes nuevos, 10k seguidores..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Aliados Estratégicos / Influencers (usernames)
          </label>
          <input
            type="text"
            value={formData.strategic_allies}
            onChange={(e) => handleChange('strategic_allies', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
            placeholder="@username1, @username2"
          />
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zionx-primary mb-6">🏆 Análisis de Competencia</h2>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ¿Cuál es tu competencia directa?
        </label>
        <textarea
          value={formData.direct_competition}
          onChange={(e) => handleChange('direct_competition', e.target.value)}
          rows="4"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          placeholder="Negocios que ofrecen lo mismo que tú..."
        />
        <p className="text-xs text-gray-500 mt-1">
          Competidores que ofrecen exactamente los mismos servicios
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ¿Cuál es tu competencia indirecta?
        </label>
        <textarea
          value={formData.indirect_competition}
          onChange={(e) => handleChange('indirect_competition', e.target.value)}
          rows="4"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          placeholder="Negocios que resuelven el mismo problema de forma diferente..."
        />
        <p className="text-xs text-gray-500 mt-1">
          Alternativas que los clientes podrían considerar
        </p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-medium text-gray-800 mb-3">Información Adicional del Proyecto</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rango de Presupuesto</label>
            <select
              value={formData.budget_range}
              onChange={(e) => handleChange('budget_range', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
            >
              <option value="">Selecciona...</option>
              <option value="$3,000-$5,000">$3,000 - $5,000</option>
              <option value="$5,000-$10,000">$5,000 - $10,000</option>
              <option value="$10,000-$20,000">$10,000 - $20,000</option>
              <option value="$20,000+">$20,000+</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Timeline del Proyecto</label>
            <select
              value={formData.timeline}
              onChange={(e) => handleChange('timeline', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zionx-primary mb-6">🎨 Referencias e Inspiración</h2>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Adjunta Referencias de Marcas que te Gusten
        </label>
        <textarea
          value={formData.brand_references}
          onChange={(e) => handleChange('brand_references', e.target.value)}
          rows="5"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          placeholder="URLs de Instagram, sitios web, o descripciones de marcas que admiras..."
        />
        <p className="text-xs text-gray-500 mt-1">
          Puedes pegar links de Instagram, websites, o describir las marcas
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notas Adicionales sobre Referencias
        </label>
        <textarea
          value={formData.inspiration_notes}
          onChange={(e) => handleChange('inspiration_notes', e.target.value)}
          rows="3"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          placeholder="¿Qué te gusta de estas referencias? ¿Qué NO te gusta?"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notas / Comentarios Finales
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows="4"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zionx-primary"
          placeholder="Cualquier información adicional que quieras compartir..."
        />
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="font-bold text-green-800 mb-3">🎉 ¡Casi Listo!</h3>
        <p className="text-sm text-green-700 mb-4">
          Has completado el Creative Brief. Ahora puedes:
        </p>
        <ul className="text-sm text-green-700 space-y-2">
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
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-zionx-highlight"></div>
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
              <div>
                <h1 className="text-2xl font-semibold text-black">📝 Creative Brief</h1>
                <p className="text-gray-500 text-sm mt-1">
                  Cuestionario detallado para proyectos de marketing
                </p>
              </div>
              <button
                onClick={() => navigate('/briefs')}
                className="bg-white border border-zionx-secondary px-6 py-2 rounded-lg hover:bg-gray-50"
              >
                ← Volver
              </button>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-8">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div
                  onClick={() => setCurrentStep(step.number)}
                  className={`cursor-pointer flex items-center justify-center w-12 h-12 rounded-full text-xl font-bold transition-all ${
                    currentStep === step.number
                      ? 'bg-zionx-primary text-black scale-110'
                      : currentStep > step.number
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {currentStep > step.number ? '✓' : step.icon}
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-1 mx-2 ${currentStep > step.number ? 'bg-green-500' : 'bg-gray-300'}`} />
                )}
              </div>
            ))}
          </div>

          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold text-gray-800">{steps[currentStep - 1].title}</h3>
            <p className="text-sm text-gray-500">Paso {currentStep} de {steps.length}</p>
          </div>
        </div>

        {/* Form Content */}
        <div className="max-w-4xl mx-auto px-6 pb-8">
          <div className="bg-white rounded-xl border border-zionx-secondary p-8">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
            {currentStep === 5 && renderStep5()}

            {/* Navigation */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t">
              <button
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep === 1}
                className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ← Anterior
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '💾 Guardando...' : '💾 Guardar Progreso'}
              </button>

              {currentStep < 5 ? (
                <button
                  onClick={() => setCurrentStep(Math.min(5, currentStep + 1))}
                  className="px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  onClick={async () => {
                    await handleSave();
                    navigate('/briefs');
                  }}
                  className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
                >
                  ✓ Completar Brief
                </button>
              )}
            </div>

            {/* Quick Actions */}
            {id && (
              <div className="space-y-3 mt-4 pt-4 border-t">
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
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                >
                  🔗 Generar Link Público (para enviar al prospecto)
                </button>

                <div className="flex gap-3">
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
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
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
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
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
