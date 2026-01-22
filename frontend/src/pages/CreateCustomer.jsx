import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";

const CreateCustomer = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationErrors, setValidationErrors] = useState({});
  
  const [form, setForm] = useState({
    // Business Information
    business_name: "",
    commercial_name: "",
    rfc: "",
    tax_regime: "",
    business_type: "Persona Moral",
    industry: "",
    website: "",
    
    // Fiscal Address
    fiscal_address: "",
    fiscal_address2: "",
    fiscal_postal_code: "",
    fiscal_city: "",
    fiscal_state: "",
    
    // Contact Person Information
    contact_first_name: "",
    contact_last_name: "",
    contact_position: "",
    contact_email: "",
    contact_phone: "",
    contact_mobile: "",
    
    // Additional Business Info
    business_size: "",
    employees_count: "",
    annual_revenue: "",
    marketing_budget: "",
    target_market: "",
    current_marketing_channels: "",
    
    // Additional Information
    notes: "",
    referral_source: ""
  });

  const [files, setFiles] = useState({
    business_license: null,
    tax_certificate: null,
    fiscal_address_proof: null,
    legal_representative_id: null
  });

  const [dragActive, setDragActive] = useState({});

  // Step configuration
  const steps = [
    {
      id: 1,
      title: "Información de la Empresa",
      icon: "🏢",
      description: "Datos básicos del negocio"
    },
    {
      id: 2,
      title: "Dirección Fiscal",
      icon: "📍",
      description: "Información fiscal y de facturación"
    },
    {
      id: 3,
      title: "Persona de Contacto",
      icon: "👤",
      description: "Responsable de comunicación"
    },
    {
      id: 4,
      title: "Información de Marketing",
      icon: "📈",
      description: "Datos comerciales y presupuesto"
    },
    {
      id: 5,
      title: "Documentos",
      icon: "📄",
      description: "Documentación empresarial"
    },
    {
      id: 6,
      title: "Confirmación",
      icon: "✅",
      description: "Revisar y crear cliente"
    }
  ];

  // Validation rules
  const validateStep = useCallback((step) => {
    const errors = {};
    
    switch (step) {
      case 1: // Business Information
        if (!form.business_name.trim()) errors.business_name = "Razón social es requerida";
        if (!form.rfc.trim()) errors.rfc = "RFC es requerido";
        if (form.rfc && !/^[A-Z&Ñ]{3}\d{6}[A-Z0-9]{3}$/i.test(form.rfc)) {
          console.log('RFC validation failed for:', form.rfc);
          console.log('RFC length:', form.rfc.length);
          console.log('RFC trimmed:', form.rfc.trim());
          console.log('RFC uppercase:', form.rfc.toUpperCase());
          console.log('RFC regex test:', /^[A-Z&Ñ]{3}\d{6}[A-Z0-9]{3}$/i.test(form.rfc));
          console.log('RFC char by char:', form.rfc.split(''));
          errors.rfc = "Formato de RFC inválido. Use formato: XXX999999XXX (3 letras + 6 números + 3 caracteres)";
        } else {
          console.log('RFC validation passed for:', form.rfc);
        }
        if (!form.industry.trim()) errors.industry = "Giro comercial es requerido";
        break;
        
      case 2: // Fiscal Address
        if (!form.fiscal_address.trim()) errors.fiscal_address = "Dirección fiscal es requerida";
        if (!form.fiscal_postal_code.trim()) errors.fiscal_postal_code = "Código postal es requerido";
        if (form.fiscal_postal_code && !/^\d{5}$/.test(form.fiscal_postal_code)) {
          errors.fiscal_postal_code = "Código postal debe tener 5 dígitos";
        }
        if (!form.fiscal_city.trim()) errors.fiscal_city = "Ciudad es requerida";
        if (!form.fiscal_state.trim()) errors.fiscal_state = "Estado es requerido";
        break;
        
      case 3: // Contact Person
        if (!form.contact_first_name.trim()) errors.contact_first_name = "Nombre del contacto es requerido";
        if (!form.contact_last_name.trim()) errors.contact_last_name = "Apellido del contacto es requerido";
        if (!form.contact_email.trim()) errors.contact_email = "Email del contacto es requerido";
        if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) {
          errors.contact_email = "Formato de email inválido";
        }
        if (!form.contact_phone.trim()) errors.contact_phone = "Teléfono del contacto es requerido";
        if (form.contact_phone && !/^\+?\d{10,}$/.test(form.contact_phone.replace(/\s/g, ''))) {
          errors.contact_phone = "Formato de teléfono inválido";
        }
        break;
        
      case 4: // Marketing Information
        if (!form.business_size.trim()) errors.business_size = "Tamaño de empresa es requerido";
        if (!form.target_market.trim()) errors.target_market = "Mercado objetivo es requerido";
        break;
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    
    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleFileUpload = useCallback((type, file) => {
    if (file && file.size > 10 * 1024 * 1024) { // 10MB limit
      alert("El archivo es demasiado grande. Máximo 10MB.");
      return;
    }
    
    setFiles(prev => ({ ...prev, [type]: file }));
  }, []);

  const handleDrag = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(prev => ({ ...prev, [type]: true }));
    } else if (e.type === "dragleave") {
      setDragActive(prev => ({ ...prev, [type]: false }));
    }
  }, []);

  const handleDrop = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(prev => ({ ...prev, [type]: false }));
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(type, e.dataTransfer.files[0]);
    }
  }, [handleFileUpload]);

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setUploadProgress(0);
    
    const token = localStorage.getItem("token");
    const formData = new FormData();
    
    // Add all form fields
    Object.keys(form).forEach(key => {
      if (form[key]) {
        formData.append(key, form[key]);
      }
    });
    
    // Add files
    Object.keys(files).forEach(type => {
      if (files[type]) {
        formData.append(type, files[type]);
      }
    });

    try {
      const res = await fetch(`${API_BASE_URL}/customers/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.ok) {
        const result = await res.json();
        alert("✅ Cliente creado correctamente");
        navigate("/crm");
      } else {
        const error = await res.json();
        alert(`❌ Error: ${error.message || 'Error al crear cliente'}`);
      }
    } catch (error) {
      console.error("Error creating customer:", error);
      alert("❌ Error de conexión");
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  // Calculate completion percentage
  const completionPercentage = useMemo(() => {
    const requiredFields = {
      1: ['first_name', 'last_name', 'phone', 'curp'],
      2: ['address', 'postal_code'],
      3: ['employment_status', 'income'],
      4: [],
      5: []
    };
    
    const totalRequired = Object.values(requiredFields).flat().length;
    const completed = Object.values(requiredFields).flat().filter(field => form[field]?.trim()).length;
    
    return Math.round((completed / totalRequired) * 100);
  }, [form]);

  const FileUploadZone = ({ type, title, accept, description }) => (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
        dragActive[type] 
          ? 'border-primary-400 bg-primary-50' 
          : files[type] 
            ? 'border-primary-500 bg-primary-50' 
            : 'border-neutral-300 hover:border-neutral-400'
      }`}
      onDragEnter={(e) => handleDrag(e, type)}
      onDragLeave={(e) => handleDrag(e, type)}
      onDragOver={(e) => handleDrag(e, type)}
      onDrop={(e) => handleDrop(e, type)}
    >
      <input
        type="file"
        accept={accept}
        onChange={(e) => handleFileUpload(type, e.target.files[0])}
        className="hidden"
        id={`file-${type}`}
      />
      
      <label htmlFor={`file-${type}`} className="cursor-pointer">
        <div className="text-4xl mb-2">
          {files[type] ? '✅' : '📎'}
        </div>
        <div className="text-neutral-800 font-medium mb-1">{title}</div>
        <div className="text-neutral-600 text-sm mb-3">{description}</div>
        
        {files[type] ? (
          <div className="text-primary-600 text-sm">
            ✓ {files[type].name}
          </div>
        ) : (
          <div className="text-neutral-500 text-sm">
            Arrastra aquí o haz clic para seleccionar
          </div>
        )}
      </label>
    </div>
  );

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-surface-50 to-surface-100 text-neutral-800">
        {/* Header */}
        <div className="bg-white border-b border-neutral-200 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => navigate("/crm")}
                  className="mr-4 p-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 rounded-lg transition-colors"
                >
                  ← Volver
                </button>
                <div>
                  <h1 className="text-3xl font-bold text-zionx-primary">Crear Cliente Empresarial</h1>
                  <p className="text-zionx-accent">Complete la información de la empresa paso a paso</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary-600">{completionPercentage}%</div>
                <div className="text-neutral-600 text-sm">Completado</div>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center space-x-4 overflow-x-auto pb-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center flex-shrink-0">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-200 ${
                    currentStep > step.id
                      ? 'bg-primary-500 border-primary-500 text-neutral-800'
                      : currentStep === step.id
                        ? 'bg-primary-600 border-primary-600 text-neutral-800'
                        : 'bg-neutral-200 border-neutral-300 text-neutral-600'
                  }`}>
                    <span className="text-lg">{step.icon}</span>
                  </div>
                  <div className="ml-3 min-w-0">
                    <div className={`font-medium text-sm ${
                      currentStep >= step.id ? 'text-neutral-800' : 'text-neutral-500'
                    }`}>
                      {step.title}
                    </div>
                    <div className="text-neutral-600 text-xs">{step.description}</div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-8 h-px mx-4 ${
                      currentStep > step.id ? 'bg-primary-500' : 'bg-neutral-300'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="max-w-6xl mx-auto p-6">
          <div className="bg-white rounded-xl p-8 border border-neutral-200 shadow-lg">
            
            {/* Step 1: Personal Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="text-6xl mb-4">🏢</div>
                  <h2 className="text-2xl font-bold text-zionx-primary">Información de la Empresa</h2>
                  <p className="text-zionx-accent">Datos básicos del negocio</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-zionx-primary font-medium mb-2">Razón Social *</label>
                    <input
                      type="text"
                      name="business_name"
                      value={form.business_name}
                      onChange={handleChange}
                      className={`w-full p-3 bg-zionx-tertiary border rounded-lg text-zionx-primary focus:outline-none transition-colors ${
                        validationErrors.business_name ? 'border-red-500' : 'border-zionx-secondary focus:border-zionx-highlight'
                      }`}
                      placeholder="Nombre legal de la empresa"
                    />
                    {validationErrors.business_name && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.business_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-zionx-primary font-medium mb-2">Nombre Comercial</label>
                    <input
                      type="text"
                      name="commercial_name"
                      value={form.commercial_name}
                      onChange={handleChange}
                      className="w-full p-3 bg-zionx-tertiary border border-zionx-secondary rounded-lg text-zionx-primary focus:border-zionx-highlight focus:outline-none transition-colors"
                      placeholder="Nombre comercial (si es diferente)"
                    />
                  </div>

                  <div>
                    <label className="block text-zionx-primary font-medium mb-2">RFC *</label>
                    <input
                      type="text"
                      name="rfc"
                      value={form.rfc}
                      onChange={handleChange}
                      className={`w-full p-3 bg-zionx-tertiary border rounded-lg text-zionx-primary focus:outline-none transition-colors ${
                        validationErrors.rfc ? 'border-red-500' : 'border-zionx-secondary focus:border-zionx-highlight'
                      }`}
                      placeholder="RFC de la empresa"
                      maxLength="13"
                      style={{textTransform: 'uppercase'}}
                    />
                    {validationErrors.rfc && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.rfc}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-zionx-primary font-medium mb-2">Giro Comercial *</label>
                    <select
                      name="industry"
                      value={form.industry}
                      onChange={handleChange}
                      className={`w-full p-3 bg-zionx-tertiary border rounded-lg text-zionx-primary focus:outline-none transition-colors ${
                        validationErrors.industry ? 'border-red-500' : 'border-zionx-secondary focus:border-zionx-highlight'
                      }`}
                    >
                      <option value="">Seleccionar giro</option>
                      <option value="Tecnología">Tecnología</option>
                      <option value="Retail">Retail/Comercio</option>
                      <option value="Servicios">Servicios Profesionales</option>
                      <option value="Manufactura">Manufactura</option>
                      <option value="Salud">Salud y Bienestar</option>
                      <option value="Educación">Educación</option>
                      <option value="Inmobiliario">Inmobiliario</option>
                      <option value="Turismo">Turismo y Hospitalidad</option>
                      <option value="Financiero">Servicios Financieros</option>
                      <option value="Otro">Otro</option>
                    </select>
                    {validationErrors.industry && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.industry}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-zionx-primary font-medium mb-2">Régimen Fiscal *</label>
                    <select
                      name="tax_regime"
                      value={form.tax_regime}
                      onChange={handleChange}
                      className="w-full p-3 bg-zionx-tertiary border border-zionx-secondary rounded-lg text-zionx-primary focus:border-zionx-highlight focus:outline-none transition-colors"
                    >
                      <option value="">Seleccionar régimen</option>
                      <option value="General">General de Ley Personas Morales</option>
                      <option value="Simplificado">Régimen Simplificado de Confianza</option>
                      <option value="RESICO">RESICO</option>
                      <option value="Incorporacion Fiscal">Régimen de Incorporación Fiscal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-zionx-primary font-medium mb-2">Sitio Web</label>
                    <input
                      type="url"
                      name="website"
                      value={form.website}
                      onChange={handleChange}
                      className="w-full p-3 bg-zionx-tertiary border border-zionx-secondary rounded-lg text-zionx-primary focus:border-zionx-highlight focus:outline-none transition-colors"
                      placeholder="https://www.empresa.com"
                    />
                  </div>

                </div>
              </div>
            )}

            {/* Step 2: Fiscal Address Information */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="text-6xl mb-4">📍</div>
                  <h2 className="text-2xl font-bold text-zionx-primary">Dirección Fiscal</h2>
                  <p className="text-zionx-accent">Información fiscal y de facturación</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-zionx-primary font-medium mb-2">Dirección Fiscal *</label>
                    <input
                      type="text"
                      name="fiscal_address"
                      value={form.fiscal_address}
                      onChange={handleChange}
                      className={`w-full p-3 bg-zionx-tertiary border rounded-lg text-zionx-primary focus:outline-none transition-colors ${
                        validationErrors.fiscal_address ? 'border-red-500' : 'border-zionx-secondary focus:border-zionx-highlight'
                      }`}
                      placeholder="Calle, número exterior e interior"
                    />
                    {validationErrors.fiscal_address && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.fiscal_address}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-zionx-primary font-medium mb-2">Información Adicional</label>
                    <input
                      type="text"
                      name="fiscal_address2"
                      value={form.fiscal_address2}
                      onChange={handleChange}
                      className="w-full p-3 bg-zionx-tertiary border border-zionx-secondary rounded-lg text-zionx-primary focus:border-zionx-highlight focus:outline-none transition-colors"
                      placeholder="Colonia, referencias, entre calles"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-medium mb-2">Código Postal *</label>
                    <input
                      type="text"
                      name="fiscal_postal_code"
                      value={form.fiscal_postal_code}
                      onChange={handleChange}
                      className={`w-full p-3 bg-zionx-tertiary border rounded-lg text-zionx-primary focus:outline-none transition-colors ${
                        validationErrors.fiscal_postal_code ? 'border-red-500' : 'border-zionx-secondary focus:border-zionx-highlight'
                      }`}
                      placeholder="12345"
                      maxLength="5"
                    />
                    {validationErrors.fiscal_postal_code && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.fiscal_postal_code}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-zionx-primary font-medium mb-2">Ciudad *</label>
                    <input
                      type="text"
                      name="fiscal_city"
                      value={form.fiscal_city}
                      onChange={handleChange}
                      className={`w-full p-3 bg-zionx-tertiary border rounded-lg text-zionx-primary focus:outline-none transition-colors ${
                        validationErrors.fiscal_city ? 'border-red-500' : 'border-zionx-secondary focus:border-zionx-highlight'
                      }`}
                      placeholder="Ciudad"
                    />
                    {validationErrors.fiscal_city && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.fiscal_city}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-zionx-primary font-medium mb-2">Estado *</label>
                    <select
                      name="fiscal_state"
                      value={form.fiscal_state}
                      onChange={handleChange}
                      className={`w-full p-3 bg-zionx-tertiary border rounded-lg text-zionx-primary focus:outline-none transition-colors ${
                        validationErrors.fiscal_state ? 'border-red-500' : 'border-zionx-secondary focus:border-zionx-highlight'
                      }`}
                    >
                      <option value="">Seleccione estado</option>
                      <option value="Puebla">Puebla</option>
                      <option value="Ciudad de México">Ciudad de México</option>
                      <option value="Tlaxcala">Tlaxcala</option>
                      <option value="Morelos">Morelos</option>
                      <option value="Hidalgo">Hidalgo</option>
                      <option value="Estado de México">Estado de México</option>
                    </select>
                    {validationErrors.fiscal_state && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.fiscal_state}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Financial Information */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="text-6xl mb-4">👤</div>
                  <h2 className="text-2xl font-bold text-zionx-primary">Persona de Contacto</h2>
                  <p className="text-zionx-accent">Responsable de comunicación</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-zionx-primary font-medium mb-2">Nombre del Contacto *</label>
                    <input
                      type="text"
                      name="contact_first_name"
                      value={form.contact_first_name}
                      onChange={handleChange}
                      className={`w-full p-3 bg-zionx-tertiary border rounded-lg text-zionx-primary focus:outline-none transition-colors ${
                        validationErrors.contact_first_name ? 'border-red-500' : 'border-zionx-secondary focus:border-zionx-highlight'
                      }`}
                      placeholder="Nombre del responsable"
                    />
                    {validationErrors.contact_first_name && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.contact_first_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-zionx-primary font-medium mb-2">Apellidos del Contacto *</label>
                    <input
                      type="text"
                      name="contact_last_name"
                      value={form.contact_last_name}
                      onChange={handleChange}
                      className={`w-full p-3 bg-zionx-tertiary border rounded-lg text-zionx-primary focus:outline-none transition-colors ${
                        validationErrors.contact_last_name ? 'border-red-500' : 'border-zionx-secondary focus:border-zionx-highlight'
                      }`}
                      placeholder="Apellidos del responsable"
                    />
                    {validationErrors.contact_last_name && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.contact_last_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-zionx-primary font-medium mb-2">Puesto/Cargo</label>
                    <input
                      type="text"
                      name="contact_position"
                      value={form.contact_position}
                      onChange={handleChange}
                      className="w-full p-3 bg-zionx-tertiary border border-zionx-secondary rounded-lg text-zionx-primary focus:border-zionx-highlight focus:outline-none transition-colors"
                      placeholder="Director de Marketing, Gerente General, etc."
                    />
                  </div>

                  <div>
                    <label className="block text-zionx-primary font-medium mb-2">Email del Contacto *</label>
                    <input
                      type="email"
                      name="contact_email"
                      value={form.contact_email}
                      onChange={handleChange}
                      className={`w-full p-3 bg-zionx-tertiary border rounded-lg text-zionx-primary focus:outline-none transition-colors ${
                        validationErrors.contact_email ? 'border-red-500' : 'border-zionx-secondary focus:border-zionx-highlight'
                      }`}
                      placeholder="contacto@empresa.com"
                    />
                    {validationErrors.contact_email && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.contact_email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-zionx-primary font-medium mb-2">Teléfono del Contacto *</label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 text-sm text-zionx-primary bg-zionx-secondary border border-r-0 border-zionx-secondary rounded-l-lg">
                        🇲🇽 +52
                      </span>
                      <input
                        type="tel"
                        name="contact_phone"
                        value={form.contact_phone}
                        onChange={handleChange}
                        className={`flex-1 p-3 bg-zionx-tertiary border rounded-r-lg text-zionx-primary focus:outline-none transition-colors ${
                          validationErrors.contact_phone ? 'border-red-500' : 'border-zionx-secondary focus:border-zionx-highlight'
                        }`}
                        placeholder="Número de contacto"
                      />
                    </div>
                    {validationErrors.contact_phone && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.contact_phone}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-zionx-primary font-medium mb-2">Teléfono Móvil</label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 text-sm text-zionx-primary bg-zionx-secondary border border-r-0 border-zionx-secondary rounded-l-lg">
                        📱 +52
                      </span>
                      <input
                        type="tel"
                        name="contact_mobile"
                        value={form.contact_mobile}
                        onChange={handleChange}
                        className="flex-1 p-3 bg-zionx-tertiary border border-zionx-secondary rounded-r-lg text-zionx-primary focus:border-zionx-highlight focus:outline-none transition-colors"
                        placeholder="Celular del contacto"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Marketing Information */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="text-6xl mb-4">📈</div>
                  <h2 className="text-2xl font-bold text-zionx-primary">Información de Marketing</h2>
                  <p className="text-zionx-accent">Datos comerciales y presupuesto</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-zionx-primary font-medium mb-2">Tamaño de Empresa *</label>
                    <select
                      name="business_size"
                      value={form.business_size}
                      onChange={handleChange}
                      className={`w-full p-3 bg-zionx-tertiary border rounded-lg text-zionx-primary focus:outline-none transition-colors ${
                        validationErrors.business_size ? 'border-red-500' : 'border-zionx-secondary focus:border-zionx-highlight'
                      }`}
                    >
                      <option value="">Seleccionar tamaño</option>
                      <option value="Micro">Micro (1-10 empleados)</option>
                      <option value="Pequeña">Pequeña (11-50 empleados)</option>
                      <option value="Mediana">Mediana (51-250 empleados)</option>
                      <option value="Grande">Grande (250+ empleados)</option>
                    </select>
                    {validationErrors.business_size && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.business_size}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-zionx-primary font-medium mb-2">Número de Empleados</label>
                    <input
                      type="number"
                      name="employees_count"
                      value={form.employees_count}
                      onChange={handleChange}
                      className="w-full p-3 bg-zionx-tertiary border border-zionx-secondary rounded-lg text-zionx-primary focus:border-zionx-highlight focus:outline-none transition-colors"
                      placeholder="Cantidad aproximada"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-zionx-primary font-medium mb-2">Facturación Anual</label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-zionx-primary">$</span>
                      <input
                        type="number"
                        name="annual_revenue"
                        value={form.annual_revenue}
                        onChange={handleChange}
                        className="w-full pl-8 pr-3 py-3 bg-zionx-tertiary border border-zionx-secondary rounded-lg text-zionx-primary focus:border-zionx-highlight focus:outline-none transition-colors"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-zionx-primary font-medium mb-2">Presupuesto de Marketing</label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-zionx-primary">$</span>
                      <input
                        type="number"
                        name="marketing_budget"
                        value={form.marketing_budget}
                        onChange={handleChange}
                        className="w-full pl-8 pr-3 py-3 bg-zionx-tertiary border border-zionx-secondary rounded-lg text-zionx-primary focus:border-zionx-highlight focus:outline-none transition-colors"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-zionx-primary font-medium mb-2">Mercado Objetivo *</label>
                    <textarea
                      name="target_market"
                      value={form.target_market}
                      onChange={handleChange}
                      rows="3"
                      className={`w-full p-3 bg-zionx-tertiary border rounded-lg text-zionx-primary focus:outline-none transition-colors ${
                        validationErrors.target_market ? 'border-red-500' : 'border-zionx-secondary focus:border-zionx-highlight'
                      }`}
                      placeholder="Describe tu mercado objetivo, audiencia, demografía..."
                    />
                    {validationErrors.target_market && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.target_market}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-zionx-primary font-medium mb-2">Canales de Marketing Actuales</label>
                    <textarea
                      name="current_marketing_channels"
                      value={form.current_marketing_channels}
                      onChange={handleChange}
                      rows="3"
                      className="w-full p-3 bg-zionx-tertiary border border-zionx-secondary rounded-lg text-zionx-primary focus:border-zionx-highlight focus:outline-none transition-colors"
                      placeholder="Redes sociales, Google Ads, email marketing, etc."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Documents */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="text-6xl mb-4">📄</div>
                  <h2 className="text-2xl font-bold text-zionx-primary">Documentación Empresarial</h2>
                  <p className="text-zionx-accent">Subir documentos de la empresa</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FileUploadZone
                    type="business_license"
                    title="Acta Constitutiva"
                    accept="image/*,.pdf"
                    description="Documento de constitución de la empresa"
                  />
                  
                  <FileUploadZone
                    type="tax_certificate"
                    title="Constancia de Situación Fiscal"
                    accept="image/*,.pdf"
                    description="RFC y régimen fiscal vigente"
                  />
                  
                  <FileUploadZone
                    type="fiscal_address_proof"
                    title="Comprobante de Domicilio Fiscal"
                    accept="image/*,.pdf"
                    description="Comprobante de la dirección fiscal"
                  />
                  
                  <FileUploadZone
                    type="legal_representative_id"
                    title="Identificación del Representante Legal"
                    accept="image/*,.pdf"
                    description="INE/IFE del representante legal"
                  />
                </div>

                <div className="bg-zionx-highlight/10 border border-zionx-highlight/30 rounded-lg p-4">
                  <h4 className="text-zionx-highlight font-semibold mb-2">📋 Información sobre Documentos</h4>
                  <ul className="text-zionx-primary text-sm space-y-1">
                    <li>• Formatos aceptados: JPG, PNG, PDF</li>
                    <li>• Tamaño máximo: 10MB por archivo</li>
                    <li>• Los documentos deben ser legibles y vigentes</li>
                    <li>• El Acta Constitutiva y RFC son obligatorios para facturación</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step 6: Confirmation */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="text-6xl mb-4">✅</div>
                  <h2 className="text-2xl font-bold text-zionx-primary">Confirmación</h2>
                  <p className="text-zionx-accent">Revisar información antes de crear cliente</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Business Info Summary */}
                  <div className="bg-gradient-to-br from-zionx-tertiary to-zionx-secondary rounded-lg p-6 border border-zionx-accent">
                    <h3 className="text-lg font-semibold text-zionx-primary mb-4">🏢 Información de la Empresa</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-zionx-accent">Razón Social:</span> <span className="text-zionx-primary font-medium">{form.business_name}</span></div>
                      <div><span className="text-zionx-accent">RFC:</span> <span className="text-zionx-primary font-medium">{form.rfc}</span></div>
                      <div><span className="text-zionx-accent">Giro:</span> <span className="text-zionx-primary">{form.industry}</span></div>
                      <div><span className="text-zionx-accent">Sitio Web:</span> <span className="text-zionx-primary">{form.website || 'No proporcionado'}</span></div>
                    </div>
                  </div>

                  {/* Fiscal Address Summary */}
                  <div className="bg-gradient-to-br from-zionx-tertiary to-zionx-secondary rounded-lg p-6 border border-zionx-accent">
                    <h3 className="text-lg font-semibold text-zionx-primary mb-4">📍 Dirección Fiscal</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-zionx-accent">Dirección:</span> <span className="text-zionx-primary">{form.fiscal_address}</span></div>
                      <div><span className="text-zionx-accent">C.P.:</span> <span className="text-zionx-primary">{form.fiscal_postal_code}</span></div>
                      <div><span className="text-zionx-accent">Ciudad:</span> <span className="text-zionx-primary">{form.fiscal_city}</span></div>
                      <div><span className="text-zionx-accent">Estado:</span> <span className="text-zionx-primary">{form.fiscal_state}</span></div>
                    </div>
                  </div>

                  {/* Contact Person Summary */}
                  <div className="bg-gradient-to-br from-zionx-tertiary to-zionx-secondary rounded-lg p-6 border border-zionx-accent">
                    <h3 className="text-lg font-semibold text-zionx-primary mb-4">👤 Persona de Contacto</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-zionx-accent">Nombre:</span> <span className="text-zionx-primary">{form.contact_first_name} {form.contact_last_name}</span></div>
                      <div><span className="text-zionx-accent">Puesto:</span> <span className="text-zionx-primary">{form.contact_position || 'No especificado'}</span></div>
                      <div><span className="text-zionx-accent">Email:</span> <span className="text-zionx-primary">{form.contact_email}</span></div>
                      <div><span className="text-zionx-accent">Teléfono:</span> <span className="text-zionx-primary">{form.contact_phone}</span></div>
                    </div>
                  </div>

                  {/* Marketing Summary */}
                  <div className="bg-gradient-to-br from-zionx-tertiary to-zionx-secondary rounded-lg p-6 border border-zionx-accent">
                    <h3 className="text-lg font-semibold text-zionx-primary mb-4">📈 Información de Marketing</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-zionx-accent">Tamaño:</span> <span className="text-zionx-primary">{form.business_size}</span></div>
                      <div><span className="text-zionx-accent">Empleados:</span> <span className="text-zionx-primary">{form.employees_count || 'No especificado'}</span></div>
                      <div><span className="text-zionx-accent">Facturación:</span> <span className="text-zionx-primary">${parseFloat(form.annual_revenue || 0).toLocaleString()}</span></div>
                      <div><span className="text-zionx-accent">Presupuesto Marketing:</span> <span className="text-zionx-primary">${parseFloat(form.marketing_budget || 0).toLocaleString()}</span></div>
                    </div>
                  </div>

                  {/* Documents Summary */}
                  <div className="bg-gradient-to-br from-zionx-tertiary to-zionx-secondary rounded-lg p-6 border border-zionx-accent">
                    <h3 className="text-lg font-semibold text-zionx-primary mb-4">📄 Documentos</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zionx-accent">Acta Constitutiva:</span>
                        <span className={files.business_license ? 'text-zionx-highlight' : 'text-zionx-accent'}>
                          {files.business_license ? '✓ Subido' : '○ Opcional'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zionx-accent">Constancia Fiscal:</span>
                        <span className={files.tax_certificate ? 'text-zionx-highlight' : 'text-zionx-accent'}>
                          {files.tax_certificate ? '✓ Subido' : '○ Opcional'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zionx-accent">Comp. Domicilio Fiscal:</span>
                        <span className={files.fiscal_address_proof ? 'text-zionx-highlight' : 'text-zionx-accent'}>
                          {files.fiscal_address_proof ? '✓ Subido' : '○ Opcional'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zionx-accent">ID Representante:</span>
                        <span className={files.legal_representative_id ? 'text-zionx-highlight' : 'text-zionx-accent'}>
                          {files.legal_representative_id ? '✓ Subido' : '○ Opcional'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-zionx-highlight/10 border border-zionx-highlight/30 rounded-lg p-4">
                  <h4 className="text-zionx-highlight font-semibold mb-2">⚠️ Confirmación</h4>
                  <p className="text-zionx-primary text-sm">
                    ¿La información proporcionada es correcta? Una vez creado el cliente empresarial, 
                    podrás editar estos campos y agregar proyectos de marketing desde el perfil del cliente.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-8 border-t border-neutral-200">
              <button
                type="button"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-white disabled:text-gray-500 text-neutral-800 rounded-lg font-medium transition-colors"
              >
                ← Anterior
              </button>

              <div className="flex gap-3">
                {currentStep < steps.length ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-neutral-800 rounded-lg font-medium transition-colors"
                  >
                    Siguiente →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-8 py-3 bg-lime-600 hover:bg-lime-700 disabled:bg-gray-600 text-neutral-800 rounded-lg font-bold transition-colors shadow-lg"
                  >
                    {isSubmitting ? "Creando Cliente..." : "✅ Crear Cliente"}
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar for Upload */}
            {uploadProgress > 0 && (
              <div className="mt-6">
                <div className="flex justify-between text-sm text-neutral-600 mb-2">
                  <span>Creando cliente...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CreateCustomer;