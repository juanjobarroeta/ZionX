import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { InstagramPreview, FacebookPreview, TikTokPreview } from '../components/SocialPreviews';

const SocialHub = () => {
  const [posts, setPosts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); // all, scheduled, published, failed
  const [platformFilter, setPlatformFilter] = useState('all'); // all, instagram, facebook, tiktok
  const [customerFilter, setCustomerFilter] = useState('all'); // all, or customer id
  const [monthFilter, setMonthFilter] = useState('all'); // all, or YYYY-MM format
  const [selectedPost, setSelectedPost] = useState(null); // For preview modal

  useEffect(() => {
    fetchPublications();
  }, []);

  const fetchPublications = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch customers
      const customersRes = await axios.get(`${API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setCustomers(customersRes.data || []);

      // Fetch completed posts with arte from all customers
      const allPosts = [];
      
      for (const customer of customersRes.data || []) {
        try {
          // Get current month and previous/next months
          const currentDate = new Date();
          const months = [];
          for (let i = -1; i <= 1; i++) {
            const date = new Date(currentDate);
            date.setMonth(date.getMonth() + i);
            months.push(date.toISOString().slice(0, 7));
          }

          // Fetch posts for each month
          for (const month of months) {
            try {
              const response = await axios.get(
                `${API_BASE_URL}/customers/${customer.id}/content-calendar/${month}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );

              // Filter posts that have arte (completed)
              const completedPosts = (response.data || [])
                .filter(post => post.arte || (post.arte_files && post.arte_files.length > 0))
                .map(post => ({
                  id: post.id,
                  customer_id: customer.id,
                  customer: customer.business_name || customer.commercial_name || `Cliente ${customer.id}`,
                  campaign: post.campaign || 'Sin campaña',
                  platform: post.platform || 'instagram',
                  status: post.status || 'draft',
                  scheduled_date: post.scheduled_date,
                  published_date: post.published_date,
                  month: month,
                  image_url: post.arte ? `http://localhost:5001${post.arte}` : null,
                  arte_files: post.arte_files || [],
                  post_number: post.post_number,
                  copy_in: post.copy_in,
                  copy_out: post.copy_out
                }));

              allPosts.push(...completedPosts);
            } catch (err) {
              // Skip if month doesn't exist
              console.log(`No calendar for ${customer.id} in ${month}`);
            }
          }
        } catch (err) {
          console.error(`Error fetching posts for customer ${customer.id}:`, err);
        }
      }

      setPosts(allPosts);
    } catch (error) {
      console.error('Error fetching publications:', error);
    } finally {
      setLoading(false);
    }
  };

  const platformConfig = {
    instagram: { color: 'from-purple-500 to-pink-500', icon: '📷', name: 'Instagram' },
    facebook: { color: 'from-blue-500 to-blue-700', icon: '📘', name: 'Facebook' },
    tiktok: { color: 'from-black to-gray-800', icon: '🎵', name: 'TikTok' }
  };

  const statusConfig = {
    scheduled: { color: 'bg-blue-500', label: 'Programado', icon: '⏰' },
    published: { color: 'bg-green-500', label: 'Publicado', icon: '✅' },
    failed: { color: 'bg-red-500', label: 'Error', icon: '❌' },
    draft: { color: 'bg-gray-500', label: 'Borrador', icon: '📝' }
  };

  const filteredPosts = posts.filter(post => {
    if (activeFilter !== 'all' && post.status !== activeFilter) return false;
    if (platformFilter !== 'all' && post.platform !== platformFilter) return false;
    if (customerFilter !== 'all' && post.customer_id != customerFilter) return false;
    if (monthFilter !== 'all' && post.month !== monthFilter) return false;
    return true;
  });

  const stats = {
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    published: posts.filter(p => p.status === 'published').length,
    failed: posts.filter(p => p.status === 'failed').length,
    total: posts.length
  };

  return (
    <Layout>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-black">Hub de Publicaciones</h1>
              <p className="text-gray-500 text-sm mt-1">Gestión centralizada de contenido en redes sociales</p>
            </div>
            <button className="bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-lg transition-colors font-medium">
              ➕ Programar Post
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-8 py-6 border-b border-gray-200">
          {/* Customer & Month Filters */}
          <div className="flex space-x-3 mb-4">
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              <option value="all">Todos los Clientes</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.business_name || customer.commercial_name || `Cliente ${customer.id}`}
                </option>
              ))}
            </select>

            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              <option value="all">Todos los Meses</option>
              <option value="2025-10">Octubre 2025</option>
              <option value="2025-11">Noviembre 2025</option>
              <option value="2025-12">Diciembre 2025</option>
              <option value="2026-01">Enero 2026</option>
            </select>
          </div>

          {/* Platform Filters */}
          <div className="flex space-x-3">
            <button
              onClick={() => setPlatformFilter('all')}
              className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                platformFilter === 'all' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todas las Plataformas
            </button>
            <button
              onClick={() => setPlatformFilter('instagram')}
              className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center space-x-2 ${
                platformFilter === 'instagram' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>📷</span>
              <span>Instagram</span>
            </button>
            <button
              onClick={() => setPlatformFilter('facebook')}
              className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center space-x-2 ${
                platformFilter === 'facebook' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>📘</span>
              <span>Facebook</span>
            </button>
            <button
              onClick={() => setPlatformFilter('tiktok')}
              className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center space-x-2 ${
                platformFilter === 'tiktok' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>🎵</span>
              <span>TikTok</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="px-8 py-6">
          <div className="grid grid-cols-4 gap-6 mb-8">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Programadas</p>
                  <p className="text-3xl font-bold text-black">{stats.scheduled}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">⏰</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Publicadas</p>
                  <p className="text-3xl font-bold text-black">{stats.published}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Fallidas</p>
                  <p className="text-3xl font-bold text-black">{stats.failed}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">❌</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total</p>
                  <p className="text-3xl font-bold text-black">{stats.total}</p>
                </div>
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">📱</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status Filters */}
          <div className="flex space-x-3 mb-6">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                activeFilter === 'all' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setActiveFilter('scheduled')}
              className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                activeFilter === 'scheduled' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Programadas
            </button>
            <button
              onClick={() => setActiveFilter('published')}
              className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                activeFilter === 'published' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Publicadas
            </button>
            <button
              onClick={() => setActiveFilter('failed')}
              className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                activeFilter === 'failed' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Fallidas
            </button>
          </div>

          {/* 3-Column Grid (TikTok/Instagram style) */}
          <div className="grid grid-cols-3 gap-1">
            {filteredPosts.map(post => (
              <div 
                key={post.id} 
                onClick={() => setSelectedPost(post)}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="aspect-square bg-gray-100 flex items-center justify-center relative">
                  {post.image_url ? (
                    <img src={post.image_url} alt={post.campaign} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-6xl">📱</span>
                  )}
                  
                  {/* Platform Badge */}
                  <div className="absolute top-2 right-2 bg-white rounded-full p-2 shadow">
                    <span className="text-lg">{platformConfig[post.platform]?.icon}</span>
                  </div>

                  {/* Status Badge */}
                  <div className={`absolute bottom-2 left-2 ${statusConfig[post.status]?.color} text-white px-3 py-1 rounded-lg text-xs font-bold`}>
                    {statusConfig[post.status]?.icon} {statusConfig[post.status]?.label}
                  </div>
                </div>

                {/* Post Info */}
                <div className="p-3">
                  <p className="font-medium text-black text-sm truncate">{post.campaign}</p>
                  <p className="text-xs text-gray-500 truncate">{post.customer}</p>
                  {post.status === 'scheduled' && (
                    <p className="text-xs text-blue-600 mt-1">{post.scheduled_date}</p>
                  )}
                  {post.status === 'failed' && (
                    <p className="text-xs text-red-600 mt-1">{post.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredPosts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No hay publicaciones para mostrar</p>
              <p className="text-sm text-gray-400 mt-2">Crea contenido en la escaleta y genera tareas para ver publicaciones aquí</p>
            </div>
          )}
        </div>

        {/* Preview Modal */}
        {selectedPost && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedPost(null)}
          >
            <div 
              className="relative max-w-6xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedPost(null)}
                className="absolute -top-12 right-0 text-white hover:text-gray-300 text-3xl font-bold z-10"
              >
                ✕
              </button>

              {/* Platform Preview */}
              <div className="bg-gray-900 rounded-lg p-8">
                {selectedPost.platform === 'instagram' && <InstagramPreview post={selectedPost} />}
                {selectedPost.platform === 'facebook' && <FacebookPreview post={selectedPost} />}
                {selectedPost.platform === 'tiktok' && <TikTokPreview post={selectedPost} />}
                {!['instagram', 'facebook', 'tiktok'].includes(selectedPost.platform) && (
                  <div className="text-center text-white">
                    <p>Vista previa no disponible para esta plataforma</p>
                  </div>
                )}
              </div>

              {/* Post Actions */}
              <div className="mt-6 flex items-center justify-center space-x-4">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium">
                  📅 Reprogramar
                </button>
                <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors font-medium">
                  ✅ Publicar Ahora
                </button>
                <button className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors font-medium">
                  ✏️ Editar
                </button>
                <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors font-medium">
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SocialHub;

