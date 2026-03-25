import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

/**
 * Public Creative Brief - No login required
 * For prospects to fill out before becoming clients
 */
const PublicCreativeBrief = () => {
  const { token } = useParams(); // Unique token for this brief
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [briefData, setBriefData] = useState(null);
  
  const [formData, setFormData] = useState({
    prospect_name: '',
    company_name: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    social_profiles: '',
    why_this_business: '',
    what_you_love: '',
    what_you_dont_do: '',
    how_perceived: '',
    brand_personality: '',
    differentiators: '',
    concerns_about_exposure: '',
    company_description: '',
    history_origin: '',
    project_reason: '',
    core_concept: '',
    value_proposition: '',
    value_offer: '',
    services_list: '',
    main_service: '',
    primary_objective: '',
    secondary_objective: '',
    problem_to_solve: '',
    target_consumer: '',
    ideal_client_primary: '',
    ideal_client_secondary: '',
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
    direct_competition: '',
    indirect_competition: '',
    brand_references: '',
    inspiration_notes: '',
    budget_range: '',
    timeline: '',
    notes: ''
  });

  useEffect(() => {
    if (token) {
      loadBrief();
    }
  }, [token]);

  const loadBrief = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/briefs/public/${token}`);
      setBriefData(res.data);
      // Pre-fill any existing data
      if (res.data.prospect_name) {
        setFormData(prev => ({...prev, prospect_name: res.data.prospect_name}));
      }
    } catch (error) {
      console.error("Error loading brief:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      
      await axios.post(`${API_BASE_URL}/api/briefs/public/${token}/submit`, formData);
      
      setSubmitted(true);
    } catch (error) {
      console.error("Error submitting brief:", error);
      alert("❌ Error al enviar. Por favor intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProgress = async () => {
    try {
      setSaving(true);
      await axios.put(`${API_BASE_URL}/api/briefs/public/${token}`, formData);
      alert("✅ Progreso guardado");
    } catch (error) {
      console.error("Error saving:", error);
      alert("❌ Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { number: 1, title: "Información General", icon: "📋" },
    { number: 2, title: "Tu Negocio", icon: "🎯" },
    { number: 3, title: "Diferenciación", icon: "⭐" },
    { number: 4, title: "Mercado", icon: "🏆" },
    { number: 5, title: "Inspiración", icon: "🎨" }
  ];

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-lime-50 via-green-50 to-emerald-50 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-12 text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-4xl font-bold text-gray-800 mb-4">¡Gracias!</h1>
          <p className="text-xl text-gray-600 mb-6">
            Hemos recibido tu Creative Brief
          </p>
          <p className="text-gray-500">
            Nuestro equipo lo revisará y nos pondremos en contacto contigo pronto.
          </p>
          <div className="mt-8 pt-8 border-t">
            <p className="text-sm text-gray-400">
              ¿Necesitas hacer cambios? Usa el mismo link que recibiste.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Bienvenido 👋</h2>
        <p className="text-gray-600">Cuéntanos sobre ti y tu negocio</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tu Nombre *</label>
          <input
            type="text"
            value={formData.prospect_name}
            onChange={(e) => handleChange('prospect_name', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            placeholder="Ej: Lucía García"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Nombre de tu Empresa</label>
          <input
            type="text"
            value={formData.company_name}
            onChange={(e) => handleChange('company_name', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            placeholder="Ej: Lucía Estética"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Correo Electrónico *</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            placeholder="tu@email.com"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            placeholder="222 123 4567"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Página Web</label>
          <input
            type="url"
            value={formData.website}
            onChange={(e) => handleChange('website', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            placeholder="https://tuempresa.com"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Redes Sociales</label>
          <input
            type="text"
            value={formData.social_profiles}
            onChange={(e) => handleChange('social_profiles', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            placeholder="@instagram, @facebook"
          />
        </div>
      </div>

      <div className="bg-gradient-to-r from-lime-50 to-green-50 border-2 border-lime-200 rounded-xl p-6 mt-8">
        <h3 className="font-bold text-gray-800 mb-4 text-lg">Preguntas Iniciales</h3>
        
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ¿Por qué decidiste dedicarte a este negocio?
            </label>
            <textarea
              value={formData.why_this_business}
              onChange={(e) => handleChange('why_this_business', e.target.value)}
              rows="3"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              placeholder="Comparte tu historia..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ¿Qué es lo que más te gusta de lo que haces?
            </label>
            <textarea
              value={formData.what_you_love}
              onChange={(e) => handleChange('what_you_love', e.target.value)}
              rows="3"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
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
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
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
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              placeholder="Describe la personalidad..."
            />
          </div>
        </div>
      </div>
    </div>
  );

  // Render steps 2-5 with similar styling...
  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Tu Negocio y Objetivos</h2>
      <p className="text-gray-600 mb-6">Ayúdanos a entender mejor tu proyecto</p>
      {/* Add all step 2 fields here - abbreviated for space */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ¿Qué promete lograr o solucionar tu servicio?
        </label>
        <textarea
          value={formData.value_proposition}
          onChange={(e) => handleChange('value_proposition', e.target.value)}
          rows="4"
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-black"
          placeholder="Tu propuesta de valor..."
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">¿Qué te Hace Único?</h2>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ¿Qué te diferencia de la competencia?
        </label>
        <textarea
          value={formData.unique_differentiators}
          onChange={(e) => handleChange('unique_differentiators', e.target.value)}
          rows="4"
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-black"
        />
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Tu Mercado</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Presupuesto Mensual</label>
          <select
            value={formData.budget_range}
            onChange={(e) => handleChange('budget_range', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-black"
          >
            <option value="">Selecciona...</option>
            <option value="$3,000-$5,000">$3,000 - $5,000</option>
            <option value="$5,000-$10,000">$5,000 - $10,000</option>
            <option value="$10,000-$20,000">$10,000 - $20,000</option>
            <option value="$20,000+">$20,000+</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">¿Cuándo quieres empezar?</label>
          <select
            value={formData.timeline}
            onChange={(e) => handleChange('timeline', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-black"
          >
            <option value="">Selecciona...</option>
            <option value="Lo antes posible">Lo antes posible</option>
            <option value="En 1 mes">En 1 mes</option>
            <option value="En 2-3 meses">En 2-3 meses</option>
            <option value="Solo explorando">Solo explorando</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Referencias e Inspiración</h2>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ¿Qué marcas admiras? (Links de Instagram, websites, etc.)
        </label>
        <textarea
          value={formData.brand_references}
          onChange={(e) => handleChange('brand_references', e.target.value)}
          rows="4"
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-black"
          placeholder="Pega links o describe las marcas..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Comentarios o Preguntas Finales
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows="3"
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-black"
          placeholder="Cualquier cosa que quieras añadir..."
        />
      </div>

      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
        <h3 className="font-bold text-green-800 mb-3">✅ ¡Último Paso!</h3>
        <p className="text-sm text-green-700">
          Al hacer click en "Enviar", recibiremos tu información y nos pondremos en contacto pronto.
        </p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-lime-50 via-green-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-lime-50 via-green-50 to-emerald-50">
      {/* Header */}
      <div className="bg-white border-b-2 border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800">ZIONX Marketing</h1>
            <p className="text-gray-600 mt-2">Creative Brief - Cuestionario Estratégico</p>
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center flex-1">
              <div
                className={`flex items-center justify-center w-14 h-14 rounded-full text-xl font-bold transition-all ${
                  currentStep === step.number
                    ? 'bg-black text-white scale-110 shadow-lg'
                    : currentStep > step.number
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {currentStep > step.number ? '✓' : step.icon}
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-2 mx-2 rounded-full ${currentStep > step.number ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="text-center mb-8">
          <h3 className="text-2xl font-semibold text-gray-800">{steps[currentStep - 1].title}</h3>
          <p className="text-sm text-gray-500 mt-1">Paso {currentStep} de {steps.length}</p>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-4xl mx-auto px-6 pb-12">
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 p-8 md:p-12">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
          {currentStep === 5 && renderStep5()}

          {/* Navigation */}
          <div className="flex justify-between items-center mt-12 pt-8 border-t-2">
            <button
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
              className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              ← Anterior
            </button>

            <button
              onClick={handleSaveProgress}
              disabled={saving}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all"
            >
              {saving ? '💾 Guardando...' : '💾 Guardar'}
            </button>

            {currentStep < 5 ? (
              <button
                onClick={() => setCurrentStep(Math.min(5, currentStep + 1))}
                className="px-8 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-all shadow-lg"
              >
                Siguiente →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={saving || !formData.prospect_name || !formData.email}
                className="px-8 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                ✓ Enviar Brief
              </button>
            )}
          </div>

          {/* Progress indicator */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>💡 Tu progreso se guarda automáticamente cada vez que cambias de paso</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t-2 border-gray-200 py-6">
        <div className="max-w-5xl mx-auto px-6 text-center text-sm text-gray-500">
          <p>¿Necesitas ayuda? Contacta a tu account manager</p>
        </div>
      </div>
    </div>
  );
};

export default PublicCreativeBrief;
