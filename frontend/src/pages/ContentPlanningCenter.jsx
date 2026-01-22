import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const ContentPlanningCenter = () => {
  const [view, setView] = useState('calendar'); // calendar, list, kanban
  const [posts, setPosts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [customerFilter, setCustomerFilter] = useState('all');
  const [selectedPost, setSelectedPost] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingTasks, setExistingTasks] = useState([]);
  
  // New post form state
  const [newPost, setNewPost] = useState({
    customer_id: '',
    campaign: '',
    scheduled_date: '',
    platform: 'instagram',
    pilar: '',
    formato: 'post',
    idea_tema: '',
    referencia: '',
    copy_in: '',
    copy_out: '',
    assigned_designer: '',
    assigned_cm: ''
  });
  
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // File upload states
  const [arteFile, setArteFile] = useState(null);
  const [elementosFiles, setElementosFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  // Fetch existing tasks when a post is selected
  useEffect(() => {
    const fetchExistingTasks = async () => {
      if (selectedPost && selectedPost.customer_id && selectedPost.post_number) {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(
            `${API_BASE_URL}/tasks/by-post/${selectedPost.customer_id}/${selectedPost.post_number}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setExistingTasks(response.data || []);
        } catch (error) {
          console.error('Error fetching existing tasks:', error);
          setExistingTasks([]);
        }
      } else {
        setExistingTasks([]);
      }
    };
    
    fetchExistingTasks();
  }, [selectedPost]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [customersRes, teamRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/customers`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/team-members`, { headers }).catch(() => ({ data: { team_members: [] } }))
      ]);

      setCustomers(customersRes.data || []);
      setTeamMembers(teamRes.data.team_members || []);

      // Fetch actual posts from database
      const allPosts = [];
      for (const customer of customersRes.data || []) {
        try {
          const postsRes = await axios.get(
            `${API_BASE_URL}/customers/${customer.id}/content-calendar/${selectedMonth}`,
            { headers }
          );
          
          // Map posts with customer name
          const customerPosts = (postsRes.data || []).map(post => ({
            ...post,
            customer_name: customer.business_name || customer.commercial_name,
            platform: post.platform || 'instagram' // Default if not set
          }));
          
          allPosts.push(...customerPosts);
        } catch (error) {
          console.error(`Error fetching posts for customer ${customer.id}:`, error);
        }
      }

      console.log('Loaded posts from database:', allPosts);
      console.log('Total posts loaded:', allPosts.length);
      allPosts.forEach(post => {
        console.log(`Post: ${post.campaign} - Date: ${post.scheduled_date} - Customer: ${post.customer_name}`);
      });
      setPosts(allPosts);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (dateString) => {
    const [year, month] = dateString.split('-');
    return new Date(year, month, 0).getDate();
  };

  const getMonthStart = (dateString) => {
    const [year, month] = dateString.split('-');
    return new Date(year, month - 1, 1).getDay();
  };

  const platformConfig = {
    instagram: { color: 'bg-purple-100 text-purple-700 border-purple-200', icon: '📷' },
    facebook: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: '📘' },
    tiktok: { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: '🎵' }
  };

  const statusConfig = {
    planificado: { color: 'bg-gray-100 text-gray-700', label: 'Planificado' },
    en_diseño: { color: 'bg-yellow-100 text-yellow-700', label: 'En Diseño' },
    revision: { color: 'bg-orange-100 text-orange-700', label: 'En Revisión' },
    aprobado: { color: 'bg-green-100 text-green-700', label: 'Aprobado' },
    publicado: { color: 'bg-blue-100 text-blue-700', label: 'Publicado' }
  };

  const filteredPosts = posts.filter(post => 
    customerFilter === 'all' || post.customer_id == customerFilter
  );

  const getPostsForDate = (day) => {
    const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
    const postsForDay = filteredPosts.filter(post => {
      // Handle both date formats: YYYY-MM-DD and YYYY-MM-DDTHH:MM:SS
      const postDate = post.scheduled_date?.split('T')[0];
      return postDate === dateStr;
    });
    
    if (postsForDay.length > 0) {
      console.log(`Posts for ${dateStr}:`, postsForDay);
    }
    
    return postsForDay;
  };

  const renderCalendarView = () => {
    const daysInMonth = getDaysInMonth(selectedMonth);
    const monthStart = getMonthStart(selectedMonth);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < monthStart; i++) {
      days.push(<div key={`empty-${i}`} className="h-32 bg-gray-50"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayPosts = getPostsForDate(day);
      const isToday = day === new Date().getDate() && 
                     selectedMonth === new Date().toISOString().slice(0, 7);

      days.push(
        <div
          key={day}
          className={`h-32 border border-gray-200 p-2 hover:bg-gray-50 transition-colors ${
            isToday ? 'bg-blue-50 border-blue-300' : 'bg-white'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
              {day}
            </span>
            {dayPosts.length > 0 && (
              <span className="text-xs bg-black text-white px-2 py-0.5 rounded-full">
                {dayPosts.length}
              </span>
            )}
          </div>
          
          <div className="space-y-1 overflow-y-auto max-h-20">
            {dayPosts.map(post => (
              <button
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className={`w-full text-left p-1.5 rounded text-xs ${platformConfig[post.platform]?.color} border hover:shadow-sm transition-all`}
              >
                <div className="flex items-center space-x-1">
                  <span>{platformConfig[post.platform]?.icon}</span>
                  <span className="truncate font-medium">{post.campaign}</span>
                </div>
                <p className="text-xs opacity-75 truncate">{post.customer_name}</p>
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-7 gap-0">
        {/* Day headers */}
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
          <div key={day} className="bg-gray-100 border border-gray-200 px-3 py-2 text-center text-sm font-medium text-gray-700">
            {day}
          </div>
        ))}
        {days}
      </div>
    );
  };

  const renderListView = () => {
    return (
      <div className="space-y-3">
        {filteredPosts.map(post => (
          <div
            key={post.id}
            onClick={() => setSelectedPost(post)}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg hover:border-black transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{platformConfig[post.platform]?.icon}</span>
                  <div>
                    <h3 className="font-semibold text-black">{post.campaign}</h3>
                    <p className="text-sm text-gray-500">{post.customer_name} • Post #{post.post_number}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig[post.status]?.color}`}>
                  {statusConfig[post.status]?.label}
                </span>
                <span className="text-sm text-gray-600">{post.scheduled_date}</span>
                <div className="flex items-center space-x-2">
                  {post.assigned_designer && (
                    <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white text-xs">
                      {teamMembers.find(t => t.id == post.assigned_designer)?.name?.charAt(0) || 'D'}
                    </div>
                  )}
                  {post.assigned_cm && (
                    <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white text-xs">
                      {teamMembers.find(t => t.id == post.assigned_cm)?.name?.charAt(0) || 'C'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-black"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-black">Calendario de Contenido</h1>
              <p className="text-gray-500 text-sm mt-1">Planificación centralizada de contenido para todos los clientes</p>
            </div>
            <div className="flex items-center space-x-3">
              {/* View Switcher */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setView('calendar')}
                  className={`px-4 py-2 rounded-md text-sm transition-colors ${
                    view === 'calendar' ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:text-black'
                  }`}
                >
                  📅 Calendario
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`px-4 py-2 rounded-md text-sm transition-colors ${
                    view === 'list' ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:text-black'
                  }`}
                >
                  📋 Lista
                </button>
              </div>

              <button 
                onClick={() => {
                  setShowCreateModal(true);
                  setCustomerSearch('');
                  setNewPost({
                    customer_id: '',
                    campaign: '',
                    scheduled_date: '',
                    platform: 'instagram',
                    pilar: '',
                    formato: 'post',
                    idea_tema: ''
                  });
                }}
                className="bg-black hover:bg-gray-800 text-white px-6 py-2 rounded-lg transition-colors font-medium"
              >
                ➕ Nuevo Post
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-8 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              <option value="all">Todos los Clientes</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.business_name || customer.commercial_name}
                </option>
              ))}
            </select>

            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            />

            <div className="flex-1"></div>

            <div className="text-sm text-gray-600">
              {filteredPosts.length} posts programados
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {view === 'calendar' && renderCalendarView()}
          {view === 'list' && renderListView()}

          {filteredPosts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No hay posts programados para este periodo</p>
              <button className="mt-4 text-black hover:underline text-sm">
                ➕ Crear primer post
              </button>
            </div>
          )}
        </div>

        {/* Create Post Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
              {/* Fixed Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-lg font-semibold text-black">Crear Nuevo Post</h2>
                  <p className="text-xs text-gray-500">Planifica contenido para redes sociales</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-black text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto flex-1 p-6 space-y-4">
                {/* Customer Selection with Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerDropdown(true);
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      placeholder="🔍 Buscar cliente..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                    
                    {/* Dropdown Results */}
                    {showCustomerDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {customers
                          .filter(c => 
                            (c.business_name?.toLowerCase().includes(customerSearch.toLowerCase())) ||
                            (c.commercial_name?.toLowerCase().includes(customerSearch.toLowerCase()))
                          )
                          .map(customer => (
                            <button
                              key={customer.id}
                              onClick={() => {
                                // Auto-populate team from customer defaults
                                setNewPost({
                                  ...newPost, 
                                  customer_id: customer.id,
                                  assigned_designer: customer.default_designer || '',
                                  assigned_cm: customer.default_community_manager || ''
                                });
                                setCustomerSearch(customer.business_name || customer.commercial_name);
                                setShowCustomerDropdown(false);
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                            >
                              <p className="font-medium text-black text-sm">
                                {customer.business_name || customer.commercial_name}
                              </p>
                              {customer.commercial_name && customer.business_name !== customer.commercial_name && (
                                <p className="text-xs text-gray-500">Comercial: {customer.commercial_name}</p>
                              )}
                            </button>
                          ))
                        }
                        {customers.filter(c => 
                          (c.business_name?.toLowerCase().includes(customerSearch.toLowerCase())) ||
                          (c.commercial_name?.toLowerCase().includes(customerSearch.toLowerCase()))
                        ).length === 0 && (
                          <div className="px-4 py-3 text-sm text-gray-500">
                            No se encontraron clientes
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {newPost.customer_id && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Cliente seleccionado
                    </p>
                  )}
                </div>

                {/* Campaign & Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Campaña *</label>
                    <input
                      type="text"
                      value={newPost.campaign}
                      onChange={(e) => setNewPost({...newPost, campaign: e.target.value})}
                      placeholder="Ej: Promoción Verano"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Publicación *</label>
                    <input
                      type="date"
                      value={newPost.scheduled_date}
                      onChange={(e) => setNewPost({...newPost, scheduled_date: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                  </div>
                </div>

                {/* Platform */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Plataforma *</label>
                  <div className="flex space-x-3">
                    <button 
                      onClick={() => setNewPost({...newPost, platform: 'instagram'})}
                      className={`flex-1 rounded-lg px-4 py-3 transition-all ${
                        newPost.platform === 'instagram'
                          ? 'border-2 border-purple-500 bg-purple-50'
                          : 'border border-gray-300 hover:border-purple-500 hover:bg-purple-50'
                      }`}
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <span className="text-2xl">📷</span>
                        <span className="font-medium">Instagram</span>
                      </div>
                    </button>
                    <button 
                      onClick={() => setNewPost({...newPost, platform: 'facebook'})}
                      className={`flex-1 rounded-lg px-4 py-3 transition-all ${
                        newPost.platform === 'facebook'
                          ? 'border-2 border-blue-500 bg-blue-50'
                          : 'border border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <span className="text-2xl">📘</span>
                        <span className="font-medium">Facebook</span>
                      </div>
                    </button>
                    <button 
                      onClick={() => setNewPost({...newPost, platform: 'tiktok'})}
                      className={`flex-1 rounded-lg px-4 py-3 transition-all ${
                        newPost.platform === 'tiktok'
                          ? 'border-2 border-gray-600 bg-gray-50'
                          : 'border border-gray-300 hover:border-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <span className="text-2xl">🎵</span>
                        <span className="font-medium">TikTok</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Pilar & Formato */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pilar</label>
                    <input
                      type="text"
                      value={newPost.pilar}
                      onChange={(e) => setNewPost({...newPost, pilar: e.target.value})}
                      placeholder="Ej: Ventas, Producto, Educación"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Formato</label>
                    <select 
                      value={newPost.formato}
                      onChange={(e) => setNewPost({...newPost, formato: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                    >
                      <option value="post">Post</option>
                      <option value="reel">Reel</option>
                      <option value="story">Story</option>
                      <option value="carousel">Carousel</option>
                      <option value="video">Video</option>
                    </select>
                  </div>
                </div>

                {/* Idea/Tema */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Idea/Tema</label>
                  <textarea
                    rows="2"
                    value={newPost.idea_tema}
                    onChange={(e) => setNewPost({...newPost, idea_tema: e.target.value})}
                    placeholder="Describe la idea principal del contenido..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
                  ></textarea>
                </div>

                {/* Reference Link */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referencia (Inspiración)</label>
                  <input
                    type="url"
                    value={newPost.referencia}
                    onChange={(e) => setNewPost({...newPost, referencia: e.target.value})}
                    placeholder="https://instagram.com/p/ejemplo..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                  <p className="text-xs text-gray-500 mt-1">Link de posts similares o inspiración</p>
                </div>

                {/* Copy In & Copy Out */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Copy In</label>
                    <textarea
                      rows="2"
                      value={newPost.copy_in}
                      onChange={(e) => setNewPost({...newPost, copy_in: e.target.value})}
                      placeholder="Texto que aparece en la imagen/video..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Copy Out</label>
                    <textarea
                      rows="2"
                      value={newPost.copy_out}
                      onChange={(e) => setNewPost({...newPost, copy_out: e.target.value})}
                      placeholder="Caption o descripción del post..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
                    ></textarea>
                  </div>
                </div>

                {/* File Uploads */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Archivos</p>
                  
                  {/* ARTE Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ARTE (Imagen/Video Final)</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-gray-400 transition-colors">
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={(e) => setArteFile(e.target.files[0])}
                        className="hidden"
                        id="arte-upload"
                      />
                      <label htmlFor="arte-upload" className="cursor-pointer block text-center">
                        <div className="mb-2">
                          <span className="text-3xl">🎨</span>
                        </div>
                        {arteFile ? (
                          <div>
                            <p className="text-sm font-medium text-black">{arteFile.name}</p>
                            <p className="text-xs text-gray-500">{(arteFile.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm text-black font-medium">Subir ARTE</p>
                            <p className="text-xs text-gray-500">Imagen o video final para publicación</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Elementos Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Elementos a Utilizar</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-gray-400 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => setElementosFiles(Array.from(e.target.files))}
                        className="hidden"
                        id="elementos-upload"
                      />
                      <label htmlFor="elementos-upload" className="cursor-pointer block text-center">
                        <div className="mb-2">
                          <span className="text-3xl">📁</span>
                        </div>
                        {elementosFiles.length > 0 ? (
                          <div>
                            <p className="text-sm font-medium text-black">{elementosFiles.length} archivos seleccionados</p>
                            <div className="mt-2 space-y-1">
                              {elementosFiles.slice(0, 3).map((file, idx) => (
                                <p key={idx} className="text-xs text-gray-600 truncate">{file.name}</p>
                              ))}
                              {elementosFiles.length > 3 && (
                                <p className="text-xs text-gray-500">+{elementosFiles.length - 3} más</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm text-black font-medium">Subir Elementos</p>
                            <p className="text-xs text-gray-500">Logos, fotos, materiales de referencia</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Google Drive Link (Optional) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Carpeta Google Drive (opcional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/folder/..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                    <p className="text-xs text-gray-500 mt-1">Para archivos muy grandes o materiales adicionales</p>
                  </div>
                </div>

                {/* Team Assignment */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Diseñador</label>
                    <select 
                      value={newPost.assigned_designer}
                      onChange={(e) => setNewPost({...newPost, assigned_designer: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                    >
                      <option value="">Sin asignar</option>
                      {teamMembers.filter(t => t.role === 'designer' || t.role === 'UI/UX Designer').map(designer => (
                        <option key={designer.id} value={designer.id}>
                          {designer.name}
                        </option>
                      ))}
                    </select>
                    {newPost.assigned_designer && (
                      <p className="text-xs text-gray-500 mt-1">
                        {newPost.customer_id && customers.find(c => c.id == newPost.customer_id)?.default_designer == newPost.assigned_designer 
                          ? '⭐ Diseñador principal de este cliente' 
                          : 'Asignado manualmente'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Community Manager</label>
                    <select 
                      value={newPost.assigned_cm}
                      onChange={(e) => setNewPost({...newPost, assigned_cm: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                    >
                      <option value="">Sin asignar</option>
                      {teamMembers.filter(t => t.role === 'Project Manager' || t.role === 'Content Strategist' || t.role === 'community_manager').map(cm => (
                        <option key={cm.id} value={cm.id}>
                          {cm.name}
                        </option>
                      ))}
                    </select>
                    {newPost.assigned_cm && (
                      <p className="text-xs text-gray-500 mt-1">
                        {newPost.customer_id && customers.find(c => c.id == newPost.customer_id)?.default_community_manager == newPost.assigned_cm 
                          ? '⭐ CM principal de este cliente' 
                          : 'Asignado manualmente'}
                      </p>
                    )}
                  </div>
                </div>

              </div>

              {/* Fixed Footer with Actions */}
              <div className="bg-white border-t border-gray-200 px-6 py-4 flex space-x-3 flex-shrink-0">
                <button 
                  onClick={() => {
                    setShowCreateModal(false);
                    setCustomerSearch('');
                    setNewPost({
                      customer_id: '',
                      campaign: '',
                      scheduled_date: '',
                      platform: 'instagram',
                      pilar: '',
                      formato: 'post',
                      idea_tema: '',
                      referencia: '',
                      copy_in: '',
                      copy_out: '',
                      assigned_designer: '',
                      assigned_cm: ''
                    });
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-black px-4 py-3 rounded-lg transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button 
                    onClick={async () => {
                      try {
                        if (!newPost.customer_id || !newPost.campaign || !newPost.scheduled_date) {
                          alert('Por favor completa los campos requeridos (Cliente, Campaña, Fecha)');
                          return;
                        }

                        const token = localStorage.getItem('token');
                        
                        // Create post in database
                        const postData = {
                          customer_id: newPost.customer_id,
                          month_year: newPost.scheduled_date.slice(0, 7),
                          post_number: posts.length + 1,
                          campaign: newPost.campaign,
                          scheduled_date: newPost.scheduled_date,
                          platform: newPost.platform,
                          pilar: newPost.pilar,
                          content_type: newPost.formato,
                          idea_tema: newPost.idea_tema,
                          status: 'planificado',
                          referencia: newPost.referencia,
                          copy_in: newPost.copy_in,
                          copy_out: newPost.copy_out,
                          arte: '',
                          fotos_video: false,
                          elementos_utilizar: [],
                          assigned_designer: newPost.assigned_designer,
                          assigned_community_manager: newPost.assigned_cm
                        };

                        const response = await axios.post(`${API_BASE_URL}/content-calendar`, postData, {
                          headers: { Authorization: `Bearer ${token}` }
                        });

                        const createdPost = response.data.data;
                        
                        // Upload files if any
                        if (arteFile || elementosFiles.length > 0) {
                          setUploadingFiles(true);
                          
                          // Upload ARTE
                          if (arteFile) {
                            const arteFormData = new FormData();
                            arteFormData.append('files', arteFile);
                            arteFormData.append('fileType', 'arte');
                            
                            await axios.post(`${API_BASE_URL}/content/${createdPost.id}/upload`, arteFormData, {
                              headers: { 
                                Authorization: `Bearer ${token}`,
                                'Content-Type': 'multipart/form-data'
                              }
                            });
                          }
                          
                          // Upload Elementos
                          if (elementosFiles.length > 0) {
                            const elementosFormData = new FormData();
                            elementosFiles.forEach(file => {
                              elementosFormData.append('files', file);
                            });
                            elementosFormData.append('fileType', 'elementos');
                            
                            await axios.post(`${API_BASE_URL}/content/${createdPost.id}/upload`, elementosFormData, {
                              headers: { 
                                Authorization: `Bearer ${token}`,
                                'Content-Type': 'multipart/form-data'
                              }
                            });
                          }
                          
                          setUploadingFiles(false);
                        }

                        alert('✅ Post creado exitosamente!' + (arteFile || elementosFiles.length > 0 ? '\n📎 Archivos subidos' : ''));
                        setShowCreateModal(false);
                        setCustomerSearch('');
                        setArteFile(null);
                        setElementosFiles([]);
                        setNewPost({
                          customer_id: '',
                          campaign: '',
                          scheduled_date: '',
                          platform: 'instagram',
                          pilar: '',
                          formato: 'post',
                          idea_tema: '',
                          referencia: '',
                          copy_in: '',
                          copy_out: '',
                          assigned_designer: '',
                          assigned_cm: ''
                        });
                        
                        // Refresh posts
                        fetchData();
                      } catch (error) {
                        console.error('Error creating post:', error);
                        alert('Error creando el post. Por favor intenta de nuevo.');
                      }
                    }}
                    className="flex-1 bg-black hover:bg-gray-800 text-white px-4 py-3 rounded-lg transition-colors font-medium"
                    disabled={uploadingFiles}
                  >
                    {uploadingFiles ? '📤 Subiendo archivos...' : '✓ Crear Post'}
                  </button>
              </div>
            </div>
          </div>
        )}

        {/* Post Detail Modal */}
        {selectedPost && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
              {/* Fixed Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-lg font-semibold text-black">{selectedPost.campaign || 'Post sin título'}</h2>
                  <p className="text-xs text-gray-500">{selectedPost.customer_name} • Post #{selectedPost.post_number}</p>
                </div>
                <div className="flex items-center space-x-3">
                  {!isEditingPost && (
                    <button
                      onClick={() => setIsEditingPost(true)}
                      className="bg-gray-100 hover:bg-gray-200 text-black px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                    >
                      ✏️ Editar
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedPost(null);
                      setIsEditingPost(false);
                    }}
                    className="text-gray-400 hover:text-black text-2xl"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto flex-1 p-6 space-y-6">
                {/* Header Info Row */}
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Fecha de Publicación</p>
                    <p className="text-sm font-medium text-black">
                      {new Date(selectedPost.scheduled_date).toLocaleDateString('es-ES', { 
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Plataforma</p>
                    <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-lg ${platformConfig[selectedPost.platform || 'instagram']?.color} border`}>
                      <span>{platformConfig[selectedPost.platform || 'instagram']?.icon}</span>
                      <span className="text-sm font-medium capitalize">{selectedPost.platform || 'instagram'}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Estado</p>
                    <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${statusConfig[selectedPost.status]?.color}`}>
                      {statusConfig[selectedPost.status]?.label || selectedPost.status}
                    </span>
                  </div>
                </div>

                {/* Content Section */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  {selectedPost.pilar && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Pilar de Contenido</p>
                      <p className="text-sm text-black">{selectedPost.pilar}</p>
                    </div>
                  )}

                  {selectedPost.idea_tema && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Idea/Tema</p>
                      <p className="text-sm text-black whitespace-pre-wrap">{selectedPost.idea_tema}</p>
                    </div>
                  )}

                  {selectedPost.referencia && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Referencia (Inspiración)</p>
                      <a href={selectedPost.referencia} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">
                        {selectedPost.referencia}
                      </a>
                    </div>
                  )}
                </div>

                {/* Copy Section */}
                {(selectedPost.copy_in || selectedPost.copy_out) && (
                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Textos</p>
                    
                    {selectedPost.copy_in && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Copy In (Texto en el Post)</p>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <p className="text-sm text-black whitespace-pre-wrap">{selectedPost.copy_in}</p>
                        </div>
                      </div>
                    )}

                    {selectedPost.copy_out && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Copy Out (Caption)</p>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <p className="text-sm text-black whitespace-pre-wrap">{selectedPost.copy_out}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Files Section */}
                {(selectedPost.arte || selectedPost.elementos_utilizar) && (
                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Archivos</p>
                    
                    {selectedPost.arte && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">ARTE Final</p>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          {selectedPost.arte.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                            <img 
                              src={`http://localhost:5001${selectedPost.arte}`} 
                              alt="ARTE" 
                              className="max-w-full h-auto rounded"
                            />
                          ) : (
                            <a 
                              href={`http://localhost:5001${selectedPost.arte}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center space-x-2 text-blue-600 hover:underline"
                            >
                              <span>📎</span>
                              <span className="text-sm">{selectedPost.arte.split('/').pop()}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedPost.elementos_utilizar && selectedPost.elementos_utilizar.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Elementos Utilizados</p>
                        <div className="grid grid-cols-3 gap-2">
                          {(Array.isArray(selectedPost.elementos_utilizar) 
                            ? selectedPost.elementos_utilizar 
                            : JSON.parse(selectedPost.elementos_utilizar || '[]')
                          ).map((file, idx) => (
                            <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                              {file.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                <img 
                                  src={`http://localhost:5001${file}`} 
                                  alt={`Elemento ${idx + 1}`} 
                                  className="w-full h-24 object-cover rounded"
                                />
                              ) : (
                                <a 
                                  href={`http://localhost:5001${file}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="block text-center text-xs text-blue-600 hover:underline"
                                >
                                  📎 {file.split('/').pop()}
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Team Section */}
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Equipo Asignado</p>
                  <div className="flex space-x-6">
                    {selectedPost.assigned_designer && (
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center text-white font-bold">
                          {teamMembers.find(t => t.id == selectedPost.assigned_designer)?.name?.charAt(0) || 'D'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-black">
                            {teamMembers.find(t => t.id == selectedPost.assigned_designer)?.name || 'Diseñador'}
                          </p>
                          <p className="text-xs text-gray-500">Diseñador</p>
                        </div>
                      </div>
                    )}

                    {selectedPost.assigned_community_manager && (
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold">
                          {teamMembers.find(t => t.id == selectedPost.assigned_community_manager)?.name?.charAt(0) || 'C'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-black">
                            {teamMembers.find(t => t.id == selectedPost.assigned_community_manager)?.name || 'CM'}
                          </p>
                          <p className="text-xs text-gray-500">Community Manager</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Fixed Footer */}
              {!isEditingPost && (
                <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3 flex-shrink-0">
                  <button
                    onClick={() => {
                      setSelectedPost(null);
                      setIsEditingPost(false);
                    }}
                    className="bg-gray-100 hover:bg-gray-200 text-black px-6 py-2 rounded-lg transition-colors font-medium"
                  >
                    Cerrar
                  </button>
                  
                  {/* Show existing tasks info or generate button */}
                  {existingTasks.length > 0 ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg px-6 py-2 flex items-center space-x-2">
                      <span className="text-green-700 font-medium">✅ Tareas ya creadas ({existingTasks.length})</span>
                    </div>
                  ) : selectedPost.assigned_designer && selectedPost.assigned_community_manager ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-6 py-2">
                      <span className="text-blue-700 text-sm">💡 Las tareas se generarán automáticamente al asignar el equipo</span>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-6 py-2">
                      <span className="text-yellow-700 text-sm">⚠️ Asigna diseñador y CM para crear tareas</span>
                    </div>
                  )}
                  
                  {/* Manual task generation button - only show if needed */}
                  {existingTasks.length === 0 && selectedPost.assigned_designer && selectedPost.assigned_community_manager && (
                  <button 
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('token');
                        
                        // Generate tasks for designer and CM
                        const tasks = [];
                        
                        // First check if tasks already exist for this post
                        const existingTasksRes = await axios.get(
                          `${API_BASE_URL}/tasks/by-post/${selectedPost.customer_id}/${selectedPost.post_number}`,
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        
                        if (existingTasksRes.data && existingTasksRes.data.length > 0) {
                          alert('⚠️ Ya existen tareas para este post. Para evitar duplicados, elimina las tareas existentes primero.');
                          return;
                        }
                        
                        if (selectedPost.assigned_designer) {
                          tasks.push({
                            title: `Crear ARTE para ${selectedPost.campaign} #${selectedPost.post_number}`,
                            description: `Diseñar arte para ${selectedPost.content_type || 'post'} - ${selectedPost.idea_tema || 'contenido'}`,
                            assigned_to: selectedPost.assigned_designer,
                            customer_id: selectedPost.customer_id,
                            post_id: selectedPost.id,
                            post_number: selectedPost.post_number,
                            due_date: selectedPost.scheduled_date?.split('T')[0] || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                            task_type: 'design',
                            priority: 'medium',
                            required_files: ['arte'],
                            content_details: {
                              campaign: selectedPost.campaign,
                              format: selectedPost.content_type,
                              platform: selectedPost.platform,
                              idea_tema: selectedPost.idea_tema,
                              pilar: selectedPost.pilar,
                              referencia: selectedPost.referencia
                            }
                          });
                        }
                        
                        if (selectedPost.assigned_community_manager) {
                          tasks.push({
                            title: `Crear COPY para ${selectedPost.campaign} #${selectedPost.post_number}`,
                            description: `Escribir copy in/out para ${selectedPost.content_type || 'post'}`,
                            assigned_to: selectedPost.assigned_community_manager,
                            customer_id: selectedPost.customer_id,
                            post_id: selectedPost.id,
                            post_number: selectedPost.post_number,
                            due_date: selectedPost.scheduled_date?.split('T')[0] || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                            task_type: 'copywriting',
                            priority: 'medium',
                            required_files: ['copy_in', 'copy_out'],
                            content_details: {
                              campaign: selectedPost.campaign,
                              format: selectedPost.content_type,
                              platform: selectedPost.platform,
                              idea_tema: selectedPost.idea_tema,
                              pilar: selectedPost.pilar
                            }
                          });
                        }
                        
                        // Create tasks in backend
                        let createdCount = 0;
                        for (const task of tasks) {
                          try {
                            await axios.post(`${API_BASE_URL}/tasks`, task, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            createdCount++;
                          } catch (err) {
                            console.error('Error creating task:', err);
                          }
                        }
                        
                        if (createdCount > 0) {
                          const designerName = teamMembers.find(t => t.id == selectedPost.assigned_designer)?.name || 'Diseñador';
                          const cmName = teamMembers.find(t => t.id == selectedPost.assigned_community_manager)?.name || 'CM';
                          
                          alert(`✅ ${createdCount} tareas generadas!\n\n🎨 ${designerName}: Crear ARTE\n📝 ${cmName}: Escribir COPY\n\nLas tareas aparecerán en sus dashboards.`);
                          
                          setSelectedPost(null);
                          setIsEditingPost(false);
                        } else {
                          alert('No se pudieron crear las tareas. Verifica que el equipo esté asignado.');
                        }
                      } catch (error) {
                        console.error('Error generating tasks:', error);
                        alert('Error generando tareas');
                      }
                    }}
                    className="bg-black hover:bg-gray-800 text-white px-6 py-2 rounded-lg transition-colors font-medium"
                  >
                    🔄 Regenerar Tareas Manualmente
                  </button>
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

export default ContentPlanningCenter;

