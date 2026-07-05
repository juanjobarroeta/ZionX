import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";
import "./CreateCustomer.css";

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
        if (form.rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(form.rfc)) {
          errors.rfc = "Formato de RFC inválido. Use formato: Persona Moral (12 caracteres) o Persona Física (13 caracteres)";
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
      className={`zxccu-drop ${dragActive[type] ? 'active' : ''} ${files[type] ? 'has' : ''}`}
      onDragEnter={(e) => handleDrag(e, type)}
      onDragLeave={(e) => handleDrag(e, type)}
      onDragOver={(e) => handleDrag(e, type)}
      onDrop={(e) => handleDrop(e, type)}
    >
      <input
        type="file"
        accept={accept}
        onChange={(e) => handleFileUpload(type, e.target.files[0])}
        style={{ display: "none" }}
        id={`file-${type}`}
      />

      <label htmlFor={`file-${type}`}>
        <div className="dic">
          {files[type] ? '✅' : '📎'}
        </div>
        <div className="dt">{title}</div>
        <div className="dd">{description}</div>

        {files[type] ? (
          <div className="dfile">
            ✓ {files[type].name}
          </div>
        ) : (
          <div className="dhint">
            Arrastra aquí o haz clic para seleccionar
          </div>
        )}
      </label>
    </div>
  );

  return (
    <Layout>
      <div className="zxccu">
        <div className="zxccu-inner">
          {/* Header */}
          <div className="zxccu-head">
            <div className="zxccu-head-l">
              <button
                onClick={() => navigate("/crm")}
                className="zxccu-btn"
              >
                ← Volver
              </button>
              <div>
                <p className="zxccu-eyebrow">Nuevo registro</p>
                <h1>Crear <span className="zxccu-serif">cliente</span> empresarial</h1>
                <p className="zxccu-sub">Complete la información de la empresa paso a paso</p>
              </div>
            </div>
            <div className="zxccu-pct">
              <div className="n">{completionPercentage}%</div>
              <div className="l">Completado</div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="zxccu-steps">
            {steps.map((step, index) => (
              <div key={step.id} className={`zxccu-step ${currentStep > step.id ? 'done' : ''} ${currentStep === step.id ? 'active' : ''}`}>
                <div className="zxccu-step-node">
                  <div className="zxccu-step-dot">
                    <span>{step.icon}</span>
                  </div>
                  <div className="zxccu-step-txt">
                    <div className="t">{step.title}</div>
                    <div className="d">{step.description}</div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className="zxccu-step-line" />
                )}
              </div>
            ))}
          </div>

          {/* Form Content */}
          <div className="zxccu-panel">
            
            {/* Step 1: Personal Information */}
            {currentStep === 1 && (
              <div>
                <div className="zxccu-step-head">
                  <div className="ic">🏢</div>
                  <h2>Información de la Empresa</h2>
                  <p>Datos básicos del negocio</p>
                </div>

                <div className="zxccu-grid">
                  <div className="zxccu-field">
                    <label className="zxccu-label">Razón Social *</label>
                    <input
                      type="text"
                      name="business_name"
                      value={form.business_name}
                      onChange={handleChange}
                      className={`zxccu-input ${validationErrors.business_name ? 'err' : ''}`}
                      placeholder="Nombre legal de la empresa"
                    />
                    {validationErrors.business_name && (
                      <p className="zxccu-err">{validationErrors.business_name}</p>
                    )}
                  </div>

                  <div className="zxccu-field">
                    <label className="zxccu-label">Nombre Comercial</label>
                    <input
                      type="text"
                      name="commercial_name"
                      value={form.commercial_name}
                      onChange={handleChange}
                      className="zxccu-input"
                      placeholder="Nombre comercial (si es diferente)"
                    />
                  </div>

                  <div className="zxccu-field">
                    <label className="zxccu-label">RFC *</label>
                    <input
                      type="text"
                      name="rfc"
                      value={form.rfc}
                      onChange={handleChange}
                      className={`zxccu-input ${validationErrors.rfc ? 'err' : ''}`}
                      placeholder="RFC de la empresa"
                      maxLength="13"
                      style={{textTransform: 'uppercase'}}
                    />
                    {validationErrors.rfc && (
                      <p className="zxccu-err">{validationErrors.rfc}</p>
                    )}
                  </div>

                  <div className="zxccu-field">
                    <label className="zxccu-label">Giro Comercial *</label>
                    <select
                      name="industry"
                      value={form.industry}
                      onChange={handleChange}
                      className={`zxccu-select ${validationErrors.industry ? 'err' : ''}`}
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
                      <p className="zxccu-err">{validationErrors.industry}</p>
                    )}
                  </div>

                  <div className="zxccu-field">
                    <label className="zxccu-label">Régimen Fiscal *</label>
                    <select
                      name="tax_regime"
                      value={form.tax_regime}
                      onChange={handleChange}
                      className="zxccu-select"
                    >
                      <option value="">Seleccionar régimen</option>
                      <option value="General">General de Ley Personas Morales</option>
                      <option value="Simplificado">Régimen Simplificado de Confianza</option>
                      <option value="RESICO">RESICO</option>
                      <option value="Incorporacion Fiscal">Régimen de Incorporación Fiscal</option>
                    </select>
                  </div>

                  <div className="zxccu-field">
                    <label className="zxccu-label">Sitio Web</label>
                    <input
                      type="url"
                      name="website"
                      value={form.website}
                      onChange={handleChange}
                      className="zxccu-input"
                      placeholder="https://www.empresa.com"
                    />
                  </div>

                </div>
              </div>
            )}

            {/* Step 2: Fiscal Address Information */}
            {currentStep === 2 && (
              <div>
                <div className="zxccu-step-head">
                  <div className="ic">📍</div>
                  <h2>Dirección Fiscal</h2>
                  <p>Información fiscal y de facturación</p>
                </div>

                <div className="zxccu-grid">
                  <div className="zxccu-field zxccu-col2">
                    <label className="zxccu-label">Dirección Fiscal *</label>
                    <input
                      type="text"
                      name="fiscal_address"
                      value={form.fiscal_address}
                      onChange={handleChange}
                      className={`zxccu-input ${validationErrors.fiscal_address ? 'err' : ''}`}
                      placeholder="Calle, número exterior e interior"
                    />
                    {validationErrors.fiscal_address && (
                      <p className="zxccu-err">{validationErrors.fiscal_address}</p>
                    )}
                  </div>

                  <div className="zxccu-field zxccu-col2">
                    <label className="zxccu-label">Información Adicional</label>
                    <input
                      type="text"
                      name="fiscal_address2"
                      value={form.fiscal_address2}
                      onChange={handleChange}
                      className="zxccu-input"
                      placeholder="Colonia, referencias, entre calles"
                    />
                  </div>

                  <div className="zxccu-field">
                    <label className="zxccu-label">Código Postal *</label>
                    <input
                      type="text"
                      name="fiscal_postal_code"
                      value={form.fiscal_postal_code}
                      onChange={handleChange}
                      className={`zxccu-input ${validationErrors.fiscal_postal_code ? 'err' : ''}`}
                      placeholder="12345"
                      maxLength="5"
                    />
                    {validationErrors.fiscal_postal_code && (
                      <p className="zxccu-err">{validationErrors.fiscal_postal_code}</p>
                    )}
                  </div>

                  <div className="zxccu-field">
                    <label className="zxccu-label">Ciudad *</label>
                    <input
                      type="text"
                      name="fiscal_city"
                      value={form.fiscal_city}
                      onChange={handleChange}
                      className={`zxccu-input ${validationErrors.fiscal_city ? 'err' : ''}`}
                      placeholder="Ciudad"
                    />
                    {validationErrors.fiscal_city && (
                      <p className="zxccu-err">{validationErrors.fiscal_city}</p>
                    )}
                  </div>

                  <div className="zxccu-field">
                    <label className="zxccu-label">Estado *</label>
                    <select
                      name="fiscal_state"
                      value={form.fiscal_state}
                      onChange={handleChange}
                      className={`zxccu-select ${validationErrors.fiscal_state ? 'err' : ''}`}
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
                      <p className="zxccu-err">{validationErrors.fiscal_state}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Financial Information */}
            {currentStep === 3 && (
              <div>
                <div className="zxccu-step-head">
                  <div className="ic">👤</div>
                  <h2>Persona de Contacto</h2>
                  <p>Responsable de comunicación</p>
                </div>

                <div className="zxccu-grid">
                  <div className="zxccu-field">
                    <label className="zxccu-label">Nombre del Contacto *</label>
                    <input
                      type="text"
                      name="contact_first_name"
                      value={form.contact_first_name}
                      onChange={handleChange}
                      className={`zxccu-input ${validationErrors.contact_first_name ? 'err' : ''}`}
                      placeholder="Nombre del responsable"
                    />
                    {validationErrors.contact_first_name && (
                      <p className="zxccu-err">{validationErrors.contact_first_name}</p>
                    )}
                  </div>

                  <div className="zxccu-field">
                    <label className="zxccu-label">Apellidos del Contacto *</label>
                    <input
                      type="text"
                      name="contact_last_name"
                      value={form.contact_last_name}
                      onChange={handleChange}
                      className={`zxccu-input ${validationErrors.contact_last_name ? 'err' : ''}`}
                      placeholder="Apellidos del responsable"
                    />
                    {validationErrors.contact_last_name && (
                      <p className="zxccu-err">{validationErrors.contact_last_name}</p>
                    )}
                  </div>

                  <div className="zxccu-field">
                    <label className="zxccu-label">Puesto/Cargo</label>
                    <input
                      type="text"
                      name="contact_position"
                      value={form.contact_position}
                      onChange={handleChange}
                      className="zxccu-input"
                      placeholder="Director de Marketing, Gerente General, etc."
                    />
                  </div>

                  <div className="zxccu-field">
                    <label className="zxccu-label">Email del Contacto *</label>
                    <input
                      type="email"
                      name="contact_email"
                      value={form.contact_email}
                      onChange={handleChange}
                      className={`zxccu-input ${validationErrors.contact_email ? 'err' : ''}`}
                      placeholder="contacto@empresa.com"
                    />
                    {validationErrors.contact_email && (
                      <p className="zxccu-err">{validationErrors.contact_email}</p>
                    )}
                  </div>

                  <div className="zxccu-field">
                    <label className="zxccu-label">Teléfono del Contacto *</label>
                    <div className="zxccu-inputgroup">
                      <span className="zxccu-prefix">
                        🇲🇽 +52
                      </span>
                      <input
                        type="tel"
                        name="contact_phone"
                        value={form.contact_phone}
                        onChange={handleChange}
                        className={`zxccu-input ${validationErrors.contact_phone ? 'err' : ''}`}
                        placeholder="Número de contacto"
                      />
                    </div>
                    {validationErrors.contact_phone && (
                      <p className="zxccu-err">{validationErrors.contact_phone}</p>
                    )}
                  </div>

                  <div className="zxccu-field">
                    <label className="zxccu-label">Teléfono Móvil</label>
                    <div className="zxccu-inputgroup">
                      <span className="zxccu-prefix">
                        📱 +52
                      </span>
                      <input
                        type="tel"
                        name="contact_mobile"
                        value={form.contact_mobile}
                        onChange={handleChange}
                        className="zxccu-input"
                        placeholder="Celular del contacto"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Marketing Information */}
            {currentStep === 4 && (
              <div>
                <div className="zxccu-step-head">
                  <div className="ic">📈</div>
                  <h2>Información de Marketing</h2>
                  <p>Datos comerciales y presupuesto</p>
                </div>

                <div className="zxccu-grid">
                  <div className="zxccu-field">
                    <label className="zxccu-label">Tamaño de Empresa *</label>
                    <select
                      name="business_size"
                      value={form.business_size}
                      onChange={handleChange}
                      className={`zxccu-select ${validationErrors.business_size ? 'err' : ''}`}
                    >
                      <option value="">Seleccionar tamaño</option>
                      <option value="Micro">Micro (1-10 empleados)</option>
                      <option value="Pequeña">Pequeña (11-50 empleados)</option>
                      <option value="Mediana">Mediana (51-250 empleados)</option>
                      <option value="Grande">Grande (250+ empleados)</option>
                    </select>
                    {validationErrors.business_size && (
                      <p className="zxccu-err">{validationErrors.business_size}</p>
                    )}
                  </div>

                  <div className="zxccu-field">
                    <label className="zxccu-label">Número de Empleados</label>
                    <input
                      type="number"
                      name="employees_count"
                      value={form.employees_count}
                      onChange={handleChange}
                      className="zxccu-input"
                      placeholder="Cantidad aproximada"
                      min="1"
                    />
                  </div>

                  <div className="zxccu-field">
                    <label className="zxccu-label">Facturación Anual</label>
                    <div className="zxccu-money">
                      <span className="sym">$</span>
                      <input
                        type="number"
                        name="annual_revenue"
                        value={form.annual_revenue}
                        onChange={handleChange}
                        className="zxccu-input"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div className="zxccu-field">
                    <label className="zxccu-label">Presupuesto de Marketing</label>
                    <div className="zxccu-money">
                      <span className="sym">$</span>
                      <input
                        type="number"
                        name="marketing_budget"
                        value={form.marketing_budget}
                        onChange={handleChange}
                        className="zxccu-input"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div className="zxccu-field zxccu-col2">
                    <label className="zxccu-label">Mercado Objetivo *</label>
                    <textarea
                      name="target_market"
                      value={form.target_market}
                      onChange={handleChange}
                      rows="3"
                      className={`zxccu-textarea ${validationErrors.target_market ? 'err' : ''}`}
                      placeholder="Describe tu mercado objetivo, audiencia, demografía..."
                    />
                    {validationErrors.target_market && (
                      <p className="zxccu-err">{validationErrors.target_market}</p>
                    )}
                  </div>

                  <div className="zxccu-field zxccu-col2">
                    <label className="zxccu-label">Canales de Marketing Actuales</label>
                    <textarea
                      name="current_marketing_channels"
                      value={form.current_marketing_channels}
                      onChange={handleChange}
                      rows="3"
                      className="zxccu-textarea"
                      placeholder="Redes sociales, Google Ads, email marketing, etc."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Documents */}
            {currentStep === 5 && (
              <div>
                <div className="zxccu-step-head">
                  <div className="ic">📄</div>
                  <h2>Documentación Empresarial</h2>
                  <p>Subir documentos de la empresa</p>
                </div>

                <div className="zxccu-grid">
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

                <div className="zxccu-note">
                  <h4>📋 Información sobre Documentos</h4>
                  <ul>
                    <li>Formatos aceptados: JPG, PNG, PDF</li>
                    <li>Tamaño máximo: 10MB por archivo</li>
                    <li>Los documentos deben ser legibles y vigentes</li>
                    <li>El Acta Constitutiva y RFC son obligatorios para facturación</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step 6: Confirmation */}
            {currentStep === 6 && (
              <div>
                <div className="zxccu-step-head">
                  <div className="ic">✅</div>
                  <h2>Confirmación</h2>
                  <p>Revisar información antes de crear cliente</p>
                </div>

                <div className="zxccu-grid">
                  {/* Business Info Summary */}
                  <div className="zxccu-sumcard">
                    <h3>🏢 Información de la Empresa</h3>
                    <div className="zxccu-sumrow"><span className="k">Razón Social</span> <span className="v">{form.business_name}</span></div>
                    <div className="zxccu-sumrow"><span className="k">RFC</span> <span className="v">{form.rfc}</span></div>
                    <div className="zxccu-sumrow"><span className="k">Giro</span> <span className="v">{form.industry}</span></div>
                    <div className="zxccu-sumrow"><span className="k">Sitio Web</span> <span className="v">{form.website || 'No proporcionado'}</span></div>
                  </div>

                  {/* Fiscal Address Summary */}
                  <div className="zxccu-sumcard">
                    <h3>📍 Dirección Fiscal</h3>
                    <div className="zxccu-sumrow"><span className="k">Dirección</span> <span className="v">{form.fiscal_address}</span></div>
                    <div className="zxccu-sumrow"><span className="k">C.P.</span> <span className="v">{form.fiscal_postal_code}</span></div>
                    <div className="zxccu-sumrow"><span className="k">Ciudad</span> <span className="v">{form.fiscal_city}</span></div>
                    <div className="zxccu-sumrow"><span className="k">Estado</span> <span className="v">{form.fiscal_state}</span></div>
                  </div>

                  {/* Contact Person Summary */}
                  <div className="zxccu-sumcard">
                    <h3>👤 Persona de Contacto</h3>
                    <div className="zxccu-sumrow"><span className="k">Nombre</span> <span className="v">{form.contact_first_name} {form.contact_last_name}</span></div>
                    <div className="zxccu-sumrow"><span className="k">Puesto</span> <span className="v">{form.contact_position || 'No especificado'}</span></div>
                    <div className="zxccu-sumrow"><span className="k">Email</span> <span className="v">{form.contact_email}</span></div>
                    <div className="zxccu-sumrow"><span className="k">Teléfono</span> <span className="v">{form.contact_phone}</span></div>
                  </div>

                  {/* Marketing Summary */}
                  <div className="zxccu-sumcard">
                    <h3>📈 Información de Marketing</h3>
                    <div className="zxccu-sumrow"><span className="k">Tamaño</span> <span className="v">{form.business_size}</span></div>
                    <div className="zxccu-sumrow"><span className="k">Empleados</span> <span className="v">{form.employees_count || 'No especificado'}</span></div>
                    <div className="zxccu-sumrow"><span className="k">Facturación</span> <span className="v">${parseFloat(form.annual_revenue || 0).toLocaleString()}</span></div>
                    <div className="zxccu-sumrow"><span className="k">Presupuesto Marketing</span> <span className="v">${parseFloat(form.marketing_budget || 0).toLocaleString()}</span></div>
                  </div>

                  {/* Documents Summary */}
                  <div className="zxccu-sumcard">
                    <h3>📄 Documentos</h3>
                    <div className="zxccu-sumrow">
                      <span className="k">Acta Constitutiva</span>
                      <span className={files.business_license ? 'v ok' : 'v off'}>
                        {files.business_license ? '✓ Subido' : '○ Opcional'}
                      </span>
                    </div>
                    <div className="zxccu-sumrow">
                      <span className="k">Constancia Fiscal</span>
                      <span className={files.tax_certificate ? 'v ok' : 'v off'}>
                        {files.tax_certificate ? '✓ Subido' : '○ Opcional'}
                      </span>
                    </div>
                    <div className="zxccu-sumrow">
                      <span className="k">Comp. Domicilio Fiscal</span>
                      <span className={files.fiscal_address_proof ? 'v ok' : 'v off'}>
                        {files.fiscal_address_proof ? '✓ Subido' : '○ Opcional'}
                      </span>
                    </div>
                    <div className="zxccu-sumrow">
                      <span className="k">ID Representante</span>
                      <span className={files.legal_representative_id ? 'v ok' : 'v off'}>
                        {files.legal_representative_id ? '✓ Subido' : '○ Opcional'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="zxccu-note warn">
                  <h4>⚠️ Confirmación</h4>
                  <p>
                    ¿La información proporcionada es correcta? Una vez creado el cliente empresarial,
                    podrás editar estos campos y agregar proyectos de marketing desde el perfil del cliente.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="zxccu-nav">
              <button
                type="button"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="zxccu-navbtn"
              >
                ← Anterior
              </button>

              <div className="r">
                {currentStep < steps.length ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="zxccu-navbtn solid"
                  >
                    Siguiente →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="zxccu-navbtn solid"
                  >
                    {isSubmitting ? "Creando Cliente..." : "✅ Crear Cliente"}
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar for Upload */}
            {uploadProgress > 0 && (
              <div className="zxccu-progress">
                <div className="lab">
                  <span>Creando cliente...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="track">
                  <div
                    className="bar"
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