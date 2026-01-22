import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "../components/Layout";
import ContentCalendar from "../components/ContentCalendar";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const CustomerProfile = () => {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('cliente');
  
  // Marketing-specific state
  const [brandingFiles, setBrandingFiles] = useState([]);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [escaletaFiles, setEscaletaFiles] = useState([]);
  const [designFiles, setDesignFiles] = useState([]);
  const [reports, setReports] = useState([]);
  const [notes, setNotes] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('');
  const [showChatModal, setShowChatModal] = useState(false);

  // File upload state
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});

  // Fetch customer data and marketing assets
  useEffect(() => {
    fetchCustomerData();
    fetchMarketingAssets();
    fetchTeamMembers();
  }, [id]);

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.get(`${API_BASE_URL}/customers/${id}`, { headers });
      setCustomer(response.data);
    } catch (err) {
      console.error("Error fetching customer:", err);
      setError("No se pudo cargar la información del cliente");
    } finally {
      setLoading(false);
    }
  };

  const fetchMarketingAssets = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch real marketing files by category
      const [brandingRes, mediaRes, escaletaRes, designRes, reportsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/customers/${id}/files/branding`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/customers/${id}/files/media`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/customers/${id}/files/escaleta`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/customers/${id}/files/designs`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/customers/${id}/reports`, { headers }).catch(() => ({ data: [] }))
      ]);

      // Process and format the file data
      const formatFileData = (files) => {
        return files.map(file => ({
          id: file.id,
          name: file.original_name,
          size: file.file_size ? `${(file.file_size / 1024 / 1024).toFixed(1)} MB` : 'Unknown',
          uploaded_at: new Date(file.created_at).toLocaleDateString(),
          type: file.file_type || 'file'
        }));
      };

      setBrandingFiles(formatFileData(brandingRes.data || []));
      setMediaFiles(formatFileData(mediaRes.data || []));
      setEscaletaFiles(formatFileData(escaletaRes.data || []));
      setDesignFiles(formatFileData(designRes.data || []));
      setReports(reportsRes.data || []);

      console.log("✅ Marketing assets loaded:", {
        branding: brandingRes.data?.length || 0,
        media: mediaRes.data?.length || 0,
        escaleta: escaletaRes.data?.length || 0,
        designs: designRes.data?.length || 0,
        reports: reportsRes.data?.length || 0
      });

    } catch (err) {
      console.error("Error fetching marketing assets:", err);
    }
  };

  // File upload handlers
  const handleFileUpload = async (files, category) => {
    try {
      setUploadingFiles(prev => ({ ...prev, [category]: true }));
      
      const formData = new FormData();
      Array.from(files).forEach((file, index) => {
        formData.append(`files`, file);
      });
      formData.append('category', category);
      formData.append('customer_id', id);

      const token = localStorage.getItem("token");
      const response = await axios.post(`${API_BASE_URL}/customers/${id}/files/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(prev => ({ ...prev, [category]: percentCompleted }));
        }
      });

      if (response.data.success) {
        await fetchMarketingAssets();
        setShowUploadModal(false);
        setSelectedFiles([]);
        alert('Archivos subidos exitosamente');
      }
    } catch (err) {
      console.error(`Error uploading ${category} files:`, err);
      alert(`Error subiendo archivos de ${category}`);
    } finally {
      setUploadingFiles(prev => ({ ...prev, [category]: false }));
      setUploadProgress(prev => ({ ...prev, [category]: 0 }));
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Customer dashboard tabs
  const tabs = [
    { id: 'funnel', label: '📱 Publicaciones', icon: '📱', description: 'Funnel de publicaciones activas' },
    { id: 'escaleta', label: '📅 Escaleta', icon: '📅', description: 'Planificación de contenido' },
    { id: 'resources', label: '📁 Recursos', icon: '📁', description: 'Manuales e identidad de marca' },
    { id: 'statement', label: '💰 Estado de Cuenta', icon: '💰', description: 'Cotizaciones y pagos' },
    { id: 'settings', label: '⚙️ Configuración', icon: '⚙️', description: 'Información del cliente' }
  ];

  // File category configurations
  const fileCategories = {
    branding: {
      title: 'Archivos de Branding',
      description: 'Logos, paletas de colores, tipografías y manuales de marca',
      acceptedTypes: '.svg,.png,.jpg,.pdf,.ai,.eps',
      icon: '🎨',
      files: brandingFiles
    },
    media: {
      title: 'Fotos y Videos',
      description: 'Contenido multimedia para campañas y redes sociales',
      acceptedTypes: '.jpg,.png,.mp4,.mov,.avi,.gif',
      icon: '📸',
      files: mediaFiles
    },
    escaleta: {
      title: 'Escaleta de Contenido',
      description: 'Calendarios, planificación y estrategias de contenido',
      acceptedTypes: '.pdf,.xlsx,.docx,.pptx',
      icon: '📅',
      files: escaletaFiles
    },
    designs: {
      title: 'Artes Listos',
      description: 'Diseños finalizados listos para publicar',
      acceptedTypes: '.png,.jpg,.pdf,.ai,.psd',
      icon: '🎯',
      files: designFiles
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`${API_BASE_URL}/team-members`, { headers });
      setTeamMembers(response.data.team_members || []);
    } catch (err) {
      console.error("Error fetching team members:", err);
      setTeamMembers([]);
    }
  };

  const updateDefaultTeamMember = async (role, memberId) => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      
      // Update both assignments at once to prevent conflicts
      const currentCustomer = customer || {};
      const updateData = {
        default_designer: role === 'designer' ? memberId : currentCustomer.default_designer,
        default_community_manager: role === 'community_manager' ? memberId : currentCustomer.default_community_manager
      };

      console.log('Updating team assignment:', updateData);

      const response = await axios.put(`${API_BASE_URL}/customers/${id}/team-assignment`, updateData, { headers });
      
      // Update local state immediately
      if (response.data.success) {
        setCustomer(prev => ({ 
          ...prev, 
          default_designer: updateData.default_designer,
          default_community_manager: updateData.default_community_manager
        }));
        console.log(`✅ Updated default ${role} for customer ${id}`);
      }
    } catch (error) {
      console.error('Error updating default team member:', error);
      alert('Error actualizando asignación del equipo');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-zionx-highlight mx-auto mb-4"></div>
            <p className="text-zionx-accent">Cargando perfil del cliente...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 m-6">
          <h3 className="text-red-400 font-semibold mb-2">❌ Error</h3>
          <p className="text-zionx-primary">{error}</p>
        </div>
      </Layout>
    );
  }

  if (!customer) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-zionx-primary mb-2">Cliente No Encontrado</h2>
          <p className="text-zionx-accent">El cliente que buscas no existe.</p>
          <Link to="/crm" className="mt-4 inline-block bg-zionx-accent text-white px-6 py-2 rounded-lg hover:bg-zionx-primary transition-colors">
            ← Volver al Directorio
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-zionx-secondary via-zionx-tertiary to-zionx-secondary">
        {/* Header Section */}
        <div className="bg-zionx-tertiary border-b border-zionx-secondary">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center text-2xl font-bold text-white">
                  {customer.business_name ? customer.business_name.charAt(0) : (customer.first_name?.charAt(0) || 'C')}
                  {customer.commercial_name ? customer.commercial_name.charAt(0) : (customer.last_name?.charAt(0) || '')}
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-black">
                    {customer.business_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Cliente Sin Nombre'}
                  </h1>
                  {customer.commercial_name && customer.business_name !== customer.commercial_name && (
                    <p className="text-zionx-accent font-medium">Comercial: {customer.commercial_name}</p>
                  )}
                  <div className="flex items-center space-x-4 mt-2">
                    <p className="text-zionx-accent">{customer.contact_email || customer.email}</p>
                    <p className="text-zionx-accent">{customer.contact_phone || customer.phone}</p>
                    {customer.rfc && <p className="text-zionx-accent">RFC: {customer.rfc}</p>}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Link
                  to="/crm"
                  className="bg-gray-100 hover:bg-gray-200 text-black px-4 py-2 rounded-lg transition-colors"
                >
                  ← Volver
                </Link>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowChatModal(true)}
                    className="bg-zionx-secondary hover:bg-zionx-accent text-zionx-primary hover:text-white px-4 py-2 rounded-lg transition-all duration-200"
                  >
                    💬 Chat
                  </button>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="bg-gradient-to-r from-zionx-accent to-zionx-primary hover:from-zionx-primary hover:to-zionx-accent text-white px-6 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
                  >
                    📤 Subir Archivos
                  </button>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-zionx-secondary p-1 rounded-lg">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-3 px-4 rounded-md font-semibold transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-zionx-accent text-white shadow-lg"
                      : "text-zionx-primary hover:text-white hover:bg-zionx-accent/50"
                  }`}
                >
                  <span className="block">{tab.icon}</span>
                  <span className="text-sm">{tab.label.replace(/🏢|🎨|📸|📅|🎯|📊/, '').trim()}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Publication Funnel Tab */}
          {activeTab === 'funnel' && (
            <div className="space-y-6">
              <div className="bg-zionx-tertiary rounded-xl p-6 border border-zionx-secondary">
                <h2 className="text-2xl font-bold text-zionx-primary mb-6">📱 Funnel de Publicaciones</h2>

                {/* Platform Selection */}
                <div className="flex space-x-2 mb-6">
                  <button className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-3 rounded-lg hover:shadow-lg transition-all">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="text-xl">📷</span>
                      <span className="font-semibold">Instagram</span>
                    </div>
                  </button>
                  <button className="flex-1 bg-gradient-to-r from-blue-500 to-blue-700 text-white px-4 py-3 rounded-lg hover:shadow-lg transition-all">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="text-xl">📘</span>
                      <span className="font-semibold">Facebook</span>
                    </div>
                  </button>
                  <button className="flex-1 bg-gradient-to-r from-black to-gray-800 text-white px-4 py-3 rounded-lg hover:shadow-lg transition-all">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="text-xl">🎵</span>
                      <span className="font-semibold">TikTok</span>
                    </div>
                  </button>
                </div>

                {/* Publication Status Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-white rounded-lg p-4 border border-zionx-secondary text-center">
                    <div className="text-2xl font-bold text-blue-600">12</div>
                    <div className="text-sm text-zionx-accent">Programadas</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-zionx-secondary text-center">
                    <div className="text-2xl font-bold text-yellow-600">3</div>
                    <div className="text-sm text-zionx-accent">En Proceso</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-zionx-secondary text-center">
                    <div className="text-2xl font-bold text-green-600">28</div>
                    <div className="text-sm text-zionx-accent">Publicadas</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-zionx-secondary text-center">
                    <div className="text-2xl font-bold text-red-600">1</div>
                    <div className="text-sm text-zionx-accent">Fallidas</div>
                  </div>
                </div>

                {/* TikTok/Instagram-like 3-Column Grid */}
                <div className="grid grid-cols-3 gap-1">
                  {/* Published posts with platform indicators */}
                  {Array.from({ length: 15 }, (_, i) => {
                    const platforms = ['instagram', 'facebook', 'tiktok'];
                    const platform = platforms[i % 3];
                    const platformColors = {
                      instagram: 'from-purple-500 to-pink-500',
                      facebook: 'from-blue-500 to-blue-700',
                      tiktok: 'from-black to-gray-800'
                    };
                    const platformIcons = {
                      instagram: '📷',
                      facebook: '📘',
                      tiktok: '🎵'
                    };
                    
                    return (
                      <div key={i} className="bg-white overflow-hidden hover:shadow-xl transition-shadow cursor-pointer relative">
                        <div className={`aspect-square bg-gradient-to-br ${platformColors[platform]} flex items-center justify-center relative`}>
                          <span className="text-white text-4xl">📱</span>
                          {/* Platform Badge */}
                          <div className="absolute top-2 right-2 bg-white rounded-full p-1">
                            <span className="text-sm">{platformIcons[platform]}</span>
                          </div>
                          {/* Status Badge */}
                          <div className="absolute bottom-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">
                            ✅ Publicado
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Scheduled posts */}
                  {Array.from({ length: 8 }, (_, i) => {
                    const platforms = ['instagram', 'facebook', 'tiktok'];
                    const platform = platforms[i % 3];
                    const platformIcons = {
                      instagram: '📷',
                      facebook: '📘',
                      tiktok: '🎵'
                    };
                    
                    return (
                      <div key={`scheduled-${i}`} className="bg-white overflow-hidden hover:shadow-xl transition-shadow cursor-pointer relative">
                        <div className="aspect-square bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center relative">
                          <span className="text-white text-4xl">⏰</span>
                          {/* Platform Badge */}
                          <div className="absolute top-2 right-2 bg-white rounded-full p-1">
                            <span className="text-sm">{platformIcons[platform]}</span>
                          </div>
                          {/* Schedule Badge */}
                          <div className="absolute bottom-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold">
                            ⏳ Hoy 3PM
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Failed posts */}
                  {Array.from({ length: 2 }, (_, i) => {
                    const platforms = ['instagram', 'facebook'];
                    const platform = platforms[i % 2];
                    const platformIcons = {
                      instagram: '📷',
                      facebook: '📘'
                    };
                    
                    return (
                      <div key={`failed-${i}`} className="bg-white overflow-hidden hover:shadow-xl transition-shadow cursor-pointer relative border-2 border-red-500">
                        <div className="aspect-square bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center relative">
                          <span className="text-white text-4xl">❌</span>
                          {/* Platform Badge */}
                          <div className="absolute top-2 right-2 bg-white rounded-full p-1">
                            <span className="text-sm">{platformIcons[platform]}</span>
                          </div>
                          {/* Error Badge */}
                          <div className="absolute bottom-2 left-2 bg-red-700 text-white px-2 py-1 rounded text-xs font-bold">
                            ⚠️ Error
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Publication Timeline */}
                <div className="mt-8">
                  <h3 className="text-lg font-bold text-zionx-primary mb-4">📈 Timeline de Publicaciones</h3>
                  <div className="bg-white rounded-lg p-6 border border-zionx-secondary">
                    <div className="space-y-4">
                      {/* Today's Publications */}
                      <div className="flex items-center space-x-4">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div className="flex-1">
                          <p className="font-medium text-zionx-primary">Post #12 - "Promoción Especial"</p>
                          <p className="text-sm text-zionx-accent">Publicado en Instagram • 2h ago</p>
                        </div>
                        <span className="text-green-600 text-sm">✅ Éxito</span>
                      </div>

                      {/* Scheduled Publications */}
                      <div className="flex items-center space-x-4">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <div className="flex-1">
                          <p className="font-medium text-zionx-primary">Post #13 - "Nuevo Producto"</p>
                          <p className="text-sm text-zionx-accent">Programado para hoy 3:00 PM</p>
                        </div>
                        <span className="text-blue-600 text-sm">⏰ Programado</span>
                      </div>

                      {/* Failed Publications */}
                      <div className="flex items-center space-x-4">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <div className="flex-1">
                          <p className="font-medium text-zionx-primary">Post #10 - "Oferta Especial"</p>
                          <p className="text-sm text-zionx-accent">Error de API - Reintentando</p>
                        </div>
                        <span className="text-red-600 text-sm">❌ Error</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cliente Tab */}
          {activeTab === 'cliente' && (
            <div className="space-y-6">
              <div className="bg-zionx-tertiary rounded-xl p-6 border border-zionx-secondary">
                <h2 className="text-2xl font-bold text-zionx-primary mb-6">📊 Información General</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Business Information */}
                  <div className="bg-white rounded-lg p-6 border border-zionx-secondary">
                    <h3 className="text-lg font-bold text-zionx-primary mb-4">🏢 Datos Empresariales</h3>
                    <div className="space-y-3">
                      <div>
                        <span className="text-zionx-accent font-medium">Razón Social:</span>
                        <p className="text-zionx-primary">{customer.business_name || 'No especificado'}</p>
                      </div>
                      <div>
                        <span className="text-zionx-accent font-medium">Nombre Comercial:</span>
                        <p className="text-zionx-primary">{customer.commercial_name || 'No especificado'}</p>
                      </div>
                      <div>
                        <span className="text-zionx-accent font-medium">RFC:</span>
                        <p className="text-zionx-primary">{customer.rfc || 'No especificado'}</p>
                      </div>
                      <div>
                        <span className="text-zionx-accent font-medium">Giro:</span>
                        <p className="text-zionx-primary">{customer.industry || 'No especificado'}</p>
                      </div>
                      <div>
                        <span className="text-zionx-accent font-medium">Sitio Web:</span>
                        <p className="text-zionx-primary">
                          {customer.website ? (
                            <a href={customer.website} target="_blank" rel="noopener noreferrer" className="text-zionx-highlight hover:underline">
                              {customer.website}
                            </a>
                          ) : 'No especificado'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="bg-white rounded-lg p-6 border border-zionx-secondary">
                    <h3 className="text-lg font-bold text-zionx-primary mb-4">👤 Persona de Contacto</h3>
                    <div className="space-y-3">
                      <div>
                        <span className="text-zionx-accent font-medium">Nombre:</span>
                        <p className="text-zionx-primary">{customer.contact_first_name} {customer.contact_last_name}</p>
                      </div>
                      <div>
                        <span className="text-zionx-accent font-medium">Puesto:</span>
                        <p className="text-zionx-primary">{customer.contact_position || 'No especificado'}</p>
                      </div>
                      <div>
                        <span className="text-zionx-accent font-medium">Email:</span>
                        <p className="text-zionx-primary">{customer.contact_email}</p>
                      </div>
                      <div>
                        <span className="text-zionx-accent font-medium">Teléfono:</span>
                        <p className="text-zionx-primary">{customer.contact_phone}</p>
                      </div>
                      <div>
                        <span className="text-zionx-accent font-medium">Móvil:</span>
                        <p className="text-zionx-primary">{customer.contact_mobile || 'No especificado'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Marketing Information */}
                  <div className="bg-white rounded-lg p-6 border border-zionx-secondary">
                    <h3 className="text-lg font-bold text-zionx-primary mb-4">📈 Información de Marketing</h3>
                    <div className="space-y-3">
                      <div>
                        <span className="text-zionx-accent font-medium">Tamaño:</span>
                        <p className="text-zionx-primary">{customer.business_size || 'No especificado'}</p>
                      </div>
                      <div>
                        <span className="text-zionx-accent font-medium">Empleados:</span>
                        <p className="text-zionx-primary">{customer.employees_count || 'No especificado'}</p>
                      </div>
                      <div>
                        <span className="text-zionx-accent font-medium">Presupuesto Marketing:</span>
                        <p className="text-zionx-primary">
                          {customer.marketing_budget ? `$${parseFloat(customer.marketing_budget).toLocaleString()}` : 'No especificado'}
                        </p>
                      </div>
                      <div>
                        <span className="text-zionx-accent font-medium">Mercado Objetivo:</span>
                        <p className="text-zionx-primary">{customer.target_market || 'No especificado'}</p>
                      </div>
                      <div>
                        <span className="text-zionx-accent font-medium">Canales Actuales:</span>
                        <p className="text-zionx-primary">{customer.current_marketing_channels || 'No especificado'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Team Assignment */}
                  <div className="bg-white rounded-lg p-6 border border-zionx-secondary">
                    <h3 className="text-lg font-bold text-zionx-primary mb-4">👥 Equipo Asignado</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-zionx-primary mb-2">
                          🎨 Diseñador Principal
                        </label>
                        <select 
                          className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                          value={customer.default_designer || ''}
                          onChange={(e) => updateDefaultTeamMember('designer', e.target.value)}
                        >
                          <option value="">Seleccionar diseñador...</option>
                          {teamMembers
                            .filter(member => member.role === 'UI/UX Designer' || member.role === 'designer')
                            .map(member => (
                              <option key={member.id} value={member.id}>
                                {member.name}
                              </option>
                            ))
                          }
                        </select>
                        <p className="text-xs text-zionx-accent mt-1">
                          Diseñador asignado por defecto para todos los posts de este cliente
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-zionx-primary mb-2">
                          📱 Community Manager Principal
                        </label>
                        <select 
                          className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                          value={customer.default_community_manager || ''}
                          onChange={(e) => updateDefaultTeamMember('community_manager', e.target.value)}
                        >
                          <option value="">Seleccionar CM...</option>
                          {teamMembers
                            .filter(member => member.role === 'Content Strategist' || member.role === 'community_manager' || member.role === 'Project Manager')
                            .map(member => (
                              <option key={member.id} value={member.id}>
                                {member.name}
                              </option>
                            ))
                          }
                        </select>
                        <p className="text-xs text-zionx-accent mt-1">
                          Community Manager asignado por defecto para todos los posts de este cliente
                        </p>
                      </div>

                      <div className="bg-zionx-tertiary rounded-lg p-3">
                        <p className="text-sm text-zionx-primary">
                          <strong>💡 Tip:</strong> Estas asignaciones se aplicarán automáticamente a todos los posts nuevos. 
                          Puedes cambiar las asignaciones individualmente en cada post si es necesario.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Branding Tab */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              <div className="bg-zionx-tertiary rounded-xl p-6 border border-zionx-secondary">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-zionx-primary">🎨 Recursos de Branding</h2>
                  <button
                    onClick={() => { setUploadCategory('branding'); setShowUploadModal(true); }}
                    className="bg-gradient-to-r from-zionx-accent to-zionx-primary text-white px-4 py-2 rounded-lg hover:from-zionx-primary hover:to-zionx-accent transition-all"
                  >
                    📤 Subir Archivo
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {brandingFiles.map((file) => (
                    <div key={file.id} className="bg-white rounded-lg p-4 border border-zionx-secondary hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-2xl">🎨</span>
                        <span className="text-xs text-zionx-accent bg-zionx-secondary px-2 py-1 rounded">
                          {file.type}
                        </span>
                      </div>
                      <h4 className="font-semibold text-zionx-primary mb-2 truncate">{file.name}</h4>
                      <div className="text-sm text-zionx-accent space-y-1">
                        <p>Tamaño: {file.size}</p>
                        <p>Subido: {file.uploaded_at}</p>
                      </div>
                      <div className="flex space-x-2 mt-3">
                        <button className="flex-1 bg-zionx-highlight text-white px-3 py-1 rounded text-sm hover:bg-zionx-accent transition-colors">
                          📥 Descargar
                        </button>
                        <button className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors">
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {brandingFiles.length === 0 && (
                    <div className="col-span-full text-center py-12 text-zionx-accent">
                      <span className="text-4xl block mb-4">🎨</span>
                      <p>No hay archivos de branding subidos</p>
                      <p className="text-sm">Sube logos, paletas de colores y manuales de marca</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Media Tab */}
          {activeTab === 'media' && (
            <div className="space-y-6">
              <div className="bg-zionx-tertiary rounded-xl p-6 border border-zionx-secondary">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-zionx-primary">📸 Fotos y Videos</h2>
                  <button
                    onClick={() => { setUploadCategory('media'); setShowUploadModal(true); }}
                    className="bg-gradient-to-r from-zionx-accent to-zionx-primary text-white px-4 py-2 rounded-lg hover:from-zionx-primary hover:to-zionx-accent transition-all"
                  >
                    📤 Subir Media
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {mediaFiles.map((file) => (
                    <div key={file.id} className="bg-white rounded-lg p-4 border border-zionx-secondary hover:shadow-lg transition-shadow">
                      <div className="aspect-video bg-zionx-secondary rounded-lg mb-3 flex items-center justify-center">
                        {file.type === 'video' ? (
                          <span className="text-3xl">🎥</span>
                        ) : (
                          <span className="text-3xl">📷</span>
                        )}
                      </div>
                      <h4 className="font-semibold text-zionx-primary mb-2 truncate">{file.name}</h4>
                      <div className="text-sm text-zionx-accent space-y-1">
                        <p>Tamaño: {file.size}</p>
                        <p>Subido: {file.uploaded_at}</p>
                      </div>
                      <div className="flex space-x-2 mt-3">
                        <button className="flex-1 bg-zionx-highlight text-white px-3 py-1 rounded text-sm hover:bg-zionx-accent transition-colors">
                          📥 Descargar
                        </button>
                        <button className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors">
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {mediaFiles.length === 0 && (
                    <div className="col-span-full text-center py-12 text-zionx-accent">
                      <span className="text-4xl block mb-4">📸</span>
                      <p>No hay archivos multimedia subidos</p>
                      <p className="text-sm">Sube fotos, videos y contenido visual</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

           {/* Escaleta Tab */}
           {activeTab === 'escaleta' && (
             <ContentCalendar customerId={id} customerData={customer} />
           )}

          {/* Resources Tab */}
          {activeTab === 'resources' && (
            <div className="space-y-6">
              <div className="bg-zionx-tertiary rounded-xl p-6 border border-zionx-secondary">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-zionx-primary">📁 Recursos de Marca</h2>
                  <button className="bg-gradient-to-r from-zionx-accent to-zionx-primary text-white px-4 py-2 rounded-lg hover:from-zionx-primary hover:to-zionx-accent transition-all">
                    📤 Subir Recursos
                  </button>
                </div>

                {/* Resource Categories */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Brand Manual */}
                  <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
                    <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full mb-4 mx-auto">
                      <span className="text-white text-2xl">📋</span>
                    </div>
                    <h3 className="text-lg font-bold text-zionx-primary mb-2 text-center">Manual de Marca</h3>
                    <p className="text-sm text-zionx-accent mb-4">Guías de identidad corporativa</p>
                    <div className="space-y-2">
                      <button className="w-full bg-zionx-secondary text-zionx-primary px-3 py-2 rounded text-sm hover:bg-zionx-accent hover:text-white transition-colors">
                        📥 Descargar
                      </button>
                      <button className="w-full bg-zionx-highlight text-white px-3 py-2 rounded text-sm hover:bg-zionx-accent transition-colors">
                        ✏️ Editar
                      </button>
                    </div>
                  </div>

                  {/* Photography */}
                  <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
                    <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full mb-4 mx-auto">
                      <span className="text-white text-2xl">📸</span>
                    </div>
                    <h3 className="text-lg font-bold text-zionx-primary mb-2 text-center">Fotografía</h3>
                    <p className="text-sm text-zionx-accent mb-4">Imágenes de productos y servicios</p>
                    <div className="space-y-2">
                      <button className="w-full bg-zionx-secondary text-zionx-primary px-3 py-2 rounded text-sm hover:bg-zionx-accent hover:text-white transition-colors">
                        📥 Ver Galería
                      </button>
                      <button className="w-full bg-zionx-highlight text-white px-3 py-2 rounded text-sm hover:bg-zionx-accent transition-colors">
                        📤 Subir Fotos
                      </button>
                    </div>
                  </div>

                  {/* Videos */}
                  <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
                    <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full mb-4 mx-auto">
                      <span className="text-white text-2xl">🎥</span>
                    </div>
                    <h3 className="text-lg font-bold text-zionx-primary mb-2 text-center">Videos</h3>
                    <p className="text-sm text-zionx-accent mb-4">Contenido audiovisual</p>
                    <div className="space-y-2">
                      <button className="w-full bg-zionx-secondary text-zionx-primary px-3 py-2 rounded text-sm hover:bg-zionx-accent hover:text-white transition-colors">
                        📥 Ver Videos
                      </button>
                      <button className="w-full bg-zionx-highlight text-white px-3 py-2 rounded text-sm hover:bg-zionx-accent transition-colors">
                        📤 Subir Video
                      </button>
                    </div>
                  </div>

                  {/* Graphics */}
                  <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
                    <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-full mb-4 mx-auto">
                      <span className="text-white text-2xl">🎨</span>
                    </div>
                    <h3 className="text-lg font-bold text-zionx-primary mb-2 text-center">Gráficos</h3>
                    <p className="text-sm text-zionx-accent mb-4">Elementos visuales y diseños</p>
                    <div className="space-y-2">
                      <button className="w-full bg-zionx-secondary text-zionx-primary px-3 py-2 rounded text-sm hover:bg-zionx-accent hover:text-white transition-colors">
                        📥 Ver Diseños
                      </button>
                      <button className="w-full bg-zionx-highlight text-white px-3 py-2 rounded text-sm hover:bg-zionx-accent transition-colors">
                        📤 Subir Diseño
                      </button>
                    </div>
                  </div>
                </div>

                {/* Recent Files */}
                <div className="mt-8">
                  <h3 className="text-lg font-bold text-zionx-primary mb-4">📂 Archivos Recientes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }, (_, i) => (
                      <div key={i} className="bg-white rounded-lg p-4 border border-zionx-secondary hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-2xl">📄</span>
                            <div>
                              <p className="font-medium text-zionx-primary">Manual_Branding_v2.pdf</p>
                              <p className="text-xs text-zionx-accent">2.5 MB • Actualizado hace 3 días</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button className="flex-1 bg-zionx-secondary text-zionx-primary px-2 py-1 rounded text-xs hover:bg-zionx-accent hover:text-white transition-colors">
                            📥 Descargar
                          </button>
                          <button className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 transition-colors">
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Designs Tab */}
          {activeTab === 'designs' && (
            <div className="space-y-6">
              <div className="bg-zionx-tertiary rounded-xl p-6 border border-zionx-secondary">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-zionx-primary">🎯 Artes Listos</h2>
                  <button
                    onClick={() => { setUploadCategory('designs'); setShowUploadModal(true); }}
                    className="bg-gradient-to-r from-zionx-accent to-zionx-primary text-white px-4 py-2 rounded-lg hover:from-zionx-primary hover:to-zionx-accent transition-all"
                  >
                    📤 Subir Diseño
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {designFiles.map((file) => (
                    <div key={file.id} className="bg-white rounded-lg p-4 border border-zionx-secondary hover:shadow-lg transition-shadow">
                      <div className="aspect-square bg-zionx-secondary rounded-lg mb-3 flex items-center justify-center">
                        <span className="text-3xl">🎯</span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-zionx-accent bg-zionx-secondary px-2 py-1 rounded">
                          {file.type}
                        </span>
                        <span className="text-xs text-zionx-accent">{file.size}</span>
                      </div>
                      <h4 className="font-semibold text-zionx-primary mb-2 truncate">{file.name}</h4>
                      <p className="text-sm text-zionx-accent mb-3">Subido: {file.uploaded_at}</p>
                      <div className="flex space-x-2">
                        <button className="flex-1 bg-zionx-highlight text-white px-3 py-1 rounded text-sm hover:bg-zionx-accent transition-colors">
                          📥 Descargar
                        </button>
                        <button className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors">
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {designFiles.length === 0 && (
                    <div className="col-span-full text-center py-12 text-zionx-accent">
                      <span className="text-4xl block mb-4">🎯</span>
                      <p>No hay diseños listos subidos</p>
                      <p className="text-sm">Sube artes finalizados para redes sociales y web</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Account Statement Tab */}
          {activeTab === 'statement' && (
            <div className="space-y-6">
              <div className="bg-zionx-tertiary rounded-xl p-6 border border-zionx-secondary">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-zionx-primary">💰 Estado de Cuenta</h2>
                  <div className="flex space-x-3">
                    <button className="bg-gradient-to-r from-zionx-accent to-zionx-primary text-white px-4 py-2 rounded-lg hover:from-zionx-primary hover:to-zionx-accent transition-all">
                      ➕ Nueva Cotización
                    </button>
                    <button className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors">
                      💳 Registrar Pago
                    </button>
                  </div>
                </div>

                {/* Account Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <div className="bg-white rounded-xl p-6 border border-zionx-secondary text-center">
                    <div className="text-2xl font-bold text-zionx-primary mb-1">$15,000</div>
                    <div className="text-sm text-zionx-accent">Saldo Pendiente</div>
                  </div>
                  <div className="bg-white rounded-xl p-6 border border-zionx-secondary text-center">
                    <div className="text-2xl font-bold text-green-600 mb-1">$8,500</div>
                    <div className="text-sm text-zionx-accent">Pagado este mes</div>
                  </div>
                  <div className="bg-white rounded-xl p-6 border border-zionx-secondary text-center">
                    <div className="text-2xl font-bold text-blue-600 mb-1">$23,500</div>
                    <div className="text-sm text-zionx-accent">Facturado Total</div>
                  </div>
                  <div className="bg-white rounded-xl p-6 border border-zionx-secondary text-center">
                    <div className="text-2xl font-bold text-orange-600 mb-1">12</div>
                    <div className="text-sm text-zionx-accent">Días de Crédito</div>
                  </div>
                </div>

                {/* Recent Quotes */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
                    <h3 className="text-lg font-bold text-zionx-primary mb-4">📋 Cotizaciones Recientes</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-zionx-tertiary rounded-lg">
                        <div>
                          <p className="font-medium text-zionx-primary">Campaña Redes Sociales</p>
                          <p className="text-sm text-zionx-accent">Octubre 2025 • 30 posts</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">$12,000</p>
                          <p className="text-xs text-zionx-accent">Pendiente</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-zionx-tertiary rounded-lg">
                        <div>
                          <p className="font-medium text-zionx-primary">Diseño Branding</p>
                          <p className="text-sm text-zionx-accent">Septiembre 2025</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">$8,000</p>
                          <p className="text-xs text-green-600">Aprobada</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-zionx-tertiary rounded-lg">
                        <div>
                          <p className="font-medium text-zionx-primary">Mantenimiento Web</p>
                          <p className="text-sm text-zionx-accent">Trimestral</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">$3,500</p>
                          <p className="text-xs text-green-600">Pagada</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
                    <h3 className="text-lg font-bold text-zionx-primary mb-4">💳 Historial de Pagos</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                        <div>
                          <p className="font-medium text-zionx-primary">Campaña Redes Sociales</p>
                          <p className="text-sm text-zionx-accent">Factura #001 • 15 Oct 2025</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">-$12,000</p>
                          <p className="text-xs text-green-600">Completado</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div>
                          <p className="font-medium text-zionx-primary">Diseño Branding</p>
                          <p className="text-sm text-zionx-accent">Factura #002 • 01 Oct 2025</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-blue-600">-$8,000</p>
                          <p className="text-xs text-blue-600">Pendiente</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                        <div>
                          <p className="font-medium text-zionx-primary">Mantenimiento Web</p>
                          <p className="text-sm text-zionx-accent">Factura #003 • 15 Sep 2025</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">-$3,500</p>
                          <p className="text-xs text-green-600">Completado</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Terms */}
                <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
                  <h3 className="text-lg font-bold text-zionx-primary mb-4">📋 Términos de Pago</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-zionx-primary">30</div>
                      <div className="text-sm text-zionx-accent">Días de Crédito</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-zionx-primary">Neto 30</div>
                      <div className="text-sm text-zionx-accent">Condiciones de Pago</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-zionx-primary">2%</div>
                      <div className="text-sm text-zionx-accent">Descuento Pronto Pago</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-zionx-tertiary rounded-xl p-6 border border-zionx-secondary">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-zionx-primary">⚙️ Configuración del Cliente</h2>
                  <button className="bg-gradient-to-r from-zionx-accent to-zionx-primary text-white px-4 py-2 rounded-lg hover:from-zionx-primary hover:to-zionx-accent transition-all">
                    💾 Guardar Cambios
                  </button>
                </div>

                {/* Customer Settings */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Basic Information */}
                  <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
                    <h3 className="text-lg font-bold text-zionx-primary mb-4">📋 Información Básica</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-zionx-primary mb-1">Razón Social</label>
                        <input
                          type="text"
                          className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                          defaultValue="GRUPO STELLA SAPI DE CV"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zionx-primary mb-1">Nombre Comercial</label>
                        <input
                          type="text"
                          className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                          defaultValue="STELLA"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zionx-primary mb-1">RFC</label>
                        <input
                          type="text"
                          className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                          defaultValue="RHC110912RD2"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zionx-primary mb-1">Giro</label>
                        <select className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none">
                          <option>Retail</option>
                          <option>Servicios</option>
                          <option>Manufactura</option>
                          <option>Tecnología</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
                    <h3 className="text-lg font-bold text-zionx-primary mb-4">👤 Información de Contacto</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-zionx-primary mb-1">Nombre del Contacto</label>
                        <input
                          type="text"
                          className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                          defaultValue="TIGER NAVA"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zionx-primary mb-1">Puesto</label>
                        <input
                          type="text"
                          className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                          defaultValue="DUEÑO"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zionx-primary mb-1">Email</label>
                        <input
                          type="email"
                          className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                          defaultValue="juanjobarroeta@live.com.mx"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zionx-primary mb-1">Teléfono</label>
                        <input
                          type="tel"
                          className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                          defaultValue="+522225887392"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Business Information */}
                  <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
                    <h3 className="text-lg font-bold text-zionx-primary mb-4">🏢 Información Empresarial</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-zionx-primary mb-1">Tamaño de Empresa</label>
                        <select className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none">
                          <option selected>Mediana</option>
                          <option>Pequeña</option>
                          <option>Grande</option>
                          <option>Corporativo</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zionx-primary mb-1">Número de Empleados</label>
                        <input
                          type="number"
                          className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                          defaultValue="200"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zionx-primary mb-1">Presupuesto Marketing Anual</label>
                        <input
                          type="text"
                          className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                          defaultValue="$1,000,000"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zionx-primary mb-1">Sitio Web</label>
                        <input
                          type="url"
                          className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                          defaultValue="https://hcspeople.com/"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Marketing Information */}
                  <div className="bg-white rounded-xl p-6 border border-zionx-secondary">
                    <h3 className="text-lg font-bold text-zionx-primary mb-4">📈 Información de Marketing</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-zionx-primary mb-1">Mercado Objetivo</label>
                        <input
                          type="text"
                          className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                          defaultValue="X"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zionx-primary mb-1">Canales Actuales</label>
                        <input
                          type="text"
                          className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                          defaultValue="X"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zionx-primary mb-1">Notas Adicionales</label>
                        <textarea
                          rows="3"
                          className="w-full border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none resize-none"
                          placeholder="Notas adicionales sobre el cliente..."
                        ></textarea>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Settings Actions */}
                <div className="mt-8 pt-6 border-t border-zionx-secondary">
                  <div className="flex justify-between items-center">
                    <div className="flex space-x-4">
                      <button className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">
                        🗑️ Eliminar Cliente
                      </button>
                      <button className="bg-zionx-secondary text-zionx-primary px-4 py-2 rounded-lg hover:bg-zionx-accent hover:text-white transition-colors">
                        📋 Duplicar Cliente
                      </button>
                    </div>
                    <div className="flex space-x-3">
                      <button className="bg-zionx-secondary text-zionx-primary px-4 py-2 rounded-lg hover:bg-zionx-accent hover:text-white transition-colors">
                        Cancelar
                      </button>
                      <button className="bg-gradient-to-r from-zionx-accent to-zionx-primary text-white px-4 py-2 rounded-lg hover:from-zionx-primary hover:to-zionx-accent transition-all">
                        💾 Guardar Cambios
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reportes' && (
            <div className="space-y-6">
              <div className="bg-zionx-tertiary rounded-xl p-6 border border-zionx-secondary">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-zionx-primary">📊 Reportes Mensuales</h2>
                  <button
                    onClick={() => { setUploadCategory('reportes'); setShowUploadModal(true); }}
                    className="bg-gradient-to-r from-zionx-accent to-zionx-primary text-white px-4 py-2 rounded-lg hover:from-zionx-primary hover:to-zionx-accent transition-all"
                  >
                    📤 Subir Reporte
                  </button>
                </div>
                
                <div className="space-y-4">
                  {reports.map((report) => (
                    <div key={report.id} className="bg-white rounded-lg p-6 border border-zionx-secondary hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">📊</span>
                          <div>
                            <h4 className="font-semibold text-zionx-primary">{report.name}</h4>
                            <p className="text-sm text-zionx-accent">Período: {report.period}</p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button className="bg-zionx-highlight text-white px-3 py-1 rounded text-sm hover:bg-zionx-accent transition-colors">
                            📥 Descargar
                          </button>
                          <button className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors">
                            🗑️
                          </button>
                        </div>
                      </div>
                      
                      {report.metrics && (
                        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-zionx-secondary">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-zionx-primary">{report.metrics.reach?.toLocaleString()}</p>
                            <p className="text-xs text-zionx-accent">Alcance</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-zionx-primary">{report.metrics.engagement}%</p>
                            <p className="text-xs text-zionx-accent">Engagement</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-zionx-primary">{report.metrics.clicks}</p>
                            <p className="text-xs text-zionx-accent">Clics</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {reports.length === 0 && (
                    <div className="text-center py-12 text-zionx-accent">
                      <span className="text-4xl block mb-4">📊</span>
                      <p>No hay reportes disponibles</p>
                      <p className="text-sm">Los reportes mensuales aparecerán aquí</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat Modal */}
        {showChatModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl w-full max-w-2xl h-[600px] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-zionx-secondary">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-zionx-accent to-zionx-primary rounded-full flex items-center justify-center text-white font-bold">
                    {customer.commercial_name?.charAt(0) || customer.business_name?.charAt(0) || 'C'}
                  </div>
                  <div>
                    <h3 className="font-bold text-zionx-primary">{customer.commercial_name || customer.business_name}</h3>
                    <p className="text-sm text-zionx-accent">Comunicación con cliente</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowChatModal(false)}
                  className="text-zionx-accent hover:text-zionx-primary"
                >
                  ✕
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-4 overflow-y-auto bg-zionx-tertiary">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-zionx-secondary rounded-full flex items-center justify-center text-xs font-bold text-zionx-primary">
                      Z
                    </div>
                    <div className="bg-white rounded-lg p-3 max-w-xs">
                      <p className="text-sm text-zionx-primary">¡Hola! ¿Cómo podemos ayudarte con tu campaña?</p>
                      <p className="text-xs text-zionx-accent mt-1">2 min ago</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 justify-end">
                    <div className="bg-zionx-highlight text-white rounded-lg p-3 max-w-xs">
                      <p className="text-sm">Perfecto, estamos emocionados por trabajar juntos.</p>
                      <p className="text-xs opacity-70 mt-1">1 min ago</p>
                    </div>
                    <div className="w-8 h-8 bg-gradient-to-br from-zionx-accent to-zionx-primary rounded-full flex items-center justify-center text-xs font-bold text-white">
                      {customer.commercial_name?.charAt(0) || 'C'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-zionx-secondary">
                <div className="flex space-x-3">
                  <input
                    type="text"
                    placeholder="Escribe un mensaje..."
                    className="flex-1 border border-zionx-secondary rounded-lg px-3 py-2 focus:border-zionx-highlight focus:outline-none"
                  />
                  <button className="bg-gradient-to-r from-zionx-accent to-zionx-primary text-white px-4 py-2 rounded-lg hover:from-zionx-primary hover:to-zionx-accent transition-all">
                    📤 Enviar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-zionx-primary">
                  Subir {fileCategories[uploadCategory]?.title}
                </h3>
                <button
                  onClick={() => { setShowUploadModal(false); setSelectedFiles([]); }}
                  className="text-zionx-accent hover:text-zionx-primary"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-zionx-accent">{fileCategories[uploadCategory]?.description}</p>
                <p className="text-xs text-zionx-accent mt-1">
                  Formatos: {fileCategories[uploadCategory]?.acceptedTypes}
                </p>
              </div>

              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive ? 'border-zionx-highlight bg-zionx-highlight/10' : 'border-zionx-secondary hover:border-zionx-accent'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  multiple
                  accept={fileCategories[uploadCategory]?.acceptedTypes}
                  onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-4xl block mb-4">{fileCategories[uploadCategory]?.icon}</span>
                  <p className="text-zionx-primary font-medium">
                    Arrastra archivos aquí o haz clic para seleccionar
                  </p>
                  <p className="text-sm text-zionx-accent mt-2">
                    Máximo 10 archivos, 50MB cada uno
                  </p>
                </label>
              </div>

              {selectedFiles.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-zionx-primary mb-2">Archivos seleccionados:</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-zionx-tertiary p-2 rounded">
                        <span className="text-sm text-zionx-primary truncate">{file.name}</span>
                        <span className="text-xs text-zionx-accent">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex space-x-3 mt-4">
                    <button
                      onClick={() => setSelectedFiles([])}
                      className="flex-1 bg-zionx-secondary text-zionx-primary px-4 py-2 rounded-lg hover:bg-zionx-accent hover:text-white transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleFileUpload(selectedFiles, uploadCategory)}
                      disabled={uploadingFiles[uploadCategory]}
                      className="flex-1 bg-gradient-to-r from-zionx-accent to-zionx-primary text-white px-4 py-2 rounded-lg hover:from-zionx-primary hover:to-zionx-accent transition-all disabled:opacity-50"
                    >
                      {uploadingFiles[uploadCategory] ? 'Subiendo...' : 'Subir Archivos'}
                    </button>
                  </div>
                  
                  {uploadProgress[uploadCategory] > 0 && (
                    <div className="mt-3">
                      <div className="bg-zionx-secondary rounded-full h-2">
                        <div 
                          className="bg-zionx-highlight h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress[uploadCategory]}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-zionx-accent text-center mt-1">
                        {uploadProgress[uploadCategory]}% completado
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CustomerProfile;
